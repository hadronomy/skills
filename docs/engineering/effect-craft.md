## What it does

`effect-craft` teaches agents to write Effect TypeScript the way the Effect
and opencode codebases do: one consumer line first, one Schema per shape, one
narrow service per capability, barrels that re-export, docs with runnable
examples. It behaves differently from generic coding help because every rule
carries the source file that proves it, and the reference layers load by task
branch instead of all at once.

## When to reach for it

- Type `/effect-craft`, or the agent reaches for it automatically when the
  task fits Effect API work.
- Reach for this when modeling with Schema, building services with Context
  and Layer, reviewing an API surface, or writing JSDoc with examples. Its
  sibling boundary is general TypeScript help: syntax questions and non-Effect
  code belong elsewhere.

## The three notes behind it

The skill distills a vault research set on API design. The full evidence and
long-form guidance live there: the merged guidelines, the work-order moves,
and the docs companion. The skill keeps the checkable rules; the notes keep
the reasoning.

## Common questions

**Does it replace reading the Effect docs?**
No. It routes to the same sources the rules come from and tells the agent
when local guidance runs out.

## It's working if

- New services arrive with `Context.Service`, a layer constructor, and named
  ops without being asked twice.
- New models arrive as Schema with brands and tagged errors.
- Reviews cite missing docs, missing examples, or barrel violations with the
  rule attached.

## Where it fits

Standalone for any Effect TypeScript task, and a chain step before review:
draft with `effect-craft`, then run the repo's own checks. Its closest
neighbour is the repo's test and docs discipline, because the skill's done
state is green narrow checks plus documented exports.
