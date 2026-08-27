# Workspace, manifests, and build speed

## Layout

Keep the crate list **flat**. One `crates/` directory, every crate directly
inside it, no nesting. A long list stays readable; a tree rots. This scales to
about a million lines, which is past the size of `rust-analyzer`, `oxc`, and
`uv`.

```
repo/
  Cargo.toml          # virtual manifest, no [package]
  rust-toolchain.toml
  clippy.toml
  rustfmt.toml
  .cargo/config.toml
  crates/
    myapp-core/
    myapp-cli/
    myapp-fs/
  apps/               # binaries, when they are separate from crates/
  tasks/ or xtask/    # automation written in Rust
```

Rules:

- **Folder name equals crate name.** `crates/uv-cache/` holds the crate
  `uv-cache`. Cargo's namespace is flat, so express hierarchy with a prefix
  (`hir_def`, `hir_ty`, `oxc_ast`, `uv-distribution-types`), not with
  directories.
- **The root manifest is virtual.** No `[package]` at the root. This keeps
  `src/` out of the repo root and makes `cargo test` mean "the whole workspace"
  without `--workspace`.
- **Keep `src/` even for a one-file crate**, so growing it needs no move.
- **Split publishable crates into `libs/`** when a repo publishes some crates and
  keeps others private. The directory itself then enforces the boundary.
- **Internal crates use `version = "0.0.0"` and `publish = false`.** Reserve real
  versions for what you actually ship.

Split a crate when it gives you a real boundary — a different dependency set, a
different compile cost, an interface you want to test on its own. Do not split
to make files smaller.

## Workspace manifest

Declare every dependency once at the root, including path dependencies, and
inherit in members.

```toml
[workspace]
members = ["crates/*", "apps/*"]
resolver = "3"                     # edition 2024 default

[workspace.package]
edition      = "2024"
rust-version = "1.98.0"
license      = "MIT OR Apache-2.0"
repository   = "https://github.com/owner/repo"

[workspace.dependencies]
myapp-core = { version = "0.1.0", path = "crates/myapp-core" }
serde      = { version = "1", features = ["derive"] }
thiserror  = "2"
rustc-hash = "2"
```

Each member then reads:

```toml
[package]
name = "myapp-core"
version = "0.1.0"
edition.workspace      = true
rust-version.workspace = true
license.workspace      = true

[dependencies]
serde.workspace = true

[lints]
workspace = true
```

Use a **relaxed version requirement** (`"1"`, `"2"`) for a dependency that
appears in your public API, so downstream users pick the patch. Pin exactly
(`"=0.2.21"`) only when a break would be silent.

## Lints

Set lints once at the workspace root and inherit everywhere. A per-crate lint
list becomes noise. Groups take a negative `priority` so individual entries
override them.

```toml
[workspace.lints.rust]
unsafe_code                = "warn"   # drop this line in a crate that needs unsafe
unreachable_pub            = "warn"
unsafe_op_in_unsafe_fn     = "warn"
unused_unsafe              = "warn"
non_ascii_idents           = "warn"
missing_debug_implementations = "warn"

[workspace.lints.clippy]
all      = { level = "warn", priority = -1 }
pedantic = { level = "warn", priority = -1 }

# Restriction lints worth turning on everywhere.
dbg_macro                  = "warn"
todo                       = "warn"
unimplemented              = "warn"
print_stdout               = "warn"   # output must be opt-in, never accidental
print_stderr               = "warn"
exit                       = "warn"
allow_attributes           = "warn"   # forces #[expect] over #[allow]
undocumented_unsafe_blocks = "warn"
unnecessary_safety_comment = "warn"
clone_on_ref_ptr           = "warn"   # Rc::clone(&x), never x.clone()
format_push_string         = "warn"   # kills an intermediate String
error_impl_error           = "warn"   # do not name a type `Error`
get_unwrap                 = "warn"
rc_buffer                  = "warn"
rc_mutex                   = "warn"
empty_drop                 = "warn"
infinite_loop              = "warn"
unused_result_ok           = "warn"
fn_to_numeric_cast_any     = "warn"   # a missing call, almost always

# Pedantic lints that fight most codebases.
module_name_repetitions = "allow"
must_use_candidate      = "allow"
missing_errors_doc      = "allow"
missing_panics_doc      = "allow"
similar_names           = "allow"
too_many_lines          = "allow"
struct_excessive_bools  = "allow"
```

Turning `pedantic` on and allowing the handful that annoy you is the pattern
`oxc` and `uv` both use. Write a comment next to each `allow` saying why, the
way `oxc` does — a bare `allow` invites the next person to add another.

`clippy.toml` carries the settings the lints read:

```toml
msrv = "1.98.0"
disallowed-methods = [
  { path = "std::env::set_var", reason = "not thread-safe; set config at startup" },
]
```

## Profiles

