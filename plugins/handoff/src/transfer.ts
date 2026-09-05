import { Context, Effect, Layer, Match } from "effect"
import { Capture } from "./capture.js"
import type {
  CaptureFailed,
  PointerType,
  RedactRefused,
  RenderFailed,
  TransferInput,
} from "./rpc.js"
import { Render } from "./render.js"
import { Redact } from "./redact.js"

/**
 * One method owns the whole handoff: capture history, redact secrets, render
 * the pointer. Fork-local always redacts; export-file redacts only when its
 * `sanitize` flag holds, and then render skips the stash too, so raw output
 * never lands a side copy in storage.
 *
 * @category services
 * @since 0.2.0
 */
export class Service extends Context.Service<Service, {
  readonly transfer: (
    input: TransferInput,
  ) => Effect.Effect<PointerType, CaptureFailed | RedactRefused | RenderFailed>
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
        const scan = input.intent.scan
        const scrubbed = yield* Match.value(input.intent.resume).pipe(
          Match.discriminator("mode")("fork-local", () => Redact.scrub(captured, scan)),
          Match.discriminator("mode")("export-file", (arm) =>
            arm.sanitize ? Redact.scrub(captured, scan) : Effect.succeed(captured)),
          Match.exhaustive,
        )
        return yield* render.pointer(input, scrubbed)
      }),
    }
  }),
)

export * as Transfer from "./transfer.js"
