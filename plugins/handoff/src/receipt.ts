import { Match } from "effect"
import type { CaptureFailed, PointerType, RenderFailed } from "./rpc.js"

/**
 * A message tally that reads as English at one. Shared with the TUI so a
 * toast and a receipt never disagree about how much history moved.
 *
 * **Example** (One is singular)
 *
 * ```ts import.meta.vitest
 * import { messages } from "./receipt.js"
 *
 * messages(1) // => "1 message"
 * messages(2) // => "2 messages"
 * ```
 *
 * @category combinators
 * @since 0.4.0
 */
export const messages = (count: number): string => `${count} message${count === 1 ? "" : "s"}`

/**
 * The line the source session keeps after a handoff. Leads with what moved,
 * closes with the handle to act on: the new session for a fork-local
 * handoff, the file and its import command for an export.
 *
 * **Example** (Each resume mode names the thing to act on)
 *
 * ```ts import.meta.vitest
 * import { pointer } from "./receipt.js"
 *
 * const one = { kind: "fork-local", key: "handoff/ses_abc", nextSessionID: "ses_xyz", messages: 1 }
 *
 * pointer(one as never) // => "Handed off 1 message. Continue in session ses_xyz."
 * ```
 *
 * @category combinators
 * @since 0.4.0
 */
export const pointer = (value: PointerType): string =>
  Match.value(value).pipe(
    Match.discriminator("kind")(
      "fork-local",
      (arm) => `Handed off ${messages(arm.messages)}. Continue in session ${arm.nextSessionID}.`,
    ),
    Match.discriminator("kind")(
      "export-file",
      (arm) =>
        `Handed off ${messages(arm.messages)} to ${arm.file}. Move it, then: opencode2 import --directory <dir> <file>`,
    ),
    Match.exhaustive,
  )

/**
 * Why a handoff stopped, as one sentence a person can act on. Every caller
 * frames this same string: the RPC error message, the tool error, and the
 * receipt in the source session all read the same words.
 *
 * **Example** (The reason, not the tag, decides the sentence)
 *
 * ```ts import.meta.vitest
 * import { failure } from "./receipt.js"
 *
 * const empty = { _tag: "CaptureFailed", op: "capture", reason: "empty" }
 *
 * failure(empty as never) // => "this session has no history to hand off"
 * ```
 *
 * @category combinators
 * @since 0.4.0
 */
export const failure = (error: CaptureFailed | RenderFailed): string =>
  Match.value(error).pipe(
    Match.discriminator("_tag")("CaptureFailed", (arm) =>
      Match.value(arm.reason).pipe(
        Match.when("empty", () => "this session has no history to hand off"),
        Match.when("transport", () => "the host did not return the session history"),
        Match.exhaustive,
      )),
    Match.discriminator("_tag")("RenderFailed", (arm) =>
      Match.value(arm.reason).pipe(
        Match.when("encode", () => "the transfer data did not serialize"),
        Match.when("stash", () => "plugin storage did not keep the transfer"),
        Match.when("create", () => "the host refused a new session"),
        Match.when("deliver", () => "the new session did not accept the brief"),
        Match.when("write", () => "the file write failed"),
        Match.exhaustive,
      )),
    Match.exhaustive,
  )

export * as Receipt from "./receipt.js"
