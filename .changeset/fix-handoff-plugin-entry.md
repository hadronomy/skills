---
"@hadronomy/opencode-handoff-plugin": patch
---

Fix `handoff` opencode plugin never loading: add a root-level `index.ts` entry that re-exports `./src/index.js`. OpenCode resolves a local plugin directory to its root entry file and ignores the `exports` map, so the previous `src/`-only layout was skipped silently with no error. Point `exports["."]` at the new root entry and drop the now-incorrect `rootDir: src` from the plugin tsconfig.
