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
                // So View > Pause World View (⇧⌘P) and the Session menu work with the projector window frontmost.
                .focusedSceneValue(\.campaignDocument, document)
        } else {
            OrphanedWindow(
                title: "No Campaign", systemImage: "map",
                description: "Open a campaign, then choose World View.")
        }
    }
}

/// Shown when a window's campaign is gone, e.g. one restored on relaunch: session
/// ids aren't saved, so it can never reconnect. It closes itself.
struct OrphanedWindow: View {
    let title: String
    let systemImage: String
    let description: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ContentUnavailableView(title, systemImage: systemImage, description: Text(description))
            .onAppear { dismiss() }
    }
}

private struct WorldView: View {
    @ObservedObject var document: CampaignDocument
    @ObservedObject var liveDrag: LiveDragModel
    /// Raycasting reruns only when tokens, walls, doors or daylight change.
    @State private var visibilityCache = VisibilityCache()
    @StateObject private var window = WindowReference()
    @State private var selection: Set<String> = []
    /// A player's own in-progress drag in this window, so fog and NPC hiding follow it live.
    @State private var playerDrag: [String: Point2D] = [:]
    @State private var fitRequest: FitRequest?
    @State private var pauseLine = SystemMessages.pauseOverlay[0]
    /// "Set Screen Size…": the diagonal being typed, nil when the sheet is closed.
    @State private var screenSizeText: String?
    @State private var scaleMessage: String?
    /// This window owns the campaign's Session Console audio.
    @StateObject private var audio = WorldAudioEngine()
    /// Held without observing, so camera moves only redraw the minimap.
    @State private var minimap = MinimapModel()
    /// Strokes render with the DM's pressure settings so both windows match.
    @AppStorage(Prefs.pressureEnabled) private var pressureEnabled = true
    @AppStorage(Prefs.pressureCurve) private var pressureCurveRaw = PressureCurve.normal.rawValue

    /// The active map with the DM's in-progress drag applied, so fog and NPC visibility follow it live.
    private func liveMap(_ campaign: Campaign) -> GameMap {
        var map = campaign.activeMap
        guard !liveDrag.positions.isEmpty else { return map }
        for i in map.tokens.indices {
            if let p = liveDrag.positions[map.tokens[i].id] {
                map.tokens[i].x = p.x
                map.tokens[i].y = p.y
            }
        }
        return map
    }

