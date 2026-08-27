---
name: agent-progress
description: Show progress for a long-running command without spending context. Use when a build, test run, deploy, or remote job will take minutes, when a tool call would otherwise block with no feedback, or when progress updates would otherwise arrive as conversation messages.
---

# Agent progress

Long tasks have two audiences with opposite needs. The human wants a live bar.
The model needs one line at the end. Sending progress through the conversation
serves the human badly and costs the model a message per update.

`agent-progress` splits them. Every update overwrites one small JSON file that
renderers poll. Only the exit status reaches the conversation.

```bash
scripts/agent-progress run build -- cargo build --release
scripts/agent-progress run win-build --remote windows-mcp -- cargo build
```

Run it with the Bash tool's `run_in_background`. A whole build then costs one
completion notification.

## Where progress comes from

Three sources, best first. All run under a pseudo-terminal, because tools
suppress their rich output when stdout is a pipe.

**OSC 9;4** — the ConEmu progress sequence, emitted by the tool itself. Exact,
structured, no parsing. Cargo emits it with
`CARGO_TERM_PROGRESS_TERM_INTEGRATION=true`, which the runner sets.

**Rendered bar** — a match on `[===>   ] 12/40: name` and on bare percentages,
for tools with no OSC support.

**Explicit protocol** — any command can print `progress: 42/100 message` and
take full control.

Two traps, both found by measurement:

- `CARGO_TERM_COLOR=never` silently disables terminal integration, so no OSC is
  emitted. Leave colour alone.
- `CARGO_TERM_PROGRESS_WHEN=always` demands an explicit width and fails without
  one. Under a PTY cargo draws the bar unprompted, so do not set it.

## Renderers

The state directory is the contract:
`${XDG_STATE_HOME:-~/.local/state}/agent-progress/<name>.json`. Anything that
reads it is a renderer, which is why this works the same in Claude Code, Codex,
and OpenCode.

| Surface | How |
|---|---|
| macOS menu bar | `menubar/build.sh`, then launch `~/Applications/AgentProgress.app`. Metal capsule, eased, SwiftUI dropdown. Works in every harness including UI builds. |
| Claude Code status line | `statusLine` in `settings.json` calling a script that runs `agent-progress list`, with `refreshInterval: 1`. |
| Any terminal | The runner re-emits OSC 9;4 to `/dev/tty` when one exists. |
| Anywhere | `agent-progress watch` in a second pane. |

The menu bar is the one that matters for UI harnesses. Codex takes only
predefined status-line ids and has no slot for a command
([openai/codex#20244](https://github.com/openai/codex/issues/20244)); OpenCode
has no status-line hook at all
([#30295](https://github.com/anomalyco/opencode/issues/30295)).

A UI harness has no controlling terminal, so `/dev/tty` is absent and OSC
reaches nothing. Measured, not assumed: the whole process chain reports no tty.

## Rules

- One `run` per named task. The name is the key, so a second run with the same
  name overwrites the first.
- The runner deletes its state file on exit. Any file older than 300 seconds is
  stale to every renderer, so a killed runner leaves no frozen bar.
- Writes are throttled and go through a temp file and a rename, so a renderer
  never reads half a record.
- Pass the command after `--`. Options before it belong to `agent-progress`.
- On failure the runner prints the last 2000 characters to stderr. A failed run
  should cost context; a successful one should not.
