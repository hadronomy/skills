---
"@hadronomy/opencode-handoff-plugin": patch
---

The `/handoff` command posts a start receipt before transferring, so long handoffs show progress instead of a bare spinner. Fork-local sessions now pass agent and model at create, dropping the two switch round trips.
