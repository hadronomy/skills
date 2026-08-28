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
| macOS menu bar | `brew install hadronomy/tap/agent-progress`. Metal capsule, eased, SwiftUI dropdown. Works in every harness including UI builds. |
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

## The menu bar renderer

```bash
brew tap hadronomy/tap
brew trust hadronomy/tap          # Homebrew 6 gates third-party taps
brew install agent-progress
brew services start agent-progress
```

`brew services` owns the login item, so there is no plist to hand-write and no
`launchctl` to invoke. Stop it with `brew services stop agent-progress`.

The formula builds from source, which is the whole distribution argument: a
locally compiled binary never gets a `com.apple.quarantine` xattr, so Gatekeeper
has nothing to block and the app needs no Developer ID and no notarization.
Homebrew casks now require both, and unsigned ones leave the official tap in
September 2026. Building from source sidesteps that entirely, at the cost of
requiring the Xcode command line tools.

Without Homebrew, `menubar/build.sh [path]` produces the same bundle anywhere.

Two things the renderer depends on, neither obvious:

- **It must be an `.app` bundle.** A bare executable runs and stays alive but
  puts nothing in the menu bar, because `NSStatusItem` needs a bundle. The
  bundle does not have to live in `/Applications`; a Homebrew prefix is fine.
- **The capsule derives its height, inset, and centre from the status item's own
  size at draw time**, so it sits correctly whatever height the menu bar is. Do
  not reintroduce `NSStatusBar.thickness` into the render path: it reports the
  item, not the bar, and the two differ by a lot on a notched display.

## Running on a remote host

```bash
agent-progress run build --remote windows-mcp -- 'cd C:\path\to\repo; cargo build'
```

The command runs through `ssh` in PowerShell. Two things about that transport
are not obvious, and both look like the skill is broken when they bite:

**Windows blocks remote-to-local symlink evaluation.** `fsutil behavior query
SymlinkEvaluation` reports R2L and R2R disabled by default. An SSH session
counts as remote, so it cannot follow rustup's shims: `.cargo\bin\cargo.exe` is
a 0-byte symlink to `rustup.exe`, and invoking it fails with
`ERROR_UNTRUSTED_MOUNT_POINT` (448). The runner asks `rustup which cargo` for
the toolchain's real binaries and puts them first on `PATH`. `rustup.exe` is
itself a real file, so it is reachable. This needs no administrator rights, and
does nothing where the shims already resolve. Enabling R2L with `fsutil` also
works but relaxes a security control machine-wide, so prefer the resolve.

**ssh gives the remote command no pty**, so cargo sees no terminal and hides its
progress bar. The runner forces it with `CARGO_TERM_PROGRESS_WHEN=always`, which
requires `CARGO_TERM_PROGRESS_WIDTH` — "always" without a width is a hard error,
not a fallback.

Prefer this over driving a build through `mcp__windows__PowerShell`, which
blocks, caps at 600 seconds, and returns nothing until it finishes.

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
