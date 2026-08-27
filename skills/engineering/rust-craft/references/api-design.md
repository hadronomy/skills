# API and type design

The goal is **leverage**: a caller learns a small interface and gets a lot of
behaviour. For the vocabulary of depth, seams, and adapters, use the
`codebase-design` skill. This file is what that vocabulary looks like in Rust.

## Make the illegal state unrepresentable

This is the first move, before any other technique.

- A `struct` with private fields and a fallible constructor is a **newtype**. It
  proves its invariant once, at construction, and every function downstream gets
  the proof for free.
- An `enum` with data on each variant beats a struct of `Option`s. Four
  `Option` fields describe sixteen states; you probably meant three.
- A separate type beats a `bool` parameter. `fetch(url, true)` tells the reader
  nothing; `fetch(url, Redirects::Follow)` tells them everything.

```rust
/// A package name that has already passed PEP 508 normalisation.
///
/// Construct with [`PackageName::new`]; the inner string is guaranteed
/// lowercase with `-` as the only separator.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PackageName(SmolStr);

impl PackageName {
    pub fn new(raw: &str) -> Result<Self, InvalidPackageName> { /* ... */ }

    pub fn as_str(&self) -> &str { &self.0 }
}
```

Parse at the edge, then trust the type. A `validate_name(&str)` function that
returns `()` leaves every caller free to forget it; a constructor that returns
`Result<PackageName, _>` does not.

## Typestate

When an object moves through phases and the valid operations differ per phase,
put the phase in the type. Methods then exist only where they are legal, and a
misuse is a compile error rather than a runtime check.

```rust
pub struct Request<S> { url: Url, body: Option<Body>, _state: PhantomData<S> }
pub struct Draft;
pub struct Sealed;

impl Request<Draft> {
    pub fn body(mut self, body: Body) -> Self { /* ... */ }
    pub fn seal(self) -> Request<Sealed> { /* ... */ }
}

impl Request<Sealed> {
    pub async fn send(self) -> Result<Response, SendError> { /* ... */ }
}
```

Use it when misuse is plausible and costly. Do not use it for a two-method type;
the generic parameter leaks into every signature that stores the value.

## Builders

Reach for a builder when a constructor has more than three or four parameters,
or any optional ones. Use `bon`: it generates a typestate builder, so a missing
required field is a compile error and setting the same field twice is a compile
error.

```rust
use bon::Builder;

#[derive(Builder)]
pub struct Client {
    base_url: Url,
    #[builder(default = Duration::from_secs(30))]
    timeout: Duration,
    retries: Option<u32>,
}

let client = Client::builder().base_url(url).retries(3).build();
```

`typed-builder` is the lighter alternative when compile time matters more than
the diagnostics. Avoid `derive_builder`: it validates at runtime and hands the
caller a `Result` that a typestate builder makes impossible.

## Argument and return types

| Situation | Take | Not |
|---|---|---|
| Read a string | `&str` | `String`, `&String` |
| Read a path | `&Path` | `impl AsRef<Path>` at a crate boundary |
| Read a slice | `&[T]` | `&Vec<T>` |
| Caller may own or borrow | `Cow<'_, str>` | Two functions |
| Callback used once, at a boundary | `&dyn Fn(..)` | `impl Fn(..)` |
| Callback on a hot inner path | `impl Fn(..)` | `&dyn Fn(..)` |
| Consume a collection | `impl IntoIterator<Item = T>` | `Vec<T>` |

`impl AsRef<Path>` and `impl Into<String>` are pleasant one crate deep and
expensive across a boundary: every downstream crate monomorphizes another copy.
The compromise is a generic public wrapper that immediately calls a non-generic
inner function.

```rust
pub fn open(path: impl AsRef<Path>) -> Result<File, OpenError> {
    fn inner(path: &Path) -> Result<File, OpenError> { /* the real body */ }
    inner(path.as_ref())
}
```

Return a concrete type when you can name one. `impl Iterator<Item = T>` is fine
for an internal helper and a semver hazard on a public API — you cannot add
`DoubleEndedIterator` later without it already being there. In edition 2024,
`impl Trait` in return position captures all in-scope lifetimes by default; use
`impl Iterator<Item = T> + use<>` to opt out.

## Traits

- Implement the common traits eagerly: `Debug` on every public type, then
  `Clone`, `Copy`, `PartialEq`, `Eq`, `Hash`, `PartialOrd`, `Ord`, `Default`
  where they are meaningful. Derive rather than hand-write.
- Implement `From`, `TryFrom`, `AsRef`, and `FromStr` rather than inventing
  `to_foo` free functions. Implement `FromIterator` and `Extend` on collections.
- Keep a trait **object safe** if anyone might want `Box<dyn Trait>`. Generic
  methods and `-> Self` break object safety.
- `async fn` in a trait (AFIT) is stable but not object safe, and it does not
  let a caller add a `Send` bound. Use it for a generic trait; use
  `#[async_trait]` or an explicit `Pin<Box<dyn Future + Send>>` when you need
  `dyn`.
- **Seal a trait** you do not want implemented downstream, so you can add methods
  without a breaking change:

```rust
mod sealed { pub trait Sealed {} }

pub trait Backend: sealed::Sealed {
    fn resolve(&self, name: &PackageName) -> Result<Version, ResolveError>;
}
```

