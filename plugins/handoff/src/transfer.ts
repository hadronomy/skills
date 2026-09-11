import { Context, Effect, Layer } from "effect"
import { Capture } from "./capture.js"
import type { CaptureFailed, PointerType, RenderFailed, TransferInput } from "./rpc.js"
import { Render } from "./render.js"

/**
 * The one operation behind every handoff trigger. The slash command, the
 * agent tool, and the RPC handler all take this exact function, so none of
 * them can drift into its own half of the behaviour.
 *
 * @category models
 * @since 0.4.0
 */
export type Complete = (
  input: TransferInput,
) => Effect.Effect<PointerType, CaptureFailed | RenderFailed>

/**
 * One method owns the whole handoff: capture history, render the pointer.
 *
 * @category services
 * @since 0.2.0
 */
export class Service extends Context.Service<Service, {
  readonly transfer: Complete
}>()("@hadronomy/handoff/Handoff") {}

/**
 * Serves the handoff from the capture and render stages.
 *
 * @category layers
 * @since 0.2.0
 */
export const layer: Layer.Layer<Service, never, Capture.Service | Render.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const capture = yield* Capture.Service
    const render = yield* Render.Service
    return {
      transfer: Effect.fn("Handoff.transfer")(function* (input: TransferInput) {
        const captured = yield* capture.read(input.sessionID)
        return yield* render.pointer(input, captured)
      }),
    }
  }),
)

export * as Transfer from "./transfer.js"
