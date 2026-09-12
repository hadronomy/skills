# @hadronomy/opencode-handoff-plugin

## 0.7.0

### Minor Changes

- [#18](https://github.com/hadronomy/skills/pull/18) [`3c2b5e4`](https://github.com/hadronomy/skills/commit/3c2b5e4879ae0b3bdcb55e2a58af9283f67d0367) Thanks [@hadronomy](https://github.com/hadronomy)! - `/handoff @reviewer finish the audit` hands the work to that agent, and the agent carries its own model. The composer already has an agent picker, and `invocation.prompt.agents` already carries the mention, so a handoff reuses that picker rather than inventing a second one.

  An agent calling `handoff_transfer` chooses too. The tool description lists the agents installed on this machine with what each one is for, loaded before registration, and `agent`, `model`, `stated`, and `start` carry descriptions into the JSON Schema a model reads. An agent that decides the next stretch of work suits a reviewer can hand it to the reviewer.

- [#18](https://github.com/hadronomy/skills/pull/18) [`3c2b5e4`](https://github.com/hadronomy/skills/commit/3c2b5e4879ae0b3bdcb55e2a58af9283f67d0367) Thanks [@hadronomy](https://github.com/hadronomy)! - A handoff lands you in a session that waits. `intent.resume.resume` is now `intent.resume.start`, and it defaults to false. The old name read as `resume.resume` and the old default ran the new session the moment it was created, so `/handoff` from an open-ended thread picked a next step on its own and began. You land in front of the composer instead, with its model and agent pickers, and the first move is yours. Set `start` true to hand work to a session that begins without you.

  `intent.stated` tells a goal a person named apart from one the plugin read off the session. `/handoff` with no text sets it false, and the brief then says nobody named the next step and tells the new session to summarize and ask. A guess phrased as an instruction is how a handoff ends up doing work nobody asked for.

### Patch Changes

- [#18](https://github.com/hadronomy/skills/pull/18) [`3c2b5e4`](https://github.com/hadronomy/skills/commit/3c2b5e4879ae0b3bdcb55e2a58af9283f67d0367) Thanks [@hadronomy](https://github.com/hadronomy)! - The brief asks for prose. The summarizer prompt listed the four things to cover as bullets, and a small model answered by filling those bullets back as a JSON object, which landed in the brief as a shape with no handover in it. The prompt now bans JSON, headings, bullets, and labels outright, and asks for four to eight sentences. A summary that still comes back starting with `{` or `[` is refused, and the brief carries the transcript instead.

## 0.6.1

### Patch Changes

- [#16](https://github.com/hadronomy/skills/pull/16) [`d34a3fa`](https://github.com/hadronomy/skills/commit/d34a3fa6e6a284038af1601048452b397662536b) Thanks [@hadronomy](https://github.com/hadronomy)! - The terminal client loads again. 0.6.0 called `keymap.layer` from `setup` to register a jump-back keybinding. That face reads a Solid context, and `setup` runs before the host mounts its UI, so the host answered `Keymap.Provider is missing` and marked the plugin `Failed`. Every event subscription went with it, so a handoff stopped opening its new session as well.

  The keybinding and its command palette entry are gone. A keybinding needs `keymap.layer`, which works only inside a slot render. Naming the source session on the transcript line is unaffected: the server writes that, and it needs no client.

  `src/tui.test.ts` now runs `setup` against a context whose `keymap`, `data`, `storage`, and `renderer` throw on any access. It fails the moment the plugin reaches for a face the host cannot serve at setup, and it covers the event handling that had no test before.

## 0.6.0

### Minor Changes

- [#14](https://github.com/hadronomy/skills/pull/14) [`297caef`](https://github.com/hadronomy/skills/commit/297caefb4055d2eb163505d4f706aa29707361ab) Thanks [@hadronomy](https://github.com/hadronomy)! - The brief now names where the work came from. The host renders a message description in the transcript, never the message text, so the brief line read a bare `handoff`. It reads `handoff from "Casual greeting check-in"` now, and falls back to the handoff goal when the source session is younger than its own title.

  The terminal client adds `<leader>h` and a command palette entry, "Go to the session this was handed off from", which opens the source session. It reads the origin out of the `metadata.handoff` stash key the brief already carries, so it keeps no state and works for a handoff any client started. The command stays disabled outside a handed-off session, and its id is `handoff.origin` for rebinding.

  The contract owns the stash key shape through `keyFor` and `sessionOfKey`, so the render stage and a client cannot drift apart on it.

## 0.5.0

### Minor Changes

- [#12](https://github.com/hadronomy/skills/pull/12) [`9151a73`](https://github.com/hadronomy/skills/commit/9151a7311251a161b0eb7f60fa18e53f7c56c24e) Thanks [@hadronomy](https://github.com/hadronomy)! - The brief now carries the work. Render condenses the source conversation with the model that session was using, and the new session reads that instead of a message count and a session ID it cannot open. A failed model call falls back to the tail of the conversation verbatim and logs a warning, so a handoff never lands with nothing to resume from. Reasoning and tool parts stay out of the brief: they are the model talking to itself. The boundary, the message count, the stash key, and the source session ID leave the agent-visible text and stay in the stash and the pointer.

  Bare `/handoff` falls back to the session title, then to the last thing you asked for, then to a standing label. A session titles itself a few seconds after its first reply, so a handoff started before that used to name no work at all.

### Patch Changes

- [#12](https://github.com/hadronomy/skills/pull/12) [`9151a73`](https://github.com/hadronomy/skills/commit/9151a7311251a161b0eb7f60fa18e53f7c56c24e) Thanks [@hadronomy](https://github.com/hadronomy)! - `handoff_transfer` registers again. The host converts a tool shape to JSON Schema to show a model, and it rejected the `portable` adapter with `Schema vendor "@hadronomy/opencode-handoff-plugin" does not support JSON Schema conversion`, so the tool never reached an agent and `/handoff-interview` did nothing. The tool now publishes generated JSON Schema and decodes its own input.

  A third event, `failed`, carries the source session and the sentence that says why a handoff stopped. The slash command executor returns void, so a stopped handoff had no way to reach a watching client. The command posts nothing back into the source session now: two synthetic receipts used to land in its inbox, where the client renders the description and never the text.

- [#12](https://github.com/hadronomy/skills/pull/12) [`9151a73`](https://github.com/hadronomy/skills/commit/9151a7311251a161b0eb7f60fa18e53f7c56c24e) Thanks [@hadronomy](https://github.com/hadronomy)! - The terminal client entrypoint loads. It imported `@opencode-ai/plugin/tui`, whose barrel re-exports its Solid bindings and pulls in `solid-js`, an optional peer a published install does not carry. The import threw before any plugin code ran, so no handoff ever opened its new session. The deep path `@opencode-ai/plugin/tui/plugin` is the same `define` with no runtime imports.

## 0.4.0

### Minor Changes

- [#10](https://github.com/hadronomy/skills/pull/10) [`004e6ee`](https://github.com/hadronomy/skills/commit/004e6eec19cdfa5dc1a30b42b460aa8d5a710629) Thanks [@hadronomy](https://github.com/hadronomy)! - `CaptureFailed` and `RenderFailed` carry a `reason` beside `op`, naming the step that failed: `empty` or `transport` for capture, and `encode`, `stash`, `create`, `deliver`, or `write` for render. One module turns each reason into one sentence, so the RPC error message, the tool error, and the receipt in the source session never read two ways. Receipts also drop the raw stash key for the thing to act on: the session to continue in, or the file to move and the command to import it.

- [#10](https://github.com/hadronomy/skills/pull/10) [`004e6ee`](https://github.com/hadronomy/skills/commit/004e6eec19cdfa5dc1a30b42b460aa8d5a710629) Thanks [@hadronomy](https://github.com/hadronomy)! - A finished handoff now opens the session it made. The package ships a `tui` entrypoint beside the server one, the contract publishes `opened` and `exported` events, and the terminal client watching the source session opens the new session and focuses it. `/handoff`, `/handoff-interview`, and an HTTP caller all announce through the same two events, because the slash command, the agent tool, and the RPC handler now take one shared `Transfer.Complete`. A lost event warns rather than failing: it costs a watching client its jump, never the work.

### Patch Changes

- [#10](https://github.com/hadronomy/skills/pull/10) [`004e6ee`](https://github.com/hadronomy/skills/commit/004e6eec19cdfa5dc1a30b42b460aa8d5a710629) Thanks [@hadronomy](https://github.com/hadronomy)! - Build against `@opencode-ai/plugin` beta-19271, up from beta-19086. The export envelope pins against the host's own `SessionImportInput` with `satisfies`, which is the strongest proof of import compatibility available without a live server. A probe against opencode2 beta-19398 confirms the whole server path: the RPC registers, both resume modes return their pointer, the error encoding carries `reason`, the written envelope imports back into the host, and both events fire with the payload a client reads.

## 0.3.1

### Patch Changes

- [`7479c65`](https://github.com/hadronomy/skills/commit/7479c6548d2f2d609940b928ae8359c905cc75c9) Thanks [@hadronomy](https://github.com/hadronomy)! - The `/handoff` command posts a start receipt before transferring, so long handoffs show progress instead of a bare spinner. Fork-local sessions now pass agent and model at create, dropping the two switch round trips.

## 0.3.0

### Minor Changes

- [`4ad7b75`](https://github.com/hadronomy/skills/commit/4ad7b7562a0f0ff85fc8d907c4e356f107e871a0) Thanks [@hadronomy](https://github.com/hadronomy)! - Remove secret redaction. The `Redact` module, the `scan` intent field, and the `RedactRefused` error are gone; transfer is capture plus render. Sanitizing exports stays available through the host `sanitize` flag on export-file. The package is pre-1.0; update callers that send `scan` or handle `RedactRefused`.

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
