#!/usr/bin/env bash
# Keep the menu bar renderer running across logins.
#
# KeepAlive is conditional on SuccessfulExit=false, so a crash restarts it but
# choosing Quit from the menu leaves it stopped until the next login. An
# unconditional KeepAlive would make Quit do nothing.
set -euo pipefail

label="dev.hadronomy.agent-progress"
app="${1:-$HOME/Applications/AgentProgress.app}"
bin="$app/Contents/MacOS/AgentProgress"
plist="$HOME/Library/LaunchAgents/$label.plist"

[ -x "$bin" ] || { echo "not built: $bin — run build.sh first" >&2; exit 1; }
mkdir -p "$(dirname "$plist")"

cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array><string>$bin</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardErrorPath</key><string>/tmp/$label.err</string>
</dict></plist>
PLIST

# bootout first so a re-run replaces the running copy rather than failing.
launchctl bootout "gui/$UID/$label" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$plist"
echo "loaded $label"
echo "  remove with: launchctl bootout gui/\$UID/$label && rm $plist"
