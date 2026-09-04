# Sources

Primary material behind this skill. Check here when a rule needs its reason.

- Effect agent contract and validation table:
  https://github.com/Effect-TS/effect/blob/main/.agents/AGENTS.md
- Barrel generator and the `@barrel` marker:
  https://github.com/Effect-TS/effect/blob/main/packages/tools/utils/src/Codegen.ts
- `Function.dual` data-first and data-last dispatch:
  https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Function.ts
- `Context.Service` keys and `Layer.effect` wiring:
  https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Context.ts
- `Effect.fn`, `Effect.gen`, `Effect.retry`:
  https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
- `Schema.Struct`, `Schema.TaggedError`, brands via `Brand`:
  https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Schema.ts
- `Config` recipes without `process.env` in logic:
  https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Config.ts
- `Schedule` backoff composition:
  https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Schedule.ts
- `Stream` pipelines and `Match.exhaustive` totality:
  https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Stream.ts
- JSDoc shape, examples, and categories:
  https://github.com/Effect-TS/effect/blob/main/.agents/skills/jsdocs/SKILL.md
- Doctest runner mechanics:
  https://github.com/Effect-TS/effect/blob/main/packages/tools/doctest/README.md
- Changeset rules for consumer-visible change:
  https://github.com/Effect-TS/effect/blob/main/.agents/skills/changesets/SKILL.md
- opencode v2 agent rules, codegen discipline, dependency direction:
  https://raw.githubusercontent.com/sst/opencode/v2/AGENTS.md
- opencode plugin `Hooks` generic and registration:
  https://raw.githubusercontent.com/sst/opencode/v2/packages/plugin/src/effect/registration.ts
- opencode plugin author guide:
  https://raw.githubusercontent.com/sst/opencode/v2/packages/plugin/src/effect/README.md

## Field evidence, pinned 2026-09-04

Proven against `effect 4.0.0-rc.112` and `@opencode-ai/* 0.0.0-beta-19086`
unless noted. When the rc moves, spike again.

- Star-import ban plus export-side namespace binding plus named-variable
  binding plus destructuring ban (surface, services edits):
  https://raw.githubusercontent.com/sst/opencode/v2/AGENTS.md
- Narrow host domains on one context object (`ctx.tool`, `ctx.session`) and
  the `SessionDomain` verb set (`create`, `get`, `generate`, `synthetic`,
  `context`) (services edits):
  https://raw.githubusercontent.com/sst/opencode/v2/packages/plugin/src/effect/plugin.ts
  and `node_modules/@opencode-ai/plugin@0.0.0-beta-19086/dist/effect/session.d.ts`
- `Match.discriminator` on data unions (models edit):
  https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/Match.ts
- `Layer.provide` discards outputs and `provideMerge` retains them. Probe
  re-merge on one shared reference (services edit):
  https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/Layer.ts
- `Cause.hasInterruptsOnly` (v4 rename of `isInterruptedOnly`) and
  `Cause.findError` returning `Result` (services edit):
  https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/Cause.ts
- v4 delta equivalents (quality edit). Sources: the v4 API reference for
  rc.112
  (https://effect.website/docs/v4/api/effect/Result — `Result` module present,
  no `Either` module). The `effect@4.0.0-rc.112` tarball (`Effect.d.ts`,
  `Cause.d.ts`, `Schema.d.ts`, `Array.d.ts`, `Ref.d.ts`). The v3 branch as
  proof of the v3 side
  (`Effect.either`, `optionalWith`, `failureOption`, `catchAllCause` present.
  `Ref.append` absent.) The green rc.112 spike (`Effect.result`,
  `findErrorOption`, `Ref.update` + `Array.append`, `optional` +
  `withDecodingDefault`).
- `Schema.makeFilter` annotations and the `Schema.is` guard (models edit):
  https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/Schema.ts
- `Schema.make` takes the AST (models edit):
  https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/Schema.ts
- `Context.Service` class form (services edit):
  https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/Context.ts
- `it.effect` for Effect tests, plain `it` for sync (quality edit):
  https://raw.githubusercontent.com/Effect-TS/effect/main/.agents/skills/test-development/runtime.md
- `@effect/doctest 4.0.0-rc.112` Plugin plus `includeSource`, peer range
  `vitest >=4.1.10 <5.0.0`, green under installed vitest `5.0.0`. Native
  in-source tests are unsupported (docs edit): registry tarball
  `@effect/doctest@4.0.0-rc.112` (`Plugin.d.ts`, `package.json`) and the
  `plugins/handoff` 21-test run
- RPC contract published through the `./rpc` export (surface edit):
  https://opencode.ai/v2/docs/build/plugins/rpc plus
  `node_modules/@opencode-ai/schema@0.0.0-beta-19086/dist/rpc.js`
- `SessionImportInput` wire pin (surface edit):
  `node_modules/@opencode-ai/client@0.0.0-beta-19086/dist/effect/api/api.d.ts`
- Worked spike for every edit above: `plugins/handoff/` at `f6e2fba`
  (`capture.ts`, `transfer.ts`, `render.ts`, `redact.ts`, `rpc.ts`,
  `stage.ts`, `host.ts`, `transfer.test.ts`, `vitest.config.ts`).
