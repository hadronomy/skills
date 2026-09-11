import { Schema } from "effect"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { describe, expect, it } from "vitest"
import { T0, userMsg } from "./test-support.js"
import { Transcript } from "./transcript.js"

const assistant = (parts: ReadonlyArray<{ type: string; text: string }>, id = "msg_a1") =>
  Schema.decodeUnknownSync(SessionMessage.Assistant)({
    id,
    time: { created: T0 },
    type: "assistant",
    agent: "build",
    model: { providerID: "anthropic", id: "sonnet" },
    content: parts,
  })

const text = (value: string) => ({ type: "text", text: value })

describe("lines", () => {
  it("keeps what was said and drops what was thought", () => {
    const said = Transcript.lines([
      userMsg("ship the parser", "msg_1"),
      assistant([
        { type: "reasoning", text: "thinking out loud" },
        text("Parser shipped."),
      ]),
    ])
    expect(said).toEqual(["User: ship the parser", "Assistant: Parser shipped."])
  })

  it("drops records that carry no conversation", () => {
    const switched = Schema.decodeSync(SessionMessage.AgentSelected)({
      id: "msg_s1",
      time: { created: T0 },
      type: "agent-switched",
      agent: "build",
    })
    expect(Transcript.lines([switched])).toEqual([])
  })

  it("drops an assistant turn that produced no text", () => {
    expect(Transcript.lines([assistant([{ type: "reasoning", text: "quiet" }])])).toEqual([])
  })
})

describe("lastUserText", () => {
  it("takes the newest user text, not the newest message", () => {
    const said = [userMsg("first", "msg_1"), userMsg("second", "msg_2"), assistant([text("done")])]
    expect(Transcript.lastUserText(said)).toBe("second")
  })

  it("returns undefined when nobody asked for anything", () => {
    expect(Transcript.lastUserText([assistant([text("done")])])).toBeUndefined()
    expect(Transcript.lastUserText([])).toBeUndefined()
  })
})

describe("tail", () => {
  it("takes from the end, because that is where the work stopped", () => {
    expect(Transcript.tail(["one", "two", "three"], 10)).toBe("two\nthree")
  })

  it("returns nothing rather than half a line", () => {
    expect(Transcript.tail(["a very long line"], 4)).toBe("")
  })

  it("keeps everything when the budget allows", () => {
    expect(Transcript.tail(["a", "b"], 1000)).toBe("a\nb")
  })
})
