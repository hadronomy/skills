---
"hadronomy-skills": patch
---

Migrate the repo package manager from npm to bun 1.4 with workspaces under `plugins/*`. CI installs with `bun install --frozen-lockfile`; node stays as the script runtime.
