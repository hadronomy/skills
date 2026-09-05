import { Effect, Option } from "effect"
import type { SessionMessage } from "@opencode-ai/schema/session-message"
import type { Capture } from "./capture.js"
import { RedactRefused, type Scan } from "./rpc.js"

// The label names the hit for readers and future cause detail; refusal
// still carries only the spec-fixed reason and field. High-signal secret
// shapes only. First match wins, so specific key types precede transports
// and the generic fallback. Transcripts are full of ordinary paths and
// config names, so the secrets rule refuses on secrets alone and leaves
// the `path` and `deny` cause arms reserved.
const SECRET_PATTERNS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
  { label: "Anthropic API key", pattern: /\bsk-ant-[A-Za-z0-9-_]{10,}\b/ },
  { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { label: "GitHub PAT", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { label: "Slack token", pattern: /\bxox[abpras]-[A-Za-z0-9-]+\b/ },
  { label: "AWS access key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { label: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/i },
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    label: "credential assignment",
    pattern: /(api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_\-.~+/]{16,}["']?/i,
  },
  { label: "API key", pattern: /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{20,}\b/ },
]

// High-recall PII shapes, starting with emails. Transcripts carry addresses
// routinely (authors, contacts, fixtures), so these refuse only under the
// `all` scan depth, where the caller opts into strictness.
const PII_PATTERNS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
  { label: "mail address", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
]

// Every string leaf, walked structurally: serialization escapes would split
// secrets across seams, key names would pollute matches, and stringify
// throws on unencodable values instead of failing closed.
const stringsIn = (value: unknown): Array<string> => {
  const out: Array<string> = []
  const seen = new Set<unknown>()
  const visit = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node)
      return
    }
    if (typeof node !== "object" || node === null || seen.has(node)) return
    seen.add(node)
    for (const child of Object.values(node)) visit(child)
  }
  visit(value)
  return out
}

/**
 * First sensitive finding, if any. Total: every input yields an Option,
 * never throws, never hangs. The label names the matched rule for readers
 * and future cause detail.
 *
 * **Example** (Secrets refuse under both depths, mail only under `all`)
 *
 * ```ts import.meta.vitest
 * import { Option } from "effect"
 * import { findFirstSensitive } from "./redact.js"
 *
 * const clean = [{ id: "msg_1", time: { created: 1 }, text: "hello", type: "user" }]
 * // Built, not literal: a key-shaped literal here would trip the scanner in
 * // any session reading this source.
 * const leaked = [{ id: "msg_2", time: { created: 1 }, text: "key " + "sk-ant-" + "secret-key-1234567890" }]
 * findFirstSensitive(clean, "secrets") // => Option.none()
 * findFirstSensitive(leaked, "secrets") // => Option.some({ index: 0, label: "Anthropic API key" })
 * ```
 *
 * @category models
 * @since 0.2.0
 */
export interface SecretFinding {
  readonly index: number
  readonly label: string
}

/**
 * Scans messages against the rule tables for the depth. Secrets always;
 * PII only under `all`. Returns the first hit with its message index.
 *
 * @category combinators
 * @since 0.2.0
 */
export const findFirstSensitive = (
  messages: ReadonlyArray<SessionMessage.Info>,
  scan: Scan,
): Option.Option<SecretFinding> => {
  const rules = scan === "all" ? [...SECRET_PATTERNS, ...PII_PATTERNS] : SECRET_PATTERNS
  for (const [index, message] of messages.entries()) {
    for (const text of stringsIn(message)) {
      const rule = rules.find((entry) => entry.pattern.test(text))
      if (rule !== undefined) return Option.some({ index, label: rule.label })
    }
  }
  return Option.none()
}

/**
 * Refuses the first sensitive message. Refusal carries the cause and the
 * message pointer, and nothing is stored. Refusal instead of masking:
 * a mask would still persist redacted-by-heuristic copies, while refusal
 * keeps untrusted bytes out of storage entirely. Never retries: redaction
 * is a pure check, so a second run decides the same. Mail shapes refused
 * under `all` report the same `secret` reason.
 *
 * @category combinators
 * @since 0.1.0
 */
export const scrub = Effect.fn("Handoff.redact")(function* (
  captured: Capture.Captured,
  scan: Scan,
) {
  const hit = findFirstSensitive(captured.messages, scan)
  if (Option.isNone(hit)) return captured
  return yield* new RedactRefused({
    op: "redact",
    cause: { reason: "secret", field: `messages[${hit.value.index}]` },
  })
})

export * as Redact from "./redact.js"
