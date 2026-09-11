---
"@hadronomy/opencode-handoff-plugin": patch
---

Build against `@opencode-ai/plugin` beta-19271, up from beta-19086. The export envelope pins against the host's own `SessionImportInput` with `satisfies`, which is the strongest proof of import compatibility available without a live server. A probe against opencode2 beta-19398 confirms the whole server path: the RPC registers, both resume modes return their pointer, the error encoding carries `reason`, the written envelope imports back into the host, and both events fire with the payload a client reads.
