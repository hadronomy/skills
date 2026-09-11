# Handoff plugin

One RPC method moves a session to a resumable pointer, and the terminal
client lands you in it. Callers send a structured intent. The plugin captures
history, renders a pointer, and announces where the work went. Fixes land in
one module.

## Install

One entry installs both halves. OpenCode resolves a plugin to three
entrypoints: `server`, `tui`, and `rpc`. This package ships all three, so the
server does the handoff and the terminal client follows it.

1. Run `opencode2 --version` to show the host version.
2. If the host is older than beta-19271, upgrade the CLI to the `beta` tag.
   The plugin is built against beta-19271.
3. Run `opencode2 plugin add '@hadronomy/opencode-handoff-plugin'` to install
   from the npm registry. The command also adds the entry to the `plugins`
   array in `opencode.jsonc`.
4. For local development, add the absolute workspace path to the `plugins`
   array instead, such as `"/Users/hadronomy/repos/skills/plugins/handoff"`.
   A local directory resolves root-level files and ignores the `exports` map,
   which is why `index.ts`, `tui.ts`, and `rpc.ts` all sit at the root.
5. Run `/handoff` in a session to start a handoff.

## Use

Slash command in any session:

```text
/handoff continue the audit on Monday
```

The command builds the intent and completes one transfer. Nothing is written
back into the source session. The handoff announces itself, and the terminal
client watching that session opens the new session and focuses it. Another
window keeps its own work.

Text after `/handoff` becomes the goal. Bare `/handoff` falls back to the
session title, then to the last thing you asked for, then to a standing label.
A session titles itself a few seconds after its first reply, so the third step
is what names the work in a young session. Delivery, attachments, skills,
agent, and model arrive from context, so the command takes no flags. Anything
vaguer belongs to the guided version below.

For the guided version, copy `commands/handoff-interview.md` from the package
into a `commands` directory. Then run `/handoff-interview`. The agent reads the
session, asks through the question tool only for what context cannot answer,
and calls the `handoff_transfer` tool once. The tool takes the transfer intent
and returns the pointer, and it announces exactly like the slash command does.

The intent carries `skills`, `agent`, `model`, and typed `refs`. Skills default
to empty. Agent and model stay absent unless set, and the transfer fills both
from the source session. Refs take `spec`, `plan`, `adr`, `issue`, `commit`, or
`file`. Session, stash-key, and next-session IDs are brands. All three travel
as plain strings on the wire.

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

## The brief

The brief is the whole inheritance. A session that starts from it has no other
context, so it carries the work itself, not a pointer to work held elsewhere.

Render condenses the source conversation with the model that session was
using. The brief then names the goal, the next move, the skills, the
artifacts, and the condensed handover. Machinery the receiver cannot act on
stays out: the boundary, the message count, the stash key, and the source
session ID live in the stash and the pointer.

If the model call fails, the brief carries the tail of the conversation
verbatim instead, and the server logs a warning. A failed call costs the brief
its polish, never its content.

Reasoning and tool parts never reach the brief. They are the model talking to
itself, and they crowd out what the next agent can act on.

## Events

The contract publishes one event per resume mode, plus one for a stop. A
subscriber picks the arm it can act on, and never branches on a field that can
be absent. All three arrive as `rpc.handoff.<name>`.

| Event | Fires when | Carries |
|---|---|---|
| `opened` | a handoff lands in a fresh session | `key`, `sessionID`, `nextSessionID`, `goal`, `messages` |
| `exported` | a handoff lands in a file | `key`, `sessionID`, `file`, `goal`, `messages` |
| `failed` | a handoff stops | `sessionID`, `goal`, `message` |

`failed` is why the slash command needs no receipt. Its executor returns void,
so a failed handoff stops in silence without an event.

## In the session that receives a handoff

The brief lands as one line in the transcript. The host renders the message
description there, never the brief text, so that line names where the work
came from: `handoff from "Casual greeting check-in"`. A session younger than
its own title falls back to the handoff goal.

The brief also stamps `metadata.handoff` with the stash key, and every key is
`handoff/<source session id>`. The terminal client reads the origin back out
of it. `<leader>h` opens the source session, and so does the command palette
entry "Go to the session this was handed off from". The command needs no
stored state, and it works for a handoff that any client started.

