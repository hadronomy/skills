import type { SessionMessage } from "@opencode-ai/schema/session-message"

// One concept: turning host message records into plain text a model can
// read. Every function here is pure, so the stages that need a transcript
// stay testable without a session.

const speaker = (message: SessionMessage.Info): string | undefined =>
  message.type === "user" ? "User" : message.type === "assistant" ? "Assistant" : undefined

const spoken = (message: SessionMessage.Info): string => {
  if (message.type === "user") return message.text.trim()
  if (message.type !== "assistant") return ""
  // Reasoning and tool parts are the model talking to itself. They bloat a
  // brief without telling the next agent anything it can act on.
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text.trim())
    .filter((text) => text.length > 0)
    .join("\n")
}

/**
 * Renders the conversation as `Speaker: text` lines. Drops every record that
 * carries no conversation: switches, skills, shells, and compactions.
 *
 * **Example** (Only user and assistant text survives)
 *
 * ```ts import.meta.vitest
 * import { lines } from "./transcript.js"
 *
 * const said = lines([{ type: "user", text: "ship it" }] as never)
 *
 * said // => ["User: ship it"]
 * ```
 *
 * @category combinators
 * @since 0.5.0
 */
export const lines = (messages: ReadonlyArray<SessionMessage.Info>): ReadonlyArray<string> =>
  messages.flatMap((message) => {
    const who = speaker(message)
    if (who === undefined) return []
    const text = spoken(message)
    return text.length > 0 ? [`${who}: ${text}`] : []
  })

/**
 * Returns the newest thing the person actually asked for, or undefined when
 * the session holds no user text. This is the best name for the work when a
 * session is too young to have a title.
 *
 * @category combinators
 * @since 0.5.0
 */
export const lastUserText = (
  messages: ReadonlyArray<SessionMessage.Info>,
): string | undefined => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message === undefined || message.type !== "user") continue
    const text = message.text.trim()
    if (text.length > 0) return text
  }
  return undefined
}

/**
 * Joins the newest lines that fit in `budget` characters. Takes from the end
 * because the end of a session is what the next agent continues from.
 *
 * **Example** (A tight budget keeps the newest line)
 *
 * ```ts import.meta.vitest
 * import { tail } from "./transcript.js"
 *
 * const said = ["User: one", "User: two"]
 *
 * tail(said, 12) // => "User: two"
 * ```
 *
 * @category combinators
 * @since 0.5.0
 */
export const tail = (said: ReadonlyArray<string>, budget: number): string => {
  const kept: Array<string> = []
  let used = 0
  for (let index = said.length - 1; index >= 0; index -= 1) {
    const line = said[index]
    if (line === undefined) continue
    const cost = line.length + 1
    if (used + cost > budget) break
    kept.unshift(line)
    used += cost
  }
  return kept.join("\n")
}

export * as Transcript from "./transcript.js"
