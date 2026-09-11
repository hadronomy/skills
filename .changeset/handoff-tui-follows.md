---
"@hadronomy/opencode-handoff-plugin": minor
---

A finished handoff now opens the session it made. The package ships a `tui` entrypoint beside the server one, the contract publishes `opened` and `exported` events, and the terminal client watching the source session opens the new session and focuses it. `/handoff`, `/handoff-interview`, and an HTTP caller all announce through the same two events, because the slash command, the agent tool, and the RPC handler now take one shared `Transfer.Complete`. A lost event warns rather than failing: it costs a watching client its jump, never the work.
