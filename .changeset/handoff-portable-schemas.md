---
"@hadronomy/opencode-handoff-plugin": patch
---

Fix every `/handoff` and `handoff_transfer` call failing at the host boundary. Method schemas now cross as Standard Schema adapters validated in the plugin's own Effect copy: the host decodes method schemas with its own Effect copy, whose interpreter defects on foreign schema ASTs, so raw schemas failed each call with `UnsupportedContentType` instead of validating it. The wire format is unchanged; the slash command now sends complete values instead of relying on decode defaults at the call site.
