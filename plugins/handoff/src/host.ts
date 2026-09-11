import type { GenerateApi } from "@opencode-ai/client/effect/api"
import type { Model } from "@opencode-ai/schema/model"
import type { SessionDomain } from "@opencode-ai/plugin/effect/session"
import type { StorageDomain } from "@opencode-ai/plugin/effect/storage"
import { writeFile } from "node:fs/promises"
import * as os from "node:os"
import { Context, Effect, Layer } from "effect"

// One concept: the host boundary. Session access, durable JSON, and file
// writes travel together through every stage and every test, so they live
// together; the three tags stay separate because each names a narrow
// capability with its own test double.

/**
 * Session access the handoff needs. Mirrors the host domain slice so live
 * wiring is one `Layer.succeed` and tests swap the whole boundary.
 *
 * @category tags
 * @since 0.1.0
 */
export class SessionGateway extends Context.Service<
  SessionGateway,
  Pick<SessionDomain, "context" | "get" | "create" | "synthetic">
>()("@hadronomy/handoff/SessionGateway") {}

/**
 * Serves the session gateway from the host session domain.
 *
 * @category layers
 * @since 0.1.0
 */
export const SessionLive = (
  session: SessionDomain,
): Layer.Layer<SessionGateway> => Layer.succeed(SessionGateway, session)

/**
 * Plugin-scoped durable JSON the handoff needs. Values cross as
 * `Schema.Json`, so unserializable payloads fail at the gate, not at rest.
 *
 * @category tags
 * @since 0.1.0
 */
export class StorageGateway extends Context.Service<StorageGateway, StorageDomain>()(
  "@hadronomy/handoff/StorageGateway",
) {}

/**
 * Serves the storage gateway from the host storage domain.
 *
 * @category layers
 * @since 0.1.0
 */
export const StorageLive = (
  storage: StorageDomain,
): Layer.Layer<StorageGateway> => Layer.succeed(StorageGateway, storage)

/**
 * File writes for the export-file arm. The transfer envelope doubles as
 * `SessionImportInput`, so the file the user moves is importable as is.
 *
 * @category tags
 * @since 0.1.0
 */
export class FileWriter extends Context.Service<FileWriter, {
  readonly write: (path: string, data: string) => Effect.Effect<void, unknown>
  readonly tmpdir: () => string
}>()("@hadronomy/handoff/FileWriter") {}

/**
 * Serves the writer from node file primitives.
 *
 * @category layers
 * @since 0.1.0
 */
export const FileWriterLive: Layer.Layer<FileWriter> = Layer.succeed(FileWriter, {
  write: (path, data) => Effect.promise(() => writeFile(path, data, "utf8")),
  tmpdir: () => os.tmpdir(),
})

/**
 * Condenses a transcript into a handover brief. One capability, one call, so
 * a test swaps the model for a fixed string.
 *
 * @category tags
 * @since 0.5.0
 */
export class Summarizer extends Context.Service<Summarizer, {
  readonly condense: (
    transcript: string,
    model: Model.Ref | undefined,
  ) => Effect.Effect<string, unknown>
}>()("@hadronomy/handoff/Summarizer") {}

// Written for a reader that has no history and cannot ask a question. It
// names the four things a next agent needs before it can touch anything.
const PROMPT = [
  "Condense the session below into a handover brief for another agent.",
  "The agent starts with no history and cannot ask the previous one.",
  "",
  "Cover, in this order:",
  "- What the work is.",
  "- What is done already.",
  "- What remains, as concrete next steps.",
  "- Any decision the next agent must not undo, and why.",
  "",
  "Write at most 250 words of plain sentences. Write no heading, no",
  "greeting, and no closing line. Name real files, commands, and",
  "identifiers exactly as the session wrote them.",
  "",
  "Session:",
].join("\n")

/**
 * Serves the summarizer from the host generate API. The call runs without a
 * session, so it never touches the transcript it condenses.
 *
 * @category layers
 * @since 0.5.0
 */
export const SummarizerLive = (
  generate: GenerateApi<unknown>,
): Layer.Layer<Summarizer> =>
  Layer.succeed(Summarizer, {
    // The source session's own model writes the brief. Omitting it leaves
    // the host to pick a default, and it fails outright where no default
    // exists: "No model specified and no supported model is available".
    condense: (transcript, model) =>
      generate.text({
        prompt: `${PROMPT}\n${transcript}`,
        ...(model === undefined ? {} : { model }),
      }).pipe(Effect.map((result) => result.text.trim())),
  })

export * as Host from "./host.js"
