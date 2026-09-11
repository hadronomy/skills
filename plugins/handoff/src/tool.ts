import type { ToolEditor } from "@opencode-ai/plugin/effect/tool"
import { Tool } from "@opencode-ai/schema/tool"
import { Effect, Schema } from "effect"
import { Receipt } from "./receipt.js"
import { jsonSchema, Pointer, TransferInput } from "./rpc.js"
import type { Transfer } from "./transfer.js"

// The host shows a tool definition to a model, so it converts the shape to
// JSON Schema and refuses a Standard Schema adapter from a vendor it does
// not know. Generating both faces here keeps that conversion off the host,
// at the cost of decoding the input in this module rather than at the seam.
const input = jsonSchema(TransferInput)
const output = jsonSchema(Pointer)

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
    input,
    output,
    options: { namespace: "handoff", codemode: false },
    execute: (raw) =>
      Schema.decodeUnknownEffect(TransferInput)(raw).pipe(
        Effect.mapError((issue) => new Tool.Error({ message: `handoff rejected the input: ${issue}` })),
        Effect.flatMap((decoded) =>
          complete(decoded).pipe(
            Effect.mapError((failure) =>
              new Tool.Error({ message: `handoff stopped: ${Receipt.failure(failure)}` })),
          )),
        Effect.map((pointer) => ({ output: pointer })),
      ),
  })
}

// Singular `Tool` is taken by the host schema namespace in this file.
export * as Tools from "./tool.js"
