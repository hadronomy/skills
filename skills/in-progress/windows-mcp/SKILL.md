---
name: windows-mcp
description: Driving the Windows desktop on `workstation` through the windows MCP server. Use before any `mcp__windows__` tool, when a desktop call blocks or returns "Desktop busy", when Snapshot or Screenshot come back empty, or when this agent has no desktop tools and the task needs them.
---

# Windows desktop

One physical Windows machine, `workstation`, reached over SSH from this Mac. Its tools
arrive as `mcp__windows__*`.

## Which half you have

Two ports serve different toolsets. Read your own tool list rather than assuming:

- **Desktop port** — 37 tools, including `Click`, `Type`, `Snapshot`, `Screenshot`, `App`.
- **Tool port** — 16 tools: `PowerShell`, `FileSystem`, `Registry`, `Service`, `EventLog`,
  `Network`, `Package`, `Scrape`. No UI tools at all.

With no desktop tools, UI work is not yours to do. Say so, and let the agent on the
desktop port take it.

## The desktop is someone's real machine

`workstation` is in daily use, not a scratch VM: real apps, real windows, a real
logged-in session. Leave it as you found it — restore the window you switched away from,
close what you opened, and type only into a window you deliberately focused.

## The working loop

`Snapshot` returns the foreground window as a labeled accessibility tree, with element
names and refs you can act on directly. That is the primary sense.

1. `Snapshot` to see what is there.
2. Act: `Click`, `Type`, `Invoke`, `Shortcut`.
3. `Snapshot` or `Assert` to confirm it landed.

`Screenshot` costs roughly 700 KB a call and tells you less than the tree. Reach for it
when you need actual pixels — a rendering bug, a canvas, an image — not to find a button.

## The lease

One physical desktop, so desktop calls are serialized across every connected agent. The
relay grants a lease on your first desktop call and holds it while you keep working.

**Keep multi-step UI work tight.** The lease releases after 8 seconds idle, or 3 seconds
when another agent is queued. Pause longer than that mid-sequence and another agent can
take the desktop between your `Snapshot` and your `Click` — and your click lands
somewhere else. For anything past a few steps, use `Plan` then `Apply`: `Apply` runs the
whole sequence inside one call, holding the lease throughout, which makes it atomic.

**A busy desktop is a wait, not a failure.** A blocked call waits up to 2 minutes, then
returns `isError: true` saying the desktop is busy. Nothing was sent. Wait a few seconds
and retry the same tool — that is the path that respects the lease. Driving the UI by
another route, such as SendKeys through `PowerShell`, bypasses the lease and corrupts
whichever agent holds it.

`Kill` and `GuardrailStatus` sit outside the lease and always answer.

## When the desktop looks empty

`Snapshot` returning nothing, or `DisplayInventory` reporting 1024x768, means the server
is running outside the interactive session: it sees no desktop, and input goes nowhere
with no error. This is a session problem, not a transient one — retrying will not fix it.
The relay must run in session 1, which needs the user signed in. If they signed out, ask
them to sign back in.

## What cannot be automated

The sign-in screen, the lock screen, and UAC elevation prompts live on the Windows secure
desktop, which no user-session process can see or drive. When a UAC prompt appears the run
is blocked: tell the user and let them click it. Elevated apps cannot be driven from here
either.

## Long-running work, and showing progress

`PowerShell` blocks and caps at 600 seconds, and it returns everything at the
end. A cargo build hits that ceiling and gives no feedback until it does. Codex
caps its tool calls at 300 seconds, which is tighter still.

Do not reach for the MCP tool for this. The same machine answers plain SSH:

```bash
ssh windows-mcp 'powershell -NoProfile -EncodedCommand <base64>'
```

Output streams line by line as it is produced, with no timeout of its own, and
it bypasses the desktop lease entirely because no UI is involved.

**Encode the command.** Quoting does not survive the trip through this shell,
sshd, cmd, and powershell — it silently collapses and the command runs wrong or
not at all. Base64 of UTF-16LE has nothing to escape:

```bash
enc() { python3 -c 'import base64,sys;print(base64.b64encode(sys.stdin.read().encode("utf-16-le")).decode())'; }
ssh windows-mcp "powershell -NoProfile -EncodedCommand $(enc < script.ps1)"
```

Set `$ProgressPreference = 'SilentlyContinue'` at the top of every script, or
PowerShell writes CLIXML progress records onto stderr and they land in your
output.

**`Start-Process -RedirectStandardOutput` does not work here.** Launched from a
non-interactive SSH session it returns a PID and writes a zero-byte file
forever. Stream over the live connection instead.

### Progress without context cost

Every line a monitor emits is a conversation message. A build that reports 40
times costs 40 messages. Route progress to the status line instead, which
renders in the UI and never reaches the model:

```bash
scripts/run-progress.sh inari windows-mcp 'cd C:\Users\pablo\Repos\inari; cargo build'
```

Run it with the Bash tool's `run_in_background`. The pipeline overwrites one
state file per run in `~/.claude/run-progress/`, the status line reads that file
once a second, and the whole build costs exactly one completion notification.

Cargo hides its progress bar when stdout is not a terminal, and draws it with
carriage returns rather than newlines. `run-progress.sh` handles both: it sets
`CARGO_TERM_PROGRESS_WHEN=always` and splits the stream on `\r`, which turns
`Building [====>    ] 96/240: tokio` into a live bar.

Requires `statusLine` in `settings.json` pointing at a script that reads
`~/.claude/run-progress`, with `refreshInterval: 1`. `scripts/statusline-progress.sh`
is that segment, and composes with an existing status line.

The protocol-level answer is MCP progress notifications: the client sends a
`progressToken` and the server emits `notifications/progress` against it. That
needs changes in `windows-mcp-server` and a client that sends the token, and the
documented fallback when either is missing is to skip silently. The status line
needs neither.

## Blast radius

`PowerShell`, `Registry`, `FileSystem`, `Process` and `App` have full system access with
no sandbox, on a machine that matters. Confirm with the user before deleting, overwriting,
or changing system state. Every call lands in a tamper-evident audit log that cannot be
switched off, so treat your actions as reviewable.

`Credentials` injects a secret into an app without revealing it and has no read mode.
Never ask for the plaintext.
