# 2. AGENTS.md is a symlink to CLAUDE.md

Date: 2026-08-27

## Status

Accepted

## Context

Claude Code reads `CLAUDE.md`. Codex and OpenCode read `AGENTS.md`. Keeping two
files means keeping two files in sync, and they drift on the first hurried edit.

Three options: duplicate the content, write a `CLAUDE.md` whose only line is
`@AGENTS.md`, or make one file a symlink to the other.

## Decision

`AGENTS.md` is a git symlink to `CLAUDE.md`. Git stores the symlink as a blob
containing the target path, so the relationship survives clone and checkout.

## Consequences

One file, one edit, every harness. Both reference repositories in this space
(`mattpocock/skills`, `obra/superpowers`) do exactly this, so the pattern is
understood by anyone reading the repo.

The `@AGENTS.md` import alternative was rejected because it only works in Claude
Code; the symlink is harness-neutral.

Windows checkouts need `core.symlinks=true` or developer mode. The
`.gitattributes` in this repo already pins line endings for the same class of
portability reason.
