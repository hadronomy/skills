import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  CaptureFailed,
  FilePointer,
  ForkPointer,
  Intent,
  Pointer,
  RedactRefused,
  RenderFailed,
  TransferInput,
} from "./rpc.js"
import { Handoff } from "./rpc.js"

const minimal = {
  sessionID: "ses_abc",
  intent: { goal: "audit", directive: "resume", refs: [] as Array<string> },
}

describe("rpc contract", () => {
  it("fills export-file sanitize default on decode", () => {
    const out = Schema.decodeSync(TransferInput)({
      sessionID: "ses_abc",
      intent: { goal: "audit", directive: "queue", refs: [], resume: { mode: "export-file" } },
    })
    if (out.intent.resume.mode !== "export-file") throw new Error("unreachable")
    expect(out.intent.resume.sanitize).toBe(true)
  })

  it("validates through Standard Schema with defaults", async () => {
    const std = Schema.toStandardSchemaV1(TransferInput) as unknown as {
      "~standard": { validate: (v: unknown) => Promise<{ issues?: unknown; value?: unknown }> }
    }
    const result = await std["~standard"].validate(minimal)
    expect(result.issues).toBeUndefined()
    const value = result.value as { intent: { resume: { mode: string } } }
    expect(value.intent.resume.mode).toBe("fork-local")
  })

  it("rejects empty goal, long goal, empty session, nine refs", () => {
    const bad = [
      { ...minimal, intent: { ...minimal.intent, goal: "" } },
      { ...minimal, intent: { ...minimal.intent, goal: "x".repeat(281) } },
      { ...minimal, sessionID: "" },
      { ...minimal, intent: { ...minimal.intent, refs: Array(9).fill("r") } },
      { ...minimal, intent: { ...minimal.intent, directive: "nap" } },
      {
        ...minimal,
        intent: { ...minimal.intent, resume: { mode: "fork-local", boundary: { type: "before" } } },
      },
    ]
    for (const input of bad) {
      expect(() => Schema.decodeUnknownSync(TransferInput)(input), JSON.stringify(input)).toThrow()
    }
  })

  it("accepts a before boundary with message id", () => {
    const out = Schema.decodeSync(TransferInput)({
      sessionID: "ses_abc",
      intent: {
        goal: "audit",
        directive: "resume",
        refs: [],
        resume: { mode: "fork-local", boundary: { type: "before", messageID: "msg_1" } },
      },
    })
    if (out.intent.resume.mode !== "fork-local") throw new Error("unreachable")
    expect(out.intent.resume.boundary).toEqual({ type: "before", messageID: "msg_1" })
  })

  it("decodes each pointer arm and rejects the xor violation", () => {
    expect(Schema.decodeSync(ForkPointer)({
      kind: "fork-local",
      key: "handoff/ses_abc",
      nextSessionID: "ses_def",
      messages: 12,
    }).kind).toBe("fork-local")
    expect(Schema.decodeSync(FilePointer)({
      kind: "export-file",
      key: "handoff/ses_abc",
      file: "/tmp/handoff-ses_abc.json",
      messages: 12,
    }).kind).toBe("export-file")
    expect(Schema.decodeSync(Pointer)({
      kind: "fork-local",
      key: "handoff/ses_abc",
      nextSessionID: "ses_def",
      messages: 12,
    }).kind).toBe("fork-local")
    expect(() =>
      Schema.decodeUnknownSync(Pointer)({ kind: "fork-local", key: "k", messages: 1 })
    ).toThrow()
  })

  it("keeps goal and refs limits on intent", () => {
    const out = Schema.decodeSync(Intent)({ goal: "g", directive: "branch", refs: ["a"] })
    expect(out.directive).toBe("branch")
  })

  it("carries typed errors with tag, op, and cause", () => {
    const refused = new RedactRefused({
      op: "redact",
      cause: { reason: "secret", field: "messages[3]" },
    })
    expect(refused._tag).toBe("RedactRefused")
    expect(refused.cause).toEqual({ reason: "secret", field: "messages[3]" })
    expect(new CaptureFailed({ op: "capture" })._tag).toBe("CaptureFailed")
    expect(new RenderFailed({ op: "render" })._tag).toBe("RenderFailed")
  })

  it("registers the transfer method on the host seam", () => {
    expect(Handoff.id).toBe("handoff")
    expect(Object.keys(Handoff.methods)).toEqual(["transfer"])
    expect(Handoff.methods.transfer.input).toBe(TransferInput)
    expect(Handoff.methods.transfer.output).toBe(Pointer)
    expect(Object.keys(Handoff.methods.transfer.errors ?? {}).sort()).toEqual([
      "CaptureFailed",
      "RedactRefused",
      "RenderFailed",
    ])
  })
})
