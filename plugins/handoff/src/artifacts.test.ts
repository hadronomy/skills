import { describe, expect, it } from "vitest"
import { Artifacts, MaxListed } from "./artifacts.js"

describe("mine", () => {
  it("reads paths, shas, work items, and links out of what was said", () => {
    expect(Artifacts.mine([
      "User: see src/render.ts:56 and https://github.com/a/b/pull/18",
      "Assistant: fixed in 3c2b5e4, tracked as a/b#12, docs at https://example.com/x",
    ])).toEqual([
      { kind: "commit", ref: "3c2b5e4" },
      { kind: "issue", ref: "a/b#12" },
      { kind: "url", ref: "https://example.com/x" },
      { kind: "file", ref: "src/render.ts" },
      { kind: "issue", ref: "https://github.com/a/b/pull/18" },
    ])
  })

  it("keeps prose that only looks like a pointer out", () => {
    // A failed read costs the next agent more than a missed pointer does.
    expect(Artifacts.mine([
      "User: pick one, e.g. and/or i.e. v1.2 deadbeef 1234567 node.",
    ])).toEqual([])
  })

  it("strips the wrappers a sentence puts around a path", () => {
    expect(Artifacts.mine(["Assistant: (`src/x.ts`), then **docs/y.md**."]))
      .toEqual([{ kind: "file", ref: "src/x.ts" }, { kind: "file", ref: "docs/y.md" }])
  })

  it("drops a query string, which is where a token rides", () => {
    expect(Artifacts.mine(["User: https://app.example.com/d?token=abc123&a=1"]))
      .toEqual([{ kind: "url", ref: "https://app.example.com/d" }])
  })

  it("counts one file however many lines name it", () => {
    expect(Artifacts.mine(["a src/x.ts:10 b src/x.ts:44:2 c src/x.ts"]))
      .toEqual([{ kind: "file", ref: "src/x.ts" }])
  })
})

describe("listed", () => {
  it("lets a caller's kind win, because the transcript cannot judge it", () => {
    const stated = [{ kind: "plan", ref: "docs/plan.md" }] as const
    expect(Artifacts.listed(stated, ["User: see docs/plan.md and src/x.ts"])).toEqual([
      { kind: "plan", ref: "docs/plan.md" },
      { kind: "file", ref: "src/x.ts" },
    ])
  })

  it("caps the list, so two that matter are not buried by twenty", () => {
    const said = [Array.from({ length: 40 }, (_, i) => `src/f${i}.ts`).join(" ")]
    expect(Artifacts.listed([], said)).toHaveLength(MaxListed)
  })
})
