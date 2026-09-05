# Handoff plugin

One RPC method moves a session to a resumable pointer. Callers send a
structured intent; the plugin captures history and renders a pointer.
Fixes land in one module.

## Install

Install the published package for daily use. Use the local path to develop the
plugin.

1. Run `opencode2 --version` to show the host version.
2. If the host is older than beta-19086, upgrade the CLI to the `beta` tag.
3. Run `opencode2 plugin add '@hadronomy/opencode-handoff-plugin@0.1.0'` to install the package from the npm registry. The command also adds the entry to the `plugins` array in `opencode.jsonc`.
4. For local development, add the absolute workspace path to the `plugins` array instead. The entry looks like `"/Users/hadronomy/repos/skills/plugins/handoff"`. The directory needs its root-level `index.ts` entry file; the loader ignores the `exports` map for local paths.
5. Run `/handoff` in a session to start a handoff.

## Use

Slash command in any session:

```text
/handoff continue the audit on Monday
```

The command builds the intent and calls `transfer` once, then posts the
pointer as a queued receipt in the source session. Text after `/handoff`
becomes the goal. Bare `/handoff` falls back to the session title, then to
a standing label. Delivery, attachments, skills, agent, and model arrive
from context, so the command takes no flags. Anything vaguer belongs to
the guided version below.

For the guided version, copy `commands/handoff-interview.md` from the
package into a `commands` directory. Then run `/handoff-interview`. The agent
reads the session, asks through the question tool only for what context
cannot answer, and calls the `handoff_transfer` tool once. The tool takes
the transfer intent and returns the pointer.

The intent carries `skills`, `agent`, `model`, and typed `refs`.
Skills default to empty. Agent and model stay absent unless set; the transfer fills both from the
source session. Refs take `spec`, `plan`, `adr`, `issue`, `commit`, or `file`.
Session, stash-key, and next-session IDs are brands. All three travel as
plain strings on the wire.

Same call over HTTP:

```text
POST /api/rpc/handoff/transfer
{ "input": { "sessionID": "ses_abc", "intent": { "goal": "...", "directive": "resume", "refs": [] } } }
```

Cross-machine move names the export variant:

```ts
const ptr = await client.rpc(Handoff).transfer({
  sessionID,
  intent: { goal: "audit", directive: "queue", refs: [], resume: { mode: "export-file", sanitize: true } },
})
// out.file -> move the file, then: opencode2 import --directory ./newdir <file>
```

## Failures

Empty input fails validation before the handler runs.
`Expected a value with a length of at least 1 at ["sessionID"]` names an
empty session ID. The two stage errors cross the seam as typed failures:

- `CaptureFailed`: the history is empty or the transport failed after retries.
- `RenderFailed`: the stash, session, delivery, or file write failed.

## Layout

```text
src/rpc.ts       transfer contract: shapes, bounds, errors, and the define
src/command.ts    command input builders, namespaced as `Command`
src/tool.ts      agent-callable transfer tool surface
src/host.ts      host boundary: session, storage, and file tags plus layers
src/stage.ts     interrupt-preserving failure converter
src/capture.ts   Capture service: history read over the gateway
src/render.ts    Render service: stash plus preload or relocate
src/transfer.ts  Handoff service composing the two stages
src/plugin.ts    Plugin.define wiring: layers, RPC register, /handoff command
src/index.ts     logic-free entry: default plugin plus contract re-exports
```

Tests use `it.effect` with Ref-backed test layers (`TestSession`,
`TestStorage`, `TestFiles`) instead of the network. Worked JSDoc examples
run as tests through `@effect/doctest`: fences marked `ts import.meta.vitest`
with trailing `// =>` assertions are extracted and run as isolated Vitest
modules, the same way the Effect codebase runs its own docs.
`effect-tsgo diagnostics --strict` (tsconfig `plugins` entry) keeps the
Effect-specific rules green; it runs in CI. The entry follows the sanctioned
`effect-tsgo setup` shape, including the `prepare` patch hook. Bun does not
auto-run workspace `prepare` scripts, so editor hover/diagnostics need one
manual step per machine: `bun run prepare` inside `plugins/handoff`.

Package exports: `.` is the implementation, `./rpc` is the contract for
callers that must not load the implementation.

## Contract deviations

The fixed interface spec is the design source. The build corrects it where
the installed toolchain proves otherwise (effect 4.0.0-rc.112,
@opencode-ai/plugin 0.0.0-beta-19086):

- Defaults are decode-side (`withDecodingDefaultKey`). The spec's
  `withConstructorDefault` never fires on the RPC decode path, so omitted
  `boundary` and `delivery` failed validation.
- `Intent.resume` defaults to fork-local. The spec's own slash-command
  example omits it.
- Render uses `create` plus `synthetic`. The plugin context in beta-19086
  exposes no `fork`, `export`, or `import`, so both boundaries start a fresh
  session with the brief. The boundary stays recorded in the stash; true fork
  lands when the host exposes it.
- Error data carries the full tagged error instance. The host types demand
  the class, not a plain payload.
- Capture also reads `session.get`. The spec names only `session.context`,
  but the export envelope must stay import-compatible, which needs the
  session info. Both reads share the recurs(2) idempotent-read policy.
- Export-file with `sanitize: false` writes the file alone and skips the
  stash, so no side copy lands in storage.
- `refs` are typed artifacts (`kind` plus `ref`), a breaking change over
  string refs. The package is pre-1.0; no migration path ships.
- `skills` defaults to `[]`; `agent` and `model` stay
  absent unless set.
- Session IDs, stash keys, and next-session IDs are brands (`Session.ID`,
  `Handoff.Key`). All three encode as plain strings.
- Agent and model carry over from source info unless the intent names
  replacements. A server fork preserves the same pair.
- Pointers and the envelope encode through Schema before return or write;
  malformed output is unreturnable.

## Stage policy

- `capture` reads `session.context` plus `session.get`. Empty context fails
  closed with no retry. Transport faults retry recurs(2); the reads are
  idempotent, so retry is safe.
- `render` stashes under `handoff/<sessionID>` with a `handoff/latest`
  pointer write, then preloads the brief or relocates the file. Raw export
  (`sanitize: false`) skips the stash: the file is the only artifact. Only
  the stash verify-read retries recurs(2). Create, synthetic delivery, and
  the file write run once.
- Storage has no documented quota or TTL. The design never depends on
  expiry; the `latest` pointer is an explicit write.

## Before a live server

Unit tests cross the same seam as callers with fakes. These need a running
beta-19086 server, which the local binary (beta-19059) cannot provide yet:

- `transfer` registers and round-trips through `Rpc.define` server-side.
- Declared error data shape matches the host's TaggedError encoding.
- `SessionForkInput.boundary` still matches the contract boundary.
- The export envelope still decodes as `SessionImportInput`.
