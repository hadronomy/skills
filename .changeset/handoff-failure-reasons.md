---
"@hadronomy/opencode-handoff-plugin": minor
---

`CaptureFailed` and `RenderFailed` carry a `reason` beside `op`, naming the step that failed: `empty` or `transport` for capture, and `encode`, `stash`, `create`, `deliver`, or `write` for render. One module turns each reason into one sentence, so the RPC error message, the tool error, and the receipt in the source session never read two ways. Receipts also drop the raw stash key for the thing to act on: the session to continue in, or the file to move and the command to import it.