The command stays disabled outside a handed-off session, so the binding is
free everywhere it means nothing. Bind it elsewhere by its id,
`handoff.origin`.

The transcript line itself is not clickable. The client plugin surface
publishes no slot inside the message list and no mouse event, so nothing can
attach behaviour to a rendered message.

`sessionID` is the source. Subscribe with the contract, never a string:

```ts
import { Handoff } from "@hadronomy/opencode-handoff-plugin/rpc"

client.rpc(Handoff).events.on("opened", (event) => {
  event.data.nextSessionID // the session to open
})
```

The two success events emit after the handoff has already landed, and a failed
emit warns instead of failing. A lost event costs a watching client its report,
never the work.

The brief that lands in the new session carries `metadata.handoff`, set to the
stash key. That is how a client tells a handoff brief from any other message,
and how it reaches the stash behind one.

## Failures

Empty input fails validation before the handler runs.
`Expected a value with a length of at least 1 at ["sessionID"]` names an empty
session ID. The two stage errors cross the seam as typed failures, each with
the step that failed:

| Error | `reason` | Means |
|---|---|---|
| `CaptureFailed` | `empty` | the session has no history to hand off |
| `CaptureFailed` | `transport` | the host did not return the session history |
| `RenderFailed` | `encode` | the transfer data did not serialize |
| `RenderFailed` | `stash` | plugin storage did not keep the transfer |
| `RenderFailed` | `create` | the host refused a new session |
| `RenderFailed` | `deliver` | the new session did not accept the brief |
| `RenderFailed` | `write` | the file write failed |

`src/receipt.ts` turns each reason into one sentence. The RPC error message,
the tool error, and the source-session receipt all frame that same sentence.
A failure never reads two ways.

## Layout

```text
index.ts          server entry, root-level for local installs
tui.ts            terminal client entry, same reason
rpc.ts            shared contract entry, same reason
src/rpc.ts        transfer contract: shapes, bounds, errors, events, the define
src/command.ts    command input builders, namespaced as `Command`
src/receipt.ts    failure and chip text, namespaced as `Receipt`
src/transcript.ts host messages to plain text, namespaced as `Transcript`
src/tool.ts       agent-callable transfer tool surface
src/host.ts       host boundary: session, storage, file, and summarizer tags
src/stage.ts      interrupt-preserving failure and fallback converters
src/capture.ts    Capture service: history read over the gateway
src/render.ts     Render service: stash plus preload or relocate
src/transfer.ts   Handoff service composing the two stages
src/plugin.ts     Plugin.define wiring: layers, RPC register, /handoff command
src/tui.ts        client plugin: follows the events, opens the new session
src/index.ts      logic-free entry: default plugin plus contract re-exports
```

The slash command, the agent tool, and the RPC handler all take one
`Transfer.Complete`. That function is the only place a handoff announces
itself, so no trigger can drift into its own half of the behaviour.

Tests use `it.effect` with Ref-backed test layers (`TestSession`,
`TestStorage`, `TestFiles`) instead of the network. Worked JSDoc examples run
as tests through `@effect/doctest`: fences marked `ts import.meta.vitest` with
trailing `// =>` assertions are extracted and run as isolated Vitest modules,
the same way the Effect codebase runs its own docs. `effect-tsgo diagnostics
--strict` (tsconfig `plugins` entry) keeps the Effect-specific rules green; it
runs in CI. The entry follows the sanctioned `effect-tsgo setup` shape,
including the `prepare` patch hook. Bun does not auto-run workspace `prepare`
scripts, so editor hover and diagnostics need one manual step per machine:
`bun run prepare` inside `plugins/handoff`.

Package exports: `.` is the implementation, `./tui` is the terminal client,
`./rpc` is the contract for callers that must not load either.

## Contract deviations

The fixed interface spec is the design source. The build corrects it where the
installed toolchain proves otherwise (effect 4.0.0-rc.112,
@opencode-ai/plugin 0.0.0-beta-19271):

- Defaults are decode-side (`withDecodingDefaultKey`). The spec's
  `withConstructorDefault` never fires on the RPC decode path, so omitted
  `boundary` and `delivery` failed validation.
- `Intent.resume` defaults to fork-local. The spec's own slash-command example
  omits it.
