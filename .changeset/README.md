# Changesets

Every change a user would notice gets a changeset. Run `npm run changeset`, pick
a bump, and write one line describing the change from the user's side.

Release flow: changesets opens a version PR, `npm run version` bumps
`package.json` and syncs `.claude-plugin/plugin.json` to match, and merging that
PR tags the release. Plugin consumers pick the new version up on their next
update.

Install commands inside a changeset must match
[`.agents/install-block.md`](../.agents/install-block.md) exactly.
