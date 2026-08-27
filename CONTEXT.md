# hadronomy/skills

A personal collection of agent skills, distributed two ways: as a Claude Code
plugin, and through the `skills` CLI for every other harness.

## Language

**Skill**:
A directory holding a `SKILL.md` and its bundled resources. The unit of
authoring, distribution, and invocation.
_Avoid_: command, prompt, module

**Bucket**:
A top-level folder under `skills/` that determines a skill's lifecycle:
`engineering`, `productivity`, `misc`, `in-progress`, `deprecated`. A bucket is
policy, not a category label.
_Avoid_: category, group, folder

**Promoted**:
A skill in `engineering/` or `productivity/`. Promoted skills ship in the plugin
and carry a docs page. Nothing else does.

**Invocation**:
Who can reach a skill. **Model-invoked** means the agent or the human;
**user-invoked** means the human only. See `.agents/invocation.md`.
_Avoid_: trigger, activation

**Reference file**:
A markdown file beside `SKILL.md`, reached by a relative link, loaded only when
the agent follows that link. The mechanism of progressive disclosure.
_Avoid_: doc, sub-skill, include

**Docs page**:
A human-facing page under `docs/<bucket>/<name>.md`. Not a copy of `SKILL.md`;
it orients a reader deciding whether to reach for the skill.

**Harness**:
The agent runtime that loads a skill: Claude Code, Codex, OpenCode. Each has its
own install path and its own way of expressing invocation policy.
_Avoid_: client, tool, agent (ambiguous with the model itself)

**Canonical store**:
`~/.agents/skills/`, where the `skills` CLI keeps one real copy of every
installed skill. `~/.claude/skills/` holds symlinks into it.

## Relationships

- A **Bucket** holds many **Skills**
- A **Skill** has one **Invocation** mode across every **Harness**
- A **Promoted** skill has exactly one **Docs page**
- A **Skill** may have many **Reference files**

## Flagged ambiguities

- "skill" once meant both the directory and the `SKILL.md` inside it. Resolved:
  the **Skill** is the directory; `SKILL.md` is named directly when the file is
  meant.
- "install" meant both the plugin route and the CLI route. Resolved: name the
  route (**plugin install**, **CLI install**); the two are exclusive.
