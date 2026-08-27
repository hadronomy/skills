## What it does

`rust-craft` gives an agent the working discipline of the Rust toolchain teams —
`oxc`, `ruff`/`ty`, `uv`, `mise`, `rust-analyzer` — as a set of rules it applies
while writing, reviewing, or restructuring Rust. It covers workspace layout,
type and API design, error handling, performance, async, CLI construction,
testing, crate choice, and release.

Its rules come from those teams' own `AGENTS.md` files and root manifests rather
than from general advice, so the defaults are the ones enforced on real
pull requests. That is what makes it behave differently from a style guide: it
tells the agent to read the checkout first and let repo convention override
every default it carries.

## When to reach for it

- **Invocation mode.** Type `/rust-craft`, or the agent reaches for it
  automatically when a task involves Rust.
- **Trigger boundary.** Reach for this for any Rust work. For designing a module
  interface in the abstract, `codebase-design` owns the vocabulary and
  `rust-craft` points at it rather than repeating it.

## The core contract

Twelve rules apply on every branch, before any reference file loads. The four
that change the most behaviour:

| Rule | What it rules out |
|---|---|
| Encode constraints in types | `unwrap`, `expect`, `panic!`, `unreachable!` outside tests |
| Never silence a lint to pass | `#[allow]`, workspace `allow`, `-A` on the command line |
| Measure before you optimize | A speed claim with no benchmark number |
| Run the tests | "It compiles" reported as "it works" |

## Routing, not one long file

The skill is a router. `SKILL.md` holds the contract, a task-to-file table, and
a four-step workflow; ten reference files hold the detail, and only the ones a
task needs get loaded. Asking for a performance fix pulls in allocation, type
size, hashing, and profiling. It does not pull in semver or feature flags.

`scripts/inspect_rust_project.sh` runs first: a read-only survey printing the
toolchain, edition, MSRV, lint policy, crate list, and the repo's real test
command.

## Common questions

**Why does it prefer `usage-rs` over `clap`?**
One declaration produces the parser, completions, help, docs, and man pages, so
they cannot drift apart. On a 211-command CLI it parses in 0.19 µs with zero
heap allocations against clap's 480 µs and 6,560. The skill also records that
the project calls itself experimental, and says to pin the version.

**Does it override my repo's conventions?**
No. Rule one is that the checkout is the authority. The skill's defaults apply
only where the repo is silent.

**How current are the crate recommendations?**
They were written against Rust 1.98 and edition 2024. `references/sources.md`
lists the picks most likely to age — `jiff` against `chrono`, `bon` against
`typed-builder`, `usage-rs` stability — so they can be rechecked rather than
trusted forever.

## It's working if

- The agent reads `Cargo.toml` and a neighbouring file before it writes any.
- A fallible path comes back as `if let` or a newtype, not `unwrap`.
- A Clippy complaint produces a refactor, not an `#[allow]`.
- Performance claims arrive with two numbers.
- It tells you which paths it could not verify.

## Where it fits

A reach-for-it-anytime standalone: no setup, no chain position, useful from the
first line of a new crate to the release PR. Its one neighbour is
`codebase-design`, because module depth is a language-independent question and
`rust-craft` defers to it rather than restating it.
