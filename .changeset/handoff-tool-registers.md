---
"@hadronomy/opencode-handoff-plugin": patch
---

`handoff_transfer` registers again. The host converts a tool shape to JSON Schema to show a model, and it rejected the `portable` adapter with `Schema vendor "@hadronomy/opencode-handoff-plugin" does not support JSON Schema conversion`, so the tool never reached an agent and `/handoff-interview` did nothing. The tool now publishes generated JSON Schema and decodes its own input.

A third event, `failed`, carries the source session and the sentence that says why a handoff stopped. The slash command executor returns void, so a stopped handoff had no way to reach a watching client. The command posts nothing back into the source session now: two synthetic receipts used to land in its inbox, where the client renders the description and never the text.
