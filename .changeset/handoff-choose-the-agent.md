---
"@hadronomy/opencode-handoff-plugin": minor
---

`/handoff @reviewer finish the audit` hands the work to that agent, and the agent carries its own model. The composer already has an agent picker, and `invocation.prompt.agents` already carries the mention, so a handoff reuses that picker rather than inventing a second one.

An agent calling `handoff_transfer` chooses too. The tool description lists the agents installed on this machine with what each one is for, loaded before registration, and `agent`, `model`, `stated`, and `start` carry descriptions into the JSON Schema a model reads. An agent that decides the next stretch of work suits a reviewer can hand it to the reviewer.
