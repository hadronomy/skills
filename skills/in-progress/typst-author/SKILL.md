---
name: typst-author
description: Author idiomatic, compilable Typst documents. Use when creating or editing Typst (.typ) files, when a task involves Typst syntax, packages, templates, or bibliographies, or when a Typst build fails and the error needs a fix.
compatibility: Requires typst 0.15.x, typstyle, and tinymist on PATH. Needs network on the first fetch of a new package.
---

# Typst author

Contract: every `.typ` file left behind compiles with a clean format check. The loop is **compile-verify**: compile on every edit, read the diagnostics, fix, recompile. Never finish on "the code looks right".

## Preflight

Run once per task, before any edit:

```bash
command -v typst && typst --version
```

Expect `typst 0.15.x`. If the shim fails, stop and fix the toolchain first. Nothing below works without a compiler.

## Workflow

1. Write or edit the `.typ` file, following the reference that matches the task (table below).
2. Run `typst compile main.typ --diagnostic-format short`. The flag prints one diagnostic per line for easy parsing.
3. If diagnostics appear, fix them and recompile. Repeat until the exit code is 0.
4. Run `typstyle --check main.typ`. If it reports drift, run `typstyle -i main.typ` and recompile.
5. Verify content, not just exit codes: export `typst compile main.typ out.pdf` and confirm the pages hold what the task asked for. For text checks, export HTML (`-f html`) and read it.

Done means: exit code 0, `typstyle` clean, and the output holds the requested content.

## Task map

| Task | Reach |
|---|---|
| Syntax traps (arrays, content blocks, `context`, `set` vs `show`) | [references/syntax-traps.md](references/syntax-traps.md) |
| Packages (find, pin, `init`, local overrides) | [references/packages.md](references/packages.md) |
| Bibliography and citations | [references/bibliography.md](references/bibliography.md) |

Material every run needs stays above. Material only some runs reach lives behind those links.
