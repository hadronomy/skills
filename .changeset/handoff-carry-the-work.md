---
"@hadronomy/opencode-handoff-plugin": minor
---

The brief now carries the work. Render condenses the source conversation with the model that session was using, and the new session reads that instead of a message count and a session ID it cannot open. A failed model call falls back to the tail of the conversation verbatim and logs a warning, so a handoff never lands with nothing to resume from. Reasoning and tool parts stay out of the brief: they are the model talking to itself. The boundary, the message count, the stash key, and the source session ID leave the agent-visible text and stay in the stash and the pointer.

Bare `/handoff` falls back to the session title, then to the last thing you asked for, then to a standing label. A session titles itself a few seconds after its first reply, so a handoff started before that used to name no work at all.
