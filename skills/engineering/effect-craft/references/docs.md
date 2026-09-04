# Docs: Effect deltas live here, discipline lives in docs-craft

Call the Skill tool with "docs-craft" for comments, API-doc shape, slop
filters, and review passes. This file holds only what is Effect-specific.

Tag order is fixed: deprecated, default, see, category, since. Roots carry
stable-semver `@since` and no `@default`. Reuse nearby `@category` values:
constructors, models, guards, services, tags, layers, errors, combinators,
configuration. Services are contracts, tags identify them, layers provide
them. Getters retrieve values while accessors read context.

Runnable fences carry `import.meta.vitest` and run through `@effect/doctest`.
Configure `Doctest.plugin()` with `includeSource`, pinned at `4.0.0-rc.112`.
Fence plus `// =>` plus Plugin plus `includeSource` is the proven set. This
set is green under vitest `5.0.0`, though the peer range reads `vitest <5.0.0`.
Peer ranges are advisory. Spike the range before you obey it. Native `if
(import.meta.vitest)` blocks are unsupported. The plugin collects through
generated collectors and never executes the source module. Native blocks that
an agent invents test nothing. Inline assertions use trailing `// =>`
comments with `Equal.equals` semantics. The transform runs neither Effects
nor promises: await `Effect.runPromise` in examples, `Effect.runSync` only
when sync run is the documented contract.

JSDoc edits check with the docs checker plus lint plus targeted doctest
files. Docs-only change takes no changeset. Record consumer-visible change
like any other.
