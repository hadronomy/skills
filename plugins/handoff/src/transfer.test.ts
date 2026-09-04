import { it } from "@effect/vitest"
import type { SessionInbox } from "@opencode-ai/schema/session-inbox"
import type { Session } from "@opencode-ai/schema/session"
import type { SessionMessage } from "@opencode-ai/schema/session-message"
import { Context, Effect, Layer, Ref, Schema } from "effect"
import { describe, expect } from "vitest"
import { CaptureLive } from "./capture.js"
import { Pointer, TransferInput, type PointerType } from "./rpc.js"
import { RenderLive } from "./render.js"
import { Host } from "./host.js"
import { HandoffLive, HandoffService } from "./transfer.js"

// Host-owned unions need one cast each at the fake factories below. The
// transfer path itself never casts; it only counts, stringifies, and
// forwards these values.
const userMsg = (text: string) => ({ type: "user", text }) as unknown as SessionMessage.Info
const info = (id: string) => ({ id }) as unknown as Session.Info
const syntheticOut = () => ({}) as unknown as SessionInbox.Synthetic

const decode = (input: unknown) => Schema.decodeUnknownSync(TransferInput)(input)

const minimal = (goal = "audit") => decode({
  sessionID: "ses_abc",
  intent: { goal, directive: "resume", refs: [] as Array<string> },
})

interface SessionScript {
  readonly messages: ReadonlyArray<SessionMessage.Info>
  readonly failContext: number
  readonly failGet: boolean
  readonly failCreate: boolean
  readonly failSynthetic: boolean
  readonly nextID: string
}

const script = (overrides: Partial<SessionScript> = {}): SessionScript => ({
  messages: [userMsg("hello"), userMsg("world")],
  failContext: 0,
  failGet: false,
  failCreate: false,
  failSynthetic: false,
  nextID: "ses_next",
  ...overrides,
})

interface SessionCalls {
  readonly context: number
  readonly get: number
  readonly create: number
  readonly synthetic: number
}

class TestSession extends Context.Service<TestSession, {
  readonly calls: () => Effect.Effect<SessionCalls>
  readonly syntheticInputs: () => Effect.Effect<ReadonlyArray<unknown>>
}>()("Handoff/TestSession") {}

const makeSessionTest = (sessionScript: SessionScript) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const calls = yield* Ref.make<SessionCalls>({ context: 0, get: 0, create: 0, synthetic: 0 })
      const remainingContextFailures = yield* Ref.make(sessionScript.failContext)
      const syntheticInputs = yield* Ref.make<Array<unknown>>([])
      const bump = (key: keyof SessionCalls) =>
        Ref.update(calls, (current) => ({ ...current, [key]: current[key] + 1 }))

      const gateway = Host.SessionGateway.of({
        context: Effect.fn("Handoff.TestSession.context")(function* () {
          yield* bump("context")
          const remaining = yield* Ref.getAndUpdate(
            remainingContextFailures,
            (n) => Math.max(0, n - 1),
          )
          if (remaining > 0) return yield* Effect.fail(new Error("transport"))
          return [...sessionScript.messages]
        }),
        get: Effect.fn("Handoff.TestSession.get")(function* () {
          yield* bump("get")
          if (sessionScript.failGet) return yield* Effect.fail(new Error("gone"))
          return info("ses_abc")
        }),
        create: Effect.fn("Handoff.TestSession.create")(function* () {
          yield* bump("create")
          if (sessionScript.failCreate) return yield* Effect.fail(new Error("denied"))
          return info(sessionScript.nextID)
        }),
        synthetic: (input: unknown) =>
          Effect.gen(function* () {
            yield* bump("synthetic")
            yield* Ref.update(syntheticInputs, (current) => [...current, input])
            if (sessionScript.failSynthetic) return yield* Effect.fail(new Error("busy"))
            return syntheticOut()
          }),
      })

      const probe = TestSession.of({
        calls: () => Ref.get(calls),
        syntheticInputs: () => Ref.get(syntheticInputs),
      })
      return Context.empty().pipe(
        Context.add(Host.SessionGateway, gateway),
        Context.add(TestSession, probe),
      )
    }),
  )

