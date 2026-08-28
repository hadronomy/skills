// Menu-bar renderer for agent-progress.
//
// Harness-agnostic by design: Claude Code, Codex and OpenCode all get the same
// display, including their UI builds where there is no terminal and no
// status-line hook to attach to.
import AppKit
import MetalKit

// MARK: - Model

struct Run: Decodable, Identifiable {
    let name: String
    let percent: Int?
    let detail: String?
    let status: String
    let started: Double
    let updated: Double
    var id: String { name }
    var fraction: Double? { percent.map { Double($0) / 100.0 } }
    var isError: Bool { status == "error" }
}

@MainActor final class Store: ObservableObject {
    @Published private(set) var runs: [Run] = []
    private let dir: URL

    init() {
        let env = ProcessInfo.processInfo.environment
        if let override = env["AGENT_PROGRESS_DIR"] {
            dir = URL(fileURLWithPath: override)
        } else {
            let base = env["XDG_STATE_HOME"].map { URL(fileURLWithPath: $0) }
                ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/state")
            dir = base.appendingPathComponent("agent-progress")
        }
    }

    func reload() {
        let now = Date().timeIntervalSince1970
        let found = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil))?
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(Run.self, from: Data(contentsOf: $0)) }
            // A runner killed before cleanup leaves its file behind; a frozen
            // bar is worse than none.
            .filter { now - $0.updated < 300 }
            .sorted { $0.started < $1.started } ?? []
        if found != runs { runs = found }
    }
}

extension Run: Equatable {
    static func == (a: Run, b: Run) -> Bool {
        a.name == b.name && a.percent == b.percent && a.detail == b.detail
            && a.status == b.status && a.updated == b.updated
    }
}

// MARK: - Metal capsule

private struct Uniforms {
    var size: SIMD2<Float>
    var progress: Float
    var time: Float
    var accent: SIMD4<Float>
    var track: SIMD4<Float>
    var indeterminate: Float
    var scale: Float
    var inset: Float
    var barHeight: Float
}

final class CapsuleView: MTKView {
    /// Where the bar is heading. The drawn value chases it, so a jump from
    /// 4% to 58% reads as motion rather than a teleport.
    var target: Double? = nil { didSet { wake() } }
    var isError = false
    private var shown: Double = 0
    private var pipeline: MTLRenderPipelineState?
    private var queue: MTLCommandQueue?
    private var start = CACurrentMediaTime()
    private var idleSince: CFTimeInterval?

    init() {
        super.init(frame: .zero, device: MTLCreateSystemDefaultDevice())
        wantsLayer = true
        layer?.isOpaque = false
        clearColor = MTLClearColorMake(0, 0, 0, 0)
        framebufferOnly = true
        enableSetNeedsDisplay = false
        isPaused = false
        preferredFramesPerSecond = 60
        guard let device else { return }
        queue = device.makeCommandQueue()
        do {
            let lib = try device.makeLibrary(source: shaderSource, options: nil)
            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction = lib.makeFunction(name: "v_main")
            desc.fragmentFunction = lib.makeFunction(name: "f_main")
            desc.colorAttachments[0].pixelFormat = colorPixelFormat
            // Premultiplied: the shader multiplies rgb by coverage already.
            desc.colorAttachments[0].isBlendingEnabled = true
            desc.colorAttachments[0].sourceRGBBlendFactor = .one
            desc.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
            desc.colorAttachments[0].sourceAlphaBlendFactor = .one
            desc.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha
            pipeline = try device.makeRenderPipelineState(descriptor: desc)
        } catch {
            NSLog("agent-progress: shader build failed: \(error)")
        }
    }
    required init(coder: NSCoder) { fatalError() }

    private func wake() { idleSince = nil; isPaused = false }

    /// Capsule height as a share of the item height, clamped so it stays a bar
    /// rather than a sliver or a slab on an unusual menu bar.
    private var barHeight: CGFloat { min(10, max(4, (bounds.height * 0.27).rounded())) }
    /// Horizontal padding, tied to the same measure so the shape stays in
    /// proportion at any size.
    private var inset: CGFloat { min(14, max(4, (bounds.height * 0.36).rounded())) }

