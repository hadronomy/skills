import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Session } from "@opencode-ai/schema/session"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { Rpc } from "@opencode-ai/plugin/rpc"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { Cause, Effect, Exit, JsonSchema, Match, Schema } from "effect"

/**
 * Resume directive. Fork-local starts a fresh session and injects the brief.
 * Export-file writes transfer data for a cross-machine move.
 *
 * Defaults are decode-side: the RPC seam validates input by decoding, so
 * constructor-only defaults would never fire for callers.
 *
 * @category models
 * @since 0.1.0
 */
export const Resume = Schema.Union([
  Schema.Struct({
    mode: Schema.Literal("fork-local"),
    boundary: Schema.Union([
      Schema.Struct({ type: Schema.Literal("through") }),
      Schema.Struct({ type: Schema.Literal("before"), messageID: Schema.String }),
    ]).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed({ type: "through" } as const)),
    ),
    delivery: Schema.Literals(["steer", "queue"]).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed("steer" as const)),
    ),
    /**
     * Whether the new session runs the moment it receives the brief.
     *
     * Defaults to false. A handoff lands you in front of a session that is
     * waiting, which is where the model and agent pickers are, and which is
     * where you decide what happens next. Set true to hand work to a session
     * that starts without you.
     */
    start: Schema.Boolean.annotate({
      description:
        "Whether the new session runs at once. Leave false to land a person in a waiting session. Set true only when the work needs no further direction.",
    }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  }),
  Schema.Struct({
    mode: Schema.Literal("export-file"),
    directory: Schema.optional(Schema.String),
    sanitize: Schema.Boolean.pipe(
      Schema.withDecodingDefaultKey(Effect.succeed(true)),
    ),
  }),
])
export type ResumeType = Schema.Schema.Type<typeof Resume>

/**
 * Stash key. Branded so session IDs and stash keys never mix at the type
 * level; both travel as plain strings on the wire.
 *
 * @category models
 * @since 0.2.0
 */
export const Key = Schema.String.pipe(Schema.brand("Handoff.Key"))
export type Key = typeof Key.Type

/**
 * Prefix every stash key carries. Owned here because two sides read it: the
 * render stage writes the key, and a client reads the source session back
 * out of it.
 *
 * @category configuration
 * @since 0.6.0
 */
export const KeyPrefix = "handoff/"

/**
 * Builds the stash key for a source session.
 *
 * @category constructors
 * @since 0.6.0
 */
export const keyFor = (sessionID: string): Key => Key.make(`${KeyPrefix}${sessionID}`)

/**
 * Reads the source session back out of a stash key, or undefined when the
 * value is not one. This is how a client finds where a brief came from
 * without keeping a map of its own.
 *
 * **Example** (A key round-trips to the session that made it)
 *
 * ```ts import.meta.vitest
 * import { keyFor, sessionOfKey } from "./rpc.js"
 *
 * sessionOfKey(keyFor("ses_abc")) // => "ses_abc"
 * sessionOfKey("something/else") // => undefined
 * ```
 *
 * @category combinators
 * @since 0.6.0
 */
export const sessionOfKey = (key: string): string | undefined =>
  key.startsWith(KeyPrefix) ? key.slice(KeyPrefix.length) : undefined

/**
 * Artifact kind. Refs point at work items and files; they never paste
 * content.
 *
 * @category models
 * @since 0.2.0
 */
export const ArtifactKind = Schema.Literals(["spec", "plan", "adr", "issue", "commit", "file"])
export type ArtifactKind = typeof ArtifactKind.Type

/**
 * One referenced artifact: its kind plus a pointer (path, id, or hash).
 *
 * @category models
 * @since 0.2.0
 */
export const ArtifactRef = Schema.Struct({
  kind: ArtifactKind,
  ref: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
})
export interface ArtifactRef extends Schema.Schema.Type<typeof ArtifactRef> {}

/**
 * Maximum goal length, in characters. Owned here so the contract check and
 * the command builder share one bound instead of drifting apart.
 *
 * @category configuration
 * @since 0.2.0
 */
export const MaxGoalLength = 280

/**
 * Maximum refs per intent. Owned here for the same reason.
 *
 * @category configuration
 * @since 0.2.0
 */
export const MaxRefs = 8

/**
 * Structured intent. No free-text blob: the goal names the work, the
 * directive names the continuation, refs carry at most eight pointers.
 *
 * @category models
 * @since 0.1.0
 */
