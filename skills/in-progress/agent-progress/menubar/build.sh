#!/usr/bin/env bash
# Build AgentProgress.app into ~/Applications. Needs the Xcode command line
# tools, which supply swiftc.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="${1:-$HOME/Applications/AgentProgress.app}"
macos="$app/Contents/MacOS"
mkdir -p "$macos"

swiftc -O -o "$macos/AgentProgress" \
  "$here/Shaders.swift" "$here/AgentProgress.swift" "$here/Entry.swift" \
  -framework AppKit -framework MetalKit -framework SwiftUI \
  -target arm64-apple-macosx14.0

cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>AgentProgress</string>
  <key>CFBundleIdentifier</key><string>dev.hadronomy.agent-progress</string>
  <key>CFBundleExecutable</key><string>AgentProgress</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
</dict></plist>
PLIST
echo "built $app"
