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

export * as Host from "./host.js"
