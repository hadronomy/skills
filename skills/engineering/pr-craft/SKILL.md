---
name: pr-craft
description: Write pull requests a reviewer can act on. Use when opening, rewriting, or reviewing the body of a pull request — title and description, the problem and approach, call-stack diffs, before-and-after screenshots, verification steps, risks, a review guide, and the tools that produce each part.
---

# PR Craft

A pull request body has one job: let a reviewer decide, quickly and correctly,
whether this change should land. Everything below serves that.

The reviewer arrives with seven questions, in this order. The body answers them
in the same order:

1. What is this?
2. Why does it exist?
3. What did you do?
4. Can I see it?
5. Does it work?
6. What should I worry about?
7. Where do I start reading?

## Core contract

1. **The repo is the authority.** Read `.github/pull_request_template.md`,
   `CONTRIBUTING.md`, and `AGENTS.md` first. Read the last three merged PRs to
   match house voice and section names. Repo convention beats every default
   here.
2. **Lead with what and why.** The first line is the change, in the imperative.
   The first paragraph is why it exists. A reviewer who reads nothing else must
   still know both.
3. **Describe the change, never the files.** "Moved `x` to `y`, updated
   `z.ts`" is the diff talking. Say what behaviour is different now.
4. **Show, do not assert.** A behaviour change gets a call-stack diff. A visual
   change gets before-and-after images. A performance claim gets two numbers.
5. **State what you did not do.** Known gaps, deferred work, and the shortcut
   you took belong in the body. A reviewer who finds one you hid stops trusting
   the rest.
6. **Give the reviewer a path in.** Name the file to read first and the order
   that makes the change make sense.
7. **Every claim is checkable.** Verification steps are commands the reviewer
   can paste, not "tested locally".
8. **Write it in Simplified Technical English, and still sound like a person.**
   Short sentences, active voice, one word per concept, no hedging. See
   [references/writing.md](references/writing.md).
9. **Never invent evidence.** No screenshot you did not take, no benchmark you
   did not run, no test result you did not see.
10. **Follow the repo's AI-disclosure policy.** Some projects require a
    disclosure and close PRs that omit it. Others forbid agent attribution
    entirely. Check before you write; the repo decides, not habit.
11. **Re-read the body against the final diff** before you open or update the
    PR. Descriptions go stale during review.

## Route the task

| Task | Read |
|---|---|
| Write or restructure the body | [body.md](references/body.md) |
| Get the prose right — tone, length, what to cut | [writing.md](references/writing.md) |
| Produce a call-stack diff, a fast-diff link, or a review walkthrough | [tools.md](references/tools.md) |
| Capture and embed before-and-after images or a recording | [visuals.md](references/visuals.md) |
| See a finished body for this kind of change | [examples.md](references/examples.md) |
| Check why a rule here exists | [sources.md](references/sources.md) |

Splitting one large change into a reviewable chain is a different job: call the
Skill tool with `gh-stack`. Each layer then gets its own body describing only
that layer's diff.

## The shape

Sections in this order. Drop any that carries nothing — an empty heading costs
the reviewer a scroll and tells them nothing.

```markdown
<one paragraph: what changed and why, no heading>

[Fast diff](https://diffshub.com/OWNER/REPO/pull/N) · Closes #123

## The problem
## The change
## Call stack            <- behaviour changed
## Before / After        <- anything visual
## Verifying
## Risks and limits
## Reviewing this
```

Full anatomy, with what belongs in each and what does not, is in
[body.md](references/body.md).

## Workflow

### 1. Read the ground

Repo template, contributing guide, AI policy, and the last three merged PRs:

```bash
gh pr list --state merged --limit 3 --json number,title,body
```

Done when you can name the repo's section headings, its title convention, and
its disclosure policy.

### 2. Read your own diff

```bash
git diff --stat main...HEAD
git log --oneline main...HEAD
```

Find the one sentence that says what is different now. If you cannot write it,
the change is doing more than one thing — split it.

Done when that sentence exists.

### 3. Gather evidence

Only what the change earns: a call-stack diff for a behaviour change, images
for a visual one, numbers for a performance one. See
[tools.md](references/tools.md) and [visuals.md](references/visuals.md).

Done when every claim you intend to make has something backing it.

### 4. Write and open

Write the body to a file, then:

```bash
gh pr create --title "..." --body-file pr-body.md --draft
```

Open as a draft, read the rendered body on GitHub, fix what reads badly, then
mark it ready. The rendered body is the real artifact; the markdown is not.

Done when the rendered body answers all seven questions and the fast-diff link
resolves.

### 5. Keep it true

When review changes the code, update the body. A description that describes an
earlier version of the change is worse than none.
