# The body, section by section

## Title

One line. Imperative mood, as if ordering the codebase to change: "Delete the
FizzBuzz RPC and replace it with the new system", not "Deleting..." or
"Deleted...". It states **what**, never how.

Use the repo's convention. Where that is Conventional Commits, the shape is
`type(scope): description` — `fix(parser): handle trailing comma`. Some repos
enforce the scoped title in CI.

The title appears in the merge commit, the changelog, and every future `git
log`. Write it for the person reading history in two years, not for the
reviewer who already has the diff open.

| Bad | Why | Better |
|---|---|---|
| `Fix bug` | Names nothing | `fix(auth): refresh tokens before they expire` |
| `Update files` | The diff already says that | `refactor(cache): move eviction into the store` |
| `Phase 1` | Meaningless outside your head | `feat(api): add read-only project endpoints` |
| `Fixes #482` | The number is not a summary | `fix(upload): reject files above the size limit` |

## The opening paragraph

No heading. One to three sentences, before anything else. What changed, and
why. Assume this is the only part a reviewer reads.

> Uploads larger than the configured limit were accepted, buffered fully in
> memory, and then rejected by the storage layer. A 2 GB upload could take the
> process down. The size check now runs on the request stream, before any
> buffering.

That paragraph alone lets a reviewer decide whether they are the right reviewer.
No later section does that job, because a reviewer who stops reading never
reaches them.

## The links row

One line under the opening. Two things belong here:

```markdown
[Fast diff](https://diffshub.com/OWNER/REPO/pull/N) · Closes #482
```

The **fast diff** is the same PR rendered by DiffsHub, which virtualizes the
diff and loads instantly no matter how large. Swap `github` for `diffshub` in
the PR URL. On a big PR this is the difference between a reviewer starting and
a reviewer closing the tab. See [tools.md](tools.md).

The **issue link** uses a closing keyword — `Closes`, `Fixes`, `Resolves` — so
merging closes the issue. Where the PR only relates to an issue, write `Related
to #482` and do not close it.

## The problem

The state of the world before this change, concretely. Not "there was an issue
with uploads" but the failure itself: what a user did, what happened, what
should have happened.

Include the evidence you already have — the error, the trace, the reproduction:

```
panic: runtime error: makeslice: cap out of range
  at internal/upload.buffer (upload.go:88)
```

Where a linked issue already tells this story, one sentence and the link is
enough. Do not restate the issue in full. Where there is no issue, this section
carries the whole justification and is worth real length.

A reviewer who disagrees with this section will disagree with the whole PR, so
it is worth more of your time than any other section.

## The change

The **shape** of what you did, in the domain's own words. This is where most
PR bodies fail: they list files.

Bad — this is the diff, retyped:

> Modified `upload.go`, added `limit.go`, updated tests in `upload_test.go`.

Good — this is the change:

> The size check moved from the storage layer to the request stream. `Upload`
> now takes an `io.Reader` and a byte budget, and returns
> `ErrTooLarge` as soon as the budget is exceeded, so nothing large is ever
> held in memory. The storage layer's own check stays as a backstop.

Cover, where each applies:

- The new interface or contract, as a short code block. A type definition says
  more than a paragraph.
- The tradeoff you made, and what you gave up. Google's guidance is explicit
  that shortcomings belong in the description.
- The alternative you rejected, and why — one sentence, only when a reviewer
  would otherwise propose it.

Do not narrate your process. "First I tried X, then Y failed, so I did Z"
belongs in a conversation, not a PR body.

## Call stack

When the change alters *which code runs*, show the call path before and after.
A code diff shows changed text. A call-stack diff shows changed behaviour, which
catches the class of bug where the text looks harmless and the runtime path
moved.

Generate it with `calldiff` (see [tools.md](tools.md)) and paste it as a fenced
`diff` block so the `-` and `+` lines colour correctly:

````markdown
```diff
  PluginService.list
  └─ readPluginManifest
-    └─ compilePluginView (esbuild write:false)
+    └─ readPluginViewDist
        └─ compiledViews.source
```
````

Skip this section for a pure rename, a comment change, or anything where the
call graph is untouched.

## Before / After

Any change a person can see gets images. A reviewer should never have to check
out a branch to find out what a UI change looks like.

Two images, labelled, side by side in a table so they compare directly. Full
capture and embedding technique is in [visuals.md](visuals.md).

Extend this beyond UI. The same before-and-after framing works for terminal
output, an error message, a generated report, a rendered document, a
flamegraph, or a log line. If the change alters something a person reads, show
what they read now and what they will read after.

## Verifying

Commands the reviewer can paste. "Tested locally" tells them nothing, and it
gives them no way to check the claim themselves.

```bash
cargo nextest run -p upload
curl -X POST --data-binary @3gb.bin localhost:8080/upload   # expect 413
```

Then state what you covered and what you did not:

> Covered: over-limit, exactly-at-limit, and chunked uploads. Not covered:
> multipart uploads, which take a different path and are unchanged.

Where the change is a bug fix, name the test that fails without it. That test
is the proof the bug is real and the fix works.

## Risks and limits

The section a reviewer trusts you for. It holds:

- What could break, and the blast radius.
- What you knowingly left undone, and why.
- Migration, rollout, or feature-flag steps, where any apply.
- Performance effects, with numbers where you measured and an honest "not
  measured" where you did not.

> The backstop check in the storage layer is now unreachable in normal
> operation. It stays because a future caller could bypass the stream path.
> Deleting it is a separate change.

Omit the section only when there is genuinely nothing. That is rarer than it
feels.

## Reviewing this

Where to start, and in what order. A reviewer who cannot find the thread through
a large diff usually abandons it, and three lines here prevent that.

> Start with `limit.go` — it is the whole idea. Then `upload.go:88` for the
> call-site change. The test file and the generated fixtures are mechanical.

For a large or multi-part change, break it into chapters the reviewer can
follow one at a time. Where the change is genuinely too large for one pass,
that is a signal to split it into a stack instead: call the Skill tool with
`gh-stack`.

Also useful here: flag the kind of feedback you want. "I am unsure about the
error type — opinions welcome" gets a better review than silence, and research
across GitHub projects associates making the expected feedback explicit with
higher reviewer engagement.

## What to leave out

- A file-by-file changelog. The diff is right there.
- Your process, false starts, and the order you did things in.
- Restating a linked issue in full.
- Empty template headings kept because the template had them.
- Emoji section markers, unless the repo already uses them.
- Praise for your own change. "This greatly improves..." is for the reviewer to
  decide.
- Agent attribution, unless the repo's policy requires a disclosure.
