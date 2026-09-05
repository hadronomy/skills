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
      expect(injected.resume).toBe(true)
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
      expect(failure._tag).toBe("CaptureFailed")
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
      expect(failure._tag).toBe("CaptureFailed")
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
      expect(failure._tag).toBe("RenderFailed")
      const calls = yield* session.calls
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script(), { dieSet: true }))))

  it.effect("fails render when the stash verify-read comes back empty", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("RenderFailed")
      const calls = yield* session.calls
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script(), { blankGet: true }))))

  it.effect("runs synthetic delivery once, with no retry", () =>
    Effect.gen(function* () {
      const handoff = yield* Transfer.Service
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("RenderFailed")
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
      expect(failure._tag).toBe("RenderFailed")
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
      const lines = injected.text.split("\n")
      expect(lines[0]).toBe("You are resuming work handed off from another session.")
      expect(lines[1]).toBe("Handoff: audit")
      expect(lines[2]).toContain("Resume: steer with the brief, then resume the work below")
      expect(injected.text).not.toContain("Key handoff/")
    }).pipe(Effect.provide(testLayer())))

})
