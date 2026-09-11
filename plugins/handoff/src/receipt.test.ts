import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { Receipt } from "./receipt.js"
import type { CaptureReason, RenderReason } from "./rpc.js"
import { announce, CaptureFailed, Pointer, RenderFailed } from "./rpc.js"
import { decode } from "./test-support.js"

const pointer = (value: unknown) => Schema.decodeUnknownSync(Pointer)(value)
const fork = pointer({ kind: "fork-local", key: "handoff/ses_abc", nextSessionID: "ses_xyz", messages: 12 })
const file = pointer({
  kind: "export-file",
  key: "handoff/ses_abc",
  file: "/tmp/handoff-ses_abc.json",
  messages: 12,
})

describe("Receipt.pointer", () => {
  it("names the session to continue in", () => {
    expect(Receipt.pointer(fork)).toBe("Handed off 12 messages. Continue in session ses_xyz.")
  })

  it("names the file and how to import it", () => {
    expect(Receipt.pointer(file)).toBe(
      "Handed off 12 messages to /tmp/handoff-ses_abc.json. "
        + "Move it, then: opencode2 import --directory <dir> <file>",
    )
  })
})

describe("Receipt.failure", () => {
  // Records over the reason unions, not arrays: adding a reason without a
  // sentence stops compiling here rather than shipping a blank message.
  const captured: Record<CaptureReason, string> = {
    empty: Receipt.failure(new CaptureFailed({ op: "capture", reason: "empty" })),
    transport: Receipt.failure(new CaptureFailed({ op: "capture", reason: "transport" })),
  }
  const rendered: Record<RenderReason, string> = {
    encode: Receipt.failure(new RenderFailed({ op: "render", reason: "encode" })),
    stash: Receipt.failure(new RenderFailed({ op: "render", reason: "stash" })),
    create: Receipt.failure(new RenderFailed({ op: "render", reason: "create" })),
    deliver: Receipt.failure(new RenderFailed({ op: "render", reason: "deliver" })),
    write: Receipt.failure(new RenderFailed({ op: "render", reason: "write" })),
  }

  it("gives every declared reason its own sentence", () => {
    const all = [...Object.values(captured), ...Object.values(rendered)]
    expect(new Set(all).size).toBe(all.length)
    expect(all.every((sentence) => sentence.length > 0)).toBe(true)
  })

  it("says what happened, never the tag", () => {
    expect(captured.empty).toBe("this session has no history to hand off")
    expect(rendered.create).toBe("the host refused a new session")
  })
})

describe("announce", () => {
  const input = decode({ sessionID: "ses_abc", intent: { goal: "audit", directive: "resume", refs: [] } })

  it("maps a fork-local pointer to the session a client can open", () => {
    expect(announce(input, fork)).toEqual([
      "opened",
      { key: "handoff/ses_abc", sessionID: "ses_abc", nextSessionID: "ses_xyz", goal: "audit", messages: 12 },
    ])
  })

  it("maps an export-file pointer to the file a client can name", () => {
    expect(announce(input, file)).toEqual([
      "exported",
      { key: "handoff/ses_abc", sessionID: "ses_abc", file: "/tmp/handoff-ses_abc.json", goal: "audit", messages: 12 },
    ])
  })
})
