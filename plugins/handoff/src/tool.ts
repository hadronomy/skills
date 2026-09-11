import type { ToolEditor } from "@opencode-ai/plugin/effect/tool"
import { Tool } from "@opencode-ai/schema/tool"
import { Effect } from "effect"
import { Receipt } from "./receipt.js"
import { PointerPortable, TransferInputPortable } from "./rpc.js"
import type { Transfer } from "./transfer.js"

/**
 * Agent-callable transfer. Use when the user asks to continue, move, or
 * resume the current work in a fresh session or on another machine. Fill
 * the goal from the conversation; refs take `{ kind, ref }` with kinds
 * spec, plan, adr, issue, commit, file; skills take invoked skill IDs.
 * Omit `resume` for fork-local defaults (steer delivery, whole session);
 * name `export-file` with an optional directory for cross-machine moves.
 * Omit agent and model to carry both over from the source session.
 *
 * Takes the same `Complete` the slash command and the RPC handler take, so
 * a handoff a model starts announces itself exactly like one a person typed
 * and a watching client follows both.
 *
 * @category combinators
 * @since 0.2.0
 */
export const register = (editor: ToolEditor, complete: Transfer.Complete): void => {
  editor.namespace({ name: "handoff", description: "Session handoff operations" })
  editor.add({
    name: "transfer",
    description:
      "Complete a session handoff from a structured intent and return a resumable pointer.",
    input: TransferInputPortable,
    output: PointerPortable,
    options: { namespace: "handoff", codemode: false },
    execute: (input) =>
      complete(input).pipe(
        Effect.map((output) => ({ output })),
        Effect.mapError((failure) =>
          new Tool.Error({ message: `handoff stopped: ${Receipt.failure(failure)}` })),
      ),
  })
}

// Singular `Tool` is taken by the host schema namespace in this file.
export * as Tools from "./tool.js"
