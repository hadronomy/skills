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
 * What the summarizer needs to write one handover.
 *
 * The purpose travels with the transcript. A handover written for a stated
 * goal carries what that work needs. One written for a guess stays even,
 * rather than narrow onto a label nobody chose.
 *
 * @category models
 * @since 0.8.0
 */
export interface CondenseRequest {
  readonly transcript: string
  /** What the next session is for. */
  readonly goal: string
  /** Whether a person named that purpose, or the plugin read it off the session. */
  readonly stated: boolean
  /** Artifacts the brief already lists, so the handover points instead of retelling. */
  readonly artifacts: ReadonlyArray<string>
  readonly model: Model.Ref | undefined
}

/**
 * Condenses a transcript into a handover. One capability, one call, so a test
 * swaps the model for a fixed string.
 *
 * @category tags
 * @since 0.5.0
 */
export class Summarizer extends Context.Service<Summarizer, {
  readonly condense: (request: CondenseRequest) => Effect.Effect<string, unknown>
}>()("@hadronomy/handoff/Summarizer") {}

// The summarizer reads this, so it is written the way an agent document is
// written: the target behaviour stated outright, and the shape named rather
// than banned. A ban spends attention on the thing it forbids, and `structured`
// in render.ts already refuses an answer that comes back as a form.
//
// The instruction sits after the transcript. A long body pushes an opening
// instruction out of reach, and a model answers the last thing it reads.
const PROMPT = [
  "Write the handover the next agent reads to continue this work.",
  "It starts with no history.",
  "",
  "Write two paragraphs of plain prose. Use at most six sentences in each.",
  "The first paragraph says where the work stands. Give what is done, what",
  "must stay decided, and what is still broken.",
  "The second paragraph says what to do next, in the order to do it.",
  "",
  "Name every file, command, identifier, and number exactly as the session",
  "wrote it. Point at an artifact by its path or its URL. Leave what it holds",
  "for the next agent to read there.",
  "",
  "Keep credentials, tokens, and private data out. This text becomes the",
  "first prompt of another session.",
  "",
  "Answer with the two paragraphs alone.",
].join("\n")

// A stated goal earns a handover written for it. An inferred one is the plugin
// reading the room, and writing hard to a guess covers the wrong half of the
// session.
const purpose = (request: CondenseRequest): ReadonlyArray<string> =>
  request.stated
    ? [
      "",
      `The next session exists to: ${request.goal}`,
      "Write for that work. Carry what it needs in full.",
    ]
    : [
      "",
      "Nobody named what the next session is for.",
      `"${request.goal}" is read off the session, not asked for.`,
      "Cover the whole session evenly.",
    ]

const pointers = (request: CondenseRequest): ReadonlyArray<string> =>
  request.artifacts.length === 0 ? [] : [
    "",
    `The brief lists these artifacts: ${request.artifacts.join(", ")}`,
    "Refer to each by name alone. The next agent opens them.",
  ]

// The transcript is fenced. A session full of prompts and shell output reads
// like instruction, so the markers say which part is the work.
const ask = (request: CondenseRequest): string => [
  "A session transcript follows, between the two markers.",
  "",
  "--- transcript starts ---",
  request.transcript,
  "--- transcript ends ---",
  "",
  PROMPT,
  ...purpose(request),
  ...pointers(request),
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
    condense: (request) =>
      generate.text({
        prompt: ask(request),
        ...(request.model === undefined ? {} : { model: request.model }),
      }).pipe(Effect.map((result) => result.text.trim())),
  })

export * as Host from "./host.js"