class TestStorage extends Context.Service<TestStorage, {
  readonly store: () => Effect.Effect<ReadonlyMap<string, Schema.Json>>
}>()("Handoff/TestStorage") {}

const makeStorageTest = (opts: { dieSet?: boolean; blankGet?: boolean } = {}) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, Schema.Json>())
      const gateway = Host.StorageGateway.of({
        get: (key) =>
          opts.blankGet
            ? Effect.succeed(undefined)
            : Ref.get(store).pipe(Effect.map((current) => current.get(key))),
        set: (key, value) => {
          if (opts.dieSet) return Effect.die(new Error("disk"))
          return Ref.update(store, (current) => new Map(current).set(key, value))
        },
        remove: (_key) => Effect.void,
        scan: () => Effect.succeed({ entries: [] }),
      })
      const probe = TestStorage.of({ store: () => Ref.get(store) })
      return Context.empty().pipe(
        Context.add(Host.StorageGateway, gateway),
        Context.add(TestStorage, probe),
      )
    }),
  )

class TestFiles extends Context.Service<TestFiles, {
  readonly files: () => Effect.Effect<ReadonlyMap<string, string>>
}>()("Handoff/TestFiles") {}

const makeFilesTest = (opts: { failWrite?: boolean } = {}) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const files = yield* Ref.make(new Map<string, string>())
      const writer = Host.FileWriter.of({
        write: (path, data) => {
          if (opts.failWrite) return Effect.fail(new Error("readonly"))
          return Ref.update(files, (current) => new Map(current).set(path, data))
        },
        tmpdir: () => "/tmp/handoff-test",
      })
      const probe = TestFiles.of({ files: () => Ref.get(files) })
      return Context.empty().pipe(
        Context.add(Host.FileWriter, writer),
        Context.add(TestFiles, probe),
      )
    }),
  )

const testLayer = (
  sessionScript: SessionScript = script(),
  storageOpts: { dieSet?: boolean; blankGet?: boolean } = {},
  filesOpts: { failWrite?: boolean } = {},
) => {
  // Provide discards the fakes' outputs, so merge them back: the app sees
  // the gateways while tests keep the probes. One shared reference means
  // one memoized build, so both sides observe the same Refs.
  const fakes = Layer.mergeAll(
    makeSessionTest(sessionScript),
    makeStorageTest(storageOpts),
    makeFilesTest(filesOpts),
  )
  const app = HandoffLive.pipe(
    Layer.provide(Layer.mergeAll(CaptureLive, RenderLive)),
    Layer.provide(fakes),
  )
  return Layer.mergeAll(app, fakes)
}

const wireRoundTrip = (pointer: PointerType) => {
  const encoded = Schema.encodeSync(Pointer)(pointer)
  return Schema.decodeUnknownSync(Pointer)(JSON.parse(JSON.stringify(encoded)))
}

