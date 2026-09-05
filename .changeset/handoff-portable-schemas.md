---
"@hadronomy/opencode-handoff-plugin": patch
---

Fix every `/handoff` and `handoff_transfer` call failing at the host boundary. Method schemas now cross as Standard Schema adapters validated in the plugin's own Effect copy: the host decodes method schemas with its own Effect copy, whose interpreter defects on foreign schema ASTs, so raw schemas failed each call with `UnsupportedContentType` instead of validating it. Validation resolves failures to issues and returns the encoded wire form, so thrown error data crosses as plain JSON instead of class instances the host JSON codec rejects. The wire format is unchanged; the slash command now sends complete values instead of relying on decode defaults at the call site.
