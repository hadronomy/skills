// Shared doubles for transfer tests: Ref-backed host fakes behind test
// layers, plus intent builders. Production code never imports this module.

import type { SessionDomain } from "@opencode-ai/plugin/effect/session"
import { Session } from "@opencode-ai/schema/session"
import { SessionInbox } from "@opencode-ai/schema/session-inbox"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { Context, Effect, Layer, Ref, Schema } from "effect"
import { Capture } from "./capture.js"
import { Pointer, TransferInput, type PointerType } from "./rpc.js"
import { Render } from "./render.js"
import { Host } from "./host.js"
import { Transfer } from "./transfer.js"

// Fake host records decode through the real host schemas, so the fakes
// carry every required field and the encode boundary holds in tests.
// Synthetic input flows from the gateway interface, not the client package:
// the fake implements Host.SessionGateway, so the input type is whatever the
// host declares. Naming it here keeps the probe and the Ref aligned.
type SyntheticInput = Parameters<SessionDomain["synthetic"]>[0]

export const T0 = 1_750_000_000_000
export const userMsg = (text: string, id = "msg_1") =>
  Schema.decodeSync(SessionMessage.User)({ id, time: { created: T0 }, text, type: "user" })
export const info = (id: string, identity = false) =>
  Schema.decodeSync(Session.Info)({
    id,
    projectID: "proj_test",
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: T0, updated: T0 },
    location: { directory: "/tmp/test" },
    ...(identity
      ? { agent: "build", model: { providerID: "anthropic", id: "sonnet" } }
      : {}),
  })
export const syntheticOut = () =>
  Schema.decodeSync(SessionInbox.Synthetic)({
    type: "synthetic",
    payload: { text: "ok" },
    delivery: "queue",
    id: "msg_9",
    sessionID: "ses_next",
    timeCreated: T0,
  })

export const decode = (input: unknown) => Schema.decodeUnknownSync(TransferInput)(input)

export const minimal = (goal = "audit") => decode({
  sessionID: "ses_abc",
  intent: { goal, directive: "resume", refs: [] },
})

export interface SessionScript {
  readonly messages: ReadonlyArray<SessionMessage.Info>
  readonly failContext: number
  readonly failGet: boolean
  readonly failCreate: boolean
  readonly failSynthetic: boolean
  readonly identity: boolean
  readonly nextID: string
}

export const script = (overrides: Partial<SessionScript> = {}): SessionScript => ({
  messages: [userMsg("hello", "msg_1"), userMsg("world", "msg_2")],
  failContext: 0,
  failGet: false,
  failCreate: false,
  failSynthetic: false,
  identity: false,
  nextID: "ses_next",
  ...overrides,
})

export class TransportFault extends Schema.TaggedError<TransportFault>()("TransportFault", {
  message: Schema.String,
}) {}

export interface SessionCalls {
  readonly context: number
  readonly get: number
  readonly create: number
  readonly synthetic: number
}

export class TestSession extends Context.Service<TestSession, {
  readonly calls: Effect.Effect<SessionCalls>
  readonly syntheticInputs: Effect.Effect<ReadonlyArray<SyntheticInput>>
  readonly created: Effect.Effect<{ agent: unknown; model: unknown }>
}>()("Handoff/TestSession") {}

