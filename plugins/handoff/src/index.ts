// Package entry. Logic-free: the plugin lives in ./plugin.js, the shared
// contract in ./rpc.js. Deep paths stay internal.
export { default } from "./plugin.js"
export { Handoff } from "./rpc.js"
export type { PointerType } from "./rpc.js"
