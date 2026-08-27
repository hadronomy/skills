---
name: rust-craft
description: Craft production Rust the way the top toolchain teams do. Use when writing, reviewing, or restructuring Rust — workspace layout, Cargo manifests, lints, and profiles; type, trait, and error API design; performance, allocation, and profiling work; async and concurrency; CLI construction; test, snapshot, and benchmark suites; crate selection; release, semver, MSRV, and feature flags.
---

# Rust Craft

Write Rust that is correct before it is fast, measured before it is called fast,
and shaped so that every call path is obvious to the next reader.

The rules here are taken from the codebases that set the bar: `oxc`,
`ruff`/`ty`, `uv`, `mise`, `rust-analyzer`, and the official API guidelines.
Read [references/sources.md](references/sources.md) when you need to check why a
rule exists.

This is a routed skill. Always apply the core contract. Read only the reference
layers the task needs.

## Core contract

1. **The checkout is the authority.** Before you write a line, read
   `Cargo.toml`, `rust-toolchain.toml`, `clippy.toml`, `rustfmt.toml`,
   `AGENTS.md`, and two files next to the one you will change. Repo convention
   beats every default in this skill.
2. **Encode constraints in types.** Keep `panic!`, `unreachable!`, `unwrap`,
   `expect`, and `todo!` out of library and binary code. Use `if let`, let
   chains, `let ... else`, and newtypes that cannot hold a bad value. Verbose
   code that removes a panic is the better trade.
3. **Parse at the edge.** Convert untrusted input into a validated type once, at
   the boundary. Past that point, only the validated type exists.
4. **Never silence a lint to make the build pass.** Refactor instead. If a lint
   must go, write `#[expect(lint, reason = "...")]` on the smallest possible
   scope. Do not use `#[allow]`, a workspace `allow`, or `-A` on the command
   line.
5. **Every `unsafe` block carries a `// SAFETY:` comment** that names the
   invariant it depends on. Do not reach for `unsafe` to gain speed you have not
   measured.
6. **Imports go at the top of the file.** No `use` inside a function body. Use a
   fully qualified path only for a name you write once.
7. **Write full names.** `version`, not `ver`. `requires_python`, not `rp`.
8. **Comments state invariants and reasons.** They never narrate the code and
   never record what the code used to do.
9. **Measure before you optimize, and again after.** A speed claim without a
   benchmark number is not a claim.
10. **Run the tests.** If you did not run them, the code does not work.
11. **Keep visibility narrow.** `pub(crate)` by default. Make an item `pub` when
    another crate needs it and that is the cleaner design.
12. **Features are additive.** `--no-default-features` must compile, and turning
    a feature on must never remove an API.

## Route the task

| Task | Read first | Also read when relevant |
|---|---|---|
| Start a project, split crates, tune Cargo manifests, lints, profiles, or build speed | [workspace.md](references/workspace.md) | [shipping.md](references/shipping.md) |
| Design a type, trait, module interface, or public API | [api-design.md](references/api-design.md) | [errors.md](references/errors.md), the `codebase-design` skill for depth vocabulary |
| Handle failure, model error types, or render diagnostics | [errors.md](references/errors.md) | [api-design.md](references/api-design.md) |
| Make code faster, cut allocations, shrink types, or profile | [performance.md](references/performance.md) | [testing.md](references/testing.md) for benchmark harnesses |
| Write async code, concurrency, or shared state | [async.md](references/async.md) | [performance.md](references/performance.md) |
| Build or extend a command-line binary | [cli.md](references/cli.md) | [errors.md](references/errors.md), [testing.md](references/testing.md) |
| Write tests, snapshots, property tests, or benchmarks | [testing.md](references/testing.md) | [performance.md](references/performance.md) |
| Choose a dependency | [crates.md](references/crates.md) | [shipping.md](references/shipping.md) |
| Publish, version, set MSRV, or gate a feature | [shipping.md](references/shipping.md) | [api-design.md](references/api-design.md) |
| Check why a rule here exists | [sources.md](references/sources.md) | The upstream repo itself |

## Workflow

### 1. Orient

Read the manifests and the neighbouring code. Record four things before you
plan: the edition and MSRV, the lint configuration, the test command this repo
actually uses, and the crate that owns the seam you are about to touch.

Run the inspector:

```sh
scripts/inspect_rust_project.sh /path/to/project
```

Done when you can name the crate you will edit, the command that tests it, and
the lints that will judge it.

### 2. Design before you type

State the interface first: the types that cross the seam, the error type, and
the invariant each new type protects. Prefer making an illegal state
unrepresentable over writing a check. Reach for the `codebase-design` skill when
the question is where the seam belongs.

Done when every new public item has a named invariant and a reason to exist.

### 3. Build

Follow the reference layer for the task. Match the surrounding code's idiom,
naming, and comment density. Reuse what the workspace already has before you add
a dependency or write a helper.

Done when the change compiles with zero warnings and no new suppression.

### 4. Verify

Run the repo's own commands when it has them — a `justfile`, `mise.toml`,
`xtask`, or `Makefile` target names the real gate. Otherwise:

```sh
cargo fmt --all
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo nextest run --workspace
cargo test --workspace --doc
```

Review every snapshot the run regenerated. Never hand-edit a snapshot file or an
inline snapshot body.

Done when every command above passes, every regenerated snapshot has been read,
and you can state which paths you did not exercise.

## Report honestly

Say which commands you ran and what they printed. Name every path you could not
verify — a platform you cannot build for, a test you skipped, a benchmark you
did not run. A clean `cargo check` does not prove behaviour.
