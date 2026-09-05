---
"@hadronomy/opencode-handoff-plugin": minor
---

Extend the handoff contract and command: `skills` passthrough, agent/model preservation, typed artifact refs, PII scan depth, branded IDs, Schema-proven write boundaries, and the `handoff_transfer` agent tool with the guided interview command. The slash command takes no flags; goal, delivery, refs, skills, agent, and model arrive from text and context. `refs` changes from strings to `{ kind, ref }` objects; update callers that send refs.
