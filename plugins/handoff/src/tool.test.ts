import { it } from "@effect/vitest"
import type { ToolEditor } from "@opencode-ai/plugin/effect/tool"
import { Agent } from "@opencode-ai/schema/agent"
import { Session } from "@opencode-ai/schema/session"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { Tool } from "@opencode-ai/schema/tool"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { PointerPortable, TransferInputPortable } from "./rpc.js"
import { minimal, testLayer } from "./test-support.js"
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
    Tools.register(fake.editor, testLayer())
    expect(fake.namespaces).toEqual([{ name: "handoff", description: "Session handoff operations" }])
    expect(fake.added).toHaveLength(1)
    expect(fake.added[0]?.name).toBe("transfer")
    expect(fake.added[0]?.input).toBe(TransferInputPortable)
    expect(fake.added[0]?.output).toBe(PointerPortable)
  })

  it.effect("completes a handoff through the tool seam", () =>
    Effect.gen(function* () {
      const fake = editor()
      Tools.register(fake.editor, testLayer())
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

})
