# Writing docs pages

Every promoted skill — anything in `engineering/` or `productivity/` — has a
human-facing page at `docs/<bucket>/<name>.md`. Skills in `misc/`,
`in-progress/`, and `deprecated/` get none.

The page is not the skill and not a copy of `SKILL.md`. Most skills here are
reached by a human who has to remember they exist. That memory is cognitive
load. The page relieves it: it orients one reader around one skill so they know
when to reach for it and where it sits.

Act whenever a promoted skill is added, renamed, or changes behaviour. A rename
moves the file. A bucket move moves the file. A demotion deletes it.

There is no H1; the title comes from the filename.

## Page structure

Keep this order. The frame — `What it does`, `When to reach for it`,
`Where it fits` — is on every page. The rest carries only what this skill needs.

<page-template>

## What it does

One or two plain paragraphs. Lead with the one-sentence job, then state the
**defining constraint**: the single fact that makes this skill behave
differently from the obvious default. Write it as a plain sentence, never as a
labelled aside. This is the most valuable line on the page.

## When to reach for it

- **Invocation mode.** "You invoke this by typing `/<name>`, and the agent won't
  reach for it on its own", or "Type `/<name>`, or the agent reaches for it
  automatically when a task fits."
- **Trigger boundary.** "Reach for this when …", plus the sibling boundary where
  one exists.

## Prerequisites

Only when the skill needs something in place: a workspace it writes into, prior
setup, or repo tooling. Drop the heading otherwise.

## <free-form middle>

One to three sections in the skill's own vocabulary. No prescribed headings. The
one non-negotiable: surface the skill's **leading word** — the compact concept
the reader will later think with when reaching for it.

## Common questions

Real questions, each in bold with the answer beneath. Hunt before you write:
`gh issue list --repo hadronomy/skills --search "<name>" --state all`, and
`CHANGELOG.md` for anything renamed or moved. Size the section to what the hunt
found. An invented question teaches nothing.

## It's working if

Bullets naming what the reader sees when the skill is doing its job. The bar:
checkable without opening `SKILL.md`.

## Where it fits

Role — chain step, run-once setup, periodic maintenance, or standalone — plus
the one or two neighbours that matter, each with a because-clause.

</page-template>

## Conventions

- Explain the **why**, never the process. The page never reproduces the steps.
- Use the skill's leading words so the page and the skill speak one language.
- Branches go in a table or a list, never a paragraph.
- **No install commands.** They live in `.agents/install-block.md`.
- Keep the page low-load. It argues against furniture; do not add any.

## Done when

- The page exists at `docs/<bucket>/<name>.md` and no stale page survived a
  rename or move.
- `What it does` states the defining constraint as plain prose.
- `When to reach for it` states invocation mode and the trigger boundary.
- `Where it fits` names the role.
- The middle surfaces the leading word.
- Every multi-way branch is a table or a list.
- The page writes no install command.
- Every link resolves.
