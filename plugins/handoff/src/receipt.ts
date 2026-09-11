import { Match } from "effect"
import type { CaptureFailed, RenderFailed } from "./rpc.js"

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
 * Longest source name the transcript chip carries, in characters.
 *
 * @category configuration
 * @since 0.6.0
 */
export const MaxOriginLength = 60

/**
 * Labels the brief in the transcript of the session that receives it. The
 * host renders this, not the brief text, so a bare word here is the whole
 * chip a person sees.
 *
 * Takes the source title, then the goal. A session titles itself a few
 * seconds after its first reply, so a handoff started before that has only
 * the goal to name it.
 *
 * **Example** (The goal names the work when the source has no title yet)
 *
 * ```ts import.meta.vitest
 * import { origin } from "./receipt.js"
 *
 * origin("Casual greeting check-in", "audit") // => "handoff from \"Casual greeting check-in\""
 * origin(undefined, "fix the parser") // => "handoff from \"fix the parser\""
 * ```
 *
 * @category combinators
 * @since 0.6.0
 */
export const origin = (title: string | undefined, goal: string): string => {
  const name = (title?.trim().length ?? 0) > 0 ? title!.trim() : goal.trim()
  return name.length > 0 ? `handoff from "${name.slice(0, MaxOriginLength)}"` : "handoff"
}

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
