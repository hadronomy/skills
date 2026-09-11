import type { SessionImportInput } from "@opencode-ai/client/effect/api"
import type { Model } from "@opencode-ai/schema/model"
import { Context, Effect, Layer, Match, Schedule, Schema } from "effect"
import type { Capture } from "./capture.js"
import type { Intent, PointerType, RenderReason, TransferInput } from "./rpc.js"
import { Envelope, keyFor, Pointer, RenderFailed, Stash } from "./rpc.js"
import { Host } from "./host.js"
import { Receipt } from "./receipt.js"
import { orFallback, orStageFailure } from "./stage.js"
import { Transcript } from "./transcript.js"

// Curried so every call site reads as the step that failed:
// `orStageFailure(storage.set(...), renderFailed("stash"))`.
const renderFailed = (reason: RenderReason) => () => new RenderFailed({ op: "render", reason })

const gate = Effect.fn("Handoff.render.gate")(function* (value: unknown) {
  return yield* Schema.decodeUnknownEffect(Schema.Json)(value).pipe(
    Effect.mapError(renderFailed("encode")),
  )
})

// A malformed pointer or envelope is unreturnable, not just untested.
const prove = Effect.fn("Handoff.render.prove")(function* (pointer: PointerType) {
  const wire = yield* Schema.encodeEffect(Pointer)(pointer)
  return yield* Schema.decodeEffect(Pointer)(wire)
})

/**
 * How much transcript the summarizer reads, in characters. Taken from the
 * end of the session.
 *
 * @category configuration
 * @since 0.5.0
 */
export const ReadBudget = 40_000

/**
 * How much verbatim transcript the brief carries when the summarizer fails.
 * Smaller than the read budget: this text becomes a message in the new
 * session rather than one model call.
 *
 * @category configuration
 * @since 0.5.0
 */
export const FallbackBudget = 8_000

// The brief is the whole inheritance. A session that starts from it has no
// other context, so it names the work, the next move, and then the handover
// itself. Machinery the receiver cannot act on — boundary, message count,
// source session ID, stash key — stays in the stash and the pointer.
const ADMISSION = [
  "You are resuming work handed off from another session.",
  "The handover below is your only context. The previous session is not",
  "readable from here, so do not go looking for it.",
].join("\n")

const next = (intent: Intent): string =>
  Match.value(intent.directive).pipe(
    Match.when("resume", () => "Continue the work described below."),
    Match.when("branch", () => "Branch from the work described below."),
    Match.when("queue", () => "Hold this work until someone asks you to start."),
    Match.exhaustive,
  )

const brief = (intent: Intent, handover: string): string => {
  const skills = intent.skills.length > 0 ? intent.skills.join(", ") : "none"
  const artifacts = intent.refs.length > 0
    ? ["Artifacts:", ...intent.refs.map((ref) => `- ${ref.kind}: ${ref.ref}`)]
    : ["Artifacts: none"]
  return [
    ADMISSION,
    "",
    `Goal: ${intent.goal}`,
    `Then: ${next(intent)}`,
    `Skills: ${skills}`,
    ...artifacts,
    "",
    "Handover",
    handover.length > 0 ? handover : "The source session held no conversation to carry over.",
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
  Host.StorageGateway | Host.SessionGateway | Host.FileWriter | Host.Summarizer
> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const storage = yield* Host.StorageGateway
    const session = yield* Host.SessionGateway
    const files = yield* Host.FileWriter
    const summarizer = yield* Host.Summarizer

    // A failed model call must not cost the handoff its context. The tail is
    // the same work, only longer and unsorted, which still beats a brief
    // that names a session the receiver cannot read.
    const handover = Effect.fn("Handoff.render.condense")(function* (
      said: ReadonlyArray<string>,
      model: Model.Ref | undefined,
    ) {
      if (said.length === 0) return ""
      const fallback = () => Transcript.tail(said, FallbackBudget)
      const condensed = yield* orFallback(
        summarizer.condense(Transcript.tail(said, ReadBudget), model).pipe(
          Effect.tapCause((cause) =>
            Effect.logWarning("handoff: the brief fell back to the transcript", cause)),
        ),
        fallback,
      )
      return condensed.length > 0 ? condensed : fallback()
    })

    return {
      pointer: Effect.fn("Handoff.render")(function* (input: TransferInput, captured: Capture.Captured) {
        const sessionID = input.sessionID
        const intent = input.intent
        const key = keyFor(sessionID)
        // The intent can name a different model for the new session. The
        // brief describes the old one, so the old one condenses it.
        const text = brief(
          intent,
          yield* handover(Transcript.lines(captured.messages), captured.info.model),
        )
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
            renderFailed("encode"),
          )
          // Encoded structs keep optional keys, which never satisfy the
          // Json index signature at the type level. The gate re-proves
          // plain JSON-ness and yields the Json type storage demands.
          const json = yield* gate(stash)
          yield* orStageFailure(storage.set(key, json), renderFailed("stash"))
          const seen = yield* orStageFailure(
            storage.get(key).pipe(Effect.retry(Schedule.recurs(2))),
            renderFailed("stash"),
          )
          if (seen === undefined) return yield* renderFailed("stash")()
          const pointer = yield* gate({ key })
          yield* orStageFailure(storage.set("handoff/latest", pointer), renderFailed("stash"))
        }

        return yield* Match.value(resume).pipe(
          Match.discriminator("mode")("export-file", (arm) =>
            Effect.gen(function* () {
              const directory = arm.directory ?? files.tmpdir()
              const safe = sessionID.replace(/[^A-Za-z0-9_-]/g, "_")
              const file = `${directory}/handoff-${safe}.json`
              // The file the user moves has to import as is. `satisfies`
              // pins that against the host's own input type at compile
              // time, which is the only proof available without a server.
              const importable = {
                info: captured.info,
                messages: captured.messages,
              } satisfies SessionImportInput
              const envelope = yield* orStageFailure(
                Schema.encodeEffect(Envelope)({
                  ...importable,
                  handoff: {
                    key,
                    goal: intent.goal,
                    directive: intent.directive,
                    refs: intent.refs,
                    skills: intent.skills,
                    brief: text,
                  },
                }),
                renderFailed("encode"),
              )
              yield* orStageFailure(files.write(file, JSON.stringify(envelope, null, 2)), renderFailed("write"))
              const pointer: PointerType = { kind: "export-file", key, file, messages: count }
              return yield* orStageFailure(prove(pointer), renderFailed("encode"))
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
                // No metadata here. The plugin session domain drops it at
                // create through beta-19398, though the HTTP endpoint keeps
                // it. The brief below carries the key instead, which is the
                // record that survives.
                session.create({
                  title: intent.goal.slice(0, 120),
                  ...(agent === undefined ? {} : { agent }),
                  ...(model === undefined ? {} : { model }),
                }),
                renderFailed("create"),
              )
              yield* orStageFailure(
                session.synthetic({
                  sessionID: next.id,
                  text,
                  // The host renders this, never the brief text, so it names
                  // where the work came from instead of repeating the word.
                  description: Receipt.origin(captured.info.title, intent.goal),
                  metadata: { handoff: key },
                  delivery: arm.delivery,
                  resume: arm.resume,
                }),
                renderFailed("deliver"),
              )
              const pointer: PointerType = { kind: "fork-local", key, nextSessionID: next.id, messages: count }
              return yield* orStageFailure(prove(pointer), renderFailed("encode"))
            })),
          Match.exhaustive,
        )
      }),
    }
  }),
)

export * as Render from "./render.js"
