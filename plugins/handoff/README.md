# Handoff plugin

One RPC method moves a session to a resumable pointer. Callers send a
structured intent; the plugin captures history, redacts secrets, and renders
a pointer. Fixes land in one module.

## Use

Slash command in any session:

```text
/handoff continue the audit on Monday
```

The command builds the intent and calls `transfer` once, then posts the
pointer as a queued receipt in the source session. Same call over HTTP:

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

## Layout

```text
src/rpc.ts       transfer contract: shapes, errors, and the define
src/host.ts      host boundary: session, storage, and file tags plus layers
src/stage.ts     interrupt-preserving failure converter
src/capture.ts   Capture service: history read over the gateway
src/redact.ts    secret scan; self-namespace `Redact` bound at the end
src/render.ts    Render service: stash plus preload or relocate
src/transfer.ts  Handoff service composing the three stages
src/plugin.ts    Plugin.define wiring: layers, RPC register, /handoff command
src/index.ts     logic-free entry: default plugin plus contract re-exports
```

Tests use `it.effect` with Ref-backed test layers (`TestSession`,
`TestStorage`, `TestFiles`) instead of the network. Worked JSDoc examples
run as tests through `@effect/doctest`: fences marked `ts import.meta.vitest`
with trailing `// =>` assertions are extracted and run as isolated Vitest
modules, the same way the Effect codebase runs its own docs.

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
  stash. Skipping redaction but keeping a side copy of raw secrets in
  storage would break the spec's fail-closed rule the other way.

## Stage policy

- `capture` reads `session.context` plus `session.get`. Empty context fails
  closed with no retry. Transport faults retry recurs(2); the reads are
  idempotent, so retry is safe.
- `redact` scans every message for high-signal secret shapes and refuses
  with `cause.reason` and `cause.field`. Nothing is stored on refusal.
  The `path` and `deny` cause arms stay reserved; v1 emits `secret` only.
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
