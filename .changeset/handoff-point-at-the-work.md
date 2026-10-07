---
"@hadronomy/opencode-handoff-plugin": minor
---

The brief points at work instead of retelling it. `src/artifacts.ts` reads file paths, commit shas, issue refs, and links straight out of the conversation, so every pointer is exactly what the session wrote. A model asked for the same list paraphrases a path or invents one. The brief lists what a caller named first, then what the conversation named, and the summarizer is told which artifacts the list already holds so the handover names them rather than repeating what they hold.

Precision beats recall in that reader. A pointer that only looks like a path costs the next agent a failed read, so `e.g.`, `v1.2`, and a bare `1234567` stay out. A URL keeps its path and loses its query string, because that is where an access token rides.

`ArtifactKind` gains `url` for a link that is not a work item.

The summarizer prompt is written the way an agent document is written. The transcript sits between two markers and the instruction follows it, because a model answers the last thing it reads. The prompt states the shape it wants and names no shape it refuses: a ban spends attention on the thing it forbids, and the runtime guard already refuses an answer that arrives as a form. The purpose travels with the transcript, and a handover written for a guess covers the session evenly rather than narrowing onto a label nobody chose.

The brief drops an empty section rather than printing `Skills: none`, and each label now says what to do with the list under it: `Skills to invoke`, and `Artifacts, open these before you act`.
