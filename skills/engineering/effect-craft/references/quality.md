# Quality: gates, checklists, friction fixes

Enforce strict TS with `exactOptionalPropertyTypes` and no unused locals.
`any` and `try` with `catch` stay banned. Inference rules; only exports carry
annotations. Array methods replace loops. Early returns replace `else`. Import
aliases never appear. Typechecks run per package with the project runner, and
tests run from package dirs — never from root, never the full suite in watch
mode. Runtime behavior routes to Vitest, type contracts to Tstyche.

Record consumer-visible change in a changeset. Tests-only work and pure
refactors take none. Additive exports are normally non-breaking.

Per-artifact pass, before finishing:

- Services: one capability per face, layer constructor, named ops, Test layer
  instead of the network.
- Streams: one pipeable chain, backpressure through `Stream`, matches closed
  with `exhaustive`.
- HTTP: params, payload, success, and error as Schema per route, tagged error
  union per route, clients generated from the route source.
- CLI: thin handlers that decode input, call services, and map tagged errors
  to exit codes.

Friction fixes: `any` spreads, so reach for brands and tagged errors. `try`
with `catch` hides faults, so match tags. Barrel imports tangle the graph, so
import deep paths. Nested yields blur ownership, so bind named variables.
`Effect` from pure helpers fakes async, so return plain values. `process.env`
in logic ties tests to machines, so read `Config`. Anonymous effects blind
traces, so name every op. Hand-edited generated files rot, so regenerate.
