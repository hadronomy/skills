import { Plugin } from "@opencode-ai/plugin/effect"
import type { CommandInvocation } from "@opencode-ai/plugin/effect/command"
import { Effect, Layer, Match } from "effect"
import { Capture } from "./capture.js"
import { Command } from "./command.js"
import { Render } from "./render.js"
import { Handoff } from "./rpc.js"
import { Host } from "./host.js"
import { Tools } from "./tool.js"
import { Transfer } from "./transfer.js"
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
      const live = Transfer.layer.pipe(
        Layer.provide(Layer.mergeAll(Capture.layer, Render.layer)),
        Layer.provide(
          Layer.mergeAll(Host.SessionLive(ctx.session), Host.StorageLive(ctx.storage), Host.FileWriterLive),
        ),
      )

      yield* ctx.rpc.register(Handoff, {
        transfer: (input, context) =>
          Effect.gen(function* () {
            const handoff = yield* Transfer.Service
            return yield* handoff.transfer(input)
          }).pipe(
            Effect.provide(live),
            Effect.catchTags({
              CaptureFailed: (failure) =>
                Effect.fail(context.error("CaptureFailed", `capture failed for ${input.sessionID}`, failure)),
              RenderFailed: (failure) =>
                Effect.fail(context.error("RenderFailed", `render failed for ${input.sessionID}`, failure)),
            }),
          ),
      })

      yield* ctx.tool.transform((editor) => {
        Tools.register(editor, live)
      })

      yield* ctx.command.transform((editor) => {
        editor.add({
          name: "handoff",
          description: "Continue this work in a fresh session",
          execute: Effect.fn("Handoff.command")(function* (invocation: CommandInvocation) {
            // Anything vaguer belongs to /handoff-interview, not to flags.
            const text = invocation.prompt.text.trim()
            const title = text.length > 0
              ? undefined
              : (yield* ctx.session.get({ sessionID: invocation.sessionID })).title
            const handoff = ctx.rpc(Handoff)
            const pointer = yield* handoff.transfer({
              sessionID: invocation.sessionID,
              intent: {
                goal: Command.resolveGoal(text, title),
                directive: "resume",
                refs: Command.collectRefs(invocation.prompt.files),
                skills: Command.collectSkills(invocation.prompt.skills),
                resume: {
                  mode: "fork-local",
                  boundary: { type: "through" },
                  delivery: invocation.delivery,
                  resume: true,
                },
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
