#!/usr/bin/env bash
# Stream a long-running remote command's progress into the status line instead
# of into the conversation.
#
# Every line the filter produces overwrites one state file. The status line
# reads that file once a second and renders it. Nothing reaches the model until
# the run exits, at which point the harness delivers exactly one completion
# notification.
#
#   run-progress.sh <name> <ssh-host> <remote-command>
#
# Run it with the Bash tool's run_in_background so the single completion
# notification is the only context this costs.
set -uo pipefail

name="${1:?usage: run-progress.sh <name> <host> <command>}"
host="${2:?}"; shift 2
remote="$*"

state_dir="${RUN_PROGRESS_DIR:-$HOME/.claude/run-progress}"
mkdir -p "$state_dir"
state="$state_dir/$name"
here="$(cd "$(dirname "$0")" && pwd)"

cleanup() { rm -f "$state"; }
trap cleanup EXIT INT TERM

printf '%s\tstarting\t%s\n' "$name" "$(date +%s)" > "$state"

# PowerShell over ssh: base64 UTF-16LE sidesteps every quoting layer between
# this shell, sshd, cmd, and powershell. See the skill's Progress section.
payload=$(printf '%s\n' \
  '$ProgressPreference = "SilentlyContinue"' \
  '$env:CARGO_TERM_PROGRESS_WHEN = "always"' \
  '$env:CARGO_TERM_PROGRESS_WIDTH = "140"' \
  '$env:CARGO_TERM_COLOR = "never"' \
  "$remote" | python3 -c 'import base64,sys;print(base64.b64encode(sys.stdin.read().encode("utf-16-le")).decode())')

# stdout carries only terminal events; every progress tick goes to the state file.
ssh -o BatchMode=yes "$host" "powershell -NoProfile -EncodedCommand $payload" 2>&1 \
  | "$here/cargo-progress.pl" --state "$state" --name "$name"
status=${PIPESTATUS[0]}

printf '%s\t%s\t%s\n' "$name" "$([ "$status" -eq 0 ] && echo done || echo "failed rc=$status")" "$(date +%s)" > "$state"
sleep 3   # let one status-line refresh show the final state before it clears
exit "$status"
