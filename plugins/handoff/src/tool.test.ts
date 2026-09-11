import { it } from "@effect/vitest"
import type { ToolEditor } from "@opencode-ai/plugin/effect/tool"
import { Agent } from "@opencode-ai/schema/agent"
import { Session } from "@opencode-ai/schema/session"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { Tool } from "@opencode-ai/schema/tool"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { jsonSchema, TransferInput } from "./rpc.js"
import { completeTest, minimal, script, testLayer } from "./test-support.js"
import { Tools } from "./tool.js"

const editor = () => {
  const added: Array<Tool.Info> = []
  const namespaces: Array<Tool.Namespace> = []
  const editor: ToolEditor = {
    list: () => [],
    get: () => undefined,
    namespace: (ns) => {
      namespaces.push(ns)
    },
    add: (def) => {
      added.push(def)
    },
    update: () => {},
    remove: () => {},
  }
  return { editor, added, namespaces }
}

const context = {
  sessionID: Session.ID.make("ses_abc"),
  agent: Agent.ID.make("build"),
  messageID: SessionMessage.ID.create(),
  id: Tool.CallID.make("call_1"),
  progress: () => Effect.void,
}

describe("handoff_transfer tool", () => {
  it("registers under the handoff namespace with the contract schemas", () => {
    const fake = editor()
    Tools.register(fake.editor, completeTest())
    expect(fake.namespaces).toEqual([{ name: "handoff", description: "Session handoff operations" }])
    expect(fake.added).toHaveLength(1)
    expect(fake.added[0]?.name).toBe("transfer")
    // JSON Schema, not a Standard Schema adapter: the host converts a tool
    // shape for the model and refuses a vendor it cannot convert.
    expect(fake.added[0]?.input).toEqual(jsonSchema(TransferInput))
    expect(JSON.stringify(fake.added[0]?.input)).toContain("\"maxLength\":280")
  })

  it.effect("rejects malformed input before the transfer runs", () =>
    Effect.gen(function* () {
      const fake = editor()
      Tools.register(fake.editor, completeTest())
      const definition = fake.added[0]
      if (definition === undefined) throw new Error("unreachable")
      const outcome = yield* Effect.result(definition.execute({ sessionID: 42 }, context))
      if (outcome._tag !== "Failure") throw new Error("expected a tool failure")
      expect(outcome.failure.message).toContain("handoff rejected the input")
    }))

  it.effect("completes a handoff through the tool seam", () =>
    Effect.gen(function* () {
      const fake = editor()
      Tools.register(fake.editor, completeTest())
      const definition = fake.added[0]
      if (definition === undefined) throw new Error("unreachable")
      const result = yield* definition.execute(minimal(), context)
      expect(result.output).toEqual({
        kind: "fork-local",
        key: "handoff/ses_abc",
        nextSessionID: "ses_next",
        messages: 2,
      })
    }))

  it.effect("reports the failed step in words, not a tag", () =>
    Effect.gen(function* () {
      const fake = editor()
      Tools.register(fake.editor, completeTest(testLayer(script({ messages: [] }))))
      const definition = fake.added[0]
      if (definition === undefined) throw new Error("unreachable")
      const outcome = yield* Effect.result(definition.execute(minimal(), context))
      if (outcome._tag !== "Failure") throw new Error("expected a tool failure")
      expect(outcome.failure.message).toBe("handoff stopped: this session has no history to hand off")
    }))
})