- Do not implement `Deref` except on a genuine smart pointer. `Deref` on a
  newtype makes the inner type's whole surface public by accident, and method
  resolution becomes a guessing game.
- Do not add inherent methods to a smart pointer; they shadow the target's
  methods.

## Future-proofing

- `#[non_exhaustive]` on every public enum a caller matches on, and on any struct
  you may add a field to. Adding a variant then stays a minor version.
- Private fields on every public struct. A public field is a permanent API.
- Do not repeat derived bounds on the data structure: write
  `struct Node<T> { .. }` and put `where T: Debug` on the `impl`, not the type.
- `#[must_use]` on constructors, builders, and any method whose only purpose is
  its return value.

## Documentation

`cargo doc` output is the interface as the caller sees it.

```rust
#![warn(missing_docs)]

/// Resolves `requirements` against `index`, returning a locked set.
///
/// # Errors
///
/// Returns [`ResolveError::Unsatisfiable`] when no version set satisfies every
/// requirement, and [`ResolveError::Network`] when the index is unreachable.
///
/// # Panics
///
/// Never panics.
///
/// # Examples
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let lock = resolver::resolve(&requirements, &index)?;
/// assert_eq!(lock.len(), 3);
/// # Ok(())
/// # }
/// ```
pub fn resolve(/* ... */) -> Result<Lock, ResolveError> { /* ... */ }
```

Rules that matter:

- Crate-level docs (`//!`) open with what the crate does and one runnable
  example. That text is the crates.io landing page.
- Examples use `?`, never `unwrap`. A doctest is a compiled test; broken
  examples fail CI.
- Link types with intra-doc links: `` [`PackageName`] ``, not backticked prose.
- Document `# Errors`, `# Panics`, and `# Safety` on anything that has them.
- `#[doc(hidden)]` on macro support items, so rustdoc shows the real interface.

## Naming

Follow the API guidelines; they are shared vocabulary, not taste.

- `as_x` — free, borrowed conversion. `to_x` — costly conversion. `into_x` —
  consuming conversion.
- `iter`, `iter_mut`, `into_iter` on collections, returning types named `Iter`,
  `IterMut`, `IntoIter`.
- Getters are `fn name(&self)`, not `fn get_name(&self)`.
- Consistent word order across the crate: pick `SomethingError` or
  `ErrorSomething` and keep it.
- Do not name a type `Error` when it implements `std::error::Error`; qualify it
  (`ResolveError`), so `crate::Error` never collides with `std::error::Error` in
  a `use`.

## Full API checklist

The Rust API Guidelines checklist, condensed. Walk it before publishing.

**Naming** — casing follows RFC 430 (C-CASE); conversions use `as_`/`to_`/`into_`
(C-CONV); getters unprefixed (C-GETTER); iterators named after their methods
(C-ITER, C-ITER-TY); feature names carry no filler (C-FEATURE); consistent word
order (C-WORD-ORDER).

**Interoperability** — common traits derived (C-COMMON-TRAITS); `From`/`AsRef`/
`AsMut` for conversions (C-CONV-TRAITS); `FromIterator`/`Extend` on collections
(C-COLLECT); optional Serde impls behind a feature (C-SERDE); `Send`+`Sync`
where possible (C-SEND-SYNC); meaningful error types (C-GOOD-ERR); generic
reader/writer taken by value (C-RW-VALUE).

**Documentation** — thorough crate docs with examples (C-CRATE-DOC); an example
per item (C-EXAMPLE); examples use `?` (C-QUESTION-MARK); error, panic, and
safety sections (C-FAILURE); prose links to types (C-LINK); complete Cargo
metadata (C-METADATA); implementation details hidden (C-HIDDEN).

**Predictability** — smart pointers add no inherent methods (C-SMART-PTR);
conversions live on the specific type (C-CONV-SPECIFIC); a clear receiver means
a method (C-METHOD); no out-parameters (C-NO-OUT); unsurprising operator
overloads (C-OVERLOAD); only smart pointers implement `Deref` (C-DEREF);
constructors are inherent statics (C-CTOR).

**Flexibility** — expose intermediate results (C-INTERMEDIATE); the caller
decides where data is copied (C-CALLER-CONTROL); generics minimise assumptions
(C-GENERIC); traits stay object safe when useful as objects (C-OBJECT).

**Type safety** — newtypes make static distinctions (C-NEWTYPE); arguments carry
meaning in types, not `bool`/`Option` (C-CUSTOM-TYPE); flag sets use `bitflags`
(C-BITFLAG); builders build complex values (C-BUILDER).

**Dependability** — functions validate arguments (C-VALIDATE); destructors never
fail (C-DTOR-FAIL) and blocking ones offer an alternative (C-DTOR-BLOCK).

**Debuggability** — `Debug` on every public type (C-DEBUG), never empty
(C-DEBUG-NONEMPTY).

**Future proofing** — sealed traits (C-SEALED); private struct fields
(C-STRUCT-PRIVATE); newtypes hide internals (C-NEWTYPE-HIDE); no duplicated
derive bounds (C-STRUCT-BOUNDS).

**Necessities** — public dependencies of a stable crate are stable (C-STABLE);
permissive licensing (C-PERMISSIVE).
