## What it does

`docs-craft` keeps documentation load-bearing across code comments, API
docs, and framework pages. It behaves differently from a style guide because
it routes by reader mode: comments say what code cannot, API docs specify
contracts with runnable proof, and each framework page takes exactly one
Diátaxis quadrant. Its defining constraint is deletion over repair — filler
goes out rather than getting reworded.

## When to reach for it

- Type `/docs-craft`, or the agent reaches for it automatically when the task
  involves writing or reviewing comments, API docs, READMEs, or docs pages.
- Reach for this when docs read as filler, when a page mixes instruction
  with background, or when examples carry no observation. Its sibling
  boundary is language craft: `effect-craft` and `rust-craft` own code
  shape and call `docs-craft` for the prose around it.

## The leading word

`slop` is the word the skill thinks with: anything that restates, decorates,
or hedges instead of informing. Name it on sight and cut it.

## It's working if

- Touched docs each hold one job a reader can state back.
- Every behavior-showing example executes somewhere in CI.
- Reviews return shorter docs, not longer ones.

## Where it fits

Standalone for any docs task, and a chain step inside language crafts, which
invoke it for comments and API docs. Its closest neighbour is `effect-craft`,
whose JSDoc and doctest mechanics it generalizes.
