# The canonical install block

One install story, one wording. `README.md`, `.changeset/*`, and every page
under `docs/` say **this** and nothing else. Change it here first, then
propagate.

## Claude Code: the plugin

<canonical-block name="claude-code">

```bash
/plugin marketplace add hadronomy/skills
/plugin install hadronomy-skills@hadronomy
```

</canonical-block>

## Codex, OpenCode, and everything else: the CLI

<canonical-block name="cli-whole-set">

```bash
npx skills@latest add hadronomy/skills
```

Pick the skills you want and the agents to install them on.

</canonical-block>

<canonical-block name="cli-one-skill">

```bash
npx skills@latest add hadronomy/skills --skill=<name>
```

```bash
npx skills@latest update <name>
```

</canonical-block>

## The two routes are exclusive

The plugin is a managed, read-only bundle you subscribe to. The CLI writes files
you own and edit. Installing both leaves every skill present twice. Always say
"pick one".
