import type { ToolEditor } from "@opencode-ai/plugin/effect/tool"
import { Tool } from "@opencode-ai/schema/tool"
import { Effect, Layer } from "effect"
import { Pointer, TransferInput } from "./rpc.js"
import { Transfer } from "./transfer.js"

/**
 * Agent-callable transfer. Use when the user asks to continue, move, or
 * resume the current work in a fresh session or on another machine. Fill
 * the goal from the conversation; refs take `{ kind, ref }` with kinds
 * spec, plan, adr, issue, commit, file; skills take invoked skill IDs.
 * Omit `resume` for fork-local defaults (steer delivery, whole session);
 * name `export-file` with an optional directory for cross-machine moves.
 * Omit agent and model to carry both over from the source session. A
 * refusal names the offending field: report it and stop, never retry it.
 *
 * @category combinators
 * @since 0.2.0
 */
export const register = (
  editor: ToolEditor,
  live: Layer.Layer<Transfer.Service>,
): void => {
  editor.namespace({ name: "handoff", description: "Session handoff operations" })
  editor.add({
    name: "transfer",
    description:
      "Complete a session handoff from a structured intent and return a resumable pointer.",
    input: TransferInput,
    output: Pointer,
    options: { namespace: "handoff", codemode: false },
    execute: (input) =>
      Effect.gen(function* () {
        const handoff = yield* Transfer.Service
        return { output: yield* handoff.transfer(input) }
      }).pipe(
        Effect.provide(live),
        Effect.catchTags({
          CaptureFailed: () =>
            Effect.fail(new Tool.Error({ message: "capture failed: empty history or lost transport" })),
          RedactRefused: (failure) =>
            Effect.fail(
              new Tool.Error({
                message: `refused ${failure.cause.reason} at ${failure.cause.field}; clean the source and call again`,
              }),
            ),
          RenderFailed: () =>
            Effect.fail(
              new Tool.Error({ message: "render failed: stash, session, delivery, or file write failed" }),
            ),
        }),
      ),
  })
}

// Singular `Tool` is taken by the host schema namespace in this file.
export * as Tools from "./tool.js"
