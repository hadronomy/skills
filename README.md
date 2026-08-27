# hadronomy/skills

Agent skills for production engineering. One copy serves Claude Code, Codex, and
OpenCode.

## Install

### Claude Code: the plugin

```bash
/plugin marketplace add hadronomy/skills
/plugin install hadronomy-skills@hadronomy
```

### Codex, OpenCode, and everything else

```bash
npx skills@latest add hadronomy/skills
```

Pick the skills you want and the agents to install them on.

Pick one route. The plugin is a managed, read-only bundle; the CLI writes files
you own. Both at once leaves every skill present twice.

## Skills

### Engineering

**Model-invoked**

- [`pr-craft`](skills/engineering/pr-craft) — write pull requests a reviewer can
  act on: body structure, prose, call-stack diffs, before-and-after screenshots,
  verification. [Docs](docs/engineering/pr-craft.md)
- [`rust-craft`](skills/engineering/rust-craft) — production Rust: workspace
  layout, API design, errors, performance, async, CLI, testing, crate choice,
  release. [Docs](docs/engineering/rust-craft.md)

### In progress

Not promoted: no plugin entry, no docs page, and not recommended yet.

- [`windows-mcp`](skills/in-progress/windows-mcp) — driving the Windows desktop
  on `workstation` through the windows MCP server.

## Restoring a machine

The `skills` CLI cannot restore globally-installed skills; only project-scope
`skills-lock.json` has an `experimental_install`. This repo carries the missing
half:

```bash
npm run restore -- --export   # snapshot ~/.agents/.skill-lock.json into global-skills.json
npm run restore               # print the commands that rebuild it
npm run restore -- --run      # execute them
```

Commit `global-skills.json`. It is the intent; the lock is machine state.

## Developing

```bash
npm install
npm run link       # symlink every skill into ~/.claude/skills and ~/.agents/skills
npm run validate   # spec limits, link resolution, manifest drift, docs coverage
npm run list
npm run changeset
```

`npm run validate` is the gate. CI runs the same file.

Conventions live in [`.agents/`](.agents): [authoring](.agents/authoring.md),
[invocation](.agents/invocation.md), [docs pages](.agents/writing-docs.md),
[install wording](.agents/install-block.md). Vocabulary lives in
[`CONTEXT.md`](CONTEXT.md).

## Licence

MIT
