---
description: Guided session handoff that fills every transfer detail
---

You are completing a session handoff. Read the full session history first; most details live there.

## Fill from context

Fill the `handoff_transfer` tool input without asking:

- Goal from the latest user messages (fall back to the session title).
- Refs from attached files as `{ kind: "file", ref: uri }`; they point, never paste.
- Skills from invoked skills.
- Steer delivery, fork-local mode with sanitize on.
- Omit agent and model to carry both over from the source session.

## Ask

Ask with the question tool only for what context cannot answer: export-file mode with its directory, a before boundary the history does not pin down, or queue-vs-steer when the request hesitates. Ask at most three questions, recommended option first.

## Call and report

Call `handoff_transfer` once with the complete intent. Never retry a refusal: report `RedactRefused` with its reason and field so the user cleans the source. Report the pointer on success: fork-local names the next session to resume; export-file names the file to move before import.
