# Shipping: semver, features, and release

## What breaks semver

Run `cargo semver-checks check-release` in CI on every publishable crate. It
catches most of the list below, but not all of it.

Major-version breaks:

- Removing or renaming any public item, or narrowing its visibility.
- Adding a field to a public struct without `#[non_exhaustive]`.
- Adding a variant to a public enum without `#[non_exhaustive]`.
- Adding a required method to a public trait that is not sealed.
- Changing a function signature, including tightening a generic bound.
- Changing a public type's auto traits — a `Send` or `Sync` that disappears
  because you added an `Rc` field is a silent break.
- Bumping a **public** dependency, meaning one whose types appear in your API.
  Bumping a private dependency is not a break.
- Raising the MSRV, if your policy says so.

Prevent most of these at design time: `#[non_exhaustive]`, private fields,
sealed traits. See [api-design.md](api-design.md).

## MSRV

```toml
[workspace.package]
rust-version = "1.98.0"     # the real floor
```

```toml
# rust-toolchain.toml — what developers and CI use
[toolchain]
channel = "1.98.0"
```

State the policy in the README: how far back you support, and whether an MSRV
bump is minor or major. Set `msrv` in `clippy.toml` so Clippy stops suggesting
newer APIs. Verify with `cargo hack check --rust-version --workspace`.

## Features

Features are **additive**. Turning one on may add API; it must never remove or
change API. A `no-std` or `no-foo` feature breaks that rule — invert it into
`std` or `foo` instead.

```toml
[features]
default = ["std"]
std     = []
serde   = ["dep:serde", "smallvec/serde"]

[dependencies]
serde = { version = "1", optional = true }
```

- Use `dep:name` syntax so an optional dependency does not implicitly become a
  feature name.
- `default-features = false` on your own dependencies; enable what you use.
- Test the matrix: `cargo hack --feature-powerset --depth 2 check`. A powerset
  run is slow — schedule it rather than running it per push.
- Never gate a bug fix behind a feature.

## Publish metadata

```toml
[package]
name        = "myapp-core"
description = "Resolves and locks dependency graphs."
license     = "MIT OR Apache-2.0"
repository  = "https://github.com/owner/repo"
homepage    = "https://myapp.dev"
documentation = "https://docs.rs/myapp-core"
readme      = "README.md"
keywords    = ["resolver", "lockfile", "packaging"]
categories  = ["development-tools"]

[package.metadata.docs.rs]
all-features = true
rustdoc-args = ["--cfg", "docsrs"]
```

`docsrs` plus `#[cfg_attr(docsrs, doc(cfg(feature = "serde")))]` makes docs.rs
label which feature gates an item.

Set `publish = false` on every crate you do not intend to release. A workspace
that publishes some crates and not others should keep them in separate
directories, so the boundary is visible.

## Release automation

| Tool | What it does |
|---|---|
| `release-plz` | Opens a release PR with version bumps and changelog from conventional commits, then publishes on merge. |
| `cargo-release` | Manual, scripted releases. |
| `dist` (was `cargo-dist`) | Builds binaries, installers, and archives for every platform, and generates the release workflow. |

`dist` generates part of `.github/workflows/release.yml` from
`dist-workspace.toml`. Edit the config and regenerate; a hand edit to the
generated section disappears on the next run.

Use Conventional Commits (`fix(parser): handle trailing comma`) so the changelog
and the version bump derive themselves. Many repos enforce the scoped title in
CI.

## Binary size

```toml
[profile.minimal-size]
inherits      = "release"
opt-level     = "z"
lto           = "fat"
codegen-units = 1
panic         = "abort"
strip         = true
```

`cargo bloat --release --crates` names the crate consuming the space. The usual
causes are generic monomorphization (fix with the thin-wrapper pattern),
`serde_json` pulled in for one config file, and format machinery in error paths.

## Cross-compilation

- `cross` — Docker images with the toolchains preinstalled.
- `cargo-zigbuild` — uses Zig as the linker; good for glibc version targeting.
- `cargo xwin` — check Windows targets from Unix, which `uv` uses for Clippy
  runs against Windows code paths.
- Static musl for Linux binaries you distribute.

## Supply chain

```toml
# deny.toml
[licenses]
allow = ["MIT", "Apache-2.0", "Apache-2.0 WITH LLVM-exception", "BSD-3-Clause"]

[bans]
multiple-versions = "warn"

[advisories]
yanked = "deny"
```

Run `cargo deny check` and `cargo audit` in CI. Keep `Cargo.lock` committed for
every binary, and for libraries too — it makes CI reproducible without affecting
downstream resolution.

Change dependencies one at a time:

```bash
cargo update --precise 1.2.3 some-crate
```

Never run a blanket `cargo update` in a change that is about something else. The
lockfile diff must stay reviewable.
