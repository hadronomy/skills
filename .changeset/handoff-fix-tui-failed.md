---
"@hadronomy/opencode-handoff-plugin": patch
---

The terminal client loads again. 0.6.0 called `keymap.layer` from `setup` to register a jump-back keybinding. That face reads a Solid context, and `setup` runs before the host mounts its UI, so the host answered `Keymap.Provider is missing` and marked the plugin `Failed`. Every event subscription went with it, so a handoff stopped opening its new session as well.

The keybinding and its command palette entry are gone. A keybinding needs `keymap.layer`, which works only inside a slot render. Naming the source session on the transcript line is unaffected: the server writes that, and it needs no client.

`src/tui.test.ts` now runs `setup` against a context whose `keymap`, `data`, `storage`, and `renderer` throw on any access. It fails the moment the plugin reaches for a face the host cannot serve at setup, and it covers the event handling that had no test before.
