# Errors and diagnostics

## The split

**Library**: a concrete, matchable error type per crate, built with `thiserror`.
The caller decides what to do, so the type must let them tell cases apart.

**Binary**: one dynamic error type with context, built with `anyhow`, `eyre`, or
`color-eyre`. Nothing above `main` matches on it, so the type carries a message
and a chain instead.

Never put `anyhow::Error` in a public library signature. It erases exactly the
information the caller needs.

## Library errors

```rust
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum ResolveError {
    #[error("no version of `{name}` satisfies `{requirement}`")]
    Unsatisfiable { name: PackageName, requirement: VersionSpecifier },

    #[error("failed to read the index at `{url}`")]
    Index {
        url: Url,
        #[source]
        source: reqwest::Error,
    },

    #[error(transparent)]
    Io(#[from] std::io::Error),
}
```

Rules:

- `#[non_exhaustive]`, so a new variant is a minor version bump.
- `#[source]` (or `#[from]`) on the cause, so `Error::source()` walks the chain.
  Do not restate the source's message in your own `Display`.
- `Display` is lowercase and has no trailing period. It gets embedded in
  `error: {}` and in longer chains.
- Name it for the operation (`ResolveError`, `ParseError`), never `Error` — the
  `error_impl_error` lint catches this.
- `#[error(transparent)]` when the variant adds nothing but a wrapper.
- One error type per crate is usually right. One per module is noise; one per
  workspace loses the ability to match.

**Keep the error small.** `Result<T, E>` is as large as its largest arm, and it
travels through every hot return. Measure with `size_of::<Result<T, E>>()` and
box a fat variant:

```rust
#[error("parse failed")]
Parse(Box<ParseFailure>),   // ParseFailure is 200 bytes
```

The exception is deliberate: `oxc` inlines a ~176-byte diagnostic to make the
error path allocation-free, and documents the trade in its lint config. Make
that choice explicitly, with a number.

## Application errors

```rust
use anyhow::{Context, Result};

fn load(path: &Path) -> Result<Config> {
    let text = fs::read_to_string(path)
        .with_context(|| format!("failed to read config at `{}`", path.display()))?;
    toml::from_str(&text)
        .with_context(|| format!("failed to parse config at `{}`", path.display()))
}
```

Context adds what the caller cannot infer: which path, which URL, which index,
which item of the loop. "operation failed" adds nothing. Use `with_context` (a
closure) rather than `context` when the message allocates, so the happy path
does not pay for it.

`color-eyre` gives the same API with a rendered report, section support, and a
suggestion hook — worth it for a user-facing CLI.

## Diagnostics with source spans

When the error points at a location in a file — a parser, linter, config reader
— render it the way `rustc` does.

| Crate | Use it for |
|---|---|
| `miette` | A `Diagnostic` derive on top of `thiserror`, error codes, help text, fancy rendering. The default choice for a CLI. |
| `annotate-snippets` | `rustc`'s own renderer. Closest match to Rust's output. |
| `ariadne` | Rich multi-span rendering with colour. |
| `codespan-reporting` | Stable, plain, small. |

```rust
#[derive(Debug, thiserror::Error, miette::Diagnostic)]
#[error("unexpected token")]
#[diagnostic(code(parse::unexpected_token), help("expected one of `,` `]`"))]
pub struct UnexpectedToken {
    #[source_code]
    src: NamedSource<String>,
    #[label("found here")]
    span: SourceSpan,
}
```

Store spans as `u32` byte offsets, not `usize` — halves the size of every AST
node and costs nothing under 4 GB of source.

## Panics

A panic means a bug in this code, not a bad input. That is the whole test.

- `unwrap()` and `expect()` do not belong in library or binary code. Use `if
  let`, `let ... else`, `?`, or a type that cannot be wrong.
- When an invariant genuinely cannot be expressed in the type system, use
  `expect()` and write the **invariant** in the message, not an apology:
  `.expect("resolver guarantees at least one candidate")`.
- `debug_assert!` for invariants too costly to check in release. Keep
  `debug-assertions = true` in the coverage and test profiles so they run.
- `panic = "abort"` in release removes the unwind path. If a plugin host or a
  test needs to catch a panic, give that target its own `panic = "unwind"`
  profile rather than weakening release.
- Never use `std::process::exit` outside `main`; it skips every destructor. The
  `clippy::exit` lint enforces this.

## Exit and reporting

```rust
fn main() -> ExitCode {
    if let Err(error) = run() {
        eprintln!("{error:?}");     // anyhow/eyre render the full chain here
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}
```

Return `ExitCode`, not `Result`, when you want control of the rendering and the
code. Reserve distinct codes for distinct outcomes (2 for usage, 1 for failure,
0 for success) and document them in `--help`.

Write errors to stderr, always. Data goes to stdout. The `print_stdout` and
`print_stderr` lints make every write site deliberate.

## Failure hygiene

- Attach a backtrace where it helps: `tracing-error`'s `SpanTrace` gives you the
  async context that a native backtrace loses.
- Classify transient failures at the source (timeout, 5xx, connection reset) and
  retry there with jitter, rather than retrying an opaque error at the top.
- Do not log and return the same error; pick one. Logging at every level turns
  one failure into a wall of noise.
