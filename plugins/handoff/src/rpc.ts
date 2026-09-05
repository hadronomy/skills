import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Session } from "@opencode-ai/schema/session"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { Rpc } from "@opencode-ai/plugin/rpc"
import { Effect, Schema } from "effect"

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
 * Scan depth. Secrets cover tokens, keys, and credentials. All adds
 * high-recall PII shapes, starting with emails.
 *
 * @category models
 * @since 0.2.0
 */
export const Scan = Schema.Literals(["secrets", "all"])
export type Scan = typeof Scan.Type

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
  scan: Scan.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("secrets" as const)),
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
 * Why redaction refused. v1 emits `secret`; `path` and `deny` stay reserved.
 *
 * @category models
 * @since 0.1.0
 */
export const RedactCause = Schema.Struct({
  reason: Schema.Literals(["secret", "path", "deny"]),
  field: Schema.String,
})
export interface RedactCause extends Schema.Schema.Type<typeof RedactCause> {}

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
 * Redaction refused. The cause names the reason and the message pointer;
 * nothing was stored.
 *
 * @category errors
 * @since 0.1.0
 */
export class RedactRefused extends Schema.TaggedError<RedactRefused>()(
  "RedactRefused",
  { op: Schema.Literal("redact"), cause: RedactCause },
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
 * Shared RPC contract: one method, the shapes above, the errors above.
 * Published through the `./rpc` export so callers import it without loading
 * the implementation. Raw Effect schemas travel here: the host accepts any
 * Standard Schema compatible validator, and `Rpc.define` is a passthrough
 * at runtime (it only rejects `rpc.*` error names).
 *
 * @category models
 * @since 0.1.0
 */
export const Handoff = Rpc.define({
  id: "handoff",
  methods: {
    transfer: {
      input: TransferInput,
      output: Pointer,
      errors: { CaptureFailed, RedactRefused, RenderFailed },
    },
  },
  events: {},
})
