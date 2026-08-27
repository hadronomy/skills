# Sources

## The tools

- **calldiff** — <https://github.com/tanishqkancharla/calldiff>, `calldiff` on
  npm. Call-stack diffs across git refs, Tree-sitter, 23 languages. The
  technique in the **Call stack** section comes from
  [this post](https://x.com/tanishqk/status/2091396628968259656) showing a PR
  body with a contract block, a call-stack diff, and a code diff.
- **DiffsHub** — <https://diffshub.com>, by Pierre. Swap `github` for
  `diffshub` in a PR URL. Reached here through
  [Mitchell Hashimoto's post](https://x.com/mitchellh/status/2057195825579933823)
  on what performant PR review could look like.
- **Codiff** — <https://github.com/nkzw-tech/codiff>, by Christoph Nakazawa.
  `brew install --cask nkzw-tech/tap/codiff`. Flow-based walkthroughs with
  chapters; the source of the **Reviewing this** section's argument.
  [Post](https://x.com/cnakazawa/status/2063812273962189089).
- **gh-image** — <https://github.com/drogers0/gh-image>. Uploads to
  `github.com/user-attachments/` from the terminal.
- **gh** — <https://cli.github.com>. `gh pr create --body-file` is the only
  sane way to write a body.

## Writing

- **Writing good CL descriptions**, Google —
  <https://google.github.io/eng-practices/review/developer/cl-descriptions.html>.
  The imperative first line, the what-then-why split, and the instruction to
  state shortcomings.
- **ASD-STE100 Simplified Technical English** — the sentence limits, the modal
  ladder, and condition-before-command. Reach it through the `simple-english`
  skill.
- **Reorient GitHub Pull Requests Around Changesets**, Mitchell Hashimoto —
  <https://mitchellh.com/writing/github-changesets>. On why a mutable PR loses
  review context. Systemic rather than authoring advice, but it explains why
  keeping the body true after each round of review matters.
- **Ghostty CONTRIBUTING and AI_POLICY** —
  <https://github.com/ghostty-org/ghostty/blob/main/CONTRIBUTING.md>. The
  strongest published statement that a contributor must understand their own
  change, and a project that requires AI disclosure. The reason the core
  contract defers to repo policy on attribution rather than assuming one.

## Time-sensitive

Re-check before relying on these:

- Whether `gh` has gained native image upload. It could not as of this writing,
  and the maintainers had no plans to add it.
- DiffsHub's coverage of private repositories.
- calldiff's language list. Its 0.5.0 binary reports 22; the README says 23.
