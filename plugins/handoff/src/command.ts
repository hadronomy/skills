import type { PromptInput } from "@opencode-ai/schema/prompt-input"
import type { ArtifactRef } from "./rpc.js"
import { MaxGoalLength, MaxRefs } from "./rpc.js"

/**
 * Resolves command text to a goal: trimmed text, else the session title,
 * else a standing label. Total: every input yields a goal.
 *
 * **Example** (Empty text falls back to title, then label)
 *
 * ```ts import.meta.vitest
 * import { resolveGoal } from "./command.js"
 *
 * resolveGoal("audit", "Old title") // => "audit"
 * resolveGoal("", "Weekly review") // => "Weekly review"
 * resolveGoal("", undefined) // => "Continue this session"
 * ```
 *
 * @category combinators
 * @since 0.2.0
 */
export const resolveGoal = (text: string, title: string | undefined): string => {
  const trimmed = text.trim()
  if (trimmed.length > 0) return trimmed.slice(0, MaxGoalLength)
  const fallback = title?.trim() ?? ""
  return fallback.length > 0 ? fallback.slice(0, MaxGoalLength) : "Continue this session"
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
