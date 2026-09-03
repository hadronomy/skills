# Detection signals

Check signals in this order. First match wins per craft. Record what fired
and what did not in the findings summary.

| Signal | Pin |
|---|---|
| `effect` at v4 in `package.json` | `effect-craft`, plus Effect branch |
| `effect` at v3 in `package.json` | nothing; blocked record plus upgrade pointer |
| `Cargo.toml` at root or workspace member | `rust-craft` |
| Typst files present | offer `typst-author` opt-in, labeled in-progress |
| GitHub remote with pull requests | `pr-craft` on request-heavy repos; ask, default off |

No signal means the minimal pointer: root block with stack line only, no
craft pins, no `effect.md`. Unknown stacks never receive a craft pin.
Re-runs re-check every signal; version bumps and new pins surface as diffs.
