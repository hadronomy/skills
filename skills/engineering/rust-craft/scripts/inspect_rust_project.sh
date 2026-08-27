#!/usr/bin/env bash
# Read-only survey of a Rust checkout. Prints what an agent must know before
# editing: toolchain, edition, MSRV, lint policy, crate list, test command.
set -euo pipefail

root="${1:-.}"
cd "$root"

section() { printf '\n=== %s ===\n' "$1"; }
show() { [ -f "$1" ] && { printf -- '--- %s\n' "$1"; cat "$1"; } || printf -- '--- %s (absent)\n' "$1"; }

section "Location"
pwd
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'branch: %s\n' "$(git rev-parse --abbrev-ref HEAD)"
  printf 'dirty files: %s\n' "$(git status --porcelain | wc -l | tr -d ' ')"
fi

section "Toolchain"
show rust-toolchain.toml
show rust-toolchain
# Run outside the project so a `rust-toolchain.toml` pin does not trigger a
# rustup download just because someone inspected the repo.
(cd / && command -v cargo >/dev/null && cargo --version)
(cd / && command -v rustc >/dev/null && rustc --version)

section "Workspace manifest"
if [ -f Cargo.toml ]; then
  awk '/^\[(workspace|package)\]/,/^$/' Cargo.toml
  printf -- '--- edition / rust-version\n'
  grep -nE '^\s*(edition|rust-version|resolver)' Cargo.toml || echo '(inherited or absent)'
else
  echo 'no Cargo.toml here'
fi

section "Lint policy"
if [ -f Cargo.toml ]; then
  awk '/^\[workspace\.lints/{p=1} /^\[(workspace\.)?dependencies\]|^\[profile/{p=0} p' Cargo.toml | head -80
fi
show clippy.toml
show rustfmt.toml
show .rustfmt.toml

section "Profiles"
[ -f Cargo.toml ] && awk '/^\[profile/{p=1} p' Cargo.toml | head -60

section "Crates"
for dir in crates apps libs xtask tasks; do
  [ -d "$dir" ] && { printf -- '--- %s/\n' "$dir"; ls -1 "$dir"; }
done
[ -d src ] && printf -- '--- src/ (single crate)\n' && ls -1 src | head -30

section "Agent and contributor instructions"
for f in AGENTS.md CLAUDE.md CONTRIBUTING.md CONTEXT.md; do
  [ -f "$f" ] && printf -- '--- %s (%s lines)\n' "$f" "$(wc -l < "$f" | tr -d ' ')"
done

section "Task runner"
seen=""
for f in justfile Justfile mise.toml .mise.toml Makefile; do
  # A case-insensitive filesystem matches justfile and Justfile as one file.
  key=$(printf '%s' "$f" | tr '[:upper:]' '[:lower:]')
  case " $seen " in *" $key "*) continue ;; esac
  [ -f "$f" ] && { seen="$seen $key"; printf -- '--- %s\n' "$f"; grep -nE '^[a-zA-Z0-9_:-]+\s*:|^\[tasks' "$f" | head -40; }
done
[ -d .cargo ] && show .cargo/config.toml

section "Test layout"
find . -maxdepth 3 -type d \( -name tests -o -name benches -o -name examples \) \
  -not -path './target/*' 2>/dev/null | head -20
find . -maxdepth 4 -type d -name snapshots -not -path './target/*' 2>/dev/null | head -10

section "Dependency count"
[ -f Cargo.lock ] && printf 'locked packages: %s\n' "$(grep -c '^\[\[package\]\]' Cargo.lock)"

printf '\nRead AGENTS.md and the crate you will edit before writing anything.\n'