    var body: some View {
        let campaign = document.campaign
        let library = campaign.libraryIndex
        let map = liveMap(campaign)
        let party = map.partyBounds(library: library)
        // Fog and hidden NPCs (CORE_SPEC §3.3); none in daylight.
        // The canvas draws its own drag offset, so only vision sees the player's drag.
        let visibility = visibilityCache.visibility(of: map.withTokenPositions(playerDrag), library: library)
        let vision = visibility.vision
        let hidden = visibility.hiddenNPCIDs
        let fog =
            map.isDaylightMode
            ? nil
            : FogState(
                mapID: map.id, bounds: LineOfSight.fogBounds(of: map), explored: map.exploredRegions, vision: vision,
                lit: visibility.sight.lit, ambient: visibility.sight.ambient, hatchWalls: LineOfSight.hatchWalls(of: map),
                gridSize: map.gridSize, flames: Set(map.lights.filter(\.isFlame).map(\.id)))

        ZStack(alignment: .bottomTrailing) {
            MapCanvas(
                map: map,
                library: library,
                imageProvider: { [document] name in document.imageCache.image(named: name, in: document.assets) },
                selection: selection,
                // Players may select and move tokens and open shared note pins; nothing else (PARITY §4.2).
                editing: CanvasEditing(
                    setSelection: { selection = $0 },
                    // Players always take the stairs; only the DM can stop on them.
                    dropTokens: { ids, primary, dx, dy, _, _ in
                        document.playerMoveTokens(ids, primary: primary, dx: dx, dy: dy)
                    },
                    allowsDuplicate: false,
                    openNote: { document.worldNoteID = $0 },
                    dragPreview: { playerDrag = $0 ?? [:] }),
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
                assetNamespace: document.sessionID.uuidString,
                videoProvider: { [document] name, ready in
                    document.videoFiles.url(named: name, in: document.assets, ready: ready)
                },
                // Nothing plays to an empty projector.
                animationPaused: document.isMapAnimationPaused || document.isPaused,
                // Not drawn at all while paused, so nothing leaks or flashes on resume.
                isBlanked: document.isPaused
            )

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
                        .font(.system(size: 24, weight: .semibold))  // projector legibility: ≥24 pt (world-view-player-safe)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .tint(Palette.worldAction.color)  // World View accent (TS #003362)
                .disabled(party == nil)
                .help(party == nil ? "No PC tokens on this map" : "Fit the view to every PC token")
                .padding(20)

                // Turn order (decision 016): never a hidden NPC, only names players may read.
                let combatants = map.initiativeForPlayers(library: library, hiddenTokenIDs: hidden)
                if !combatants.isEmpty {
                    WorldInitiativeStrip(combatants: combatants)
                        .padding(20)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }

            // Session Console plate covers the map (and Center on Party) while shown.
            WorldStageView(
                runtime: document.sessionRuntime,
                imageProvider: { [document] name in document.imageCache.image(named: name, in: document.assets) })

            // A note the DM showed, or a shared pin a player opened: its player notes only.
            if !document.isPaused, let id = document.worldNoteID, let note = map.notes.first(where: { $0.id == id }) {
                WorldNoteCard(note: note) { document.worldNoteID = nil }
                    .padding(20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }

            HiddenWebView(webView: audio.youtube.webView)
                .frame(width: 2, height: 2)
                .opacity(0.01)
                .allowsHitTesting(false)
                .accessibilityHidden(true)

            // Last, so nothing (a plate the DM queues while paused included) draws over it.
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
            ToolbarItem {
                Menu {
                    Button("1-Inch Squares") { zoomToInchSquares(map: map) }
                    Button("Set Screen Size…") {
                        let saved = window.window?.screen.map(TableScreen.savedDiagonal) ?? 0
                        screenSizeText = saved > 0 ? String(format: "%g", saved) : ""
                    }
                } label: {
                    Label("Table Scale", systemImage: "ruler")
                } primaryAction: {
                    zoomToInchSquares(map: map)
                }
                .help("Zoom so each grid square is one inch on this screen, for miniatures on a flat TV")
            }
        }
        .alert(
            "Screen size",
            isPresented: Binding(get: { screenSizeText != nil }, set: { if !$0 { screenSizeText = nil } })
        ) {
            TextField("Diagonal in inches", text: Binding(get: { screenSizeText ?? "" }, set: { screenSizeText = $0 }))
            Button("Save") {
                if let screen = window.window?.screen {
                    TableScreen.saveDiagonal(Double(screenSizeText ?? "") ?? 0, for: screen)
                    zoomToInchSquares(map: map)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The TV's diagonal, as sold (for example 43). Leave empty to use the size the screen reports.")
        }
        .alert("Table Scale", isPresented: Binding(get: { scaleMessage != nil }, set: { if !$0 { scaleMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(scaleMessage ?? "")
        }
        .onChange(of: document.isPaused) { _, paused in
            if paused { pauseLine = SystemMessages.pauseOverlay.randomElement() ?? pauseLine }
        }
        .onChange(of: document.worldFrameRequest) { _, request in
            if let request { fitRequest = request }
        }
        .onChange(of: campaign.activeMapID) { _, _ in
            selection = []
            playerDrag = [:]
        }
        // Tokens that drop out of sight leave the selection, so a later drag can't carry them.
        .onChange(of: hidden) { _, now in selection.subtract(now) }
        .onChange(of: document.sessionRuntime) { _, runtime in audio.apply(runtime, assets: document.assets) }
        .onChange(of: audio.lastError) { _, message in document.audioError = message }
        .onAppear {
            document.worldViewsOpen += 1
            audio.apply(document.sessionRuntime, assets: document.assets)
        }
        .onDisappear {
            document.worldViewsOpen -= 1
            audio.shutdown()  // nothing may keep playing once the window is gone
        }
    }
}

/// A note's title and player notes on the World View (decision 011). Never its DM notes.
/// Projector-sized: 24 pt and up, `world-ink` on `world-scrim`.
private struct WorldNoteCard: View {
    let note: MapNote
    let close: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Label(note.displayTitle, systemImage: "text.bubble.fill")
                    .font(.system(size: 28, weight: .bold))
                    .lineLimit(2)
                Spacer(minLength: 12)
                Button(action: close) {
                    Label("Close", systemImage: "xmark")
                        .font(.system(size: 24, weight: .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .tint(Palette.worldAction.color)
                .keyboardShortcut(.cancelAction)
                .help("Close this note")
            }
            let text = note.playerNotes.trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty {
                ScrollView {
                    // Markdown, at projector size: 26 pt body, headings larger, nothing under 24 pt.
                    NoteMarkdownView(text: text, size: 26, ruleColor: Palette.worldRule.color, linksEnabled: false)
                        .textSelection(.disabled)
                }
                .frame(maxHeight: 420)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .foregroundStyle(Palette.worldInk.color)
        .padding(24)
        .frame(width: 560, alignment: .leading)
        .background(Palette.worldScrim.color, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Palette.worldRule.color, lineWidth: 2))
        .environment(\.colorScheme, .dark)
        .accessibilityElement(children: .contain)
    }
}

/// The initiative order for players (decision 016), on the etched plate the minimap uses but
/// with `world-scrim` behind the names for 7:1. Projector-sized: nothing under 24 pt. The current
/// combatant has a play glyph, bold type and a `world-action` band, so it reads without colour.
private struct WorldInitiativeStrip: View {
    let combatants: [PlayerInitiativeEntry]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Initiative")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(Palette.worldInkDim.color)
                .padding(.horizontal, 10)
                .accessibilityAddTraits(.isHeader)
            ForEach(combatants, id: \.tokenID) { combatant in
                HStack(spacing: 10) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 24, weight: .bold))
                        .opacity(combatant.isCurrent ? 1 : 0)
                    Text(combatant.name)
                        .font(.system(size: 26, weight: combatant.isCurrent ? .bold : .regular))
                        .lineLimit(1)
                }
                .foregroundStyle(combatant.isCurrent ? Palette.worldInk.color : Palette.worldInkDim.color)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    combatant.isCurrent ? Palette.worldAction.color : Color.clear,
                    in: RoundedRectangle(cornerRadius: Radius.panel))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(combatant.name))
                .accessibilityValue(combatant.isCurrent ? "Current turn" : "")
            }
        }
        .padding(12)
        // As wide as the longest name needs (so names aren't cut at a fixed width), within limits.
        .frame(minWidth: 240, maxWidth: 440, alignment: .leading)
        .fixedSize(horizontal: true, vertical: false)
        .background(Palette.worldScrim.color, in: RoundedRectangle(cornerRadius: Radius.panel))
        .overlay(RoundedRectangle(cornerRadius: Radius.panel).strokeBorder(Palette.worldRule.color, lineWidth: 2))
        .environment(\.colorScheme, .dark)
        .accessibilityElement(children: .contain)
    }
}

