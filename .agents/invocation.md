# Model-invoked vs user-invoked

Every `SKILL.md` here is a skill. The axis that splits them is **invocation**:
who can reach it.

**Model-invoked** — reachable by the model or the human. The default. Omit
`disable-model-invocation`, and omit the `policy` block from
`agents/openai.yaml`. The `description` is model-facing and keeps its trigger
phrasing, so auto-invocation fires. The test: could the model usefully reach for
this on its own?

**User-invoked** — reachable only by the human typing its name. Set
`disable-model-invocation: true` in the frontmatter for Claude Code, and
`policy.allow_implicit_invocation: false` in `agents/openai.yaml` for Codex. The
`description` becomes human-facing: a one-line summary with the trigger list
stripped.

A skill is user-invoked in both harnesses or in neither. Keep the two files in
sync.

## Reaching another skill

Write an explicit instruction to call the tool:

```
Call the Skill tool with "writing-for-agents".
```

Not a `../other-skill/FILE.md` path, and not a bare `/name` left for the model
to interpret. Naming the tool is what fires it. Dropping the leading `/` keeps
the instruction harness-neutral.

One skill per call. A step needing two is two calls: `Call the Skill tool
twice, for "grilling" and "domain-modeling"`.

This holds only for **model-invoked** targets. Nothing can reach a user-invoked
skill except the human, so phrase that precondition as an instruction to the
person: "tell the user to run `/setup-x`".

Router prose that lists skills for a human to pick from is not invoking
anything, so it keeps plain `/name` labels.

## Shared reference

Reference material two skills both need lives inside the skill that owns it,
reached by calling the Skill tool with that skill. It never lives in a
cross-folder relative link.
