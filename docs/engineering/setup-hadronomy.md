## What it does

`setup-hadronomy` configures a repo once so every later session starts
oriented: a pointer block in the root doc, a fingerprint plus craft pins
under `docs/agents/`, and a working-note line when the vault tracks the repo.
It behaves differently from just telling an agent "follow my standards"
because the output is files the repo keeps, not instructions that evaporate
with the session. It explores first, presents each section with the
recommended answer, and never writes silently.

## When to reach for it

- You invoke this by typing `/setup-hadronomy`. The agent never reaches for
  it on its own, since it writes into repos and edits root docs.
- Reach for this when starting work in a repo the setup has not seen, when
  the stack changes (Effect v3 to v4, Rust added), or when a new craft
  promotes and old repos deserve its pin. Do not reach for it per task; the
  pinned crafts fire on their own afterward.

## The leading word

`setup` is the whole vocabulary: one run orients the repo, and everything
after runs oriented. When someone asks how a repo got its standards, the
answer is one word.

## It's working if

- A fresh session in a set-up repo follows the pinned crafts without being
  told twice.
- `docs/agents/` answers "which version, which crafts" in under a minute.
- Re-running shows a diff or reports nothing to change.

## Where it fits

Run-once setup before the first real flow, and periodic maintenance when
stacks shift — the precondition step that worker skills like `effect-craft`
and `rust-craft` assume. Its closest neighbour is the vault pickup flow,
which reads the working-note line it leaves behind.