export const makeSessionTest = (sessionScript: SessionScript) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const calls = yield* Ref.make<SessionCalls>({
        context: 0,
        get: 0,
        create: 0,
        synthetic: 0,
      })
      const remainingContextFailures = yield* Ref.make(sessionScript.failContext)
      const syntheticInputs = yield* Ref.make<Array<SyntheticInput>>([])
      const created = yield* Ref.make<{ agent: unknown; model: unknown }>({ agent: undefined, model: undefined })
      const bump = (key: keyof SessionCalls) =>
        Ref.update(calls, (current) => ({ ...current, [key]: current[key] + 1 }))

      const gateway = Host.SessionGateway.of({
        context: Effect.fn("Handoff.TestSession.context")(function* () {
          yield* bump("context")
          const remaining = yield* Ref.getAndUpdate(
            remainingContextFailures,
            (n) => Math.max(0, n - 1),
          )
          if (remaining > 0) return yield* new TransportFault({ message: "transport" })
          return [...sessionScript.messages]
        }),
        get: Effect.fn("Handoff.TestSession.get")(function* () {
          yield* bump("get")
          if (sessionScript.failGet) return yield* new TransportFault({ message: "gone" })
          return info("ses_abc", sessionScript.identity)
        }),
        create: Effect.fn("Handoff.TestSession.create")(function* (input?: { agent?: unknown; model?: unknown }) {
          yield* bump("create")
          yield* Ref.update(created, () => ({ agent: input?.agent, model: input?.model }))
          if (sessionScript.failCreate) return yield* new TransportFault({ message: "denied" })
          return info(sessionScript.nextID)
        }),
        synthetic: (input: SyntheticInput) =>
          Effect.gen(function* () {
            yield* bump("synthetic")
            yield* Ref.update(syntheticInputs, (current) => [...current, input])
            if (sessionScript.failSynthetic) return yield* new TransportFault({ message: "busy" })
            return syntheticOut()
          }),
      })

      const probe = TestSession.of({
        calls: Ref.get(calls),
        syntheticInputs: Ref.get(syntheticInputs),
        created: Ref.get(created),
      })
      return Context.empty().pipe(
        Context.add(Host.SessionGateway, gateway),
        Context.add(TestSession, probe),
      )
    }),
  )

export class TestStorage extends Context.Service<TestStorage, {
  readonly store: Effect.Effect<ReadonlyMap<string, Schema.Json>>
}>()("Handoff/TestStorage") {}

export const makeStorageTest = (opts: { dieSet?: boolean; blankGet?: boolean } = {}) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, Schema.Json>())
      const gateway = Host.StorageGateway.of({
        get: (key) => Ref.get(store).pipe(Effect.map((current) => current.get(key))),
        set: (key, value) => {
          if (opts.dieSet) return Effect.die(new TransportFault({ message: "disk" }))
          if (opts.blankGet) return Effect.void
          return Ref.update(store, (current) => new Map(current).set(key, value))
        },
        remove: (_key) => Effect.void,
        scan: () => Effect.succeed({ entries: [] }),
      })
      const probe = TestStorage.of({ store: Ref.get(store) })
      return Context.empty().pipe(
        Context.add(Host.StorageGateway, gateway),
        Context.add(TestStorage, probe),
      )
    }),
  )

export class TestFiles extends Context.Service<TestFiles, {
  readonly files: Effect.Effect<ReadonlyMap<string, string>>
}>()("Handoff/TestFiles") {}

export const filesTestLayer = Layer.effectContext(
    Effect.gen(function* () {
      const files = yield* Ref.make(new Map<string, string>())
      const writer = Host.FileWriter.of({
        write: (path, data) => Ref.update(files, (current) => new Map(current).set(path, data)),
        tmpdir: () => "/tmp/handoff-test",
      })
      const probe = TestFiles.of({ files: Ref.get(files) })
      return Context.empty().pipe(
        Context.add(Host.FileWriter, writer),
        Context.add(TestFiles, probe),
      )
    }),
  )

export const testLayer = (
  sessionScript: SessionScript = script(),
  storageOpts: { dieSet?: boolean; blankGet?: boolean } = {},
) => {
  // Provide discards the fakes' outputs, so merge them back: the app sees
  // the gateways while tests keep the probes. One shared reference means
  // one memoized build, so both sides observe the same Refs.
  const fakes = Layer.mergeAll(
    makeSessionTest(sessionScript),
    makeStorageTest(storageOpts),
    filesTestLayer,
  )
  const app = Transfer.layer.pipe(
    Layer.provide(Layer.mergeAll(Capture.layer, Render.layer)),
    Layer.provide(fakes),
  )
  return Layer.mergeAll(app, fakes)
}

export const wireRoundTrip = (pointer: PointerType) => {
  const encoded = Schema.encodeSync(Pointer)(pointer)
  return Schema.decodeUnknownSync(Pointer)(JSON.parse(JSON.stringify(encoded)))
}
