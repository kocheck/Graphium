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
            WorldView(document: document)
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
    @StateObject private var window = WindowReference()
    @State private var selection: Set<String> = []
    @State private var fitRequest: FitRequest?
    @State private var pauseLine = SystemMessages.pauseOverlay[0]

    var body: some View {
        let campaign = document.campaign
        let library = campaign.libraryIndex
        let map = campaign.activeMap
        let party = map.partyBounds(library: library)
        // Fog and hidden NPCs (CORE_SPEC §3.3); none in daylight.
        let vision = map.isDaylightMode ? [] : LineOfSight.polygons(of: map, library: library)
        let hidden =
            map.isDaylightMode
            ? Set<String>() : LineOfSight.hiddenNPCIDs(of: map, library: library, polygons: vision.map(\.polygon))
        let fog =
            map.isDaylightMode
            ? nil
            : FogState(
                bounds: LineOfSight.fogBounds(of: map), explored: map.exploredRegions.map(\.points), vision: vision)

        ZStack(alignment: .bottomTrailing) {
            MapCanvas(
                map: campaign.activeMap,
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
                measurement: document.broadcastMeasurement,
                fitRequest: fitRequest
            )
            // Stop showing the map entirely while paused so nothing leaks to the projector.
            .opacity(document.isPaused ? 0 : 1)

            if !document.isPaused {
                Button {
                    if let party { fitRequest = FitRequest(bounds: party) }
                } label: {
                    Label("Center on Party", systemImage: "person.3.fill")
                        .font(.title3.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .disabled(party == nil)
                .help(party == nil ? "No PC tokens on this map" : "Fit the view to every PC token")
                .padding(20)
            }

            if document.isPaused {
                PauseOverlay(line: pauseLine)
            }
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
