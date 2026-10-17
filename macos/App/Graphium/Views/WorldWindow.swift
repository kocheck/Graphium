import AppKit
import GraphiumCore
import SwiftUI

/// The player-facing World View for one open campaign. It observes the same
/// CampaignDocument as the Architect window, so it updates live with no sync layer.
/// Opening it again for the same campaign focuses the existing window.
struct WorldWindow: View {
    static let id = "world-view"

    let sessionID: UUID?

    var body: some View {
        if let sessionID, let document = DocumentRegistry.shared.document(for: sessionID) {
            WorldView(document: document, liveDrag: document.liveDrag)
        } else {
            ContentUnavailableView(
                "No Campaign",
                systemImage: "map",
                description: Text("Open a campaign, then choose World View."))
        }
    }
}

private struct WorldView: View {
    @ObservedObject var document: CampaignDocument
    @ObservedObject var liveDrag: LiveDragModel
    /// Raycasting reruns only when tokens, walls, doors or daylight change.
    @State private var visibilityCache = VisibilityCache()
    @StateObject private var window = WindowReference()
    @State private var selection: Set<String> = []
    @State private var fitRequest: FitRequest?
    @State private var pauseLine = SystemMessages.pauseOverlay[0]
    /// This window owns the campaign's Session Console audio.
    @StateObject private var audio = WorldAudioEngine()
    /// Held without observing, so camera moves only redraw the minimap.
    @State private var minimap = MinimapModel()
    /// Strokes render with the DM's pressure settings so both windows match.
    @AppStorage(Prefs.pressureEnabled) private var pressureEnabled = true
    @AppStorage(Prefs.pressureCurve) private var pressureCurveRaw = PressureCurve.normal.rawValue

