# 3. A restore script covers the global-lock gap

Date: 2026-08-27

## Status

Accepted

## Context

The `skills` CLI keeps two lock files. The project lock, `skills-lock.json`, has
`skills experimental_install` to rebuild from it. The global lock,
`~/.agents/.skill-lock.json`, has no restore command at all — verified by
reading the CLI bundle, not the documentation.

Every skill installed with `--global` is therefore unreproducible on a new
machine.

## Decision

`scripts/restore-global-skills.mjs` reads the global lock, groups entries by
source, and replays them as `skills add --global` calls. `--export` writes
`global-skills.json`, which is committed.

## Consequences

A new machine is one command away from the full set. The committed manifest also
survives a lock-format change, since it records intent rather than machine
state — the lock is at version 3 already.

The lock records no agent list, so the target agents are a flag with a default
rather than something the script can recover. If a skill was installed to only
one agent, the restore installs it to all three.

Move to project scope and this script retires. That is the better long-term
answer, and it is not worth the churn today.