export const Intent = Schema.Struct({
  goal: Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(MaxGoalLength))),
  /**
   * Whether a person named the goal, rather than the plugin reading it off
   * the session. Defaults to true, because a caller that fills `goal` is
   * stating one. `/handoff` with no text sets it false, and the brief then
   * asks instead of acting on a guess.
   */
  stated: Schema.Boolean.annotate({
    description:
      "Whether a person named the goal. Set false when you inferred it, and the brief asks the next session what to do instead of acting on the guess.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  directive: Schema.Literals(["resume", "branch", "queue"]),
  refs: Schema.Array(ArtifactRef).pipe(Schema.check(Schema.isMaxLength(MaxRefs))),
  skills: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([] as Array<string>)),
  ),
  agent: Schema.optional(
    Agent.ID.annotate({
      description:
        "Agent id to run the new session. Omit to keep the agent the source session was using. Pick a different one when the next stretch of work suits it better, such as a review agent for a review.",
    }),
  ),
  model: Schema.optional(
    Model.Ref.annotate({
      description:
        "Model for the new session, as providerID and id. Omit to take the chosen agent's own model, or the source session's when no agent is named. Name one to move the work to a larger or a cheaper model.",
    }),
  ),
  resume: Resume.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({ mode: "fork-local" } as const)),
  ),
})
export interface Intent extends Schema.Schema.Type<typeof Intent> {}

/**
 * RPC input: the source session plus the intent. Omitting `resume` selects
 * fork-local with steer delivery, which is exactly what `/handoff` sends.
 *
 * **Example** (Omitting `resume` selects fork-local)
 *
 * ```ts import.meta.vitest
 * import { Schema } from "effect"
 * import { TransferInput } from "./rpc.js"
 *
 * const out = Schema.decodeUnknownSync(TransferInput)({
 *   sessionID: "ses_abc",
 *   intent: { goal: "audit", directive: "resume", refs: [] }
 * })
 *
 * out.intent.resume.mode // => "fork-local"
 * out.intent.resume.boundary // => { type: "through" }
 * out.intent.resume.delivery // => "steer"
 * out.intent.resume.start // => false
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const TransferInput = Schema.Struct({
  sessionID: Session.ID.pipe(Schema.check(Schema.isMinLength(1))),
  intent: Intent,
})
export interface TransferInput extends Schema.Schema.Type<typeof TransferInput> {}

/**
 * Fork-local pointer: the stash key plus the session preloaded with the
 * brief.
 *
 * @category models
 * @since 0.1.0
 */
export const ForkPointer = Schema.Struct({
  kind: Schema.Literal("fork-local"),
  key: Key,
  nextSessionID: Session.ID,
  messages: Schema.Finite,
})
export interface ForkPointer extends Schema.Schema.Type<typeof ForkPointer> {}

/**
 * Export-file pointer: the stash key plus the transfer file to move.
 *
 * @category models
 * @since 0.1.0
 */
export const FilePointer = Schema.Struct({
  kind: Schema.Literal("export-file"),
  key: Key,
  file: Schema.String,
  messages: Schema.Finite,
})
export interface FilePointer extends Schema.Schema.Type<typeof FilePointer> {}

/**
 * Pointer xor. One arm per resume mode, never optional-both.
 *
 * @category models
 * @since 0.1.0
 */
export const Pointer = Schema.Union([ForkPointer, FilePointer])
export type PointerType = Schema.Schema.Type<typeof Pointer>

// Event payloads stay `type`, never `interface`. The host types event data as
// `Readonly<Record<string, unknown>>`, and only a type alias picks up the
// implicit index signature that makes a struct assignable to it.

/**
 * A handoff landed in a fresh session. Carries what a client needs to follow
 * it: where it came from, where it went, and how much history travelled.
 *
 * @category models
 * @since 0.4.0
 */
export const Opened = Schema.Struct({
  key: Key,
  sessionID: Session.ID,
  nextSessionID: Session.ID,
  goal: Schema.String,
  messages: Schema.Finite,
})
export type Opened = Schema.Schema.Type<typeof Opened>

/**
 * A handoff stopped. Carries the source session and the sentence that says
 * why, so a watching client reports the same words every other surface does.
 *
 * @category models
 * @since 0.5.0
 */
export const Failed = Schema.Struct({
  sessionID: Session.ID,
  goal: Schema.String,
  message: Schema.String,
})
export type Failed = Schema.Schema.Type<typeof Failed>

/**
 * A handoff landed in a file for a cross-machine move. No session exists yet,
 * so the file is the only thing to act on.
 *
 * @category models
 * @since 0.4.0
 */
export const Exported = Schema.Struct({
  key: Key,
  sessionID: Session.ID,
  file: Schema.String,
  goal: Schema.String,
  messages: Schema.Finite,
})
export type Exported = Schema.Schema.Type<typeof Exported>