/// PARITY §4.4: black, spinner, "Please Wait", and a flavour line. Sized for a projector.
private struct PauseOverlay: View {
    let line: String

    var body: some View {
        ZStack {
            // world-scrim is translucent; the black under it keeps a plate or the map from
            // showing through to the projector.
            Color.black
            Palette.worldScrim.color
            VStack(spacing: 20) {
                ProgressView()
                    .controlSize(.large)
                    .tint(Palette.worldInk.color)
                Text("Please Wait")
                    .font(.system(size: 40, weight: .bold))
                Text(line)
                    .font(.system(size: 26))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
            .foregroundStyle(Palette.worldInk.color)
        }
        .environment(\.colorScheme, .dark)
        .ignoresSafeArea()
        .accessibilityElement(children: .combine)
    }
}

/// Holds the hosting NSWindow so the World View can move itself between displays.
@MainActor
extension WorldView {
    /// One grid square = one inch on the screen showing this window, centred where it is.
    fileprivate func zoomToInchSquares(map: GameMap) {
        guard let screen = window.window?.screen else { return }
        guard let ppi = TableScreen.pointsPerInch(of: screen) else {
            scaleMessage =
                "\(screen.localizedName) doesn't report its size. Choose Set Screen Size… and type its diagonal in inches."
            return
        }
        let size = minimap.viewSize
        guard size.width > 0, size.height > 0, let zoom = PhysicalScale.inchGridZoom(gridSize: map.gridSize, pointsPerInch: ppi)
        else { return }
        let center = minimap.viewport.mapPoint(fromView: Point2D(x: size.width / 2, y: size.height / 2))
        fitRequest = FitRequest(
            bounds: PhysicalScale.bounds(center: center, zoom: zoom, viewWidth: size.width, viewHeight: size.height))
    }
}

/// A display's physical size, for 1-inch squares (PhysicalScale).
enum TableScreen {
    private static func key(_ screen: NSScreen) -> String { "graphium.screenDiagonal.\(screen.localizedName)" }

    /// The diagonal the DM typed for this display, in inches; 0 when none.
    static func savedDiagonal(_ screen: NSScreen) -> Double { UserDefaults.standard.double(forKey: key(screen)) }

    static func saveDiagonal(_ inches: Double, for screen: NSScreen) {
        if inches > 0 { UserDefaults.standard.set(inches, forKey: key(screen)) } else { UserDefaults.standard.removeObject(forKey: key(screen)) }
    }

    /// Points per inch: the typed diagonal if any, else the size the display reports.
    /// Projectors and some TVs report nothing or nonsense, so implausible sizes give nil.
    static func pointsPerInch(of screen: NSScreen) -> Double? {
        let frame = screen.frame
        let diagonal = savedDiagonal(screen)
        if diagonal > 0 {
            return PhysicalScale.pointsPerInch(diagonalInches: diagonal, widthPoints: frame.width, heightPoints: frame.height)
        }
        guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { return nil }
        let millimeters = CGDisplayScreenSize(CGDirectDisplayID(number.uint32Value))
        guard let ppi = PhysicalScale.pointsPerInch(widthPoints: frame.width, widthMillimeters: millimeters.width),
            (10...400).contains(ppi)
        else { return nil }
        return ppi
    }
}

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
