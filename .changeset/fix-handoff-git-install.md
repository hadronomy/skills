---
"@hadronomy/opencode-handoff-plugin": patch
---

Make the `handoff` plugin installable from git: skip the `effect-tsgo` patch step when its binary is absent (installed dependencies omit devDependencies) and drop `vitest` to `^4.1.10` so strict installers resolve the `@effect/doctest` and `@effect/vitest` peer ranges.
