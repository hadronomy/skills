import type { ArtifactRef } from "./rpc.js"

// One concept: finding the artifacts a conversation named. The brief points at
// work instead of retelling it, and a pointer is worth nothing unless it is
// exact, so this module copies what the session wrote. A model asked for the
// same list paraphrases a path or invents one; these functions cannot.
//
// Precision beats recall here. A brief that says "read these" and names a word
// that only looks like a path costs the next agent a failed read, so every
// rule below wants evidence before it claims a token is an artifact.

/**
 * How many artifacts the brief lists. A brief is a prompt, and a long list of
 * paths buries the two the work actually turns on.
 *
 * @category configuration
 * @since 0.8.0
 */
export const MaxListed = 12

// A bare dotted word is usually prose: "e.g.", "i.e.", "v1.2". An extension
// from this set is the evidence that `README.md` is a file and `e.g` is not.
// A token with a slash needs no such proof.
const Extensions = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "mdx",
  "yaml", "yml", "toml", "lock", "rs", "py", "go", "rb", "java", "kt",
  "swift", "c", "h", "cc", "cpp", "hpp", "cs", "php", "sh", "bash", "zsh",
  "sql", "css", "scss", "html", "svg", "txt", "csv", "ini", "conf",
])

// Wrappers a sentence puts around a path. Leading `.` and `/` survive, so
// `./src/x.ts` and `/tmp/out.json` stay whole.
const Leading = new Set(["`", "\"", "'", "(", "[", "{", "<", "*", "|"])
const Trailing = new Set([
  "`", "\"", "'", ")", "]", "}", ">", "*", "|", ",", ";", ":", ".", "!", "?",
])

const GithubWork = /^https?:\/\/[^/]*github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+$/
const IssueRef = /^(?:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)?#\d{1,6}$/
const Sha = /^[0-9a-f]{7,40}$/
const LineSuffix = /:\d+(?::\d+)?$/
const MaxRefLength = 200

const trim = (token: string): string => {
  let kept = token
  while (kept.length > 0 && Leading.has(kept.charAt(0))) kept = kept.slice(1)
  while (kept.length > 0 && Trailing.has(kept.charAt(kept.length - 1))) kept = kept.slice(0, -1)
  return kept
}

// A query string carries session state and access tokens, and the path alone
// names the artifact. Dropping it keeps a copied dashboard link from turning
// the brief into a credential.
const bare = (url: string): string => {
  const cut = url.search(/[?#]/)
  const kept = cut === -1 ? url : url.slice(0, cut)
  return kept.endsWith("/") ? kept.slice(0, -1) : kept
}

// A line reference points at the same file, so `src/render.ts:56` and
// `src/render.ts` are one artifact.
const asFile = (token: string): string | undefined => {
  if (token.includes("://")) return undefined
  const path = token.replace(LineSuffix, "")
  const slash = path.lastIndexOf("/")
  const last = path.slice(slash + 1)
  const dot = last.lastIndexOf(".")
  if (dot <= 0 || dot === last.length - 1) return undefined
  const known = Extensions.has(last.slice(dot + 1).toLowerCase())
  return known || slash > 0 ? path : undefined
}

const classify = (token: string): ArtifactRef | undefined => {
  if (token.length === 0 || token.length > MaxRefLength) return undefined
  if (token.startsWith("http://") || token.startsWith("https://")) {
    const ref = bare(token)
    return { kind: GithubWork.test(ref) ? "issue" : "url", ref }
  }
  if (IssueRef.test(token)) return { kind: "issue", ref: token }
  // A sha carries both letters and digits. Without that pair, `1234567` and
  // `deadbeef` read as commits, and neither is one.
  if (Sha.test(token) && /[a-f]/.test(token) && /\d/.test(token)) {
    return { kind: "commit", ref: token }
  }
  const file = asFile(token)
  return file === undefined ? undefined : { kind: "file", ref: file }
}

/**
 * Reads every artifact the conversation names, newest mention first. Walks
 * from the end because the end of a session is where the work is, and the cap
 * upstream keeps whatever that ordering puts in front.
 *
 * **Example** (Paths, shas, work items, and links come back typed)
 *
 * ```ts import.meta.vitest
 * import { mine } from "./artifacts.js"
 *
 * const said = ["Assistant: fixed `src/render.ts:56` in 3c2b5e4, see #18."]
 *
 * mine(said) // => [{ kind: "file", ref: "src/render.ts" }, { kind: "commit", ref: "3c2b5e4" }, { kind: "issue", ref: "#18" }]
 * ```
 *
 * **Example** (Prose that only looks like a path stays out)
 *
 * ```ts import.meta.vitest
 * import { mine } from "./artifacts.js"
 *
 * mine(["User: pick one, e.g. and/or 1234567"]) // => []
 * ```
 *
 * @category combinators
 * @since 0.8.0
 */
export const mine = (said: ReadonlyArray<string>): ReadonlyArray<ArtifactRef> => {
  const found = new Map<string, ArtifactRef>()
  for (let index = said.length - 1; index >= 0; index -= 1) {
    for (const token of (said[index] ?? "").split(/\s+/)) {
      const ref = classify(trim(token))
      if (ref !== undefined && !found.has(ref.ref)) found.set(ref.ref, ref)
    }
  }
  return [...found.values()]
}

/**
 * Builds the list the brief prints: what the caller named first, then what the
 * conversation named, capped at `MaxListed`. A caller's ref wins its own kind,
 * because `plan` is a judgement the transcript cannot make.
 *
 * **Example** (A stated ref keeps its kind and its place)
 *
 * ```ts import.meta.vitest
 * import { listed } from "./artifacts.js"
 *
 * const stated = [{ kind: "plan", ref: "docs/plan.md" }] as const
 *
 * const refs = listed(stated, ["User: see docs/plan.md and src/x.ts"])
 *
 * refs.map((ref) => ref.kind) // => ["plan", "file"]
 * ```
 *
 * @category combinators
 * @since 0.8.0
 */
export const listed = (
  stated: ReadonlyArray<ArtifactRef>,
  said: ReadonlyArray<string>,
): ReadonlyArray<ArtifactRef> => {
  const kept = new Map<string, ArtifactRef>()
  for (const ref of [...stated, ...mine(said)]) {
    if (kept.size >= MaxListed) break
    if (!kept.has(ref.ref)) kept.set(ref.ref, ref)
  }
  return [...kept.values()]
}

export * as Artifacts from "./artifacts.js"
