---
name: docs-craft
description: Documentation discipline for code comments, API docs, and docs pages. Use when writing or reviewing doc comments, JSDoc or rustdoc, README sections, or framework docs pages — or when comments and docs read as filler and need cutting.
---

# Docs Craft

Every doc has one job and one reader mode. Comments say what the code
cannot. API docs describe the contract with runnable proof. Pages answer
exactly one of learning, task, lookup, or understanding. Anything else is
slop: delete it rather than polishing it.

This is a routed skill. Always apply the core contract. Read only the
reference layers the task needs.

## Core contract

1. **One doc, one job.** Name the job before writing: explain a reason,
   specify a contract, teach a task, or record a fact. A doc doing two jobs
   splits in two.
2. **Match the reader mode.** Learning, task, lookup, and understanding each
   take different shapes. Never mix instruction into reference or background
   into steps.
3. **Prove behavior with runnable examples.** Every example executes in CI:
   doctests for code, copy-paste runs for pages. An example with no
   observation goes out.
4. **Delete over repair.** A doc that restates its subject, opens with
   filler, or carries praise without measure gets removed, not reworded.
5. **One shared vocabulary.** Terms come from the project's glossary
   (`CONTEXT.md` where one exists). The same term never wears two names.

## Branches

| Task | Read |
|---|---|
| In-code comments in any language | [references/comments.md](references/comments.md) |
| API docs: JSDoc, rustdoc, README API sections | [references/api-docs.md](references/api-docs.md) |
| Docs-framework pages: tutorials, guides, reference, explanation | [references/pages.md](references/pages.md) |
| Why behind a rule, with source links | [references/sources.md](references/sources.md) |

## Done when

- `npm run validate` passes for this skill.
- Every touched doc has one job, one reader mode, and runnable proof where
  it shows behavior.
- Slop checks ran: no restated subjects, no filler openers, no unmeasured
  praise, no dead links.