    override func draw(_ dirty: NSRect) {
        // Match the host button here rather than trusting a notification.
        // The item's height settles a few frames after it first appears, and
        // anything that reacts later draws the capsule centred against a box
        // that is about to change -- which is visible as the bar starting high
        // and dropping into place.
        if let host = superview, frame != host.bounds { frame = host.bounds }

        // Until the size is real, drawing would centre against a placeholder.
        guard bounds.height >= 8, bounds.width >= 12 else { return }
        guard let pipeline, let queue,
              let pass = currentRenderPassDescriptor,
              let drawable = currentDrawable,
              let buf = queue.makeCommandBuffer(),
              let enc = buf.makeRenderCommandEncoder(descriptor: pass) else { return }

        // Critically damped chase: fast enough to feel immediate, slow enough
        // that the eye tracks the movement.
        let goal = target ?? shown
        let delta = goal - shown
        shown += delta * 0.18
        if abs(delta) < 0.0005 { shown = goal }

        var accentNS = (isError ? NSColor.systemRed : NSColor.controlAccentColor)
        var trackNS = NSColor.tertiaryLabelColor
        accentNS = accentNS.usingColorSpace(.sRGB) ?? accentNS
        trackNS = trackNS.usingColorSpace(.sRGB) ?? trackNS

        func vec(_ c: NSColor, alpha: CGFloat) -> SIMD4<Float> {
            SIMD4(Float(c.redComponent), Float(c.greenComponent), Float(c.blueComponent), Float(alpha))
        }

        var u = Uniforms(
            size: SIMD2(Float(bounds.width), Float(bounds.height)),
            progress: Float(max(0, min(1, shown))),
            time: Float(CACurrentMediaTime() - start),
            accent: vec(accentNS, alpha: 1.0),
            track: vec(trackNS, alpha: 0.35),
            indeterminate: target == nil ? 1 : 0,
            scale: Float(window?.backingScaleFactor ?? 2),
            inset: Float(inset),
            barHeight: Float(barHeight)
        )
        enc.setRenderPipelineState(pipeline)
        enc.setFragmentBytes(&u, length: MemoryLayout<Uniforms>.stride, index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        enc.endEncoding()
        buf.present(drawable)
        buf.commit()

        // Stop drawing once settled and nothing is animating, so an idle
        // machine spends no GPU on a static bar.
        let animating = (target == nil) || abs(delta) > 0.0005
        if animating { idleSince = nil }
        else if let since = idleSince, CACurrentMediaTime() - since > 1.2 { isPaused = true }
        else if idleSince == nil { idleSince = CACurrentMediaTime() }
    }
}

// MARK: - Menu row
//
// An NSMenu, not an NSPopover. A popover carries an arrow and its own chrome,
// which is why this looked unlike every other menu bar app, and it needs the
// app to take key window -- expensive for an accessory app, and the source of
// the lag on every click. A menu opens through AppKit with no activation.

final class RunRowView: NSView {
    private let title = NSTextField(labelWithString: "")
    private let percent = NSTextField(labelWithString: "")
    private let detail = NSTextField(labelWithString: "")
    private let bar = NSProgressIndicator()

    init(width: CGFloat) {
        super.init(frame: NSRect(x: 0, y: 0, width: width, height: 52))
        let inset: CGFloat = 14

        title.font = .systemFont(ofSize: 13, weight: .medium)
        percent.font = .monospacedDigitSystemFont(ofSize: 12, weight: .semibold)
        percent.textColor = .secondaryLabelColor
        percent.alignment = .right
        detail.font = .systemFont(ofSize: 11)
        detail.textColor = .secondaryLabelColor
        detail.lineBreakMode = .byTruncatingTail

        bar.style = .bar
        bar.minValue = 0
        bar.maxValue = 1
        bar.controlSize = .small
        bar.usesThreadedAnimation = true

        for v in [title, percent, detail, bar] {
            v.translatesAutoresizingMaskIntoConstraints = false
            addSubview(v)
        }
        NSLayoutConstraint.activate([
            title.leadingAnchor.constraint(equalTo: leadingAnchor, constant: inset),
            title.topAnchor.constraint(equalTo: topAnchor, constant: 7),
            percent.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -inset),
            percent.firstBaselineAnchor.constraint(equalTo: title.firstBaselineAnchor),
            percent.leadingAnchor.constraint(greaterThanOrEqualTo: title.trailingAnchor, constant: 8),

            bar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: inset),
            bar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -inset),
            bar.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 6),

