// `@opencode-ai/plugin/tui` re-exports its Solid bindings, so importing the
// barrel pulls in `solid-js` — an optional peer this package does not carry.
// In a published install that throws before any of this runs. The deep path
// is the same `define` with no runtime imports at all.
import { define } from "@opencode-ai/plugin/tui/plugin"
import { Receipt } from "./receipt.js"
import { Handoff, sessionOfKey } from "./rpc.js"

/**
 * Terminal client plugin. The server completes the handoff; this puts the
 * person who asked for it into the session it made, rather than leaving them
 * in the one they were trying to leave.
 *
 * It adds no trigger of its own. `/handoff`, `/handoff-interview`, and an
 * HTTP caller all announce through the same contract events, so this follows
 * every one of them and cannot drift from what the server did.
 */
export default define({
  id: "handoff",
  setup: (context) => {
    const handoff = context.client.rpc(Handoff)

    // Only the client watching the source session follows the handoff. Any
    // other window is doing its own work and did not ask to be moved.
    const watching = (sessionID: string): boolean => {
      const route = context.ui.router.current()
      return route.type === "session" && route.sessionID === sessionID
    }

    // The brief stamps `metadata.handoff` with the stash key, and that key
    // embeds the session it came from. Reading it back beats keeping a map:
    // it works for a handoff any client started, and it survives a restart.
    const originOf = (sessionID: string): string | undefined => {
      const stamped = [
        ...context.data.session.message.list(sessionID),
        ...context.data.session.pending.list(sessionID).map((item) =>
          item.type === "synthetic" ? item.payload : undefined
        ),
      ]
      for (const record of stamped) {
        const key = record?.metadata?.["handoff"]
        if (typeof key !== "string") continue
        const source = sessionOfKey(key)
        if (source !== undefined) return source
      }
      return undefined
    }

    // Reads the origin of whatever session the person is looking at.
    const current = (): string | undefined => {
      const route = context.ui.router.current()
      return route.type === "session" ? originOf(route.sessionID) : undefined
    }

    const open = (sessionID: string) => {
      if (!context.ui.tabs.open(sessionID)) {
        context.ui.router.navigate({ type: "session", sessionID })
      }
    }

    context.keymap.layer(() => ({
      commands: [
        {
          id: "handoff.origin",
          title: "Go to the session this was handed off from",
          group: "Handoff",
          // Inert outside a handed-off session, so the binding stays free
          // everywhere it means nothing.
          enabled: () => current() !== undefined,
          bind: "<leader>h",
          palette: true,
          run: () => {
            const source = current()
            if (source === undefined) return false
            open(source)
          },
        },
      ],
    }))

    const stop = [
      handoff.events.on("opened", (event) => {
        if (!watching(event.data.sessionID)) return
        // A tab both opens and focuses. Without tabs the router is the only
        // way through, and it replaces the view rather than adding to it.
        open(event.data.nextSessionID)
        // The new session already carries the goal as its title, so the
        // toast says only what the title cannot: how much history came too.
        context.ui.toast.show({
          title: "Handed off",
          message: `${Receipt.messages(event.data.messages)} carried`,
          variant: "success",
        })
      }),
      handoff.events.on("exported", (event) => {
        if (!watching(event.data.sessionID)) return
        // Nothing to open: the file is the artifact, so name it and stop.
        context.ui.toast.show({
          title: "Handoff exported",
          message: context.ui.format.path(event.data.file),
          variant: "success",
        })
      }),
      handoff.events.on("failed", (event) => {
        if (!watching(event.data.sessionID)) return
        // Without this the slash command fails in silence: its executor
        // returns void, and nothing is written back into the session.
        context.ui.toast.show({
          title: "Handoff stopped",
          message: event.data.message,
          variant: "error",
        })
      }),
    ]

    return () => {
      for (const off of stop) off()
    }
  },
})
