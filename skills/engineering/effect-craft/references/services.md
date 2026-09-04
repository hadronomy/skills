# Services: Context, Layer, named ops, config, retry, streams

Group verbs by capability into one narrow service. The class is the key, the
type, and an `Effect`. Yield it directly into a named variable. Then call
through the binding (`const capture = yield* Capture`, then
`capture.read(id)`). Destructured methods (`const { read } = yield*
Capture`) discard the namespace that call sites use
(`ctx.session.context`, `capture.read`). When the call stutters (`capture.capture`), rename the
method (`capture.read`). Do not rename the call.

```ts
class UserRepo extends Context.Service<UserRepo, {
  readonly get: (id: UserId) => Effect<User, UserMissing>
}>()("UserRepo") {}
```

Name methods after domain verbs or result nouns: `read`, `transfer`, `scrub`,
`pointer`. Generic `run` and `handle` names hide the domain. Follow the host
session domain: `create`, `get`, `generate`, `synthetic`, `context`.

Build services with `Layer.effect`. Construction, scope, failure, and needs
stay in the type until one `Effect.provide` discharges them.

```ts
const Live = Layer.effect(UserRepo, Effect.gen(function* () {
  const db = yield* Database
  return { get: (id) => db.queryUser(id) }
}))
```

`Layer.provide` discards the outputs of the provider (`provideMerge` retains
them). `mergeAll` does not auto-wire sibling requirements. After
`Layer.provide`, re-merge the probes on one shared layer reference. The build
memoizes, so app and probes observe the same services. Show discharge with a
constrained consumer. An unconstrained export compiles while it still requires
services. Only a consumer that must close every requirement catches leaks.

Wrap each reusable op in `Effect.fn("Name")` and compose bodies with
`Effect.gen`. The name becomes the span. Use `Effect.fnUntraced` only for
internal helpers that deliberately skip tracing.

Read config through `Config` recipes. `Config` is itself an `Effect`:
composable with `all`, `map`, `withDefault`, and `orElse`, and provider
backed, so tests swap providers instead of environment variables.

```ts
const DbConfig = Config.all({
  host: Config.String("HOST"),
  port: Config.Number("PORT").pipe(Config.withDefault(3000))
})
```

Express retries as `Effect.retry(program, Schedule.exponential(...))`.
Compose backoff, jitter, and bounds as pure values first.

At `never`-typed boundaries, convert defects, not typed errors. Host
transports declare infallible types, and `Effect.promise` rejections surface
as defects. As a result, `mapError` alone lets faults escape as fiber breaks.
Wrap the stage in one interrupt-preserving `catchCause` converter.
`Cause.hasInterruptsOnly` keeps cancellation intact. Everything else maps to
the stage error.

Keep pipelines one pipeable chain through `Stream`. Bridge queues with
`Stream.fromQueue` and drain with `Stream.runCollect`. Wrap HTTP clients,
SDKs, and CLIs in named effects at the adapter boundary; keep business rules
in services, never in transport handlers.
