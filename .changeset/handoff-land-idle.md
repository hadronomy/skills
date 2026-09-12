---
"@hadronomy/opencode-handoff-plugin": minor
---

A handoff lands you in a session that waits. `intent.resume.resume` is now `intent.resume.start`, and it defaults to false. The old name read as `resume.resume` and the old default ran the new session the moment it was created, so `/handoff` from an open-ended thread picked a next step on its own and began. You land in front of the composer instead, with its model and agent pickers, and the first move is yours. Set `start` true to hand work to a session that begins without you.

`intent.stated` tells a goal a person named apart from one the plugin read off the session. `/handoff` with no text sets it false, and the brief then says nobody named the next step and tells the new session to summarize and ask. A guess phrased as an instruction is how a handoff ends up doing work nobody asked for.
