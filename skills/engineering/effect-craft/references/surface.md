# Surface: barrels, dual styles, client flavors, protocol and codegen

Put each concept in its own file. Re-export through a logic-free `index.ts`
with `export * as Name`. Consumers write `Effect.gen` and `Schema.Struct`.
Inside the repo, import exact module paths with `.ts` extensions — never the
barrel. Mark generated sections with `@barrel` and regenerate from source.

Bind the namespace on the export side: `export * as
Redact from "./redact.js"`. Consume it by name: `import { Redact }` plus
`Redact.scrub`. Star imports stay banned on host-loaded code because the host
lints them under its own `AGENTS.md`. The export-side binding keeps one
refactorable public name instead of a rename at every import site.

Where callers pipe, serve data-first and data-last from one body with
`Function.dual`. One body serves both sites with full inference. Reserve
overloads for genuinely distinct input modes, and options objects for
constructors with many knobs.

For host-facing APIs, expose narrow domains on one context object
(`ctx.tool`, `ctx.session`) instead of a flat client or string locator. Map
event name to input type to failure type with a generic (`Hooks<Spec,
Failures>`), so a wrong name or wrong failure does not compile. Keep
before-events mutable and after-events `readonly`: the type tells authors
what they can change. Keep transform editors synchronous and load effectful
data before registration, so folds stay atomic. Tie registration lifetime to
`Scope` with `dispose`, so cleanup survives failure and interrupt.

Own route shapes in one protocol module as Schema (params, payload, success,
error union per route). Keep shapes, method, and error union with the endpoint
in that one module. Publish the module through the `./rpc` export. When one
module no longer reads as one contract, split. Generate
every client flavor from that single source and never hand-edit generated
output. One source keeps protocol, clients, and OpenAPI entries in lockstep.

With no live server to prove the round trip, pin wire compatibility at
compile time. Shape the envelope with `satisfies` against the client input
type of the host (for example `SessionImportInput`). The host owns the import
contract. Use this type as the pin. Do not write a local duplicate.
