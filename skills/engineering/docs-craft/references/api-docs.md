# API docs: shape plus runnable proof

Document public exports only. Internals take none. Member docs stay
optional. Each doc holds one practical paragraph about the concept, never
the implementation. Functions start with a present-tense verb such as
Creates or Returns.

## JSDoc (Effect and TypeScript)

Tags close the doc in fixed order: deprecated, default, see, category,
since. Every public export carries `@since` and one `@category`. Links
point at real symbols with `{@link Symbol}`. Examples appear only for
behavior the signature does not show: one titled `**Example**`, exactly one
non-empty `ts` fence. Fences run as tests through the doctest runner
(Vitest modules behind `import.meta.vitest`, `// =>` assertions). Prefer
awaited `Effect.runPromise`. Run targeted: `pnpm doctest --run <files>`.

## rustdoc

Sections in fixed order: description, `# Examples`, `# Errors`, `# Panics`
(only when each applies). Examples compile and run under `cargo test
--doc` — a failing doctest fails the build. Document safety contracts on
`unsafe` functions; safe wrappers need no safety section.

## README API sections

State the call shape, one minimal example, and the failure modes. Link to
the generated reference for the rest. Never duplicate the reference in
prose: prose rots, generated output does not.
