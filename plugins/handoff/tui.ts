// Terminal client entry. OpenCode resolves a local plugin directory to a
// root-level `tui` file and ignores the "exports" map, so this file mirrors
// `index.ts` for the TUI half. Keep it free of logic: the client plugin
// lives in ./src/tui.js.
export { default } from "./src/tui.js"
