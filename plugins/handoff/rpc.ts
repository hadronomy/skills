// Shared contract entry. Same reason as `tui.ts`: a local plugin directory
// resolves `rpc` as a root-level file, while a published install reaches the
// identical module through the "./rpc" export. Callers that must not load
// the implementation import this one.
export * from "./src/rpc.js"