/**
 * Why the capture stage gave up. `empty` means the session held no history to
 * hand off, which no retry can change; `transport` means both reads failed
 * after the bounded retry.
 *
 * @category errors
 * @since 0.4.0
 */
export const CaptureReason = Schema.Literals(["empty", "transport"])
export type CaptureReason = typeof CaptureReason.Type

/**
 * Capture read failed or found nothing to hand off.
 *
 * @category errors
 * @since 0.1.0
 */
export class CaptureFailed extends Schema.TaggedError<CaptureFailed>()(
  "CaptureFailed",
  { op: Schema.Literal("capture"), reason: CaptureReason },
) {}

/**
 * Which render step failed. Each value names one host call, so a caller can
 * tell a refused session from a full disk without reading the plugin.
 *
 * @category errors
 * @since 0.4.0
 */
export const RenderReason = Schema.Literals(["encode", "stash", "create", "deliver", "write"])
export type RenderReason = typeof RenderReason.Type

/**
 * Stash, fresh session, brief delivery, or file write failed.
 *
 * @category errors
 * @since 0.1.0
 */
export class RenderFailed extends Schema.TaggedError<RenderFailed>()(
  "RenderFailed",
  { op: Schema.Literal("render"), reason: RenderReason },
) {}

/**
 * Brief metadata stored beside transfer data. The boundary already validated
 * every value; this shape proves the file serializes.
 *
 * @category models
 * @since 0.2.0
 */
export const HandoffMeta = Schema.Struct({
  key: Key,
  goal: Schema.String,
  directive: Schema.String,
  refs: Schema.Array(ArtifactRef),
  skills: Schema.Array(Schema.String),
  brief: Schema.String,
})
export interface HandoffMeta extends Schema.Schema.Type<typeof HandoffMeta> {}

/**
 * Export-file envelope. `info` plus `messages` keep the file importable;
 * `handoff` carries the brief metadata.
 *
 * @category models
 * @since 0.2.0
 */
export const Envelope = Schema.Struct({
  info: Session.Info,
  messages: Schema.Array(SessionMessage.Info),
  handoff: HandoffMeta,
})
export interface Envelope extends Schema.Schema.Type<typeof Envelope> {}

/**
 * Stash record. Stored encoded: decoded host values carry class instances
 * such as `DateTime`, which are not JSON, so the stash crosses the encode
 * boundary like the export envelope. Decode with this schema on read.
 *
 * @category models
 * @since 0.2.0
 */
export const Stash = Schema.Struct({
  key: Key,
  sessionID: Session.ID,
  intent: Intent,
  brief: Schema.String,
  messages: Schema.Array(SessionMessage.Info),
  info: Session.Info,
})
export interface Stash extends Schema.Schema.Type<typeof Stash> {}

/**
 * Validates in this copy. The adapter carries no Effect `TypeId`, so the
 * host skips its own decoder and runs `~standard.validate` here instead;
 * every check, brand, and decode default executes against the copy that
 * built the schema. Validation never throws: failures resolve to issues,
 * which the host reports as `invalid_input`.
 *
 * **Example** (Complete input validates, garbage resolves to issues)
 *
 * ```ts import.meta.vitest
 * import { TransferInputPortable } from "./rpc.js"
 *
 * const validate = TransferInputPortable["~standard"].validate
 * const good = await validate({
 *   sessionID: "ses_abc",
 *   intent: { goal: "audit", directive: "resume", refs: [] }
 * })
 * good.issues // => undefined
 * const bad = await validate({ sessionID: 42 })
 * bad.issues !== undefined // => true
 * ```
 *
 * @category combinators
 * @since 0.2.1
 */
export const portable = <S extends Schema.Codec<unknown, unknown, never, never>>(
  schema: S,
): StandardSchemaV1<S["Type"], S["Type"]> => ({
  "~standard": {
    version: 1,
    vendor: "@hadronomy/opencode-handoff-plugin",
    // Inference-only: never read at runtime.
    types: {} as StandardSchemaV1.Types<S["Type"], S["Type"]>,
    validate: (value: unknown) => {
      // Exits, not Effects: validation stays synchronous, and the try keeps
      // even defects (never expected same-copy) as issues. Nothing escapes
      // as a throw, so the host reports invalid_input, never a crash. The
      // encode-back returns the wire form: decode may build class instances
      // (thrown error data), which the host JSON codec rejects, while the
      // encoded form is plain JSON by construction. An unencodable value
      // fails closed as issues.
      try {
        const decoded = Schema.decodeUnknownExit(schema)(value)
        if (!Exit.isSuccess(decoded)) return { issues: [{ message: Cause.pretty(decoded.cause) }] }
        const wire = Schema.encodeUnknownExit(schema)(decoded.value)
        if (!Exit.isSuccess(wire)) return { issues: [{ message: Cause.pretty(wire.cause) }] }
        return { value: wire.value }
      } catch (cause) {
        return { issues: [{ message: cause instanceof Error ? cause.message : String(cause) }] }
      }
    },
  },
})

