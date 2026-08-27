# Testing and verification

## Rules

- **A bug fix starts with a failing test.** Write it, watch it fail, then fix.
- **Prefer integration tests to unit tests.** Test through the seam a caller
  uses, so a refactor behind that seam does not rewrite the suite.
- **Check whether a test already covers the behaviour** before adding one.
  Duplicate coverage is maintenance with no signal.
- **Match the style of the tests next to yours** — the same helpers, the same
  fixture shape, the same assertion style.
- **Do not prefix names with `test_`.** The name states the behaviour:
  `resolves_to_newest_compatible_version`.
- **If you did not run the tests, the code does not work.**

## Runner

```sh
cargo nextest run --workspace          # 2–3× faster, one process per test
cargo test --workspace --doc           # nextest does not run doctests
cargo nextest run -p mycrate -- filter # narrow while iterating
```

`nextest` isolates each test in its own process, so one panic does not take the
suite with it, and it gives you retries, partitioning across CI machines, and
per-test timeouts. Add `.config/nextest.toml` for slow-test warnings and
flaky-test retries.

## Placement

```
crates/mycrate/
  src/lib.rs
  src/parser.rs        #[cfg(test)] mod tests — private helpers, edge cases
  tests/               integration tests — one binary each, public API only
  benches/             divan or criterion benchmarks
  examples/            runnable examples; also compile-checked
```

Keep the `#[cfg(test)] mod tests` block next to the code it tests. Every file in
`tests/` is a separate binary that links the whole crate, so a large number of
them costs real build time — group by feature, not by function.

`examples/` earn their place twice: they compile in CI, and they are the fastest
way to reproduce a bug by hand.

```sh
cargo run -p myapp-parser --example parse -- fixture.txt
```

## Snapshot testing

`insta` is the right tool whenever the expected value is more than a line —
diagnostics, rendered output, JSON, an AST.

```rust
#[test]
fn reports_unclosed_bracket() {
    let diagnostics = check("fn main() { ");
    insta::assert_snapshot!(diagnostics);
}
```

```sh
cargo insta test --review     # run and review interactively
cargo insta accept            # after reading the diff
```

Rules:

- **Never hand-edit a snapshot file or an inline snapshot body.** Regenerate,
  then read the diff. A hand-edited snapshot asserts what you hoped, not what
  happened.
- **Read every regenerated snapshot** before committing. A green run with
  `INSTA_FORCE_PASS=1` proves nothing until you have read the diff.
- Check for leftover `.pending-snap` files after a forced run.
- Redact the nondeterministic parts with `insta`'s filters rather than
  weakening the assertion.
- Speed the runs up in `[profile.dev.package]`: `insta.opt-level = 3` and
  `similar.opt-level = 3`.

For CLI transcripts use `trycmd` or `snapbox` instead — see [cli.md](cli.md).

## Property and fuzz testing

`proptest` for anything with an algebraic law — a parser and printer that should
round-trip, a comparator that must be a total order, a cache that must agree
with the uncached path.

```rust
proptest! {
    #[test]
    fn parse_print_roundtrip(expr in arbitrary_expression()) {
        prop_assert_eq!(parse(&print(&expr)).unwrap(), expr);
    }
}
```

`cargo-fuzz` with `arbitrary` for anything that reads untrusted bytes. Commit
every crash the fuzzer finds as a regression test in `tests/`.

## Grading the suite

`cargo-mutants` changes your code and reports which mutations no test caught.
Every surviving mutant is a behaviour nothing verifies.

```sh
cargo mutants --in-place --test-tool nextest -- --workspace
```

Run it on the crates that matter, not the whole workspace — it is slow by
design. Treat it as a review of the tests, not a gate.

## Unsafe and concurrency

```sh
cargo +nightly miri test -p mycrate     # UB, aliasing, uninitialized reads
```

Run Miri on any crate with `unsafe`. It randomizes allocation addresses and
thread interleaving, so run it more than once.

`loom` for hand-written atomics and lock-free structures: it enumerates every
legal interleaving under the C++11 memory model. `shuttle` when the state space
is too big for `loom` and randomized search is enough.

## Compile-fail tests

`trybuild` asserts that misuse **does not compile** — the point of a typestate
builder or a sealed trait is lost if nothing tests it.

```rust
#[test]
fn ui() {
    trybuild::TestCases::new().compile_fail("tests/ui/*.rs");
}
```

## Determinism

A test that reads the wall clock, the network, the real filesystem, or an
ambient environment variable is a future flake.

- `tempfile` / `assert_fs` for filesystem work; never write into the repo.
- Inject the clock behind a small trait, or use
  `#[tokio::test(start_paused = true)]` and `tokio::time::advance`.
- Never set a process-wide env var in a test; `nextest`'s per-test process makes
  this safe, but `cargo test` shares one process across threads.
- Sort anything derived from a `HashMap` before asserting on it.
- Mock HTTP with `wiremock`, or record and replay real responses as fixtures.

## Benchmarks

`divan` for a clean API with allocation counting; `criterion2` when you need
Criterion's statistics. Gate regressions in CI with CodSpeed, which measures
instruction counts instead of wall time and so is stable on shared runners.

Benchmarks are code: keep them compiling in CI even when you do not run them.

## Coverage

```sh
cargo llvm-cov --workspace --profile coverage --lcov --output-path lcov.info
```

Use a `coverage` profile with `debug-assertions = true` and
`overflow-checks = true`, so instrumented runs still exercise the assertions
release drops. Read coverage as a map of what is untested, never as a target
number.
