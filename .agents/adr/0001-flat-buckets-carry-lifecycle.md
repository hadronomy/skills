# 1. Buckets carry lifecycle, not category

Date: 2026-08-27

## Status

Accepted

## Context

Skills need somewhere to live. The obvious arrangement is a category tree —
`rust/`, `web/`, `writing/` — which reads well until a skill spans two of them
and the tree starts growing branches nobody can predict.

A second, separate problem: a half-finished skill and a retired one both need a
home that keeps them out of the plugin and out of the docs, without deleting
them.

## Decision

`skills/` holds five buckets: `engineering`, `productivity`, `misc`,
`in-progress`, `deprecated`. The bucket determines **lifecycle**, not subject.
`engineering` and `productivity` are promoted: they ship in `plugin.json` and
carry a docs page. The other three ship nothing.

## Consequences

Promotion and demotion become one action — move the folder, and `npm run
validate` fails until the manifest and the docs page agree with the new
location. There is no state to forget to update.

The cost is that subject is no longer visible in the path. A reader looking for
Rust work reads the bucket `README.md` or the description, not the directory
name. That is acceptable at this size, and the flat list stays readable far
longer than a tree stays accurate.
