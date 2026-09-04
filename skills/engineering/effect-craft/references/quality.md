# Quality: gates, checklists, friction fixes

Enforce strict TS with `exactOptionalPropertyTypes` and no unused locals.
`any` and `try` with `catch` stay banned. Inference rules; only exports carry
annotations. Array methods replace loops. Early returns replace `else`. Import
aliases never appear. Typechecks run per package with the project runner, and
tests run from package dirs — never from root, never the full suite in watch
mode. Runtime behavior routes to Vitest (`it.effect` for Effect tests, plain
`it` for sync tests). Type contracts route to Tstyche.

Effect v4 RC delta, pinned to `effect 4.0.0-rc.112`. The rc moves weekly, so
spike each item again.

- `Schema.Type` is gone. Use `Schema.Schema.Type`.
- `Schema.optionalWith` is gone. Compose `Schema.optional` with
  `Schema.withDecodingDefault`.
- `Key` variants default on absent keys. Plain variants default on absent keys
  or `undefined`.
- `Effect.either` is gone. Use `Effect.result`.
- `Effect.flip` only inverts channels. At the runner edge, use
  `runPromiseExit`.
- `Effect.catchAllCause` is gone. Use `Effect.catchCause` with a total
  handler.
- `Cause.failureOption` is gone. Use `Cause.findErrorOption` for `Option`.
  (Or use `Cause.findError` with `Result`.)
- `Ref.append` never existed. Update through `Ref.update`. For example:
  `Ref.update(ref, Array.append(value))`.
- The `Either` module is gone. Use `effect/Result`.
- Interfaces cannot extend unions. The compiler reports `TS2312`. Use a
  distinctly-named `export type`.
- `withDecodingDefault` needs a preceding `optional` and an `Effect` default.
  (`withDecodingDefaultKey` is the decode-side RPC form.)
- `Schema.make` takes the AST.

Each item above passed a spike against rc.112. Old v3 habits mislead.

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
