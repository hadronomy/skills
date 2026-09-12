---
"@hadronomy/opencode-handoff-plugin": patch
---

The brief asks for prose. The summarizer prompt listed the four things to cover as bullets, and a small model answered by filling those bullets back as a JSON object, which landed in the brief as a shape with no handover in it. The prompt now bans JSON, headings, bullets, and labels outright, and asks for four to eight sentences. A summary that still comes back starting with `{` or `[` is refused, and the brief carries the transcript instead.
