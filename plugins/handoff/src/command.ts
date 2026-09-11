import type { PromptInput } from "@opencode-ai/schema/prompt-input"
import type { ArtifactRef } from "./rpc.js"
import { MaxGoalLength, MaxRefs } from "./rpc.js"

/**
 * Resolves command text to a goal: the typed text, else the session title,
 * else the last thing the person asked for, else a standing label. Total:
 * every input yields a goal.
 *
 * The third step earns its place. A session titles itself a few seconds
 * after its first reply, so a handoff started before that has no title, and
 * the standing label names no work at all.
 *
 * **Example** (Each source takes over when the one before it is empty)
 *
 * ```ts import.meta.vitest
 * import { resolveGoal } from "./command.js"
 *
 * resolveGoal("audit", "Old title", "hi") // => "audit"
 * resolveGoal("", "Weekly review", "hi") // => "Weekly review"
 * resolveGoal("", undefined, "fix the parser") // => "fix the parser"
 * resolveGoal("", undefined, undefined) // => "Continue this session"
 * ```
 *
 * @category combinators
 * @since 0.2.0
 */
export const resolveGoal = (
  text: string,
  title: string | undefined,
  asked: string | undefined,
): string => {
  for (const source of [text, title, asked]) {
    const trimmed = source?.trim() ?? ""
    if (trimmed.length > 0) return trimmed.slice(0, MaxGoalLength)
  }
  return "Continue this session"
}

/**
 * Maps attachments to file refs, capped at the contract bound.
 *
 * @category combinators
 * @since 0.2.0
 */
export const collectRefs = (files: PromptInput.Prompt["files"]): Array<ArtifactRef> =>
  (files ?? []).slice(0, MaxRefs).map((file) => ({ kind: "file", ref: file.uri }))

/**
 * Plucks invoked skill IDs.
 *
 * @category combinators
 * @since 0.2.0
 */
export const collectSkills = (skills: PromptInput.Prompt["skills"]): Array<string> =>
  (skills ?? []).map((skill) => skill.id)

export * as Command from "./command.js"
