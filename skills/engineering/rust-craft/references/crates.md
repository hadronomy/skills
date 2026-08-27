# Choosing crates

## Rules

1. **`std` first.** `OnceLock`, `LazyLock`, `ExitCode`, `let ... else`, and
   `std::sync::mpsc` removed the reason for several old dependencies.
2. **Use what the workspace already has.** A second HTTP client or a second
   date library is a maintenance cost with no benefit.
3. **Read the docs and the types before you assume a capability is missing.**
   Most "I need another crate" moments are a missing feature flag.
4. **Judge a dependency on four signals**: recent releases, a maintainer who
   answers issues, real downstream users, and a dependency tree you would accept
   on its own.
5. **Compile cost is part of the price.** Anything pulling `syn` costs seconds
   on every clean build.
6. `default-features = false` on every dependency, then enable exactly what you
   use.

The table below marks what the reference codebases actually ship: **oxc**,
**ruff/ty**, **uv**, **mise**.

## Core

| Need | Pick | Notes |
|---|---|---|
| Serialization | `serde` + `serde_json` | Universal. `serde_json` is fast; `simd-json` for extreme volume. |
| TOML | `toml` | Human-facing config. |
| Errors (library) | `thiserror` 2 | See [errors.md](errors.md). |
| Errors (binary) | `anyhow`, `color-eyre` | `color-eyre` for a user-facing CLI. mise uses `eyre`. |
| Diagnostics with spans | `miette` | mise, and most CLIs. `annotate-snippets` for rustc-identical output. |
| Logging | `tracing` + `tracing-subscriber` | `log` only for a tiny library. |
| Date and time | `jiff` | New default (Burnt Sushi). `chrono` is soft-deprecated; `time` is the conservative pick. |
| Regex | `regex` | Linear time, no backtracking. `fancy-regex` when you need lookaround. |
| Random | `rand`, `fastrand` | `fastrand` when you do not need crypto. |
| UUID | `uuid` | |
| Iterator extras | `itertools` | |
| Bitflags | `bitflags` | oxc. Never an enum for a flag set. |
| Temp files | `tempfile` | |
| Byte casting | `bytemuck`, `zerocopy` | Safe transmutes. |

## Collections and strings

| Need | Pick | Notes |
|---|---|---|
| Fast internal hash map | `rustc-hash` (`FxHashMap`) | oxc, ruff, uv. Never for untrusted keys. |
| Insertion-ordered map | `indexmap` | oxc, mise. Faster iteration than `HashMap`. |
| Compact owned string | `compact_str` | oxc. 24 bytes inline. |
| Cheap-clone string | `smol_str`, `ecow` | Refcounted past the inline limit. |
| Stack-first vector | `smallvec`, `arrayvec`, `tinyvec` | `tinyvec` is 100% safe code. |
| Arena | `bumpalo` | oxc's AST. |
| Typed indices | `oxc_index`, `index_vec`, `la-arena` | Replaces `Rc<RefCell<..>>` graphs. |
| Generational handles | `slotmap` | When entries are removed. |
| Graphs | `petgraph` | mise. |
| Copy-on-write helpers | `cow-utils` | oxc. Avoids allocating when nothing changed. |

## Concurrency

| Need | Pick | Notes |
|---|---|---|
| Data parallelism | `rayon` | Start here. |
| Faster mutex | `parking_lot` | |
| Concurrent map | `dashmap`, `papaya` | mise uses `dashmap`; `papaya` wins read-heavy. |
| Read-mostly value | `arc-swap` | |
| Sync channels | `crossbeam-channel`, `flume` | Both beat `std::mpsc`. |
| Async runtime | `tokio` | `current_thread` flavour for a CLI. |
| Async helpers | `futures`, `tokio-util` | `CancellationToken`, `TaskTracker`. |
| Cheap `Arc` | `triomphe` | No weak counts, one word smaller. |

## Files and processes

| Need | Pick | Notes |
|---|---|---|
| Walk respecting `.gitignore` | `ignore` | oxc, ruff. Parallel walker. |
| Plain recursive walk | `walkdir` | |
| Globs | `globset` | mise. Compiles many globs into one matcher. |
| Watch | `notify` | |
| Platform paths | `etcetera`, `directories`, `dirs` | uv uses `etcetera`. |
| Run a subprocess | `duct` | mise. Simpler than raw `Command` pipelines. |
| Memory map | `memmap2` | Large files scanned once. |
| Raw syscalls | `rustix` | Safer and lighter than `libc`. |

