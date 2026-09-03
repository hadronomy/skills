---
name: setup-hadronomy
description: Set up this repo the hadronomy way: orient it to the vault, pin the craft skills that fit its stack, and record the config later work assumes. Run once per repo before the first real task.
disable-model-invocation: true
---

# Setup Hadronomy

Scaffold the per-repo substrate that the craft skills assume: a pointer block
in the root doc, a fingerprint plus craft pins under `docs/agents/`, and a
working-note line when the vault tracks the repo.

This is a prompt-driven skill, not a deterministic script. Explore, present
what you found, confirm with the user, then write. Never write silently:
setup edits someone's root doc.

## Process

### 1. Explore

Read the repo's starting state. Read whatever exists; don't assume:

- `git remote -v`: which host, if any.
- `CLAUDE.md` and `AGENTS.md` at the root: does either exist, and is there
  already an agent-skills block in either.
- `package.json`: an `effect` dependency and its major version. v4 pins the
  Effect branch. **v3 is blocked**: record it, pin nothing Effect-related,
  point at the v4 upgrade path first.
- `Cargo.toml`: pins `rust-craft`.
- Typst files, `windows-mcp` signals: offer the matching in-progress craft as
  opt-in only, labeled as such. In-progress means not ready to recommend.
- `.agents/` with its own contract: defer to it. Mirror the same filenames
  there instead of `docs/agents/` and say so in the pointer block.
- The vault: does a working note in `content/06 Projects/` cover this repo.

Skip every branch exploration settles. No Effect dependency means no Effect
section. No in-progress signals means no opt-in section.

### 2. Present findings and ask

Summarise what is present and what is missing. Take the sections in order,
one section and one answer at a time. Lead each section with the recommended
answer so the user accepts it in a word.

- **Section A, core pin (always).** Pointer block plus fingerprint file.
- **Section B, Effect branch (only with an `effect` dependency).** v4 writes
  the pin and the version record. v3 writes the blocked record and stops.
- **Section C, craft pins (only for detected signals).** Promoted crafts pin
  automatically. In-progress crafts offer opt-in with the label attached.
- **Section D, working-note line (only when the vault tracks the repo).**

### 3. Confirm and edit

Show the user a draft of the root-doc block and each config file. Let them
edit before writing. On re-runs, re-explore first and show the diff of what
changes — new pins, version bumps — then update in place, never duplicating
an existing block.

### 4. Write

Pick the file to edit: if `CLAUDE.md` exists, edit it, else if `AGENTS.md`
exists, edit it. Never create one when the other already exists. Update an
existing skills block in place rather than appending a duplicate.

The block:

```
## Agent skills

### Stack

[one line: language, toolchain, Effect version or "no Effect"].
See `docs/agents/hadronomy.md`.

### Pinned crafts

[one line per pin: craft name plus trigger]. Unlisted work uses no craft.
```

Then write `docs/agents/hadronomy.md` (repo fingerprint plus pinned-crafts
table) and, only when Section B ran on v4, `docs/agents/effect.md` (version,
barrel layout, pointer to the vault playbook). v3 writes the version with a
`blocked: upgrade to v4 first` flag and no pin. See
[references/writes.md](references/writes.md) for seeds.

When the vault tracks the repo, append one line to its working note:
`Effect and stack work in this repo obeys the vault playbook plus
docs/agents/hadronomy.md.` Never rewrite the note.

### 5. Done

Tell the user the setup is complete and which crafts now fire in this repo.
Mention the config files stay editable by hand; re-running this skill is only
necessary when the stack changes or a new craft promotes.
