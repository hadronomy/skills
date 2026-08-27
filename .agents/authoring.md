# Authoring a skill here

The universal craft — pointers, the information hierarchy, leading words,
pruning — lives in the `writing-for-agents` skill. Call the Skill tool with
`writing-for-agents` before writing prose. This file covers only what is
specific to this repo and to the Agent Skills spec.

## Start it

```bash
npx skills@latest init <name>          # from inside the target bucket
```

Then move it under the right bucket and add `agents/openai.yaml`.

## The spec, in full

These are hard limits. `npm run validate` enforces every one.

| Field | Required | Constraint |
|---|---|---|
| `name` | yes | 1–64 chars, lowercase `a-z0-9-`, no leading, trailing, or doubled hyphen, **must equal the directory name** |
| `description` | yes | 1–1024 chars, states what it does *and* when to use it |
| `license` | no | A licence name, or a bundled licence file |
| `compatibility` | no | ≤500 chars. Only when the skill needs specific tooling or network access |
| `metadata` | no | String-to-string map |
| `allowed-tools` | no | Space-separated pre-approved tools. Experimental; support varies |

Directory shape:

```
<name>/
  SKILL.md          required
  agents/openai.yaml  Codex metadata; required for a promoted skill
  references/       loaded on demand
  scripts/          executable, self-contained, clear errors
  assets/           templates and data
```

## Budgets

- `SKILL.md` under 500 lines. The whole body loads the moment the skill fires.
- Reference links stay **one level deep** from `SKILL.md`. No chains.
- The description is always loaded, for every skill, on every turn. It earns
  harder pruning than the body.

## What earns a reference file

Branching. Material every path needs stays inline; material only some paths
reach goes behind a link. A file that every run opens is a file that belonged
in `SKILL.md`.

## The router shape

A skill with more than three or four branches works best as a router: a core
contract that always applies, a table mapping task to reference file, and a
workflow with completion criteria. `rust-craft` is the worked example.

## Done when

- `npm run validate` passes.
- The frontmatter `name` matches the directory name and the bucket is right.
- `agents/openai.yaml` exists and its invocation policy matches the frontmatter.
- A promoted skill has a docs page at `docs/<bucket>/<name>.md`.
- Every relative link resolves.
- A changeset records the change.
