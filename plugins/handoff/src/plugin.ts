import { Plugin } from "@opencode-ai/plugin/effect"
import { Effect, Layer, Match } from "effect"
import { CaptureLive } from "./capture.js"
import { RenderLive } from "./render.js"
import { Handoff } from "./rpc.js"
import { Host } from "./host.js"
import { HandoffLive, HandoffService } from "./transfer.js"
import type { PointerType } from "./rpc.js"

const receipt = (pointer: PointerType): string =>
  Match.value(pointer).pipe(
    Match.discriminator("kind")("fork-local", (p) => `Saved ${p.key}, resume ${p.nextSessionID}`),
    Match.discriminator("kind")("export-file", (p) => `Saved ${p.key}, move ${p.file} then import it`),
    Match.exhaustive,
  )

/**
 * Server plugin. One RPC method owns the handoff; the slash command builds
 * the intent and calls it once through the local subclient, so fixes land in
 * one module. The command executor returns void by host contract, so the
 * pointer comes back as a queued synthetic receipt in the source session.
 */
export default Plugin.define({
  id: "handoff",
  effect: (ctx) =>
    Effect.gen(function* () {
      const live = HandoffLive.pipe(
        Layer.provide(Layer.mergeAll(CaptureLive, RenderLive)),
        Layer.provide(
          Layer.mergeAll(Host.SessionLive(ctx.session), Host.StorageLive(ctx.storage), Host.FileWriterLive),
        ),
      )

      yield* ctx.rpc.register(Handoff, {
        transfer: (input, context) =>
          Effect.gen(function* () {
            const handoff = yield* HandoffService
            return yield* handoff.transfer(input)
          }).pipe(
            Effect.provide(live),
            Effect.catchTags({
              CaptureFailed: (failure) =>
                Effect.fail(context.error("CaptureFailed", `capture failed for ${input.sessionID}`, failure)),
              RedactRefused: (failure) =>
                Effect.fail(
                  context.error(
                    "RedactRefused",
                    `redact refused: ${failure.cause.reason} at ${failure.cause.field}`,
                    failure,
                  ),
                ),
              RenderFailed: (failure) =>
                Effect.fail(context.error("RenderFailed", `render failed for ${input.sessionID}`, failure)),
            }),
          ),
      })

      yield* ctx.command.transform((editor) => {
        editor.add({
          name: "handoff",
          description: "Continue this work in a fresh session",
          execute: (invocation) =>
            Effect.gen(function* () {
              const handoff = ctx.rpc(Handoff)
              const pointer = yield* handoff.transfer({
                sessionID: invocation.sessionID,
                intent: {
                  goal: invocation.prompt.text.trim().slice(0, 280),
                  directive: "resume",
                  refs: [],
                  resume: { mode: "fork-local", delivery: invocation.delivery },
                },
              })
              yield* ctx.session.synthetic({
                sessionID: invocation.sessionID,
                text: receipt(pointer),
                description: "handoff",
                metadata: { handoff: pointer.key },
                delivery: "queue",
                resume: false,
              })
            }),
        })
      })
    }).pipe(Effect.orDie),
})
