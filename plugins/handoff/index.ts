// Package root entry. OpenCode resolves a local plugin directory to a
// root-level entry file and ignores the "exports" map, so this file
// re-exports the implementation that lives in ./src/. Keep it free of
// logic: the plugin lives in ./src/plugin.js, the shared contract in
// ./src/rpc.js.
export { default } from "./src/index.js"
