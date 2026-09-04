import type { SessionImportInput } from "@opencode-ai/client/effect/api"
import { Context, Effect, Layer, Match, Schedule, Schema } from "effect"
import type { Captured } from "./capture.js"
import type { Intent, PointerType, TransferInput } from "./rpc.js"
import { RenderFailed } from "./rpc.js"
import { Host } from "./host.js"
import { orStageFailure } from "./stage.js"

const renderFailed = () => new RenderFailed({ op: "render" })

const gate = Effect.fn("Handoff.render.gate")(function* (value: unknown) {
  return yield* Effect.try({
    try: () => Schema.decodeUnknownSync(Schema.Json)(value),
    catch: () => renderFailed(),
  })
})

const brief = (sessionID: string, intent: Intent, captured: Captured): string => {
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
  const refs = intent.refs.length > 0 ? intent.refs.join(", ") : "none"
  return [
    `Handoff: ${intent.goal}`,
    `Directive ${intent.directive} · ${captured.messages.length} messages from ${sessionID} · boundary ${where}`,
    `Refs: ${refs}`,
    `Key handoff/${sessionID}. Continue the work above.`,
  ].join("\n")
}

/**
 * Condenses the brief, stashes, then relocates. Fork-local preloads the
 * brief into a fresh session; export-file relocates transfer data to a file.
 * Only the stash verify-read retries recurs(2); create, synthetic delivery,
 * and the file write run once.
 *
 * @category services
 * @since 0.1.0
 */
export class Render extends Context.Service<Render, {
  readonly pointer: (
    input: TransferInput,
    captured: Captured,
  ) => Effect.Effect<PointerType, RenderFailed>
}>()("@hadronomy/handoff/Render") {}

/**
 * Serves render from storage, session, and file gateways.
 *
 * @category layers
 * @since 0.1.0
 */
export const RenderLive: Layer.Layer<
  Render,
  never,
  Host.StorageGateway | Host.SessionGateway | Host.FileWriter
> = Layer.effect(
  Render,
  Effect.gen(function* () {
    const storage = yield* Host.StorageGateway
    const session = yield* Host.SessionGateway
    const files = yield* Host.FileWriter
    return {
      pointer: Effect.fn("Handoff.render")(function* (input: TransferInput, captured: Captured) {
        const sessionID = input.sessionID
        const intent = input.intent
        const key = `handoff/${sessionID}`
        const text = brief(sessionID, intent, captured)
        const count = captured.messages.length
        const resume = intent.resume

        // The stash holds redacted-by-construction data: fork-local always
        // scrubs, and export-file stashes only when sanitize holds. Raw
        // export writes the file alone, with no side copy in storage.
        if (resume.mode === "fork-local" || resume.sanitize) {
          yield* orStageFailure(
            gate({
              key,
              sessionID,
              intent,
              brief: text,
              messages: captured.messages,
              info: captured.info,
            }).pipe(Effect.flatMap((stash) => storage.set(key, stash))),
            renderFailed,
          )
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
              const envelope = yield* gate({
                ...{
                  info: captured.info,
                  messages: captured.messages,
                } satisfies SessionImportInput,
                handoff: {
                  key,
                  goal: intent.goal,
                  directive: intent.directive,
                  refs: intent.refs,
                  brief: text,
                },
              })
              yield* orStageFailure(files.write(file, JSON.stringify(envelope, null, 2)), renderFailed)
              return { kind: "export-file", key, file, messages: count } as const
            })),
          Match.discriminator("mode")("fork-local", (arm) =>
            // No fork on the plugin context in beta-19086, so both
            // boundaries start a fresh session with the brief. The boundary
            // stays recorded in the stash.
            Effect.gen(function* () {
              const next = yield* orStageFailure(
                session.create({ title: intent.goal.slice(0, 120) }),
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
              return { kind: "fork-local", key, nextSessionID: next.id, messages: count } as const
            })),
          Match.exhaustive,
        )
      }),
    }
  }),
)
