# @hadronomy/opencode-handoff-plugin

## 0.1.1

### Patch Changes

- [`99be16f`](https://github.com/hadronomy/skills/commit/99be16f98fec0f2448d7de7122e90d13844aae35) Thanks [@hadronomy](https://github.com/hadronomy)! - Make the `handoff` plugin installable from git: skip the `effect-tsgo` patch step when its binary is absent (installed dependencies omit devDependencies) and drop `vitest` to `^4.1.10` so strict installers resolve the `@effect/doctest` and `@effect/vitest` peer ranges.

- [`99be16f`](https://github.com/hadronomy/skills/commit/99be16f98fec0f2448d7de7122e90d13844aae35) Thanks [@hadronomy](https://github.com/hadronomy)! - Fix `handoff` opencode plugin never loading: add a root-level `index.ts` entry that re-exports `./src/index.js`. OpenCode resolves a local plugin directory to its root entry file and ignores the `exports` map, so the previous `src/`-only layout was skipped silently with no error. Point `exports["."]` at the new root entry and drop the now-incorrect `rootDir: src` from the plugin tsconfig.

- [`51febd6`](https://github.com/hadronomy/skills/commit/51febd65e00427d010098071391e82d311d36458) Thanks [@hadronomy](https://github.com/hadronomy)! - Set up npm publishing for the `handoff` plugin: public access with provenance, repository metadata, and a file list that includes the root entry. Switch the README install route from git to the published package.
