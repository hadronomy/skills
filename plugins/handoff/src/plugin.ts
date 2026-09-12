import { Plugin } from "@opencode-ai/plugin/effect"
import type { CommandInvocation } from "@opencode-ai/plugin/effect/command"
import type { Agent } from "@opencode-ai/schema/agent"
import { Effect, Layer } from "effect"
import { Capture } from "./capture.js"
import { Command } from "./command.js"
import { Host } from "./host.js"
import { Receipt } from "./receipt.js"
import { Render } from "./render.js"
import type { TransferInput } from "./rpc.js"
import { announce, Handoff } from "./rpc.js"
import { Tools } from "./tool.js"
import { Transcript } from "./transcript.js"
import { Transfer } from "./transfer.js"

/**
 * Server plugin. One RPC method owns the handoff; the slash command and the
 * agent tool pull the same operation, so a handoff announces itself the same
 * way whoever started it. Nothing is written back into the source session:
 * the events carry the result, and a watching client reports it.
 */
export default Plugin.define({
  id: "handoff",
  effect: (ctx) =>
    Effect.gen(function* () {
      const live = Transfer.layer.pipe(
        Layer.provide(Layer.mergeAll(Capture.layer, Render.layer)),
        Layer.provide(
          Layer.mergeAll(
            Host.SessionLive(ctx.session),
            Host.StorageLive(ctx.storage),
            Host.SummarizerLive(ctx.generate),
            Host.FileWriterLive,
          ),
        ),
      )

      // Every trigger runs this, and only this announces, so no trigger can
      // drift into its own half of the behaviour. `registration` is read from
      // the closure because registering needs the handlers that need it; the
      // binding is in place long before any trigger can fire.
      const complete: Transfer.Complete = Effect.fn("Handoff.complete")(function* (
        input: TransferInput,
      ) {
        const transfer = yield* Transfer.Service
        // A lost event costs a watching client its report, never the work,
        // so emitting warns rather than fails on both paths below.
        const tell = (...event: Parameters<typeof registration.events.emit>) =>
          registration.events.emit(...event).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("handoff: the transfer did not announce", cause)),
          )
        const pointer = yield* transfer.transfer(input).pipe(
          Effect.tapError((failure) =>
            tell("failed", {
              sessionID: input.sessionID,
              goal: input.intent.goal,
              message: Receipt.failure(failure),
            })),
        )
        yield* tell(...announce(input, pointer))
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

      // The editor is synchronous by contract, so the agent list loads here
      // and the tool description is built from what this machine has.
      const installed = yield* ctx.agent.list().pipe(
        Effect.map((listed) => listed.data.filter((agent) => !agent.hidden)),
        Effect.catchCause((cause) =>
          Effect.logWarning("handoff: the agent list did not load", cause).pipe(
            Effect.as([] as ReadonlyArray<Agent.Info>),
          )),
      )

      yield* ctx.tool.transform((editor) => {
        Tools.register(editor, complete, installed)
      })

      yield* ctx.command.transform((editor) => {
        editor.add({
          name: "handoff",
          description: "Continue this work in a fresh session",
          execute: Effect.fn("Handoff.command")(function* (invocation: CommandInvocation) {
            // Anything vaguer belongs to /handoff-interview, not to flags.
            const text = invocation.prompt.text.trim()
            // Both reads only happen when the person typed nothing, and the
            // transfer re-reads the history anyway. Naming the work is worth
            // one extra read; a brief headed "Continue this session" is not.
            const named = text.length > 0
              ? { title: undefined, asked: undefined }
              : {
                title: (yield* ctx.session.get({ sessionID: invocation.sessionID })).title,
                asked: Transcript.lastUserText(
                  yield* ctx.session.context({ sessionID: invocation.sessionID }),
                ),
              }
            // `@reviewer` in the composer picks the agent, and an agent
            // carries its own model. Reusing that picker beats adding one.
            const mentioned = Command.chosenAgent(invocation.prompt.agents)
            const chosen = mentioned === undefined
              ? undefined
              : (yield* ctx.agent.list()).data.find((agent) => agent.name === mentioned)
            yield* complete({
              sessionID: invocation.sessionID,
              intent: {
                goal: Command.resolveGoal(text, named.title, named.asked),
                // Text is the only source a person states outright. A title
                // or an old message is the plugin reading the room.
                stated: text.length > 0,
                ...(chosen === undefined ? {} : { agent: chosen.id }),
                ...(chosen?.model === undefined ? {} : { model: chosen.model }),
                directive: "resume",
                refs: Command.collectRefs(invocation.prompt.files),
                skills: Command.collectSkills(invocation.prompt.skills),
                resume: {
                  mode: "fork-local",
                  boundary: { type: "through" },
                  delivery: invocation.delivery,
                  // Land in a session that waits. The composer and its model
                  // and agent pickers are right there, before anything runs.
                  start: false,
                },
              },
            })
          }),
        })
      })
    }).pipe(Effect.orDie),
})
