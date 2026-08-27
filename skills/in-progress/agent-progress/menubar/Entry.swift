import AppKit

@main
@MainActor
struct AgentProgressApp {
    // NSApplication.delegate is weak, so the controller has to be owned here or
    // it deallocates the moment main() returns into the run loop.
    static let controller = Controller()

    static func main() {
        let app = NSApplication.shared
        app.delegate = controller
        app.setActivationPolicy(.accessory)   // menu bar only, no Dock icon
        app.run()
    }
}