- Render uses `create` plus `synthetic`. The plugin session domain exposes no
  `fork`, `export`, or `import` through beta-19271, so both boundaries start a
  fresh session with the brief. The boundary stays recorded in the stash. True
  fork lands when the host exposes it.
- Error data carries the full tagged error instance. The host types demand the
  class, not a plain payload.
- Capture also reads `session.get`. The spec names only `session.context`, but
  the export envelope must stay import-compatible, which needs the session
  info. Both reads share the recurs(2) idempotent-read policy.
- Export-file with `sanitize: false` writes the file alone and skips the stash,
  so no side copy lands in storage.
- `refs` are typed artifacts (`kind` plus `ref`), a breaking change over string
  refs. The package is pre-1.0, so no migration path ships.
- `skills` defaults to `[]`; `agent` and `model` stay absent unless set.
- Session IDs, stash keys, and next-session IDs are brands (`Session.ID`,
  `Handoff.Key`). All three encode as plain strings.
- Agent and model carry over from source info unless the intent names
  replacements. A server fork preserves the same pair.
- Pointers and the envelope encode through Schema before return or write.
  Malformed output is unreturnable.
- Stage errors carry a `reason` beside `op`. The spec's `RedactRefused` shape
  is gone with redaction, but its idea is not: a refusal names its cause.
- The new session gets no `metadata`. The plugin session domain drops the
  field at `create` through beta-19398, although the HTTP endpoint keeps it.
  The brief carries the stash key instead.
- The tool seam takes JSON Schema, not the `portable` adapter the RPC seam
  takes. The host converts a tool shape for the model, and it refuses a
  vendor it cannot convert, so the tool decodes its own input.
- The terminal client entry imports `@opencode-ai/plugin/tui/plugin`, not the
  `@opencode-ai/plugin/tui` barrel. The barrel re-exports its Solid bindings,
  and `solid-js` is an optional peer that a published install does not carry.
- `generate.text` names the source session's model. Without it the host picks
  a default and fails where no default exists.

## Stage policy

- `capture` reads `session.context` plus `session.get`. Empty context fails
  closed with no retry. Transport faults retry recurs(2). The reads are
  idempotent, so retry is safe.
- `render` stashes under `handoff/<sessionID>` with a `handoff/latest` pointer
  write, then preloads the brief or relocates the file. Raw export
  (`sanitize: false`) skips the stash: the file is the only artifact. Only the
  stash verify-read retries recurs(2). Create, synthetic delivery, and the file
  write run once.
- Storage has no documented quota or TTL. The design never depends on expiry.
  The `latest` pointer is an explicit write.

## Against a live server

Unit tests cross the same seam as callers with fakes. A probe on 2026-09-11
also ran the server half against opencode2 beta-19398, while the package is
built against beta-19271 types. Every result below came from that probe.

| Path | Result |
|---|---|
| Plugin load and RPC register | The local directory resolves and `handoff` registers. |
| `transfer`, fork-local | Returns a pointer. The new session gets the goal as its title. |
| `transfer`, export-file | Writes the envelope and returns the file path. |
| Error encoding | `CaptureFailed` crosses as `{"_tag","op","reason"}` with the sentence as its message. |
| Envelope import | The written file imports into the host, `handoff` key and all, and both messages land. |
| `rpc.handoff.opened` | Fires with `key`, `sessionID`, `nextSessionID`, `goal`, `messages`. |
| `rpc.handoff.exported` | Fires with `key`, `sessionID`, `file`, `goal`, `messages`. |

Two things the probe found, both recorded above as deviations. The plugin
session domain drops `metadata` at `create`, so the stamp moved to the brief.
The brief itself lands in the inbox of the new session, not in its message
list, until that session next runs.

A second probe on 2026-09-11 covered this round against the same host.

| Path | Result |
|---|---|
| `handoff_transfer` registration | Registers. The host logged no rejection after the JSON Schema change. |
| Terminal client entry | `src/tui.ts` imports and exports a setup function. The barrel import failed on `solid-js`. |
| Brief content | Carries the conversation, not a message count and a session ID. |
| Summarizer fallback | The probe server had no provider, so the brief fell back to the transcript and the server logged the warning. |

Two paths stay unexercised. Both need a terminal client and a provider, not an
HTTP call: the `tui` entrypoint opening the session that `opened` names, and a
model-condensed brief end to end. Unit tests cover both with fakes.
