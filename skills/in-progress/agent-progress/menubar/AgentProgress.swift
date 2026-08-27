// Menu-bar renderer for agent-progress.
//
// Harness-agnostic by design: Claude Code, Codex and OpenCode all get the same
// display, including their UI builds where there is no terminal and no
// status-line hook to attach to.
import AppKit
import MetalKit
import SwiftUI

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

    override func draw(_ dirty: NSRect) {
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
            track: vec(trackNS, alpha: 0.28),
            indeterminate: target == nil ? 1 : 0,
            scale: Float(window?.backingScaleFactor ?? 2)
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

// MARK: - Dropdown

struct RunRow: View {
    let run: Run
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: run.isError ? "exclamationmark.triangle.fill"
                        : (run.status == "done" ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath"))
                    .foregroundStyle(run.isError ? .red : (run.status == "done" ? .green : .secondary))
                    .font(.system(size: 12, weight: .semibold))
                Text(run.name).font(.system(size: 13, weight: .medium))
                Spacer(minLength: 12)
                Text(run.percent.map { "\($0)%" } ?? "—")
                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            ProgressView(value: run.fraction ?? 0)
                .progressViewStyle(.linear)
                .tint(run.isError ? .red : .accentColor)
                .opacity(run.fraction == nil ? 0.45 : 1)
                .animation(.smooth(duration: 0.35), value: run.fraction)
            if let d = run.detail, !d.isEmpty {
                Text(d).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(.vertical, 6)
    }
}

struct PanelView: View {
    @ObservedObject var store: Store
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if store.runs.isEmpty {
                Text("No active runs")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
                    .padding(.vertical, 10)
            } else {
                ForEach(store.runs) { RunRow(run: $0) }
            }
            Divider().padding(.vertical, 4)
            Button("Quit") { NSApp.terminate(nil) }
                .buttonStyle(.plain)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(width: 280)
    }
}

// MARK: - App

@MainActor final class Controller: NSObject, NSApplicationDelegate, NSPopoverDelegate {
    private var item: NSStatusItem!
    private var capsule: CapsuleView!
    private var popover: NSPopover!
    private let store = Store()
    private var timer: Timer?

    private let idleWidth: CGFloat = 26
    private let barWidth: CGFloat = 56

    func applicationDidFinishLaunching(_ note: Notification) {
        item = NSStatusBar.system.statusItem(withLength: idleWidth)
        guard let button = item.button else { return }
        button.target = self
        button.action = #selector(toggle)

        capsule = CapsuleView()
        // Auto Layout inside an NSStatusItem button is unreliable: the button
        // has no useful bounds when constraints activate, so the view lands in
        // the top-left corner. Position it explicitly instead, against the
        // status bar's own thickness.
        capsule.autoresizingMask = []
        button.addSubview(capsule)
        layoutCapsule()

        popover = NSPopover()
        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = NSHostingController(rootView: PanelView(store: store))

        let t = Timer(timeInterval: 0.4, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
        refresh()
    }

    @objc private func toggle() {
        guard let button = item.button else { return }
        if popover.isShown { popover.performClose(nil) }
        else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }

    private func layoutCapsule() {
        guard let button = item.button else { return }
        let h = NSStatusBar.system.thickness            // menu bar height in points
        let width = max(button.bounds.width, item.length)
        let w: CGFloat = max(12, width - 16)
        let barH: CGFloat = 6
        capsule.frame = NSRect(x: ((width - w) / 2).rounded(),
                               y: ((h - barH) / 2).rounded(),
                               width: w, height: barH)
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