describe("transfer", () => {
  it.effect("hands fork-local intent to a fresh session with the brief", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
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
      const store = yield* storage.store()
      expect(store.has("handoff/ses_abc")).toBe(true)
      expect(store.get("handoff/latest")).toEqual({ key: "handoff/ses_abc" })
      const calls = yield* session.calls()
      expect(calls.synthetic).toBe(1)
      const inputs = yield* session.syntheticInputs()
      const injected = inputs[0] as { delivery: string; resume: boolean; text: string }
      expect(injected.delivery).toBe("steer")
      expect(injected.resume).toBe(true)
      expect(injected.text).toContain("audit")
    }).pipe(Effect.provide(testLayer())))

  it.effect("writes export-file transfer data with import-compatible top level", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
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
      const calls = yield* session.calls()
      expect(calls.create).toBe(0)
      expect(calls.synthetic).toBe(0)
      const store = yield* storage.store()
      expect(store.has("handoff/ses_abc")).toBe(true)
      const written = yield* files.files()
      const envelope = JSON.parse(written.get("/tmp/x/handoff-ses_abc.json") ?? "")
      expect(Object.keys(envelope).sort()).toEqual(["handoff", "info", "messages"])
      expect(envelope.messages).toHaveLength(2)
      expect(envelope.handoff.goal).toBe("move machines")
    }).pipe(Effect.provide(testLayer())))

  it.effect("falls back to tmpdir when export names no directory", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
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
      const written = yield* files.files()
      expect(written.has("/tmp/handoff-test/handoff-ses_abc.json")).toBe(true)
    }).pipe(Effect.provide(testLayer())))

  it.effect("fails closed on empty context without retry", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const storage = yield* TestStorage
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("CaptureFailed")
      const calls = yield* session.calls()
      expect(calls.context).toBe(1)
      const store = yield* storage.store()
      expect(store.size).toBe(0)
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script({ messages: [] })))))

  it.effect("retries transport faults twice, then hands off", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const pointer = yield* handoff.transfer(minimal())
      expect(pointer.kind).toBe("fork-local")
      const calls = yield* session.calls()
      expect(calls.context).toBe(3)
    }).pipe(Effect.provide(testLayer(script({ failContext: 2 })))))

  it.effect("stays a typed CaptureFailed after exhausted retries", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("CaptureFailed")
      const calls = yield* session.calls()
      expect(calls.context).toBe(3)
    }).pipe(Effect.provide(testLayer(script({ failContext: 9 })))))

  it.effect("refuses secrets and stores nothing", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const storage = yield* TestStorage
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      if (failure._tag === "RedactRefused") {
        expect(failure.cause).toEqual({ reason: "secret", field: "messages[1]" })
      } else {
        expect.unreachable(`wrong failure: ${failure._tag}`)
      }
      const store = yield* storage.store()
      expect(store.size).toBe(0)
      const calls = yield* session.calls()
      expect(calls.create).toBe(0)
      expect(calls.synthetic).toBe(0)
    }).pipe(Effect.provide(
      testLayer(script({ messages: [userMsg("hello"), userMsg("deploy with sk-ant-secret-key-1234567890")] })),
    )))

  it.effect("writes the raw file alone for export-file with sanitize false", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
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
      const written = yield* files.files()
      expect(written.has("/tmp/x/handoff-ses_abc.json")).toBe(true)
      const store = yield* storage.store()
      expect(store.size).toBe(0)
    }).pipe(Effect.provide(
      testLayer(script({ messages: [userMsg("deploy with sk-ant-secret-key-1234567890")] })),
    )))

  it.effect("converts store defects into RenderFailed before relocate", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("RenderFailed")
      const calls = yield* session.calls()
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script(), { dieSet: true }))))

  it.effect("fails render when the stash verify-read comes back empty", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("RenderFailed")
      const calls = yield* session.calls()
      expect(calls.create).toBe(0)
    }).pipe(Effect.provide(testLayer(script(), { blankGet: true }))))

  it.effect("runs create once, with no retry", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("RenderFailed")
      const calls = yield* session.calls()
      expect(calls.create).toBe(1)
    }).pipe(Effect.provide(testLayer(script({ failCreate: true })))))

  it.effect("runs synthetic delivery once, with no retry", () =>
    Effect.gen(function* () {
      const handoff = yield* HandoffService
      const session = yield* TestSession
      const failure = yield* Effect.flip(handoff.transfer(minimal()))
      expect(failure._tag).toBe("RenderFailed")
      const calls = yield* session.calls()
      expect(calls.synthetic).toBe(1)
    }).pipe(Effect.provide(testLayer(script({ failSynthetic: true })))))
})
