import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import {
  decode,
  minimal,
  script,
  TestFiles,
  TestSession,
  TestStorage,
  TestSummarizer,
  testLayer,
  wireRoundTrip,
} from "./test-support.js"
import { Transfer } from "./transfer.js"

describe("transfer", () => {
  it.effect("hands fork-local intent to a fresh session with the brief", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const storage = yield* TestStorage
      const pointer = yield* handoff.transfer(minimal())
      expect(pointer).toEqual({
        kind: "fork-local",
        key: "handoff/ses_abc",
        nextSessionID: "ses_next",
        messages: 2,
      })
      expect(wireRoundTrip(pointer)).toEqual(pointer)
      const store = yield* storage.store
      expect(store.has("handoff/ses_abc")).toBe(true)
      expect(store.get("handoff/latest")).toEqual({ key: "handoff/ses_abc" })
      const calls = yield* session.calls
      expect(calls.synthetic).toBe(1)
      const inputs = yield* session.syntheticInputs
      const injected = inputs[0]
      expect(injected.delivery).toBe("steer")
      // The new session waits. Starting it is the person's move, not ours.
      expect(injected.resume).toBe(false)
      expect(injected.text).toContain("audit")
    }).pipe(Effect.provide(testLayer())))

  it.effect("writes export-file transfer data with import-compatible top level", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const storage = yield* TestStorage
      const files = yield* TestFiles
      const input = decode({
        sessionID: "ses_abc",
        intent: {
          goal: "move machines",
          directive: "queue",
          refs: [],
          resume: { mode: "export-file", directory: "/tmp/x", sanitize: true },
        },
      })
      const pointer = yield* handoff.transfer(input)
      expect(pointer).toEqual({
        kind: "export-file",
        key: "handoff/ses_abc",
        file: "/tmp/x/handoff-ses_abc.json",
        messages: 2,
      })
      expect(wireRoundTrip(pointer)).toEqual(pointer)
      const calls = yield* session.calls
      expect(calls.create).toBe(0)
      expect(calls.synthetic).toBe(0)
      const store = yield* storage.store
      expect(store.has("handoff/ses_abc")).toBe(true)
      const written = yield* files.files
      const envelope = JSON.parse(written.get("/tmp/x/handoff-ses_abc.json") ?? "")
      expect(Object.keys(envelope).sort()).toEqual(["handoff", "info", "messages"])
      expect(envelope.messages).toHaveLength(2)
      expect(envelope.handoff.goal).toBe("move machines")
    }).pipe(Effect.provide(testLayer())))

  it.effect("falls back to tmpdir when export names no directory", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const files = yield* TestFiles
      const input = decode({
        sessionID: "ses_abc",
        intent: { goal: "move", directive: "queue", refs: [], resume: { mode: "export-file" } },
      })
      const pointer = yield* handoff.transfer(input)
      expect(pointer).toEqual({
        kind: "export-file",
        key: "handoff/ses_abc",
        file: "/tmp/handoff-test/handoff-ses_abc.json",
        messages: 2,
      })
      const written = yield* files.files
      expect(written.has("/tmp/handoff-test/handoff-ses_abc.json")).toBe(true)
    }).pipe(Effect.provide(testLayer())))

  it.effect("fails closed on empty context without retry", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const storage = yield* TestStorage
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure).toMatchObject({ _tag: "CaptureFailed", reason: "empty" })
      const calls = yield* session.calls
      expect(calls.context).toBe(1)
      const store = yield* storage.store
      expect(store.size).toBe(0)
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script({ messages: [] })))))

  it.effect("retries transport faults twice, then hands off", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const pointer = yield* handoff.transfer(minimal())
      expect(pointer.kind).toBe("fork-local")
      const calls = yield* session.calls
      expect(calls.context).toBe(3)
    }).pipe(Effect.provide(testLayer(script({ failContext: 2 })))))

  it.effect("stays a typed CaptureFailed after exhausted retries", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure).toMatchObject({ _tag: "CaptureFailed", reason: "transport" })
      const calls = yield* session.calls
      expect(calls.context).toBe(3)
    }).pipe(Effect.provide(testLayer(script({ failContext: 9 })))))

  it.effect("writes the raw file alone for export-file with sanitize false", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const storage = yield* TestStorage
      const files = yield* TestFiles
      const input = decode({
        sessionID: "ses_abc",
        intent: {
          goal: "move raw",
          directive: "queue",
          refs: [],
          resume: { mode: "export-file", directory: "/tmp/x", sanitize: false },
        },
      })
      const pointer = yield* handoff.transfer(input)
      expect(pointer.kind).toBe("export-file")
      const written = yield* files.files
      expect(written.has("/tmp/x/handoff-ses_abc.json")).toBe(true)
      const store = yield* storage.store
      expect(store.size).toBe(0)
    }).pipe(Effect.provide(testLayer())))

  it.effect("converts store defects into RenderFailed before relocate", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure).toMatchObject({ _tag: "RenderFailed", reason: "stash" })
      const calls = yield* session.calls
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script(), { dieSet: true }))))

  it.effect("fails render when the stash verify-read comes back empty", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure).toMatchObject({ _tag: "RenderFailed", reason: "stash" })
      const calls = yield* session.calls
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script(), { blankGet: true }))))

  it.effect("runs synthetic delivery once, with no retry", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure).toMatchObject({ _tag: "RenderFailed", reason: "deliver" })
      const calls = yield* session.calls
      expect(calls.synthetic).toBe(1)
    }).pipe(Effect.provide(testLayer(script({ failSynthetic: true })))))

  it.effect("passes agent and model at create from the source session", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const pointer = yield* handoff.transfer(minimal())
      expect(pointer.kind).toBe("fork-local")
      const created = yield* session.created
      expect(created.agent).toBe("build")
      expect(created.model).toEqual({ providerID: "anthropic", id: "sonnet" })
      const calls = yield* session.calls
      expect(calls.create).toBe(1)
    }).pipe(Effect.provide(testLayer(script({ identity: true })))))

  it.effect("carries the stash key on the brief, the record that survives", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      yield* handoff.transfer(minimal())
      const [brief] = yield* session.syntheticInputs
      expect(brief?.metadata).toEqual({ handoff: "handoff/ses_abc" })
      // Not on the session: the plugin domain drops create metadata.
      const created = yield* session.created
      expect(created.metadata).toBeUndefined()
    }).pipe(Effect.provide(testLayer())))

  it.effect("prefers explicit intent agent and model over source info", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const input = decode({
        sessionID: "ses_abc",
        intent: {
          goal: "audit",
          directive: "resume",
          refs: [],
          agent: "other",
          model: { providerID: "other", id: "model" },
        },
      })
      yield* handoff.transfer(input)
      const created = yield* session.created
      expect(created.agent).toBe("other")
      expect(created.model).toEqual({ providerID: "other", id: "model" })
    }).pipe(Effect.provide(testLayer(script({ identity: true })))))

  it.effect("fails render when create fails, with no retry", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure).toMatchObject({ _tag: "RenderFailed", reason: "create" })
      const calls = yield* session.calls
      expect(calls.create).toBe(1)
      expect(calls.synthetic).toBe(0)
    }).pipe(Effect.provide(testLayer(script({ failCreate: true })))))

  it.effect("creates no session on export-file", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const input = decode({
        sessionID: "ses_abc",
        intent: { goal: "move", directive: "queue", refs: [], resume: { mode: "export-file" } },
      })
      const pointer = yield* handoff.transfer(input)
      expect(pointer.kind).toBe("export-file")
      const calls = yield* session.calls
      expect(calls.create).toBe(0)
      expect(calls.synthetic).toBe(0)
    }).pipe(Effect.provide(testLayer(script({ identity: true })))))

  it.effect("renders skills and referenced artifacts into the brief", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const input = decode({
        sessionID: "ses_abc",
        intent: {
          goal: "audit",
          directive: "resume",
          refs: [{ kind: "plan", ref: "docs/plan.md" }],
          skills: ["review"],
        },
      })
      yield* handoff.transfer(input)
      const inputs = yield* session.syntheticInputs
      const injected = inputs[0]
      expect(injected.text).toContain("Skills: review")
      expect(injected.text).toContain("- plan: docs/plan.md")
    }).pipe(Effect.provide(testLayer())))

  it.effect("opens the brief with admission and a resume directive, without the storage key", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const input = decode({
        sessionID: "ses_abc",
        intent: { goal: "audit", directive: "resume", refs: [] },
      })
      yield* handoff.transfer(input)
      const inputs = yield* session.syntheticInputs
      const injected = inputs[0]
      expect(injected.text).toContain("You are resuming work handed off from another session.")
      expect(injected.text).toContain("Goal: audit")
      expect(injected.text).toContain("Then: Continue the work described below.")
      // The brief is the whole inheritance, so it carries the work itself.
      expect(injected.text).toContain("Handover\nCONDENSED")
      // Machinery the receiver cannot act on stays out of agent-visible text.
      expect(injected.text).not.toContain("handoff/ses_abc")
      expect(injected.text).not.toContain("boundary")
      expect(injected.text).not.toContain("ses_abc")
    }).pipe(Effect.provide(testLayer())))

  it.effect("labels the brief with the source session, not the bare word", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      yield* handoff.transfer(minimal("review the parser"))
      const [brief] = yield* session.syntheticInputs
      // The host renders this field, never the brief text.
      expect(brief?.description).toBe('handoff from "review the parser"')
    }).pipe(Effect.provide(testLayer())))

  it.effect("asks instead of acting when the goal was not stated", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const input = decode({
        sessionID: "ses_abc",
        intent: { goal: "Weekly review", stated: false, directive: "resume", refs: [] },
      })
      yield* handoff.transfer(input)
      const [brief] = yield* session.syntheticInputs
      expect(brief?.text).toContain("Nobody named the next step")
      expect(brief?.text).toContain("ask what to do before you act")
      expect(brief?.text).not.toContain("Continue the work described below")
    }).pipe(Effect.provide(testLayer())))

  it.effect("acts on a goal a person stated", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      yield* handoff.transfer(minimal("finish the CSV fix"))
      const [brief] = yield* session.syntheticInputs
      expect(brief?.text).toContain("Then: Continue the work described below.")
    }).pipe(Effect.provide(testLayer())))

  it.effect("condenses the conversation, not the tool noise", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const summarizer = yield* TestSummarizer
      yield* handoff.transfer(minimal())
      const [transcript] = yield* summarizer.seen
      expect(transcript).toBe("User: hello\nUser: world")
    }).pipe(Effect.provide(testLayer())))

  it.effect("condenses with the model the source session was using", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const summarizer = yield* TestSummarizer
      yield* handoff.transfer(minimal())
      const [model] = yield* summarizer.models
      // Without this the host picks a default, and fails where none exists.
      expect(model).toEqual({ providerID: "anthropic", id: "sonnet" })
    }).pipe(Effect.provide(testLayer(script({ identity: true })))))

  it.effect("falls back to the transcript when the summarizer dies", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      yield* handoff.transfer(minimal())
      const [injected] = yield* session.syntheticInputs
      // A failed model call must not cost the handoff its context.
      expect(injected?.text).toContain("Handover\nUser: hello\nUser: world")
    }).pipe(Effect.provide(testLayer(script(), {}, { fail: true }))))

  it.effect("falls back when the summarizer answers with a filled-in form", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      yield* handoff.transfer(minimal())
      const [injected] = yield* session.syntheticInputs
      // A small model answers a bulleted brief with JSON. That is a shape,
      // not a handover, and the transcript beats it.
      expect(injected?.text).toContain("Handover\nUser: hello\nUser: world")
      expect(injected?.text).not.toContain("what_is_done")
    }).pipe(Effect.provide(testLayer(script(), {}, { json: true }))))

  it.effect("falls back to the transcript when the summarizer returns nothing", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      yield* handoff.transfer(minimal())
      const [injected] = yield* session.syntheticInputs
      expect(injected?.text).toContain("Handover\nUser: hello\nUser: world")
    }).pipe(Effect.provide(testLayer(script(), {}, { blank: true }))))
})