    var body: some View {
        let campaign = document.campaign
        let library = campaign.libraryIndex
        var map = campaign.activeMap
        // The DM's in-progress drag, so fog and NPC visibility follow it live.
        if !liveDrag.positions.isEmpty {
            for i in map.tokens.indices {
                if let p = liveDrag.positions[map.tokens[i].id] {
                    map.tokens[i].x = p.x
                    map.tokens[i].y = p.y
                }
            }
        }
        let party = map.partyBounds(library: library)
        // Fog and hidden NPCs (CORE_SPEC §3.3); none in daylight.
        let visibility = visibilityCache.visibility(of: map, library: library)
        let vision = visibility.vision
        let hidden = visibility.hiddenNPCIDs
        let fog =
            map.isDaylightMode
            ? nil
            : FogState(
                bounds: LineOfSight.fogBounds(of: map), explored: map.exploredRegions.map(\.points), vision: vision)

        ZStack(alignment: .bottomTrailing) {
            MapCanvas(
                map: map,
                library: library,
                imageProvider: { [document] name in document.imageCache.image(named: name, in: document.assets) },
                selection: selection,
                // Players may select and move tokens; nothing else (PARITY §4.2).
                editing: CanvasEditing(
                    setSelection: { selection = $0 },
                    dropTokens: { ids, primary, dx, dy, _ in
                        document.playerMoveTokens(ids, primary: primary, dx: dx, dy: dy)
                    },
                    allowsDuplicate: false),
                hiddenTokenIDs: hidden,
                fog: fog,
                isPlayerView: true,
                toolState: ToolState(
                    pressureCurve: PressureCurve(rawValue: pressureCurveRaw) ?? .normal, pressureEnabled: pressureEnabled),
                measurement: document.broadcastMeasurement,
                fitRequest: fitRequest,
                onViewportChange: { [minimap] viewport, size in
                    minimap.viewport = viewport
                    minimap.viewSize = size
                },
                assetNamespace: document.sessionID.uuidString
            )
            // Stop showing the map entirely while paused so nothing leaks to the projector.
            .opacity(document.isPaused ? 0 : 1)

            if !document.isPaused {
                Minimap(map: map, library: library, model: minimap) { point in
                    // Same zoom, centred on the clicked point.
                    let v = minimap.viewport
                    let w = minimap.viewSize.width / v.zoom
                    let h = minimap.viewSize.height / v.zoom
                    fitRequest = FitRequest(bounds: Bounds(x: point.x - w / 2, y: point.y - h / 2, width: w, height: h))
                }
                .padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)

                Button {
                    if let party { fitRequest = FitRequest(bounds: party) }
                } label: {
                    Label("Center on Party", systemImage: "person.3.fill")
                        .font(.system(size: 18, weight: .semibold))  // projector legibility: ≥18 px (PARITY §4.1)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0, green: 0x33 / 255, blue: 0x62 / 255))  // World View accent (TS #003362)
                .disabled(party == nil)
                .help(party == nil ? "No PC tokens on this map" : "Fit the view to every PC token")
                .padding(20)
            }

            // Session Console plate covers the map (and Center on Party) while shown.
            WorldStageView(
                runtime: document.sessionRuntime,
                imageProvider: { [document] name in document.imageCache.image(named: name, in: document.assets) })

            if document.isPaused {
                PauseOverlay(line: pauseLine)
            }

            HiddenWebView(webView: audio.youtube.webView)
                .frame(width: 2, height: 2)
                .opacity(0.01)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .background(WindowAccessor(reference: window))
        .navigationTitle("World View — \(campaign.name)")
        .toolbar {
            ToolbarItem {
                Menu {
                    ForEach(NSScreen.screens, id: \.self) { screen in
                        Button(screen.localizedName) { window.present(on: screen) }
                    }
                } label: {
                    Label("Show on Display", systemImage: "rectangle.on.rectangle")
                }
                .help("Move the World View to a display and make it full screen")
            }
        }
        .onChange(of: document.isPaused) { _, paused in
            if paused { pauseLine = SystemMessages.pauseOverlay.randomElement() ?? pauseLine }
        }
        .onChange(of: campaign.activeMapID) { _, _ in selection = [] }
        .onChange(of: document.sessionRuntime) { _, runtime in audio.apply(runtime, assets: document.assets) }
        .onChange(of: audio.lastError) { _, message in document.audioError = message }
        .onAppear {
            document.worldViewsOpen += 1
            audio.apply(document.sessionRuntime, assets: document.assets)
        }
        .onDisappear { document.worldViewsOpen -= 1 }
    }
}

/// PARITY §4.4: black, spinner, "Please Wait", and a flavour line. Sized for a projector.
private struct PauseOverlay: View {
    let line: String

    var body: some View {
        ZStack {
            Color.black.opacity(0.9)
            VStack(spacing: 20) {
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
                Text("Please Wait")
                    .font(.system(size: 40, weight: .bold))
                Text(line)
                    .font(.system(size: 22))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
            .foregroundStyle(.white)
        }
        .ignoresSafeArea()
        .accessibilityElement(children: .combine)
    }
}

/// Holds the hosting NSWindow so the World View can move itself between displays.
@MainActor
final class WindowReference: ObservableObject {
    weak var window: NSWindow?

    /// Moves to `screen` and enters full screen there (leaving full screen first if needed).
    func present(on screen: NSScreen) {
        guard let window else { return }
        let moveAndFill = {
            window.setFrame(screen.visibleFrame, display: true)
            if !window.styleMask.contains(.fullScreen) { window.toggleFullScreen(nil) }
        }
        if window.styleMask.contains(.fullScreen) {
            window.toggleFullScreen(nil)
            // Leaving full screen animates; move once it has finished.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { moveAndFill() }
        } else {
            moveAndFill()
        }
    }
}

struct WindowAccessor: NSViewRepresentable {
    let reference: WindowReference

    func makeNSView(context: Context) -> NSView { NSView() }

    func updateNSView(_ view: NSView, context: Context) {
        DispatchQueue.main.async { [weak view] in
            if let window = view?.window { reference.window = window }
        }
    }
}
