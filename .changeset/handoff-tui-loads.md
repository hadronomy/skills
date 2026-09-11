---
"@hadronomy/opencode-handoff-plugin": patch
---

The terminal client entrypoint loads. It imported `@opencode-ai/plugin/tui`, whose barrel re-exports its Solid bindings and pulls in `solid-js`, an optional peer a published install does not carry. The import threw before any plugin code ran, so no handoff ever opened its new session. The deep path `@opencode-ai/plugin/tui/plugin` is the same `define` with no runtime imports.
