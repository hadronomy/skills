---
"@hadronomy/opencode-handoff-plugin": patch
---

Build the scanner's fake example key by concatenation instead of a literal. A key-shaped literal in shipped source trips the refusal in any session reading that source, including the plugin's own docs and tests.
