---
"@hadronomy/opencode-handoff-plugin": minor
---

The brief now names where the work came from. The host renders a message description in the transcript, never the message text, so the brief line read a bare `handoff`. It reads `handoff from "Casual greeting check-in"` now, and falls back to the handoff goal when the source session is younger than its own title.

The terminal client adds `<leader>h` and a command palette entry, "Go to the session this was handed off from", which opens the source session. It reads the origin out of the `metadata.handoff` stash key the brief already carries, so it keeps no state and works for a handoff any client started. The command stays disabled outside a handed-off session, and its id is `handoff.origin` for rebinding.

The contract owns the stash key shape through `keyFor` and `sessionOfKey`, so the render stage and a client cannot drift apart on it.
