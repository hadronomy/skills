import { describe, expect, it } from "vitest"
import { Skill } from "@opencode-ai/schema/skill"
import { Command } from "./command.js"
import { MaxGoalLength, MaxRefs } from "./rpc.js"

describe("resolveGoal", () => {
  it("keeps explicit text", () => {
    expect(Command.resolveGoal("audit", "Old title", "asked")).toBe("audit")
  })

  it("truncates at the contract bound", () => {
    expect(Command.resolveGoal("x".repeat(400), undefined, undefined)).toHaveLength(MaxGoalLength)
  })

  it("falls back through title, then the last thing asked, then the label", () => {
    expect(Command.resolveGoal("", "Weekly review", "asked")).toBe("Weekly review")
    // A session younger than its own title still names real work.
    expect(Command.resolveGoal("", undefined, "fix the parser")).toBe("fix the parser")
    expect(Command.resolveGoal("  ", "  ", "  ")).toBe("Continue this session")
  })
})

describe("collectRefs", () => {
  it("maps attachments to file refs capped at the contract bound", () => {
    const files = Array.from({ length: MaxRefs + 1 }, (_, i) => ({ uri: `file:///x/${i}.md` }))
    const refs = Command.collectRefs(files)
    expect(refs).toHaveLength(MaxRefs)
    expect(refs[0]).toEqual({ kind: "file", ref: "file:///x/0.md" })
    expect(Command.collectRefs(undefined)).toEqual([])
  })
})

describe("collectSkills", () => {
  it("plucks invoked skill ids", () => {
    const skills = [{ id: Skill.ID.make("review") }, { id: Skill.ID.make("plan") }]
    expect(Command.collectSkills(skills)).toEqual(["review", "plan"])
    expect(Command.collectSkills(undefined)).toEqual([])
  })
})
