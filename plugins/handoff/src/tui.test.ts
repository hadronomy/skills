import type { Plugin } from "@opencode-ai/plugin/tui"
import { describe, expect, it } from "vitest"
import plugin from "./tui.js"

// The host builds the client context inside its Solid tree, and `setup` runs
// outside it. Anything that reads a Solid context throws there, and a throw
// in `setup` costs the whole plugin, not one feature. This trap stands in for
// every such face: touching one fails the test the way the host failed.
const unreachable = (name: string) =>
  new Proxy({}, {
    get: (_target, key) => {
      throw new Error(`${name}.${String(key)} is not reachable from setup`)
    },
  })

interface Calls {
  readonly opened: Array<string>
  readonly navigated: Array<string>
  readonly toasts: Array<{ title?: string; message: string; variant?: string }>
}

const harness = (options: { route?: string; tabs?: boolean } = {}) => {
  const calls: Calls = { opened: [], navigated: [], toasts: [] }
  const handlers = new Map<string, (event: { data: Record<string, unknown> }) => void>()
  const disposed: Array<string> = []
  const context = {
    client: {
      rpc: () => ({
        events: {
          on: (name: string, handler: (event: { data: Record<string, unknown> }) => void) => {
            handlers.set(name, handler)
            return () => disposed.push(name)
          },
        },
      }),
    },
    data: unreachable("data"),
    keymap: unreachable("keymap"),
    storage: unreachable("storage"),
    renderer: unreachable("renderer"),
    ui: {
      router: {
        current: () => ({ type: "session", sessionID: options.route ?? "ses_src" }),
        navigate: (to: { sessionID: string }) => calls.navigated.push(to.sessionID),
      },
      tabs: {
        open: (sessionID: string) => {
          if (options.tabs === false) return false
          calls.opened.push(sessionID)
          return true
        },
      },
      toast: { show: (toast: Calls["toasts"][number]) => calls.toasts.push(toast) },
      format: { path: (value: string) => value },
    },
  }
  const cleanup = (plugin as Plugin.Definition).setup(context as never)
  return { calls, handlers, disposed, cleanup }
}

describe("client plugin setup", () => {
  it("touches no Solid-backed face, so the host can load it", () => {
    // Without this the plugin fails outright with "Keymap.Provider is missing".
    expect(() => harness()).not.toThrow()
  })

  it("subscribes to every contract event and unsubscribes on cleanup", async () => {
    const { handlers, disposed, cleanup } = harness()
    expect([...handlers.keys()].sort()).toEqual(["exported", "failed", "opened"])
    await (cleanup as () => void)()
    expect(disposed.sort()).toEqual(["exported", "failed", "opened"])
  })
})

describe("following a handoff", () => {
  const opened = { sessionID: "ses_src", nextSessionID: "ses_next", messages: 2 }

  it("opens the session the handoff made", () => {
    const { calls, handlers } = harness()
    handlers.get("opened")?.({ data: opened })
    expect(calls.opened).toEqual(["ses_next"])
    expect(calls.toasts[0]?.message).toBe("2 messages carried")
  })

  it("navigates when tabs are off", () => {
    const { calls, handlers } = harness({ tabs: false })
    handlers.get("opened")?.({ data: opened })
    expect(calls.navigated).toEqual(["ses_next"])
  })

  it("leaves a window that is watching something else alone", () => {
    const { calls, handlers } = harness({ route: "ses_other" })
    handlers.get("opened")?.({ data: opened })
    expect(calls.opened).toEqual([])
    expect(calls.navigated).toEqual([])
    expect(calls.toasts).toEqual([])
  })

  it("names the file for an export and opens nothing", () => {
    const { calls, handlers } = harness()
    handlers.get("exported")?.({ data: { sessionID: "ses_src", file: "/tmp/h.json" } })
    expect(calls.opened).toEqual([])
    expect(calls.toasts[0]?.message).toBe("/tmp/h.json")
  })

  it("reports a stopped handoff, which the command cannot report itself", () => {
    const { calls, handlers } = harness()
    handlers.get("failed")?.({ data: { sessionID: "ses_src", message: "the host refused a new session" } })
    expect(calls.toasts[0]).toEqual({
      title: "Handoff stopped",
      message: "the host refused a new session",
      variant: "error",
    })
  })
})
