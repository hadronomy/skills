# hadronomy/skills

Agent skills, authored here and installed into Claude Code, Codex, and OpenCode
from one copy. `AGENTS.md` is a symlink to this file, so every harness reads the
same instructions.

Read [`CONTEXT.md`](CONTEXT.md) first and use its vocabulary exactly.

## Before you touch a skill

Read the conventions. They are not optional and they are not obvious:

- [`.agents/authoring.md`](.agents/authoring.md) — the shape of a skill here,
  the spec limits, and what earns a reference file.
- [`.agents/invocation.md`](.agents/invocation.md) — model-invoked versus
  user-invoked, and how one skill reaches another.
- [`.agents/writing-docs.md`](.agents/writing-docs.md) — the docs page for a
  promoted skill.
- [`.agents/install-block.md`](.agents/install-block.md) — the one canonical
  install wording.

For the craft of the prose itself, call the Skill tool with
`writing-for-agents`.

## Buckets carry policy

| Bucket | Ships in the plugin | Docs page | Meaning |
|---|---|---|---|
| `skills/engineering/` | yes | yes | Promoted. Code-facing work. |
| `skills/productivity/` | yes | yes | Promoted. Everything else. |
| `skills/misc/` | no | no | Narrow or one-off. |
| `skills/in-progress/` | no | no | Not ready to recommend. |
| `skills/deprecated/` | no | no | Kept for history. Not linked. |

Moving a folder changes the lifecycle. A skill promoted into `engineering/` or
`productivity/` gains a docs page and a `plugin.json` entry in the same change;
one demoted out of them loses both.

## Commands

```bash
npm run link       # symlink every skill into ~/.claude/skills and ~/.agents/skills
npm run validate   # check frontmatter, naming, size, and plugin manifest drift
npm run list       # list every SKILL.md path
npm run changeset  # record a change for the next release
```

Run `npm run validate` before you finish. It is the gate.

## Rules

- One skill per directory, named for the directory, under the right bucket.
- Every promoted skill carries `agents/openai.yaml`. Keep its invocation policy
  in sync with the frontmatter.
- Add a changeset for any change a user would notice.
- Use Conventional Commits.
- Never write install commands outside `.agents/install-block.md`.
