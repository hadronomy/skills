# Models: Schema, brands, tagged errors

Model each record with `Schema.Struct` plus a same-name interface. Compose
structs by spread. Model each state with `Schema.Literal` unions.

```ts
const User = Schema.Struct({ id: UserId, name: Schema.String })
```

Brand each ID. The brand costs zero runtime and separates structurally
identical values. One constructor gives throw, `Option`, `Result`, and guard
forms.

```ts
type UserId = string & Brand<"UserId">
const UserId = Brand.make<UserId>((s) => s.length > 0)
```

Model each failure with `Schema.TaggedError` plus the `Self` generic. Omitting
`Self` breaks subclass typing.

```ts
class UserMissing extends Schema.TaggedError<UserMissing>()("UserMissing", {
  id: UserId
}) {}
```

Match failures with `Effect.catchTag` or `Match.typeTags` plus
`Match.exhaustive`. A missed case becomes a compile error. Give data unions
the same totality. `Match.discriminator("kind")` (or `"mode"`, `"type"`) plus
`Match.exhaustive` replaces ternaries that silently take else-arms on new
variants. Name `discriminator` explicitly. Agents otherwise reach only for
`Match.when`.

Decode untrusted input once at the owning boundary with
`Schema.decodeUnknown`. Past that point, only the validated type exists. Build
trusted values directly. Carry HTTP status on protocol errors and list the
error union per endpoint instead of one global error type.

Write validation rules as checked schemas, not ad-hoc predicates in stage
code. Annotate each filter with `identifier` and `description`. Consume this
rule through the `Schema.is` guard. Validation is pure logic, so the
Effect shape governs. Where the contract mandates fail-closed refusal, refuse.
Masks persist heuristic copies in storage.
