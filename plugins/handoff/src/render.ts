import { Context, Effect, Layer, Match, Schedule, Schema } from "effect"
import type { Capture } from "./capture.js"
import type { Intent, PointerType, TransferInput } from "./rpc.js"
import { Envelope, Key, Pointer, RenderFailed, Stash } from "./rpc.js"
import { Host } from "./host.js"
import { orStageFailure } from "./stage.js"

const renderFailed = () => new RenderFailed({ op: "render" })

const gate = Effect.fn("Handoff.render.gate")(function* (value: unknown) {
  return yield* Schema.decodeUnknownEffect(Schema.Json)(value).pipe(
    Effect.mapError(renderFailed),
  )
})

// A malformed pointer or envelope is unreturnable, not just untested.
const prove = Effect.fn("Handoff.render.prove")(function* (pointer: PointerType) {
  const wire = yield* Schema.encodeEffect(Pointer)(pointer)
  return yield* Schema.decodeEffect(Pointer)(wire)
})

// Admission prefix, mirroring the house subagent line ("You are a subagent
// spawned by another session."). The fresh session starts with empty
// context, so the first line names that state before the task text.
const ADMISSION = "You are resuming work handed off from another session."

const brief = (sessionID: string, intent: Intent, captured: Capture.Captured): string => {
  const where = Match.value(intent.resume).pipe(
    Match.discriminator("mode")("export-file", () => "export-file"),
    Match.discriminator("mode")("fork-local", (arm) =>
      Match.value(arm.boundary).pipe(
        Match.discriminator("type")("through", () => "through"),
        Match.discriminator("type")("before", (before) => `before ${before.messageID}`),
        Match.exhaustive,
      )),
    Match.exhaustive,
  )
  // The stash key stays out of agent-visible text; it travels in the
  // stash record and the pointer, which the fresh session cannot read.
  const resume = Match.value(intent.resume).pipe(
    Match.discriminator("mode")(
      "export-file",
      () => `Resume: import the transfer file, then ${intent.directive} the work below`,
    ),
    Match.discriminator("mode")(
      "fork-local",
      (arm) =>
        `Resume: ${arm.delivery === "queue" ? "read the queued brief, then" : "steer with the brief, then"} ${intent.directive} the work below · ${captured.messages.length} messages from ${sessionID} · boundary ${where}`,
    ),
    Match.exhaustive,
  )
  const skills = intent.skills.length > 0 ? intent.skills.join(", ") : "none"
  const artifacts = intent.refs.length > 0
    ? ["Artifacts:", ...intent.refs.map((ref) => `- ${ref.kind}: ${ref.ref}`)]
    : ["Artifacts: none"]
  return [
    ADMISSION,
    `Handoff: ${intent.goal}`,
    resume,
    `Skills: ${skills}`,
    ...artifacts,
  ].join("\n")
}

/**
 * Condenses the brief, stashes, then relocates. Fork-local preloads the
 * brief into a fresh session; export-file relocates transfer data to a file.
 * Only the stash verify-read retries recurs(2); create, synthetic delivery,
 * and the file write run once.
 *
 * @category services
 * @since 0.2.0
 */
export class Service extends Context.Service<Service, {
  readonly pointer: (
    input: TransferInput,
    captured: Capture.Captured,
  ) => Effect.Effect<PointerType, RenderFailed>
}>()("@hadronomy/handoff/Render") {}

/**
 * Serves render from storage, session, and file gateways.
 *
 * @category layers
 * @since 0.2.0
 */
export const layer: Layer.Layer<
  Service,
  never,
  Host.StorageGateway | Host.SessionGateway | Host.FileWriter
> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const storage = yield* Host.StorageGateway
    const session = yield* Host.SessionGateway
    const files = yield* Host.FileWriter
    return {
      pointer: Effect.fn("Handoff.render")(function* (input: TransferInput, captured: Capture.Captured) {
        const sessionID = input.sessionID
        const intent = input.intent
        const key = Key.make(`handoff/${sessionID}`)
        const text = brief(sessionID, intent, captured)
        const count = captured.messages.length
        const resume = intent.resume

        // Fork-local always stashes; export-file stashes only when sanitize
        // holds. Raw export writes the file alone, with no side copy.
        if (resume.mode === "fork-local" || resume.sanitize) {
          const stash = yield* orStageFailure(
            Schema.encodeEffect(Stash)({
              key,
              sessionID,
              intent,
              brief: text,
              messages: captured.messages,
              info: captured.info,
            }),
            renderFailed,
          )
          // Encoded structs keep optional keys, which never satisfy the
          // Json index signature at the type level. The gate re-proves
          // plain JSON-ness and yields the Json type storage demands.
          const json = yield* gate(stash)
          yield* orStageFailure(storage.set(key, json), renderFailed)
          const seen = yield* orStageFailure(
            storage.get(key).pipe(Effect.retry(Schedule.recurs(2))),
            renderFailed,
          )
          if (seen === undefined) return yield* renderFailed()
          const pointer = yield* gate({ key })
          yield* orStageFailure(storage.set("handoff/latest", pointer), renderFailed)
        }

        return yield* Match.value(resume).pipe(
          Match.discriminator("mode")("export-file", (arm) =>
            Effect.gen(function* () {
              const directory = arm.directory ?? files.tmpdir()
              const safe = sessionID.replace(/[^A-Za-z0-9_-]/g, "_")
              const file = `${directory}/handoff-${safe}.json`
              const envelope = yield* orStageFailure(
                Schema.encodeEffect(Envelope)({
                  info: captured.info,
                  messages: captured.messages,
                  handoff: {
                    key,
                    goal: intent.goal,
                    directive: intent.directive,
                    refs: intent.refs,
                    skills: intent.skills,
                    brief: text,
                  },
                }),
                renderFailed,
              )
              yield* orStageFailure(files.write(file, JSON.stringify(envelope, null, 2)), renderFailed)
              const pointer: PointerType = { kind: "export-file", key, file, messages: count }
              return yield* orStageFailure(prove(pointer), renderFailed)
            })),
          Match.discriminator("mode")("fork-local", (arm) =>
            // No fork on the plugin context in beta, so both boundaries
            // start a fresh session with the brief. The boundary stays
            // recorded in the stash. Agent and model pass at create,
            // mirroring what a server fork preserves.
            Effect.gen(function* () {
              const agent = intent.agent ?? captured.info.agent
              const model = intent.model ?? captured.info.model
              const next = yield* orStageFailure(
                session.create({
                  title: intent.goal.slice(0, 120),
                  ...(agent === undefined ? {} : { agent }),
                  ...(model === undefined ? {} : { model }),
                }),
                renderFailed,
              )
              yield* orStageFailure(
                session.synthetic({
                  sessionID: next.id,
                  text,
                  description: "handoff",
                  metadata: { handoff: key },
                  delivery: arm.delivery,
                  resume: arm.resume,
                }),
                renderFailed,
              )
              const pointer: PointerType = { kind: "fork-local", key, nextSessionID: next.id, messages: count }
              return yield* orStageFailure(prove(pointer), renderFailed)
            })),
          Match.exhaustive,
        )
      }),
    }
  }),
)

export * as Render from "./render.js"
