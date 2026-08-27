#!/usr/bin/env bash
set -euo pipefail

# Links every non-deprecated skill in this repo into the directories each
# harness reads:
#   ~/.claude/skills   Claude Code
#   ~/.agents/skills   Codex, OpenCode, and other Agent Skills harnesses
#
# Each entry is a symlink into this repo, so `git pull` is the whole update
# story. The `skills` CLI puts real directories in ~/.agents/skills, so a
# symlink there is also how you tell your own skills from installed ones:
#   ls -la ~/.agents/skills | grep '^l'

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

names=(); srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(find "$REPO/skills" -name SKILL.md \
           -not -path '*/node_modules/*' \
           -not -path '*/deprecated/*' -print0)

if [ ${#names[@]} -eq 0 ]; then
  echo "no skills found under $REPO/skills" >&2
  exit 1
fi

for DEST in "${DESTS[@]}"; do
  # A DEST that is itself a symlink into this repo would make the per-skill
  # links land back inside the working copy. Refuse rather than pollute it.
  if [ -L "$DEST" ]; then
    resolved="$(readlink "$DEST")"
    case "$resolved" in
      "$REPO"|"$REPO"/*)
        echo "error: $DEST is a symlink into this repo ($resolved)." >&2
        echo "Remove it and re-run; this script recreates it as a real directory." >&2
        exit 1 ;;
    esac
  fi

  mkdir -p "$DEST"

  for i in "${!names[@]}"; do
    name="${names[$i]}"; src="${srcs[$i]}"; target="$DEST/$name"

    # A real directory here is an install from the `skills` CLI. Refuse to
    # clobber it: the collision is a name clash worth resolving by hand.
    if [ -e "$target" ] && [ ! -L "$target" ]; then
      echo "skip $name: $target is a real directory (CLI-installed). Rename one of them." >&2
      continue
    fi

    ln -sfn "$src" "$target"
    echo "linked $name -> $src ($DEST)"
  done
done
