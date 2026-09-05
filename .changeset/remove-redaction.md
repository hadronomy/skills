---
"@hadronomy/opencode-handoff-plugin": minor
---

Remove secret redaction. The `Redact` module, the `scan` intent field, and the `RedactRefused` error are gone; transfer is capture plus render. Sanitizing exports stays available through the host `sanitize` flag on export-file. The package is pre-1.0; update callers that send `scan` or handle `RedactRefused`.