## CLI

| Need | Pick | Notes |
|---|---|---|
| Argument parsing | `usage-rs` | mise. Spec-first: one declaration gives the parser, completions, help, docs, and man pages. 0.19 µs and zero allocations per parse against clap's 480 µs and 6,560. Experimental — pin the version. |
| Argument parsing (conservative) | `clap`, `bpaf`, `lexopt` | clap for the ecosystem; oxc uses `bpaf` for build speed; `lexopt` when builds must be fastest. |
| Verbosity flag | Native `count` attribute, `clap-verbosity-flag` | The flag crate is only needed under clap. |
| Completions, man pages | Built into `usage-rs`; else `clap_complete` + `clap_mangen` | usage-rs emits them from the same spec, so they cannot drift. |
| Colour | `anstream` + `anstyle` | Handles Windows and pipes. |
| Terminal helpers | `console` | oxc, mise. |
| Progress | `indicatif` | On stderr only. |
| Prompts | `inquire`, `demand` | mise uses `demand`. |
| Tables | `comfy-table` | mise. |
| TUI | `ratatui` + `crossterm` | |
| Fuzzy matching | `nucleo-matcher` | mise. |

## Network and data

| Need | Pick | Notes |
|---|---|---|
| HTTP client | `reqwest` | uv, mise. One client, cloned. `ureq` when you want no async. |
| HTTP server | `axum` | On `hyper` and `tower`. |
| TLS | `rustls` | Prefer over `native-tls`. `default-features = false` and pick a provider. |
| gRPC | `tonic` | |
| SQL, raw queries | `sqlx` | Compile-time-checked SQL, async, no ORM layer. |
| SQL, ORM | `sea-orm` | 2.0 since January 2026. Async-native on top of `sqlx`, ActiveModel updates that touch only changed fields, `sea-orm-cli` generates entities from a live schema, migrations included, backend switched by feature flag. |
| SQL, compile-time DSL | `diesel` | Strictest guarantees and the longest track record. Synchronous; async needs `diesel-async`. |
| SQLite | `rusqlite` | Direct, synchronous, full access to SQLite features. |
| Compression | `flate2`, `zstd`, `zlib-rs` | uv replaced C zlib with `zlib-rs`. |
| Archives | `tar`, `zip` | |

## Macros and codegen

| Need | Pick | Notes |
|---|---|---|
| Proc macros | `syn`, `quote`, `proc-macro2` | Keep them in leaf crates. |
| Derive input parsing | `darling` | |
| Builders | `bon` | Typestate; compile-time checked. |
| Compile-time maps | `phf` | mise. Perfect hashing for static tables. |
| Const concatenation | `constcat` | oxc. |
| Case conversion | `heck`, `convert_case` | |

## Development tools

| Tool | Job |
|---|---|
| `cargo-nextest` | Test runner |
| `cargo-insta` | Snapshot review |
| `cargo-mutants` | Grade the test suite |
| `cargo-llvm-cov` | Coverage |
| `divan`, `criterion2` | Benchmarks |
| `samply`, `cargo-flamegraph`, `dhat` | Profiling |
| `hyperfine` | Binary-level timing |
| `cargo-shear`, `cargo-machete` | Unused dependencies |
| `cargo-deny`, `cargo-audit` | Licences and advisories |
| `cargo-semver-checks` | Breaking-change detection |
| `cargo-expand`, `cargo-show-asm`, `cargo-llvm-lines` | Inspect expansion, assembly, IR volume |
| `cargo-bloat` | Binary size |
| `typos-cli` | Spelling |
| `cargo-hack` | Feature-matrix checks |
| `release-plz`, `dist` | Release automation |
| `ast-grep` | Structural search across Rust source |

## Crates to avoid or replace

| Old | Use instead |
|---|---|
| `lazy_static`, `once_cell` | `std::sync::LazyLock`, `OnceLock` |
| `chrono` | `jiff` for new code |
| `async-std` | `tokio` or `smol` |
| `structopt` | `clap` derive |
| `failure`, `error-chain` | `thiserror`, `anyhow` |
| `derive_builder` | `bon` |
| `string-cache` | A sharded interner, or none — its global mutex blocks parallelism |
| `async-trait` | Native `async fn` in traits, except where you need `dyn` |
