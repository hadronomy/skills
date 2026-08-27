# Sources

Check the upstream source when a rule here looks wrong, or when a version-
sensitive claim needs refreshing. The reference codebases move; this file does
not.

## Reference codebases

Read their `AGENTS.md`, root `Cargo.toml`, and `justfile` — that is where the
rules in this skill come from.

- **oxc** — <https://github.com/oxc-project/oxc>. Arena AST, 16-byte enums, u32
  spans, `bpaf`, workspace lints with a reason on every `allow`, per-profile
  build tuning.
- **ruff / ty** — <https://github.com/astral-sh/ruff>. `AGENTS.md` is the
  strongest published statement of Rust agent discipline: no `unwrap`, encode
  constraints in types, `#[expect]` over `#[allow]`, never hand-edit snapshots,
  comments explain invariants.
- **uv** — <https://github.com/astral-sh/uv>. Flat `crates/` workspace, CLI
  crate separated from logic, integration tests over unit tests, `insta`
  everywhere, precise lockfile updates.
- **mise** — <https://github.com/jdx/mise>. Task-runner-driven development, no
  Clippy exclusions at all, `usage-rs` for the whole CLI surface, e2e suite.
- **usage** — <https://github.com/jdx/usage> and <https://usage.jdx.dev/rust/>.
  The spec, the Rust framework, and the benchmark methodology behind the
  parser numbers in [cli.md](cli.md).
- **rust-analyzer** — <https://github.com/rust-lang/rust-analyzer>. The origin
  of the flat-workspace and `xtask` conventions.

## Documents

- **Rust API Guidelines** — <https://rust-lang.github.io/api-guidelines/checklist.html>.
  The C-XXX checklist condensed in [api-design.md](api-design.md).
- **The Rust Performance Book**, Nicholas Nethercote —
  <https://nnethercote.github.io/perf-book/>. Benchmarking, build configuration,
  profiling, inlining, hashing, heap allocations, type sizes, iterators, bounds
  checks, I/O, wrapper types, machine code, parallelism, compile times.
- **Large Rust Workspaces**, matklad —
  <https://matklad.github.io/2021/08/22/large-rust-workspaces.html>.
- **Fast Rust Builds**, matklad —
  <https://matklad.github.io/2021/09/04/fast-rust-builds.html>.
- **Pursuit of Performance on Building a JavaScript Compiler**, Boshen —
  <https://rustmagazine.org/issue-3/javascript-compiler/>, and
  <https://oxc.rs/docs/learn/performance>.
- **Astral on Rust in Production**, Charlie Marsh —
  <https://corrode.dev/podcast/s04e03-astral/>.
- **blessed.rs** — <https://blessed.rs/crates>. Curated crate list, kept current.
- **Parse, don't validate**, Alexis King — the origin of the boundary rule in
  [api-design.md](api-design.md).

## Time-sensitive claims

Re-check these before relying on them:

- The current stable Rust version and edition. This skill was written against
  **Rust 1.98 / edition 2024**, the toolchain `oxc` and `uv` pin.
- Crate recommendations in [crates.md](crates.md), especially `jiff` versus
  `chrono`, `bon` versus `typed-builder`, and `papaya` versus `dashmap`.
- `usage-rs` stability. It was experimental and on 6.4.1 when this was written,
  with point releases allowed to break. Check whether it has declared a stable
  API before you drop the exact version pin.
- Whether `async fn` in traits has gained `dyn` support, which would retire
  `async-trait`.
- Tool names that have changed: `cargo-dist` is now `dist`.
