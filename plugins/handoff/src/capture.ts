import type { Session } from "@opencode-ai/schema/session"
import type { SessionMessage } from "@opencode-ai/schema/session-message"
import { Context, Effect, Layer, Schedule } from "effect"
import { CaptureFailed } from "./rpc.js"
import { Host } from "./host.js"
import { orStageFailure } from "./stage.js"

/**
 * Captured source state: full history plus the info the export envelope
 * needs to stay import-compatible.
 *
 * @category models
 * @since 0.1.0
 */
export interface Captured {
  readonly messages: ReadonlyArray<SessionMessage.Info>
  readonly info: Session.Info
}

/**
 * Reads source history. Fails closed on empty context; retries recurs(2) on
 * transport faults, which is safe because both reads are idempotent.
 *
 * @category services
 * @since 0.2.0
 */
export class Service extends Context.Service<Service, {
  readonly read: (sessionID: Session.ID) => Effect.Effect<Captured, CaptureFailed>
}>()("@hadronomy/handoff/Capture") {}

/**
 * Serves capture from the session gateway.
 *
 * @category layers
 * @since 0.2.0
 */
export const layer: Layer.Layer<Service, never, Host.SessionGateway> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const gateway = yield* Host.SessionGateway
    return {
      read: Effect.fn("Handoff.capture")(function* (sessionID: Session.ID) {
        const [messages, info] = yield* orStageFailure(
          Effect.all(
            [gateway.context({ sessionID }), gateway.get({ sessionID })],
            { concurrency: 2 },
          ).pipe(Effect.retry(Schedule.recurs(2))),
          () => new CaptureFailed({ op: "capture" }),
        )
        if (messages.length === 0) return yield* new CaptureFailed({ op: "capture" })
        return { messages, info }
      }),
    }
  }),
)

export * as Capture from "./capture.js"
