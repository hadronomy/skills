# Docs: JSDoc shape, runnable examples, comments, slop filters

Document public exports only. Internals take none. Member docs stay optional.

Each doc holds one self-contained practical paragraph. Functions start with a
present-tense verb such as Creates or Returns. Extra sections appear at most
once in this order: `**When to use**`, `**Details**`, `**Gotchas**`. Tags
close the doc in this order: deprecated, default, see, category, since. Every
public export carries `@since` and `@category`. Links point at real symbols
with `{@link Symbol}`.

Add an example only for behavior the signature does not show. Each example
uses `**Example**` with a unique title and exactly one non-empty `ts` fence.
Fences run as tests through the doctest runner (`packages/tools/doctest`,
Vitest modules behind `import.meta.vitest`, `// =>` assertions with
`Equal.equals` semantics). Prefer awaited `Effect.runPromise`; use
`Effect.runSync` only when sync run is the contract. Show setup, then
operation, then observation. Concurrency examples use `Ref`, `Deferred`, or
Queue — never mutable probes. Run targeted: `pnpm doctest --run <files>`.

Comments earn their place the same way. Never narrate history. Worth writing:
the reason behind a non-obvious choice with the cost of the other path, the
contract for callers, domain facts readers cannot know, sync warnings for
cases that change together. Never write restated lines, hedged tone, orphan
TODO markers, or commented-out code.

Rewrite or remove every doc that restates its signature, opens with filler,
carries praise adjectives without a measure, hides behind weak modals, shows
an example with no observation, or links a symbol that does not resolve.