/**
 * Portable transfer input. Types stay symmetric: producers send complete
 * values, and decode defaults remain a backstop for foreign callers only.
 *
 * @category models
 * @since 0.2.1
 */
export const TransferInputPortable: StandardSchemaV1<TransferInput, TransferInput> = portable(TransferInput)

/**
 * Portable transfer pointer.
 *
 * @category models
 * @since 0.2.1
 */
export const PointerPortable: StandardSchemaV1<PointerType, PointerType> = portable(Pointer)

/**
 * Shared RPC contract: one method, the shapes above, the errors above, plus
 * the two events that announce a finished handoff. Published through the
 * `./rpc` export so callers — the TUI plugin included — import it without
 * loading the implementation. Every face travels as a `portable` adapter, never a
 * raw schema: the host decodes method schemas with its own Effect copy,
 * whose interpreter defects on foreign ASTs, so raw schemas fail every call
 * at the boundary instead of validating it.
 *
 * @category models
 * @since 0.1.0
 */
export const Handoff = Rpc.define({
  id: "handoff",
  methods: {
    transfer: {
      input: TransferInputPortable,
      output: PointerPortable,
      errors: {
        CaptureFailed: portable(CaptureFailed),
        RenderFailed: portable(RenderFailed),
      },
    },
  },
  events: {
    opened: { schema: portable(Opened) },
    exported: { schema: portable(Exported) },
    failed: { schema: portable(Failed) },
  },
})

/**
 * Renders a contract schema as self-contained JSON Schema.
 *
 * The tool seam needs this and the RPC seam does not. A tool definition is
 * shown to a model, so the host converts it to JSON Schema, and it refuses a
 * Standard Schema adapter whose vendor it does not know. Generating here, in
 * the copy that owns the schema, keeps that conversion off the host.
 *
 * `$defs` travels inline because the host receives one value, not a document.
 *
 * **Example** (Bounds survive the conversion)
 *
 * ```ts import.meta.vitest
 * import { jsonSchema, TransferInput } from "./rpc.js"
 *
 * const shape = jsonSchema(TransferInput) as { properties: { intent: { properties: { goal: { maxLength: number } } } } }
 *
 * shape.properties.intent.properties.goal.maxLength // => 280
 * ```
 *
 * @category combinators
 * @since 0.5.0
 */
export const jsonSchema = <S extends Schema.Codec<unknown, unknown, never, never>>(
  schema: S,
): JsonSchema.JsonSchema => {
  const document = Schema.toJsonSchemaDocument(schema)
  const defs = document.definitions
  return Object.keys(defs).length === 0
    ? document.schema
    : { ...document.schema, $defs: defs }
}

/**
 * Turns a returned pointer into the event that announces it. One arm per
 * resume mode, mirroring the pointer union, so a subscriber picks the arm it
 * can act on and never branches on a field that can be absent.
 *
 * The result is the argument list of `events.emit`, so the caller spreads it:
 * `yield* registration.events.emit(...announce(input, pointer))`.
 *
 * **Example** (A fork-local pointer announces the session to open)
 *
 * ```ts import.meta.vitest
 * import { announce } from "./rpc.js"
 *
 * const [name, data] = announce(
 *   { sessionID: "ses_abc", intent: { goal: "audit" } } as never,
 *   { kind: "fork-local", key: "handoff/ses_abc", nextSessionID: "ses_xyz", messages: 12 } as never,
 * )
 *
 * name // => "opened"
 * data.goal // => "audit"
 * ```
 *
 * @category combinators
 * @since 0.4.0
 */
export const announce = (
  input: TransferInput,
  pointer: PointerType,
): Rpc.EventInput<typeof Handoff> =>
  Match.value(pointer).pipe(
    Match.discriminator("kind")("fork-local", (arm): Rpc.EventInput<typeof Handoff> =>
      [
        "opened",
        {
          key: arm.key,
          sessionID: input.sessionID,
          nextSessionID: arm.nextSessionID,
          goal: input.intent.goal,
          messages: arm.messages,
        },
      ]),
    Match.discriminator("kind")("export-file", (arm): Rpc.EventInput<typeof Handoff> =>
      [
        "exported",
        {
          key: arm.key,
          sessionID: input.sessionID,
          file: arm.file,
          goal: input.intent.goal,
          messages: arm.messages,
        },
      ]),
    Match.exhaustive,
  )
