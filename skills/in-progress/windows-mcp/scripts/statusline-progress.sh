#!/usr/bin/env bash
# Status-line segment: render every active run in ~/.claude/run-progress.
#
# Add to an existing status line, or use standalone. Reads nothing from stdin,
# so it composes with a script that does.
state_dir="${RUN_PROGRESS_DIR:-$HOME/.claude/run-progress}"
[ -d "$state_dir" ] || exit 0

now=$(date +%s)
for f in "$state_dir"/*; do
  [ -f "$f" ] || continue
  case "$f" in *.tmp) continue ;; esac
  # A runner killed without its trap leaves a stale file. Drop anything
  # untouched for 5 minutes rather than showing a frozen bar forever.
  mtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo "$now")
  [ $(( now - mtime )) -gt 300 ] && continue
  IFS=$'\t' read -r name body < "$f"
  printf '%s %s\n' "⚙ ${name}" "${body}"
done
