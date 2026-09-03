# Services: Context, Layer, named ops, config, retry, streams

Group verbs by capability into one narrow service. The class is the key, the
type, and an `Effect` — yield it directly.

```ts
class UserRepo extends Context.Service<UserRepo, {
  readonly get: (id: UserId) => Effect<User, UserMissing>
}>()("UserRepo") {}
```

Build services with `Layer.effect`. Construction, scope, failure, and needs
stay in the type until one `Effect.provide` discharges them.

```ts
const Live = Layer.effect(UserRepo, Effect.gen(function* () {
  const db = yield* Database
  return { get: (id) => db.queryUser(id) }
}))
```

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

Keep pipelines one pipeable chain through `Stream`. Bridge queues with
`Stream.fromQueue` and drain with `Stream.runCollect`. Wrap HTTP clients,
SDKs, and CLIs in named effects at the adapter boundary; keep business rules
in services, never in transport handlers.
