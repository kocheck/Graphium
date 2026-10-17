import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// The DM's window: map navigator sidebar, the editable canvas, and the token inspector.
struct ArchitectView: View {
    @ObservedObject var document: CampaignDocument
    @Environment(\.undoManager) private var undoManager
    @Environment(\.openWindow) private var openWindow

    @State private var selection: Set<String> = []
    @State private var importTarget: ImportTarget?
    @State private var renamingMapID: String?
    @State private var renameText = ""
    @State private var deletingMapID: String?
    @State private var errorMessage: String?

    private enum ImportTarget: Identifiable {
        case mapImage, tokens
        var id: Self { self }
    }

    var body: some View {
        NavigationSplitView {
            mapList
        } detail: {
            canvas
                .inspector(isPresented: inspectorShown) {
                    TokenInspector(document: document, selection: selection)
                        .inspectorColumnWidth(min: 240, ideal: 260)
                }
                .toolbar { toolbarContent }
        }
        .fileImporter(
            isPresented: Binding(get: { importTarget != nil }, set: { if !$0 { importTarget = nil } }),
            allowedContentTypes: [.image],
            allowsMultipleSelection: importTarget == .tokens
        ) { result in
            let target = importTarget
            importTarget = nil
            switch result {
            case .success(let urls):
                if target == .mapImage, let url = urls.first {
                    setMapImage(from: url)
                } else {
                    addTokens(from: urls, at: document.campaign.activeMap.centrePlacementPoint)
                }
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        }
        .alert("Rename Map", isPresented: Binding(get: { renamingMapID != nil }, set: { if !$0 { renamingMapID = nil } })) {
            TextField("Name", text: $renameText)
            Button("Rename") {
                if let id = renamingMapID, !renameText.trimmingCharacters(in: .whitespaces).isEmpty {
                    let name = renameText.trimmingCharacters(in: .whitespaces)
                    document.edit("Rename Map", undoManager: undoManager) { $0.renameMap(id: id, to: name) }
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog(
            "Delete this map?",
            isPresented: Binding(get: { deletingMapID != nil }, set: { if !$0 { deletingMapID = nil } })
        ) {
            Button("Delete Map", role: .destructive) {
                if let id = deletingMapID { deleteMap(id) }
            }
        } message: {
            Text("Its tokens, drawings and fog go with it. You can undo this.")
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .focusedSceneValue(\.campaignDocument, document)
        .onChange(of: document.campaign) { _, campaign in
            // Undo/redo or a map switch can remove selected tokens.
            let live = Set(campaign.activeMap.tokens.map(\.id))
            if !selection.isSubset(of: live) { selection.formIntersection(live) }
        }
    }

    // MARK: Sidebar

    private var mapList: some View {
        List(selection: activeMapBinding) {
            Section("Maps") {
                ForEach(document.campaign.maps) { map in
                    Text(map.name)
                        .tag(map.id)
                        .contextMenu {
                            Button("Rename…") {
                                renameText = map.name
                                renamingMapID = map.id
                            }
                            Button("Delete…", role: .destructive) { deletingMapID = map.id }
                                .disabled(document.campaign.maps.count == 1)
                        }
                }
            }
        }
        .navigationSplitViewColumnWidth(min: 180, ideal: 220)
        .toolbar {
            ToolbarItem {
                Button {
                    document.edit("Add Map", undoManager: undoManager) { $0.addMap() }
                } label: {
                    Label("Add Map", systemImage: "plus")
                }
                .help("Add a map to this campaign")
            }
        }
    }

    private var activeMapBinding: Binding<String?> {
        Binding(
            get: { document.campaign.activeMapID },
            set: { newValue in
                guard let newValue, newValue != document.campaign.activeMapID else { return }
                selection = []
                document.edit("Switch Map", undoManager: undoManager) { $0.activeMapID = newValue }
            })
    }

    // MARK: Canvas

    private var canvas: some View {
        let campaign = document.campaign
        return MapCanvas(
            map: campaign.activeMap,
            library: campaign.libraryIndex,
            imageProvider: { [document] name in document.imageCache.image(named: name, in: document.assets) },
            selection: selection,
            editing: CanvasEditing(
                setSelection: { selection = $0 },
                dropTokens: { ids, primary, dx, dy, duplicate in
                    var placed: [String] = []
                    document.edit(duplicate ? "Duplicate Tokens" : "Move Tokens", undoManager: undoManager) {
                        campaign in
                        var map = campaign.activeMap
                        placed = map.dropTokens(
                            ids, primary: primary, dx: dx, dy: dy, duplicate: duplicate,
                            library: campaign.libraryIndex)
                        campaign.activeMap = map
                    }
                    if duplicate { selection = Set(placed) }
                },
                deleteSelection: { deleteSelectedTokens() },
                dropImageFiles: { urls, point in addTokens(from: urls, at: point, centred: true) }
            )
        )
        .navigationTitle(campaign.activeMap.name)
        .navigationSubtitle(campaign.name)
    }

    private var daylightBinding: Binding<Bool> {
        Binding(
            get: { document.campaign.activeMap.isDaylightMode },
            set: { value in
                document.edit(value ? "Daylight On" : "Daylight Off", undoManager: undoManager) {
                    $0.activeMap.isDaylightMode = value
                }
            })
    }

    private var inspectorShown: Binding<Bool> {
        Binding(get: { !selection.isEmpty }, set: { if !$0 { selection = [] } })
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button {
                importTarget = .mapImage
            } label: {
                Label("Map Image", systemImage: "photo")
            }
            .help("Set this map's background image")

            Button {
                importTarget = .tokens
            } label: {
                Label("Add Tokens", systemImage: "person.crop.circle.badge.plus")
            }
            .help("Add tokens from image files")

            Button {
                openWindow(id: WorldWindow.id, value: document.sessionID)
            } label: {
                Label("World View", systemImage: "tv")
            }
            .help("Open the player-facing World View (drag it to the projector)")

            PauseToolbarButton(document: document)
        }
        ToolbarItemGroup(placement: .secondaryAction) {
            Toggle(isOn: daylightBinding) {
                Label("Daylight", systemImage: "sun.max")
            }
            .help("Daylight: no fog of war on this map")

            Button {
                document.edit("Reset Explored Fog", undoManager: undoManager) {
                    $0.activeMap.exploredRegions = []
                }
            } label: {
                Label("Reset Explored Fog", systemImage: "eye.slash")
            }
            .help("Forget what the party has explored on this map")
            .disabled(document.campaign.activeMap.exploredRegions.isEmpty)
        }
    }

    // MARK: Actions

    private func withAccess<T>(to url: URL, _ body: () throws -> T) rethrows -> T {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        return try body()
    }

    private func setMapImage(from url: URL) {
        do {
            let image = try withAccess(to: url) { try ImportedImage.load(from: url, kind: .map) }
            let name = document.addAsset(image.data, preferredName: image.preferredName)
            document.edit("Set Map Image", undoManager: undoManager) { campaign in
                campaign.activeMap.background = MapBackground(
                    src: name, width: Double(image.width), height: Double(image.height))
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Adds one token per image. `point` is the top-left for the first token, or its
    /// centre when `centred` (Finder drops land under the pointer). Each is snapped.
    private func addTokens(from urls: [URL], at point: Point2D, centred: Bool = false) {
        var created: [Token] = []
        let map = document.campaign.activeMap
        for (offset, url) in urls.enumerated() {
            do {
                let image = try withAccess(to: url) { try ImportedImage.load(from: url, kind: .token) }
                let name = document.addAsset(image.data, preferredName: image.preferredName)
                let size = map.gridSize
                let shift = Double(offset) * size
                let topLeft = Point2D(
                    x: point.x + shift - (centred ? size / 2 : 0), y: point.y - (centred ? size / 2 : 0))
                let snapped = snapToGrid(topLeft, gridSize: size, gridType: map.gridType, width: size, height: size)
                created.append(Token(x: snapped.x, y: snapped.y, src: name, type: .npc, name: "New Token"))
            } catch {
                errorMessage = error.localizedDescription
            }
        }
        guard !created.isEmpty else { return }
        document.edit(created.count == 1 ? "Add Token" : "Add Tokens", undoManager: undoManager) {
            $0.activeMap.tokens.append(contentsOf: created)
        }
        selection = Set(created.map(\.id))
    }

    private func deleteSelectedTokens() {
        let ids = selection
        document.edit(ids.count == 1 ? "Delete Token" : "Delete Tokens", undoManager: undoManager) {
            $0.activeMap.removeTokens(ids)
        }
        selection = []
    }

    private func deleteMap(_ id: String) {
        do {
            var next = document.campaign
            try next.deleteMap(id: id)
            selection = []
            document.edit("Delete Map", undoManager: undoManager) { $0 = next }
        } catch {
            errorMessage = "A campaign needs at least one map."
        }
    }
}

/// Play/Pause for the World View (PARITY §1.12): red while players can't see the map.
private struct PauseToolbarButton: View {
    @ObservedObject var document: CampaignDocument

    var body: some View {
        Button {
            document.isPaused.toggle()
        } label: {
            Label(
                document.isPaused ? "Resume" : "Pause",
                systemImage: document.isPaused ? "play.fill" : "pause.fill")
        }
        .tint(document.isPaused ? .red : .green)
        .help(document.isPaused ? "Resume - Players will see the map" : "Pause - Hide map from players")
    }
}
