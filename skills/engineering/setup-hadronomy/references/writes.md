# Seeds for setup writes

Copy a seed, fill the brackets, never invent new sections. One concern per
file. Pointer prose lives in the root-doc block, never duplicated here.

## `docs/agents/hadronomy.md`

```md
# Hadronomy config for [repo name]

Stack: [language, toolchain].
Effect: [v4 | v3-blocked | none].

## Pinned crafts

| Craft | Trigger |
|---|---|
| [name] | [when it fires] |

Unlisted work uses no craft.
```

## `docs/agents/effect.md` (v4 only)

```md
# Effect config for [repo name]

Version: v4 ([exact range from package.json]).
Barrels: namespaced `export * as Name`, deep imports inside the repo.
Playbook: vault map [[Effect API Playbook]].
```

## v3 blocked record (inside `hadronomy.md`, no `effect.md`)

```md
Effect: v3-blocked. Upgrade to v4 first. No Effect craft pins until then.
```

## Working-note line (vault-tracked repos only)

```md
Effect and stack work in this repo obeys the vault playbook plus docs/agents/hadronomy.md.
```
