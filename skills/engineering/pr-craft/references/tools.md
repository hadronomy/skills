# Tools

Each tool below produces one part of the body. Reach for the one the change
earns; none of them are mandatory.

## `gh` — open and edit the PR

Write the body to a file. A body typed into `--body` loses newlines, and a body
typed into an editor cannot be regenerated.

```bash
gh pr create --title "fix(upload): reject oversized uploads on the stream" \
             --body-file pr-body.md --draft
gh pr edit --body-file pr-body.md          # after review changes the code
gh pr create --dry-run --body-file pr-body.md   # print instead of creating
```

Open as `--draft`, read it rendered, then mark ready. `gh pr view --web` opens
it.

Useful for step 1 of the workflow — reading house style:

```bash
gh pr list --state merged --limit 3 --json number,title,body \
  --jq '.[] | "## \(.number) \(.title)\n\(.body)\n"'
```

Never use `--fill`. It pastes commit messages into the body and produces
exactly the file-by-file changelog that [body.md](body.md) tells you to cut.

## `calldiff` — the call-stack diff

Diffs call stacks across git refs, "like `git diff`, but for who-calls-whom".
Tree-sitter based, 22 languages as of 0.5.0 including TypeScript, Python, Go, Rust, Java,
Swift, Zig, and Elixir.

```bash
npx calldiff@latest diff main HEAD --entry UploadService.handle
npx calldiff@latest diff main HEAD --file src/upload.ts     # all exports
npx calldiff@latest diff main HEAD --entry handle --format md
```

| Flag | Use |
|---|---|
| `--entry` / `-e` | A function name or `ClassName.method` to start from |
| `--file` / `-F` | Every exported symbol in one file |
| `--max-depth` | Stop the tree from sprawling |
| `--format json\|yaml\|md\|jsonl` | Machine-readable, for pasting or for an agent |
| `--locs` | Show file and line for each node |

Two other subcommands are worth knowing. `calldiff tree` prints the hierarchy
with no comparison, which is how you explain an unfamiliar area to a reviewer.
`calldiff reach --entry X --to Y` finds every path from an entrypoint to a
symbol, which answers "can this actually be called from there?" in a review
thread.

Paste the output in a fenced `diff` block so `-` and `+` lines colour. Trim it:
a 60-line call tree helps nobody. Keep the branch that changed and one level of
context.

## DiffsHub — the fast diff link

GitHub's diff view degrades badly on large PRs. DiffsHub virtualizes any public
diff and renders it near-instantly at any size. Swap the host:

```
https://github.com/OWNER/REPO/pull/123
https://diffshub.com/OWNER/REPO/pull/123
```

Put it in the links row, directly under the opening paragraph:

```markdown
[Fast diff](https://diffshub.com/OWNER/REPO/pull/123) · Closes #482
```

It works on public repositories. Skip it on a private repo — a dead link costs
more than a missing one.

Generate it from the PR number:

```bash
gh pr view --json url --jq '.url | sub("github.com"; "diffshub.com")'
```

## Codiff — reviewing before you ask others to

A macOS visual diff app with flow-based walkthroughs and chapters. Use it on
your own branch before you open the PR: walking your change the way a reviewer
will is the fastest way to find the section your body forgot to explain.

```bash
brew install --cask nkzw-tech/tap/codiff
codiff -w <url to pr>       # open a PR for review
```

Its chapter model is also the argument for the **Reviewing this** section: a
change reads best in a deliberate order, and you are the only person who knows
what that order is.

## `gh-image` — screenshots without committing them

GitHub has no public API for the drag-and-drop attachment endpoint, so `gh`
cannot upload images. This extension replicates the browser flow, so files land
at `github.com/user-attachments/assets/` exactly as they would from the web UI,
and stay private on private repos.

```bash
gh extension install drogers0/gh-image
gh image upload before.png        # prints a URL to paste into the body
```

Alternatives, when an extension is not an option, are in
[visuals.md](visuals.md).

## `gh stack` — when one PR is too much

Already installed here. When a change has natural sequential layers, a chain of
small PRs reviews far better than one large one. Each layer gets a body
describing **only that layer's diff**, never the whole stack.

Call the Skill tool with `gh-stack` for the workflow.

## Choosing

| The change... | Reach for |
|---|---|
| alters which code runs | `calldiff` |
| is large | DiffsHub link, and consider `gh stack` |
| changes anything a person sees | screenshots — [visuals.md](visuals.md) |
| claims to be faster | `hyperfine`, or the repo's benchmark, with two numbers |
| is hard to follow in file order | a **Reviewing this** section, chaptered |
| is a one-line fix | none of them; the body is three sentences |
