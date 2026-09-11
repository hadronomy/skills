import { Plugin } from "@opencode-ai/plugin/effect"
import type { CommandInvocation } from "@opencode-ai/plugin/effect/command"
import type { Session } from "@opencode-ai/schema/session"
import { Effect, Layer } from "effect"
import { Capture } from "./capture.js"
import { Command } from "./command.js"
import { Host } from "./host.js"
import { Receipt } from "./receipt.js"
import { Render } from "./render.js"
import type { TransferInput } from "./rpc.js"
import { announce, Handoff } from "./rpc.js"
import { Tools } from "./tool.js"
import { Transfer } from "./transfer.js"

/**
 * Server plugin. One RPC method owns the handoff; the slash command and the
 * agent tool pull the same operation, so a handoff announces itself the same
 * way whoever started it. The command executor returns void by host contract,
 * so the source session keeps a queued receipt instead of a return value.
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

      const post = (sessionID: Session.ID, text: string) =>
        ctx.session.synthetic({
          sessionID,
          text,
          description: "handoff",
          delivery: "queue",
          resume: false,
        })

      // Every trigger runs this, and only this announces, so no trigger can
      // drift into its own half of the behaviour. `registration` is read from
      // the closure because registering needs the handlers that need it; the
      // binding is in place long before any trigger can fire.
      const complete: Transfer.Complete = Effect.fn("Handoff.complete")(function* (input: TransferInput) {
        const transfer = yield* Transfer.Service
        const pointer = yield* transfer.transfer(input)
        // The handoff already landed. A lost event costs a watching client
        // its jump, never the work, so it warns rather than fails.
        yield* registration.events.emit(...announce(input, pointer)).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("handoff: the transfer did not announce", cause)),
        )
        return pointer
      }, Effect.provide(live))

      const registration = yield* ctx.rpc.register(Handoff, {
        transfer: (input, context) =>
          complete(input).pipe(
            Effect.catchTags({
              CaptureFailed: (failure) =>
                Effect.fail(context.error("CaptureFailed", Receipt.failure(failure), failure)),
              RenderFailed: (failure) =>
                Effect.fail(context.error("RenderFailed", Receipt.failure(failure), failure)),
            }),
          ),
      })

      yield* ctx.tool.transform((editor) => {
        Tools.register(editor, complete)
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
            // A capture over a long session takes seconds. The transcript
            // says so rather than sitting blank, and every path below closes
            // this line out with a receipt.
            yield* post(invocation.sessionID, "Handoff started, capturing history…")
            const pointer = yield* complete({
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
            }).pipe(
              Effect.tapError((failure) =>
                post(invocation.sessionID, `Handoff stopped: ${Receipt.failure(failure)}.`)),
            )
            yield* post(invocation.sessionID, Receipt.pointer(pointer))
          }),
        })
      })
    }).pipe(Effect.orDie),
})
