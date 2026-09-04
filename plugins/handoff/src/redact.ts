import { Effect, Schema } from "effect"
import type { Captured } from "./capture.js"
import { RedactRefused } from "./rpc.js"

// High-signal secret shapes only. Transcripts are full of ordinary paths and
// config names, so the v1 rule refuses on secrets alone and leaves the `path`
// and `deny` cause arms reserved.
const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  /\bxox[abpras]-[A-Za-z0-9-]+\b/,
  /\bsk-ant-[A-Za-z0-9-_]{10,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9_\-.~+/]{16,}\b/,
  /(api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_\-.~+/]{16,}["']?/i,
]

/**
 * Transcript text without high-signal secret shapes. The rule as a checked
 * schema: the declaration documents the refusal, and the guard below is its
 * compiled form.
 */
const SecretFree = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter(
      (text) =>
        SECRET_PATTERNS.some((pattern) => pattern.test(text))
          ? "message holds a secret shape"
          : undefined,
      {
        identifier: "Handoff.SecretFree",
        description: "Transcript text free of high-signal secret shapes (keys, tokens, credentials)",
      },
    ),
  ),
)

const isSecretFree = Schema.is(SecretFree)

/**
 * Scans every captured message for secret shapes. Refusal carries the cause
 * and the message pointer, and nothing is stored. Refusal instead of masking:
 * a mask would still persist redacted-by-heuristic copies, while refusal
 * keeps untrusted bytes out of storage entirely. Never retries: redaction
 * is a pure check, so a second run decides the same.
 *
 * @category combinators
 * @since 0.1.0
 */
export const scrub = Effect.fn("Handoff.redact")(function* (captured: Captured) {
  const hit = captured.messages.findIndex((message) => !isSecretFree(JSON.stringify(message)))
  if (hit !== -1) {
    return yield* new RedactRefused({
      op: "redact",
      cause: { reason: "secret", field: `messages[${hit}]` },
    })
  }
  return captured
})

export * as Redact from "./redact.js"
