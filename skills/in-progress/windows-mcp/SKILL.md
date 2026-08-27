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

## Blast radius

`PowerShell`, `Registry`, `FileSystem`, `Process` and `App` have full system access with
no sandbox, on a machine that matters. Confirm with the user before deleting, overwriting,
or changing system state. Every call lands in a tamper-evident audit log that cannot be
switched off, so treat your actions as reviewable.

`Credentials` injects a secret into an app without revealing it and has no read mode.
Never ask for the plaintext.
