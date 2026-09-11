import { Plugin } from "@opencode-ai/plugin/tui"
import { Receipt } from "./receipt.js"
import { Handoff } from "./rpc.js"

/**
 * Terminal client plugin. The server completes the handoff; this puts the
 * person who asked for it into the session it made, rather than leaving them
 * in the one they were trying to leave.
 *
 * It adds no trigger of its own. `/handoff`, `/handoff-interview`, and an
 * HTTP caller all announce through the same two contract events, so this
 * follows every one of them and cannot drift from what the server did.
 */
export default Plugin.define({
  id: "handoff",
  setup: (context) => {
    const handoff = context.client.rpc(Handoff)

    // Only the client watching the source session follows the handoff. Any
    // other window is doing its own work and did not ask to be moved.
    const watching = (sessionID: string): boolean => {
      const route = context.ui.router.current()
      return route.type === "session" && route.sessionID === sessionID
    }

    const stop = [
      handoff.events.on("opened", (event) => {
        if (!watching(event.data.sessionID)) return
        // A tab both opens and focuses. Without tabs the router is the only
        // way through, and it replaces the view rather than adding to it.
        if (!context.ui.tabs.open(event.data.nextSessionID)) {
          context.ui.router.navigate({ type: "session", sessionID: event.data.nextSessionID })
        }
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
    ]

    return () => {
      for (const off of stop) off()
    }
  },
})
