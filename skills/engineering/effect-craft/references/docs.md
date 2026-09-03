# Docs: Effect deltas live here, discipline lives in docs-craft

Call the Skill tool with "docs-craft" for comments, API-doc shape, slop
filters, and review passes. This file holds only what is Effect-specific.

Tag order is fixed: deprecated, default, see, category, since. Roots carry
stable-semver `@since` and no `@default`. Reuse nearby `@category` values:
constructors, models, guards, services, tags, layers, errors, combinators,
configuration. Services are contracts, tags identify them, layers provide
them. Getters retrieve values while accessors read context.

Runnable fences carry `import.meta.vitest` and run through the doctest
tool at `packages/tools/doctest`. Inline assertions use trailing `// =>`
comments with `Equal.equals` semantics. The transform runs neither Effects
nor promises: await `Effect.runPromise` in examples, `Effect.runSync` only
when sync run is the documented contract.

JSDoc edits check with the docs checker plus lint plus targeted doctest
files. Docs-only change takes no changeset. Record consumer-visible change
like any other.
