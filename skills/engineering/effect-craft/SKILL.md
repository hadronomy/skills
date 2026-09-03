---
name: effect-craft
description: Craft Effect TypeScript APIs with the discipline of the Effect and opencode codebases. Use when modeling data with Schema, building services with Context and Layer, naming operations with Effect.fn, exposing modules through barrels, designing hooks or HTTP surfaces, or writing JSDoc with runnable examples — new code, refactors, and API reviews.
---

# Effect Craft

Write Effect TypeScript that reads like the call it serves: one consumer line,
one Schema per shape, one narrow service per capability. The rules here are
distilled from the codebases that set the bar: `Effect-TS/effect` and
`sst/opencode` on the `v2` branch. Read
[references/sources.md](references/sources.md) when you need to check why a
rule exists.

This is a routed skill. Always apply the core contract. Read only the reference
layers the task needs.

## Core contract

1. **The consumer line is the whole DX.** Write the call before the
   implementation. If the call needs a comment, rename until it does not. If
   the call needs three config objects, merge them into one.
2. **One Schema per shape.** A record is a `Schema.Struct`, a state is a
   `Schema.Literal` union, an ID is a brand, a failure is a
   `Schema.TaggedError` with the `Self` generic. The declaration is the type,
   the decoder, and the wire entry. Never triplicate them.
3. **One narrow service per capability.** Define it with `Context.Service`,
   build it with `Layer.effect`, consume it with `yield*` or `Effect.provide`.
   Bind services to named variables. Never nest yields. Never return `Effect`
   from a pure helper.
4. **Name every operation.** Wrap reusable work in `Effect.fn("Name")` and
   compose bodies with `Effect.gen`. The name becomes the span and the log
   field.
5. **Values, not machinery.** Config travels through `Config` recipes —
   `process.env` stays out of domain code. Failures are tagged data matched
   with `catchTag`. Retries are bounded `Schedule` values, and only transport,
   rate-limit, and internal faults retry.
6. **Barrels re-export; files implement.** One concept per file, `export * as
   Name` from a logic-free `index.ts`, deep imports inside the repo, generated
   sections regenerated and never hand-edited.
7. **Docs earn their place.** Document public exports with one practical
   paragraph, fixed tag order, and runnable `ts` examples executed as tests.
   Delete every doc that restates its signature.
8. **Check narrowly.** Run the smallest check that covers the change. Touch a
   public export and its docs travel in the same change.

## Branches

| Task | Read |
|---|---|
| Data models, brands, tagged errors | [references/models.md](references/models.md) |
| Services, layers, named ops, config, retry, streams | [references/services.md](references/services.md) |
| Barrels, dual call styles, client flavors, protocol and codegen | [references/surface.md](references/surface.md) |
| JSDoc shape, runnable examples, code comments, slop filters | [references/docs.md](references/docs.md) |
| Quality gates, per-artifact checklists, friction fixes | [references/quality.md](references/quality.md) |
| Why behind a rule, with source links | [references/sources.md](references/sources.md) |

## Done when

- `npm run validate` passes for this skill.
- Every touched public export carries docs plus a runnable example where the
  signature does not show the behavior.
- The narrowest check covering the change is green, and the result is reported.
