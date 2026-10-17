import GraphiumCore
import ImageIO
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
    @State private var tools = ToolState()
    @State private var recentColors: [String] = []
    @State private var measurement: MeasurementShape?
    @State private var broadcastMeasurement = true
    @State private var showingLibrary = false
    @State private var libraryUpload: ImportedImage?
    @State private var cropping: CropRequest?
    @ObservedObject private var library = LibraryStore.shared

    /// A Finder-dropped image waiting in the cropper.
    private struct CropRequest: Identifiable {
        let id = UUID()
        let image: CGImage
        let name: String
        let point: Point2D
    }

    private enum ImportTarget: Identifiable {
        case mapImage, tokens, libraryUpload
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
                } else if target == .libraryUpload, let url = urls.first {
                    do {
                        libraryUpload = try withAccess(to: url) { try ImportedImage.load(from: url, kind: .token) }
                    } catch {
                        errorMessage = error.localizedDescription
                    }
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
        .sheet(isPresented: $showingLibrary) {
            LibraryManagerView(
                onPlace: { placeLibraryItem($0, at: nil) },
                onEdited: { document.syncLibraryItem($0, undoManager: undoManager) })
        }
        .sheet(item: $libraryUpload) { image in
            AddToLibraryView(image: image)
        }
        .sheet(item: $cropping) { request in
            ImageCropperView(image: request.image) { cropped in
                addCroppedToken(cropped, name: request.name, centredAt: request.point)
            }
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
            librarySection
            let doors = document.campaign.activeMap.doors
            if !doors.isEmpty {
                // Bulk door controls (PARITY §2.1).
                Section("Doors") {
                    Button("Open All Unlocked Doors") {
                        document.edit("Open Doors", undoManager: undoManager) {
                            $0.activeMap.setAllUnlockedDoors(open: true)
                        }
                    }
                    Button("Close All Open Doors") {
                        document.edit("Close Doors", undoManager: undoManager) {
                            $0.activeMap.setAllUnlockedDoors(open: false)
                        }
                    }
                    if doors.contains(where: \.isLocked) {
                        Button("Unlock All") {
                            document.edit("Unlock Doors", undoManager: undoManager) {
                                $0.activeMap.setAllDoorLocks(locked: false)
                            }
                        }
                    }
                }
                .buttonStyle(.link)
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
                dropImageFiles: { urls, point in dropImages(urls, at: point) },
                addDrawing: { addDrawing($0) },
                placeDoor: { point in
                    document.edit("Place Door", undoManager: undoManager) {
                        $0.activeMap.placeDoor(at: point, orientation: tools.doorOrientation)
                    }
                },
                doorAction: { id, action in performDoorAction(id, action) },
                setMeasurement: { setMeasurement($0) },
                setTool: { selectTool($0) },
                toggleDoorOrientation: {
                    tools.doorOrientation = tools.doorOrientation == .horizontal ? .vertical : .horizontal
                },
                dropLibraryItem: { id, point in
                    if let item = libraryItem(id) { placeLibraryItem(item, at: point) }
                }
            ),
            toolState: tools,
            measurement: measurement
        )
        .navigationTitle(campaign.activeMap.name)
        .navigationSubtitle(campaign.name)
    }

    // MARK: Library

    /// Sidebar Library section (PARITY §2.1): Place / Add / Manage plus quick tokens.
    @ViewBuilder
    private var librarySection: some View {
        let campaignLibrary = document.campaign.tokenLibrary
        let recent = TokenLibrarySearch.recent(tokens: document.campaign.activeMap.tokens, library: campaignLibrary)
        let party = TokenLibrarySearch.party(library: library.items, excluding: recent)
        Section("Library") {
            HStack {
                Button("Place…") { showingLibrary = true }
                Button("Add…") { importTarget = .libraryUpload }
                Button("Manage…") { showingLibrary = true }
            }
            .buttonStyle(.link)
            if !recent.isEmpty {
                Text("Recent").font(.caption).foregroundStyle(.secondary)
                ForEach(recent) { item in quickToken(item, image: document.imageCache.image(named: item.thumbnailSrc, in: document.assets)) }
            }
            if !party.isEmpty {
                Text("Party").font(.caption).foregroundStyle(.secondary)
                ForEach(party) { item in quickToken(item, image: library.image(item.thumbnailSrc)) }
            }
        }
    }

    private func quickToken(_ item: TokenLibraryItem, image: CGImage?) -> some View {
        Button {
            placeLibraryItem(item, at: nil)
        } label: {
            HStack {
                Group {
                    if let image { Image(decorative: image, scale: 1).resizable().scaledToFit() } else {
                        Image(systemName: "person.crop.circle")
                    }
                }
                .frame(width: 24, height: 24)
                Text(item.name).lineLimit(1)
            }
        }
        .buttonStyle(.plain)
        .draggable(LibraryDrag.payload(for: item)) {
            Text(item.name).padding(6).background(.regularMaterial, in: Capsule())
        }
        .help("Click to place at the map centre, or drag onto the map")
    }

    /// Campaign copy first (its src points at this package), else the app-wide library.
    private func libraryItem(_ id: String) -> TokenLibraryItem? {
        library.items.first { $0.id == id } ?? document.campaign.tokenLibrary.first { $0.id == id }
    }

    private func placeLibraryItem(_ item: TokenLibraryItem, at point: Point2D?) {
        if let id = document.placeLibraryItem(item, centredAt: point, undoManager: undoManager) {
            selection = [id]
        } else {
            errorMessage = "“\(item.name)” is missing its image in the library."
        }
    }

    /// Finder drops: one image goes through the 1:1 cropper (TS); several import directly.
    private func dropImages(_ urls: [URL], at point: Point2D) {
        if urls.count == 1, let url = urls.first,
            let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
        {
            cropping = CropRequest(image: image, name: url.lastPathComponent, point: point)
        } else {
            addTokens(from: urls, at: point, centred: true)
        }
    }

    private func addCroppedToken(_ image: CGImage, name: String, centredAt point: Point2D) {
        let side = min(image.width, ImageKind.token.maxDimension)
        guard let context = CGContext(
            data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))
        guard let scaled = context.makeImage(), let png = NSBitmapImageRep(cgImage: scaled).representation(using: .png, properties: [:])
        else { return }
        let asset = document.addAsset(png, preferredName: (name as NSString).deletingPathExtension + ".png")
        let map = document.campaign.activeMap
        let size = map.gridSize
        let snapped = snapToGrid(
            Point2D(x: point.x - size / 2, y: point.y - size / 2), gridSize: size, gridType: map.gridType,
            width: size, height: size)
        let token = Token(x: snapped.x, y: snapped.y, src: asset, type: .npc, name: "New Token")
        document.edit("Add Token", undoManager: undoManager) { $0.activeMap.tokens.append(token) }
        selection = [token.id]
    }

    // MARK: Tools

    private func selectTool(_ tool: CanvasTool) {
        guard tool != tools.tool else { return }
        tools.tool = tool
        setMeasurement(nil)  // changing tool clears the measurement (TS)
    }

    private var markerColorBinding: Binding<Color> {
        Binding(
            get: { Color(nsColor: NSColor(hex: tools.markerColor) ?? .systemOrange) },
            set: { color in
                let hex = NSColor(color).usingColorSpace(.sRGB)?.hexString ?? StrokeDefaults.markerColor
                tools.markerColor = hex
            })
    }

    private var measureModeBinding: Binding<MeasurementShape.Mode> {
        Binding(
            get: { tools.measureMode },
            set: {
                tools.measureMode = $0
                setMeasurement(nil)
            })
    }

    private func setMeasurement(_ shape: MeasurementShape?) {
        measurement = shape
        publishMeasurement()
    }

    private func publishMeasurement() {
        document.broadcastMeasurement = broadcastMeasurement ? measurement : nil
    }

    private func addDrawing(_ drawing: Drawing) {
        var stroke = drawing
        let name: String
        switch drawing.tool {
        case .wall:
            let existing = document.campaign.activeMap.drawings.filter { $0.tool == .wall }.map(\.points)
            stroke.points = PathOptimization.finalizeWall(drawing.points, existingWalls: existing)
            name = "Draw Wall"
        case .marker:
            // Recent colours: most recent first, deduped, three shown (PARITY §2.2).
            recentColors = Array(([drawing.color] + recentColors.filter { $0 != drawing.color }).prefix(3))
            name = "Draw"
        case .eraser:
            name = "Erase"
        }
        document.edit(name, undoManager: undoManager) { $0.activeMap.drawings.append(stroke) }
    }

    private func performDoorAction(_ id: String, _ action: DoorAction) {
        switch action {
        case .toggle:
            document.edit("Toggle Door", undoManager: undoManager) { $0.activeMap.toggleDoor(id: id) }
        case .lock, .unlock:
            document.edit(action == .lock ? "Lock Door" : "Unlock Door", undoManager: undoManager) { campaign in
                if let i = campaign.activeMap.doors.firstIndex(where: { $0.id == id }) {
                    campaign.activeMap.doors[i].isLocked = action == .lock
                }
            }
        case .delete:
            document.edit("Delete Door", undoManager: undoManager) { $0.activeMap.doors.removeAll { $0.id == id } }
        }
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
        ToolbarItemGroup(placement: .principal) {
            Picker("Tool", selection: Binding(get: { tools.tool }, set: { selectTool($0) })) {
                ForEach(CanvasTool.allCases) { tool in
                    Label(tool.title, systemImage: tool.symbol).tag(tool).help(tool.help)
                }
            }
            .pickerStyle(.segmented)
            .labelStyle(.iconOnly)

            switch tools.tool {
            case .marker:
                ColorPicker("Marker Colour", selection: markerColorBinding, supportsOpacity: false)
                    .labelsHidden()
                ForEach(recentColors, id: \.self) { hex in
                    Button {
                        tools.markerColor = hex
                    } label: {
                        Image(systemName: "circle.fill").foregroundStyle(Color(nsColor: NSColor(hex: hex) ?? .black))
                    }
                    .help(hex)
                }
            case .door:
                Button {
                    tools.doorOrientation = tools.doorOrientation == .horizontal ? .vertical : .horizontal
                } label: {
                    Label(
                        tools.doorOrientation == .horizontal ? "Horizontal" : "Vertical",
                        systemImage: tools.doorOrientation == .horizontal ? "arrow.left.and.right" : "arrow.up.and.down")
                }
                .help("Door orientation (R or arrow keys)")
            case .measure:
                Picker("Measure", selection: measureModeBinding) {
                    Text("Ruler").tag(MeasurementShape.Mode.ruler)
                    Text("Blast").tag(MeasurementShape.Mode.blast)
                    Text("Cone").tag(MeasurementShape.Mode.cone)
                }
                .pickerStyle(.segmented)
                Toggle(isOn: $broadcastMeasurement) {
                    Label(broadcastMeasurement ? "Broadcasting" : "Local Only", systemImage: "dot.radiowaves.left.and.right")
                }
                .help("Show this measurement in the World View")
                .onChange(of: broadcastMeasurement) { _, _ in publishMeasurement() }
            default:
                EmptyView()
            }
        }
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
