import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Session } from "@opencode-ai/schema/session"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { Rpc } from "@opencode-ai/plugin/rpc"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { Cause, Effect, Exit, Schema } from "effect"

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
    resume: Schema.Boolean.pipe(
      Schema.withDecodingDefaultKey(Effect.succeed(true)),
    ),
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
  directive: Schema.Literals(["resume", "branch", "queue"]),
  refs: Schema.Array(ArtifactRef).pipe(Schema.check(Schema.isMaxLength(MaxRefs))),
  skills: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([] as Array<string>)),
  ),
  agent: Schema.optional(Agent.ID),
  model: Schema.optional(Model.Ref),
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
 * out.intent.resume.resume // => true
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

/**
 * Capture read failed or found nothing to hand off.
 *
 * @category errors
 * @since 0.1.0
 */
export class CaptureFailed extends Schema.TaggedError<CaptureFailed>()(
  "CaptureFailed",
  { op: Schema.Literal("capture") },
) {}

/**
 * Stash, fresh session, brief delivery, or file write failed.
 *
 * @category errors
 * @since 0.1.0
 */
export class RenderFailed extends Schema.TaggedError<RenderFailed>()(
  "RenderFailed",
  { op: Schema.Literal("render") },
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
 * Shared RPC contract: one method, the shapes above, the errors above.
 * Published through the `./rpc` export so callers import it without loading
 * the implementation. Every face travels as a `portable` adapter, never a
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
  events: {},
})
