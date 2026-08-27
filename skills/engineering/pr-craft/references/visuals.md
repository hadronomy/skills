# Before and after

If the change alters something a person looks at, show it. This covers more
than UI: terminal output, error messages, generated documents, charts, log
lines, and flamegraphs all qualify.

A reviewer who has to check out the branch to see what changed will approve
without looking.

## Capture

**Web UI** — drive a real browser so the capture is the real render. Call the
Skill tool with `agent-browser`, which takes screenshots of any page and can
log in, resize, and set a colour scheme first. Capture `before` on the base
branch and `after` on yours, at the **same viewport and same theme**. A
comparison where the width moved proves nothing.

**A region of the screen (macOS)**

```bash
screencapture -i -o before.png     # interactive, no window shadow
screencapture -w -o after.png      # a whole window
```

**A terminal** — capture the text, not a photo of text. Paste it in a fenced
block so it stays searchable and readable on a phone. Reach for a recording
only when timing or progressive output is the point.

**A short recording** — a GIF beats a video for an interaction, because it
plays inline in the body without a click. Keep it under about 10 seconds and
5 MB.

```bash
ffmpeg -i screen.mov -vf "fps=12,scale=900:-1:flags=lanczos" \
       -loop 0 after.gif
magick after.gif -layers Optimize after.gif      # shrink it
```

## Make the pair comparable

- Same viewport, same theme, same zoom, same data.
- Same state — do not compare an empty list to a populated one.
- Crop both to the same region. The change should be the only difference.
- Annotate only when the change is genuinely hard to spot, and keep it to one
  arrow or box.

Where the difference is subtle, add a third image: the visual diff.

```bash
magick compare before.png after.png diff.png
```

## Embed

**Side by side**, which is what a reviewer wants for a comparison:

```markdown
| Before | After |
|---|---|
| <img src="URL_BEFORE" width="420"> | <img src="URL_AFTER" width="420"> |
```

Set `width` so two images fit the body column. Without it, GitHub renders both
full-size and stacks them, which defeats the comparison.

**Theme-aware**, when the image has a background that fights one theme:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="URL_DARK">
  <img src="URL_LIGHT" width="600" alt="The upload panel after the change">
</picture>
```

**Collapsed**, for a long series that would bury the text:

```markdown
<details>
<summary>All six breakpoints</summary>

...images...

</details>
```

Keep the primary before-and-after pair **outside** any `<details>`. A collapsed
comparison is a comparison nobody opens.

Always write `alt` text. It is what a screen-reader user gets, and what
everyone gets when the image fails to load.

## Hosting

GitHub's drag-and-drop upload uses an undocumented endpoint that needs browser
session cookies, so `gh` cannot do it and there are no plans to add it. Four
routes, best first:

| Route | How | Notes |
|---|---|---|
| `gh-image` extension | `gh extension install drogers0/gh-image`, then `gh image upload before.png` | Replicates the browser flow. Files land at `github.com/user-attachments/assets/` and stay private on private repos. |
| Web UI | Open the PR, drag the file into the description box | Always works. Fine when you are already in the browser. |
| Release assets | Attach images to a prerelease, use the asset URLs | Ugly but scriptable with plain `gh`. |
| Scratch repo | Commit images to a public repo, link `raw.githubusercontent.com` URLs | Permanent URLs, but the images live forever in a repo. |

Never commit screenshots into the repository the PR targets. They bloat the
history permanently to serve one review.

## When to skip

- Nothing a person sees changed.
- The change is internal and the output is identical by design — say that in
  one sentence instead.
- You cannot capture it honestly. Say "I could not capture this; here is how to
  reproduce it locally" and give the steps. Never stage an approximation and
  present it as the real thing.