            detail.leadingAnchor.constraint(equalTo: leadingAnchor, constant: inset),
            detail.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -inset),
            detail.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 5),
        ])
    }
    required init?(coder: NSCoder) { fatalError() }

    func apply(_ run: Run) {
        title.stringValue = run.name
        percent.stringValue = run.percent.map { "\($0)%" } ?? "—"
        let d = run.detail ?? ""
        detail.stringValue = d.isEmpty ? run.status : d
        if let f = run.fraction {
            if bar.isIndeterminate { bar.stopAnimation(nil); bar.isIndeterminate = false }
            bar.doubleValue = f
        } else if !bar.isIndeterminate {
            bar.isIndeterminate = true
            bar.startAnimation(nil)
        }
    }
}

// MARK: - App

@MainActor final class Controller: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var item: NSStatusItem!
    private var capsule: CapsuleView!
    private let menu = NSMenu()
    private let store = Store()
    private var timer: Timer?

    private let idleWidth: CGFloat = 26
    private let barWidth: CGFloat = 56

    func applicationDidFinishLaunching(_ note: Notification) {
        item = NSStatusBar.system.statusItem(withLength: idleWidth)
        guard let button = item.button else { return }

        capsule = CapsuleView()
        // Auto Layout inside an NSStatusItem button is unreliable: the button
        // has no useful bounds when constraints activate, so the view lands in
        // the top-left corner. Position it explicitly instead, against the
        // status bar's own thickness.
        capsule.autoresizingMask = [.width, .height]
        button.addSubview(capsule)
        // The item resizes when a run starts and when the menu bar changes.
        // Without this the capsule keeps a stale size until the next poll,
        // which shows as the bar jumping into place a second after it appears.
        button.postsFrameChangedNotifications = true
        NotificationCenter.default.addObserver(
            forName: NSView.frameDidChangeNotification, object: button, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.layoutCapsule() }
        }
        layoutCapsule()

        // Handing the menu to the status item lets AppKit open it directly.
        // Routing through a button action costs a click-to-open delay.
        menu.delegate = self
        item.menu = menu

        let t = Timer(timeInterval: 0.4, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
        refresh()
    }

    // Built only as the menu opens, rather than kept in sync on every tick.
    func menuNeedsUpdate(_ menu: NSMenu) {
        store.reload()
        menu.removeAllItems()
        let width: CGFloat = 280

        if store.runs.isEmpty {
            let empty = NSMenuItem(title: "No active runs", action: nil, keyEquivalent: "")
            empty.isEnabled = false
            menu.addItem(empty)
        } else {
            for run in store.runs {
                let row = NSMenuItem()
                let view = RunRowView(width: width)
                view.apply(run)
                row.view = view
                menu.addItem(row)
            }
        }
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit AgentProgress",
                     action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    }

    private func layoutCapsule() {
        guard let button = item.button else { return }
        // Mirror the button exactly. The shader derives the capsule from this
        // view's own size, so whatever height the menu bar happens to be, the
        // bar lands in its middle. Never substitute a guessed height here: a
        // wrong one centres the capsule against the wrong box.
        capsule.frame = button.bounds
    }

    private func refresh() {
        store.reload()
        let active = store.runs.first { $0.status == "running" } ?? store.runs.last
        guard let button = item.button else { return }

        if let active {
            if item.length != barWidth { item.length = barWidth }
            layoutCapsule()
            capsule.isHidden = false
            button.image = nil
            capsule.isError = active.isError
            capsule.target = active.fraction
        } else {
            if item.length != idleWidth { item.length = idleWidth }
            capsule.isHidden = true
            let cfg = NSImage.SymbolConfiguration(pointSize: 12, weight: .regular)
            button.image = NSImage(systemSymbolName: "circle.dotted",
                                   accessibilityDescription: "no active runs")?
                .withSymbolConfiguration(cfg)
            button.image?.isTemplate = true
        }
    }
}

