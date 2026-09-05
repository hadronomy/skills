# @hadronomy/opencode-handoff-plugin

## 0.2.3

### Patch Changes

- [`14b884a`](https://github.com/hadronomy/skills/commit/14b884a07d0d2f65465ff1fa46cdba010df6f15d) Thanks [@hadronomy](https://github.com/hadronomy)! - Build the scanner's fake example key by concatenation instead of a literal. A key-shaped literal in shipped source trips the refusal in any session reading that source, including the plugin's own docs and tests.

## 0.2.2

### Patch Changes

- [`e6662db`](https://github.com/hadronomy/skills/commit/e6662db24a8f92f0b961433774896768fb0b5d4b) Thanks [@hadronomy](https://github.com/hadronomy)! - Fix every `/handoff` and `handoff_transfer` call failing at the host boundary. Method schemas now cross as Standard Schema adapters validated in the plugin's own Effect copy: the host decodes method schemas with its own Effect copy, whose interpreter defects on foreign schema ASTs, so raw schemas failed each call with `UnsupportedContentType` instead of validating it. Validation resolves failures to issues and returns the encoded wire form, so thrown error data crosses as plain JSON instead of class instances the host JSON codec rejects. The wire format is unchanged; the slash command now sends complete values instead of relying on decode defaults at the call site.

## 0.2.1

### Patch Changes

- [`0dc94cc`](https://github.com/hadronomy/skills/commit/0dc94cc1a7c8f093cf30ee3465bae53f7dffbc1b) Thanks [@hadronomy](https://github.com/hadronomy)! - Fix every `/handoff` and `handoff_transfer` call failing at the host boundary. Method schemas now cross as Standard Schema adapters validated in the plugin's own Effect copy: the host decodes method schemas with its own Effect copy, whose interpreter defects on foreign schema ASTs, so raw schemas failed each call with `UnsupportedContentType` instead of validating it. The wire format is unchanged; the slash command now sends complete values instead of relying on decode defaults at the call site.

## 0.2.0

### Minor Changes

- [`965458b`](https://github.com/hadronomy/skills/commit/965458b974fb74e67040ade29006fee7121d5c11) Thanks [@hadronomy](https://github.com/hadronomy)! - Extend the handoff contract and command: `skills` passthrough, agent/model preservation, typed artifact refs, PII scan depth, branded IDs, Schema-proven write boundaries, and the `handoff_transfer` agent tool with the guided interview command. The slash command takes no flags; goal, delivery, refs, skills, agent, and model arrive from text and context. `refs` changes from strings to `{ kind, ref }` objects; update callers that send refs.

## 0.1.1

### Patch Changes

- [`99be16f`](https://github.com/hadronomy/skills/commit/99be16f98fec0f2448d7de7122e90d13844aae35) Thanks [@hadronomy](https://github.com/hadronomy)! - Make the `handoff` plugin installable from git: skip the `effect-tsgo` patch step when its binary is absent (installed dependencies omit devDependencies) and drop `vitest` to `^4.1.10` so strict installers resolve the `@effect/doctest` and `@effect/vitest` peer ranges.

- [`99be16f`](https://github.com/hadronomy/skills/commit/99be16f98fec0f2448d7de7122e90d13844aae35) Thanks [@hadronomy](https://github.com/hadronomy)! - Fix `handoff` opencode plugin never loading: add a root-level `index.ts` entry that re-exports `./src/index.js`. OpenCode resolves a local plugin directory to its root entry file and ignores the `exports` map, so the previous `src/`-only layout was skipped silently with no error. Point `exports["."]` at the new root entry and drop the now-incorrect `rootDir: src` from the plugin tsconfig.

- [`51febd6`](https://github.com/hadronomy/skills/commit/51febd65e00427d010098071391e82d311d36458) Thanks [@hadronomy](https://github.com/hadronomy)! - Set up npm publishing for the `handoff` plugin: public access with provenance, repository metadata, and a file list that includes the root entry. Switch the README install route from git to the published package.