```toml
[profile.dev]
debug = false            # local and CI builds get much faster

[profile.test]
debug = false

[profile.dev.package]
# Proc macros and snapshot machinery run many times; optimize them once.
myapp-macros.opt-level = 1
insta.opt-level        = 3
similar.opt-level      = 3

[profile.release]
opt-level      = 3
lto            = "fat"
codegen-units  = 1
strip          = "symbols"
debug          = false
panic          = "abort"   # forces the code to be correct rather than recoverable

# Same shape as release, but you can actually profile it.
[profile.profiling]
inherits = "release"
strip    = false
debug    = "full"
lto      = false           # fat LTO makes the edit-profile loop unusable

# Fast iteration on tests.
[profile.fast-build]
inherits  = "dev"
opt-level = 1
lto       = "off"          # opt-level 1 turns on thin LTO implicitly
debug     = 0
strip     = "debuginfo"

# Coverage runs must keep the assertions that release drops.
[profile.coverage]
inherits         = "release"
opt-level        = 2
codegen-units    = 256
lto              = "thin"
debug-assertions = true
overflow-checks  = true
```

`panic = "abort"` is not compatible with tests that expect a panic, and it stops
a plugin host from catching a panic at a boundary. Add an inheriting profile
with `panic = "unwind"` for those targets rather than weakening release.

## Toolchain and MSRV

Pin the toolchain in the repo so every machine and CI runner agrees:

```toml
# rust-toolchain.toml
[toolchain]
channel    = "1.98.0"
profile    = "default"
components = ["clippy", "rustfmt"]
```

Set `rust-version` in `[workspace.package]` to your real MSRV, which may be
older than the pinned toolchain. `clippy.toml`'s `msrv` key makes Clippy respect
it.

## Build speed

Compile time is a feature. In order of payoff:

1. **Audit `Cargo.lock`.** For each dependency, ask what problem it solves
   *here*. `regex` for one `starts_with` is a minute of build time per clean
   build. Feature-gate or delete.
2. **Push proc macros to the leaves.** A proc macro blocks pipelined
   compilation and drags in `syn`. Keep `serde` derives in the crates that
   serialize, not in the vocabulary crate everything depends on.
3. **Shape the crate graph wide, not deep.** `A → B → C → D` compiles serially.
   A shared vocabulary crate plus independent feature crates plus one leaf
   binary compiles in parallel.
4. **Avoid generics at crate boundaries.** Each downstream crate re-monomorphizes
   them. Make the public function generic if you must, then have it delegate
   immediately to a non-generic inner function. Prefer `&Path` over
   `impl AsRef<Path>` and `&dyn Fn()` over `impl Fn()` at a boundary.
5. **Ship one binary.** Every extra binary target repeats the link step. A
   busybox-style dispatcher that reads `argv[0]` costs one link.
6. **Turn off debug info** in `dev` and `test`, as above.
7. **Use a fast linker.** In `.cargo/config.toml`:

```toml
[target.x86_64-unknown-linux-gnu]
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

[target.aarch64-apple-darwin]
rustflags = ["-C", "link-arg=-fuse-ld=lld"]
```

Diagnose with `cargo build --timings`, which shows the critical path and how
much parallelism you actually get. Do not guess.

## Automation

Write automation in Rust (`cargo xtask`) or in the repo's task runner (`just`,
`mise run`), never as loose shell scripts spread across the repo. One entry
point, discoverable with `just --list` or `mise task ls`.

Give the repo a single "everything" target — `just ready`, `mise run ci` — that
runs format, lint, test, and codegen. That target is what an agent runs before
declaring the work done.

When a repo generates code (schemas, docs, CLI reference, lint rule tables),
regenerate rather than hand-edit, and commit the result:

```sh
cargo dev generate-all      # ruff
just ast                    # oxc
mise run render             # mise
```

## CI shape

- Split `cargo nextest run --no-run` from the run, so a build failure is not
  reported as a test failure.
- Cache the `target` artifacts of **external** dependencies only. Rebuild your
  own crates every run; caching them is how a stale build passes CI.
- Set `CARGO_INCREMENTAL=0`. From-scratch builds gain nothing from incremental
  state and pay for the extra I/O and cache size.
- Set `RUSTFLAGS=-Dwarnings` in the environment instead of `#![deny(warnings)]`
  in source, so local development is not blocked by a nightly lint.
- Run the feature matrix (`cargo hack --feature-powerset check`) on a schedule,
  not on every push.

## Repo hygiene tools

| Tool | Job |
|---|---|
| `cargo-shear` / `cargo-machete` | Find dependencies nothing uses |
| `typos-cli` | Catch typos in code, comments, and docs |
| `cargo-deny` | License, advisory, and duplicate-version policy |
| `cargo-semver-checks` | Detect a breaking change before you publish |
| `cargo-hakari` | Cut workspace feature-unification rebuilds |
| `cargo-nextest` | The test runner (see [testing.md](testing.md)) |

Never run a blanket `cargo update`. Change one dependency at a time with
`cargo update --precise <version> <crate>` so the lockfile diff is reviewable.
