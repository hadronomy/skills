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
 * Structured intent. No free-text blob: the goal names the work, the
 * directive names the continuation, refs carry at most eight pointers.
 *
 * @category models
 * @since 0.1.0
 */
export const Intent = Schema.Struct({
  goal: Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(280))),
  directive: Schema.Literals(["resume", "branch", "queue"]),
  refs: Schema.Array(Schema.String).pipe(Schema.check(Schema.isMaxLength(8))),
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
  sessionID: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
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
  key: Schema.String,
  nextSessionID: Schema.String,
  messages: Schema.Number,
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
  key: Schema.String,
  file: Schema.String,
  messages: Schema.Number,
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
