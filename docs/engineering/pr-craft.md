## What it does

`pr-craft` writes pull request bodies that a reviewer can act on: title, the
problem, the change, evidence, verification steps, honest limits, and a reading
order. It also knows which tool produces each piece of evidence — `calldiff`
for a call-stack diff, DiffsHub for a fast diff link, `gh-image` for
screenshots, `gh` for everything else.

It organises the body around the seven questions a reviewer arrives with rather
than around a template's headings, and it drops any section that carries
nothing. A three-line change gets three lines.

## When to reach for it

- **Invocation mode.** Type `/pr-craft`, or the agent reaches for it
  automatically when you open, rewrite, or review a pull request body.
- **Trigger boundary.** Reach for this when the change is ready and the body
  needs writing. When the change is too large for one review, split it first:
  `gh-stack` owns that, and each layer then comes back here for its own body.

## Prerequisites

None to write a body. The evidence tools are optional and per-change:
`npx calldiff` needs no install, `gh extension install drogers0/gh-image` is a
one-time setup for screenshots, and Codiff is a macOS app.

## Show, do not assert

The rule the skill turns on. Every claim in a body has a matching artifact:

| The change... | Show |
|---|---|
| alters which code runs | a `calldiff` call-stack diff |
| changes anything a person sees | before-and-after images, same viewport |
| claims to be faster | two numbers and the tool that produced them |
| fixes a bug | the test that fails without it |

A body that asserts without showing is a body a reviewer has to verify from
scratch, which is the work you were meant to save them.

## Common questions

**Does it just fill in a template?**
No. It reads the repo's template and the last three merged PRs first, then
writes to the repo's conventions. Where the repo has no template, it uses its
own section order and deletes what the change does not earn.

**Why is Simplified Technical English involved?**
A body is read by tired people, often not in their first language, often on a
phone. STE gives the sentence limits, the ban on hedging modals, and
condition-before-command. The skill pairs it with an explicit instruction to
still sound like a person, because a body that reads as machine-written gets
skimmed.

**What about AI disclosure?**
The repo decides. Some projects require a disclosure and auto-close PRs without
one; others forbid agent attribution. The skill checks the repo's policy before
writing rather than applying a default.

## It's working if

- The opening paragraph alone tells you what changed and why.
- No section is a retyped file list.
- Every visual change has two comparable images.
- The verification steps are commands you can paste.
- The body says what the author did not do.
- You know which file to open first.

## Where it fits

A reach-for-it-anytime standalone that fires at the end of a change. Its one
neighbour is `gh-stack`: when a change is too big to review in one pass, that
skill splits it, and `pr-craft` writes a body for each layer describing only
that layer's diff.
