import GraphiumCore
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

/// The DM's window: map navigator sidebar, the editable canvas, and the token inspector.
struct ArchitectView: View {
    @ObservedObject var document: CampaignDocument
    @Environment(\.undoManager) private var undoManager
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow
    @AppStorage(Prefs.pressureEnabled) private var pressureEnabled = true
    @AppStorage(Prefs.pressureCurve) private var pressureCurveRaw = PressureCurve.normal.rawValue
    @State private var showingPerformance = false
    @State private var legacyExport: LegacyGraphiumFile?
    @State private var showingColorPopover = false
    /// Image imports in flight (decoded off the main thread); shows a spinner.
    @State private var importsInFlight = 0
    /// Sidebar shown or hidden, restored with the window (column widths are restored by the system).
    @SceneStorage("architect.sidebarHidden") private var sidebarHidden = false

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
    @State private var showingConsole = false
    @State private var showingPalette = false
    @State private var showingDungeon = false
    @State private var editingLibraryItem: TokenLibraryItem?
    @State private var showingConsoleSettings = false
    @State private var inspectorTab = InspectorTab.token
    @State private var mapSettings: MapSettingsRequest?
    @State private var calibrating = false
    @State private var toast: Toast?

    private enum InspectorTab: Hashable {
        case token, console
    }
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

    private struct MapSettingsRequest: Identifiable {
        let id = UUID()
        let map: GameMap
        let isNew: Bool
    }

    private struct Toast: Equatable {
        enum Kind {
            case info, success, error
        }

        let id = UUID()
        let message: String
        let kind: Kind
    }

    private enum ImportTarget: Identifiable {
        case mapImage, tokens, libraryUpload
        var id: Self { self }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: sidebarVisibility) {
            mapList
        } detail: {
            canvas
                .inspector(isPresented: inspectorShown) {
                    VStack(spacing: 0) {
                        if showingConsole && hasSelectedTokens {
                            Picker("Panel", selection: $inspectorTab) {
                                Text("Token").tag(InspectorTab.token)
                                Text("Session Console").tag(InspectorTab.console)
                            }
                            .pickerStyle(.segmented)
                            .labelsHidden()
                            .padding(8)
                        }
                        if hasSelectedTokens && (inspectorTab == .token || !showingConsole) {
                            TokenInspector(document: document, selection: selection)
                        } else {
                            SessionConsolePanel(document: document)
                        }
                    }
                    .inspectorColumnWidth(min: 260, ideal: 300)
                }
                .toolbar(id: "architect") { toolbarContent }
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
        .sheet(isPresented: $showingLibrary) {
            LibraryManagerView(
                document: document,
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
        .sheet(isPresented: $showingPalette) {
            CommandPalette(
                isPaused: document.isPaused,
                run: { runCommand($0) },
                placeAsset: { placeLibraryItem($0, at: nil) },
                editAsset: { editingLibraryItem = $0 },
                document: document)
        }
        .sheet(isPresented: $showingDungeon) {
            DungeonDialog { options, clearFirst in generateDungeon(options, clearFirst: clearFirst) }
        }
        .sheet(item: $editingLibraryItem) { item in
            TokenMetadataEditor(item: item) { updated in
                try? LibraryStore.shared.update(updated)
                document.syncLibraryItem(updated, undoManager: undoManager)
            }
        }
        .sheet(isPresented: $showingConsoleSettings) {
            SessionConsoleSettings(document: document)
        }
        .focusedSceneValue(
            \.architectActions,
            ArchitectActions(
                showPalette: { showingPalette = true }, showDungeon: { showingDungeon = true },
                togglePerformanceMonitor: { showingPerformance.toggle() },
                exportLegacy: { exportLegacy() },
                tool: tools.tool,
                selectTool: { selectTool($0) },
                showMapSettings: { mapSettings = MapSettingsRequest(map: document.campaign.activeMap, isNew: false) },
                newMap: { mapSettings = MapSettingsRequest(map: GameMap(name: "Untitled Map"), isNew: true) },
                calibrate: canCalibrate ? { startCalibration() } : nil,
                isDaylight: document.campaign.activeMap.isDaylightMode,
                toggleDaylight: {
                    let daylight = daylightBinding
                    daylight.wrappedValue.toggle()
                },
                resetFog: document.campaign.activeMap.exploredRegions.isEmpty ? nil : { resetExploredFog() },
                deleteSelection: selection.isEmpty ? nil : { deleteSelection() },
                showConsoleSettings: { showingConsoleSettings = true }))
        .onAppear {
            document.adoptUndoManager(undoManager)
            dismissWindow(id: WelcomeView.windowID)
            switch LaunchIntent.shared.take() {
            case .generateDungeon:
                // TS opens the dialog 100 ms after entering the editor.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { showingDungeon = true }
            case .template(let template):
                document.edit("Apply Template", undoManager: undoManager) { template.apply(to: &$0) }
                showToast("🎲 Created \(template.name) campaign!", .success)
            case nil:
                break
            }
        }
        .onAppear {
            #if DEBUG
                // Profiling (TS `?stress=1`): launch with `-GraphiumStress YES` to add the
                // stress map (200 tokens, 50 walls, 200 strokes, 1,500 fog regions).
                if UserDefaults.standard.bool(forKey: "GraphiumStress"),
                    !document.campaign.maps.contains(where: { $0.name == "Stress Test" })
                {
                    let stress = StressFixture.map(exploredRegions: 1500)
                    document.edit("Add Stress Map", undoManager: undoManager) {
                        $0.maps.append(stress)
                        $0.activeMapID = stress.id
                    }
                }
            #endif
        }
        .onReceive(NotificationCenter.default.publisher(for: .graphiumShowAbout)) { _ in
            ShowAbout(openWindow: openWindow)(.about)
        }
        .onChange(of: errorMessage) { _, message in
            // Errors are toasts, as in TS (PARITY §1.6).
            if let message {
                showToast(message, .error)
                errorMessage = nil
            }
        }
        .focusedSceneValue(\.campaignDocument, document)
        .onChange(of: selection) { _, _ in if hasSelectedTokens { inspectorTab = .token } }
        .onChange(of: document.campaign) { _, campaign in
            // Undo/redo or a map switch can remove selected items.
            let map = campaign.activeMap
            let live = Set(map.tokens.map(\.id) + map.drawings.map(\.id) + map.doors.map(\.id))
            if !selection.isSubset(of: live) { selection.formIntersection(live) }
        }
        .onChange(of: document.campaign.activeMapID) { _, _ in calibrating = false }
        .sheet(item: $mapSettings) { request in
            MapSettingsView(
                document: document,
                map: request.map,
                isNew: request.isNew,
                onSave: { saveMapSettings($0, isNew: request.isNew) },
                onCalibrate: { map in
                    saveMapSettings(map, isNew: request.isNew)
                    selection = []
                    calibrating = true
                })
        }
    }

    // MARK: Sidebar

    private var mapList: some View {
        List(selection: activeMapBinding) {
            Section("Maps") {
                // Alphabetical, as TS (PARITY §2.1).
                ForEach(document.campaign.maps.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }) { map in
                    Text(map.name)
                        .tag(map.id)
                        .contextMenu {
                            Button("Map Settings…") { mapSettings = MapSettingsRequest(map: map, isNew: false) }
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
        .toolbar(id: "sidebar") {
            ToolbarItem(id: "add-map") {
                Button {
                    mapSettings = MapSettingsRequest(map: GameMap(name: "Untitled Map"), isNew: true)
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
                deleteSelection: { deleteSelection() },
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
                    if id == GenericToken.id {
                        placeGenericToken(at: point)
                    } else if let item = libraryItem(id) {
                        placeLibraryItem(item, at: point)
                    }
                },
                moveDrawings: { ids, dx, dy, duplicate in
                    var placed: [String] = []
                    document.edit(duplicate ? "Duplicate Strokes" : "Move Strokes", undoManager: undoManager) {
                        placed = $0.activeMap.moveDrawings(ids, dx: dx, dy: dy, duplicate: duplicate)
                    }
                    if duplicate { selection = selection.subtracting(ids).union(placed) }
                },
                resizeToken: { id, scale in
                    document.edit("Resize Token", undoManager: undoManager) { campaign in
                        if let i = campaign.activeMap.tokens.firstIndex(where: { $0.id == id }) {
                            campaign.activeMap.tokens[i].scale = scale
                        }
                    }
                },
                calibrate: { box in
                    calibrating = false
                    var applied = false
                    document.edit("Calibrate Map", undoManager: undoManager) { applied = $0.activeMap.calibrate(to: box) }
                    showToast(applied ? "Map calibrated to the grid" : "Drag a larger box around one grid cell")
                },
                cancelCalibration: {
                    calibrating = false
                    showToast("Calibration cancelled")
                },
                dragPreview: { positions in document.liveDrag.update(positions ?? [:]) },
                setGridType: { type in
                    guard type != document.campaign.activeMap.gridType else { return }
                    document.edit("Change Grid", undoManager: undoManager) { $0.activeMap.gridType = type }
                    showToast("Grid: \(type.title)")
                },
                openColorPicker: { openMarkerColorPicker() },
                stopAudio: { document.dispatch(.stop) }
            ),
            toolState: penAdjusted(tools),
            measurement: measurement,
            calibrating: calibrating,
            assetNamespace: document.sessionID.uuidString
        )
        .overlay(alignment: .top) { canvasBanner }
        .overlay(alignment: .bottomTrailing) {
            if showingPerformance { PerformanceOverlay(document: document).padding(12) }
        }
        .overlay {
            if importsInFlight > 0 {
                ProgressView("Importing image…")
                    .padding(16)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .navigationTitle(campaign.activeMap.name)
        .navigationSubtitle(campaign.name)
        // On the canvas, not the root: the root already has a file importer.
        .fileExporter(
            isPresented: Binding(get: { legacyExport != nil }, set: { if !$0 { legacyExport = nil } }),
            document: legacyExport,
            contentType: .legacyGraphium,
            defaultFilename: campaign.name.isEmpty ? "Campaign" : campaign.name
        ) { result in
            legacyExport = nil
            switch result {
            case .success(let url): showToast("Exported \(url.lastPathComponent)", .success)
            case .failure(let error): showToast(error.localizedDescription, .error)
            }
        }
    }

    // MARK: Palette and generation

    private func runCommand(_ command: PaletteCommand) {
        let tools: [String: CanvasTool] = [
            "tool-select": .select, "tool-marker": .marker, "tool-eraser": .eraser,
            "tool-wall": .wall, "tool-door": .door, "tool-measure": .measure,
        ]
        if let tool = tools[command.id] {
            selectTool(tool)
            return
        }
        switch command.id {
        case "world-view-toggle-pause": document.isPaused.toggle()
        case "world-view-launch": openWindow(id: WorldWindow.id, value: document.sessionID)
        case "dungeon-generate": showingDungeon = true
        case "session-console-stop": document.dispatch(.stop)
        case "session-console-duck": document.dispatch(.setDucked(!document.sessionRuntime.ducked))
        case "session-console-return-to-map": document.dispatch(.returnToMap)
        case "session-console-test-tone": document.dispatch(.fireSfx(sfxId: "test-tone"))
        case "session-console-settings": showingConsoleSettings = true
        default: break
        }
    }

    /// One undoable edit; walls and doors only, grid-aligned to this map (PARITY §5.5).
    private func generateDungeon(_ options: DungeonOptions, clearFirst: Bool) {
        var opts = options
        opts.gridSize = document.campaign.activeMap.gridSize
        if let screen = NSScreen.main?.visibleFrame.size {
            opts.canvasWidth = screen.width
            opts.canvasHeight = screen.height
        }
        let dungeon = DungeonGenerator.generate(opts)
        document.edit("Generate Dungeon", undoManager: undoManager) { $0.activeMap.apply(dungeon, clearFirst: clearFirst) }
        selection = []
    }

    // MARK: Library

    /// Sidebar Library section (PARITY §2.1): Place / Add / Manage plus quick tokens.
    @ViewBuilder
    private var librarySection: some View {
        let campaignLibrary = document.campaign.tokenLibrary
        let recent = TokenLibrarySearch.recent(tokens: document.campaign.activeMap.tokens, library: campaignLibrary)
        let party = TokenLibrarySearch.party(library: document.browsableLibrary.items, excluding: recent)
        Section("Library") {
            HStack {
                Button("Place…") { showingPalette = true }
                Button("Add…") { importTarget = .libraryUpload }
                Button("Manage…") { showingLibrary = true }
            }
            .buttonStyle(.link)
            Button {
                placeGenericToken(at: nil)
            } label: {
                HStack {
                    Image(systemName: "person.crop.circle.fill").frame(width: 24, height: 24)
                    Text(GenericToken.name)
                }
            }
            .buttonStyle(.plain)
            .draggable(GenericToken.dragPayload) {
                Text(GenericToken.name).padding(6).background(.regularMaterial, in: Capsule())
            }
            .help("Click to place at the map centre, or drag onto the map")
            if !recent.isEmpty {
                Text("Recent").font(.caption).foregroundStyle(.secondary)
                ForEach(recent) { item in quickToken(item, image: document.imageCache.image(named: item.thumbnailSrc, in: document.assets)) }
            }
            if !party.isEmpty {
                Text("Party").font(.caption).foregroundStyle(.secondary)
                ForEach(party) { item in quickToken(item, image: document.libraryThumbnail(item)) }
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

    /// The app-wide library first, else the campaign's copy (items that came with the file).
    /// Either way, placing uses the campaign copy's package image when there is one.
    private func libraryItem(_ id: String) -> TokenLibraryItem? {
        library.items.first { $0.id == id } ?? document.campaign.tokenLibrary.first { $0.id == id }
    }

    private func placeLibraryItem(_ item: TokenLibraryItem, at point: Point2D?) {
        if let id = document.placeLibraryItem(item, centredAt: point, undoManager: undoManager) {
            selection = [id]
            showToast(SystemMessages.roll(.assetAddedToMapSuccess, ["itemName": item.name]), .success)
        } else {
            errorMessage = "“\(item.name)” is missing its image in the library."
        }
    }

    /// `I`: the marker colour popover (switches to Marker).
    private func openMarkerColorPicker() {
        selectTool(.marker)
        // Next turn of the run loop: the popover's anchor only exists once Marker is active.
        DispatchQueue.main.async { showingColorPopover = true }
    }

    /// File > Export as .graphium… (PARITY §5.2).
    private func exportLegacy() {
        do {
            legacyExport = try LegacyGraphiumFile(package: CampaignPackage(campaign: document.campaign, assets: document.assets))
        } catch {
            showToast(error.localizedDescription, .error)
        }
    }

    private func placeGenericToken(at point: Point2D?) {
        if let id = document.placeGenericToken(centredAt: point, undoManager: undoManager) { selection = [id] }
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
        Binding(
            get: { hasSelectedTokens || showingConsole },
            set: { shown in
                if !shown {
                    selection = []
                    showingConsole = false
                }
            })
    }

    /// View > Customize Toolbar… can add, remove and reorder these (ids are stable).
    @ToolbarContentBuilder
    private var toolbarContent: some CustomizableToolbarContent {
        toolItems
        actionItems
        secondaryItems
    }

    @ToolbarContentBuilder
    private var toolItems: some CustomizableToolbarContent {
        ToolbarItem(id: "tool", placement: .principal) {
            Picker("Tool", selection: Binding(get: { tools.tool }, set: { selectTool($0) })) {
                ForEach(CanvasTool.allCases) { tool in
                    Label(tool.title, systemImage: tool.symbol).tag(tool).help(tool.help)
                }
            }
            .pickerStyle(.segmented)
            .labelStyle(.iconOnly)
        }
        ToolbarItem(id: "tool-options", placement: .principal) {
            toolOptions
        }
    }

    @ToolbarContentBuilder
    private var actionItems: some CustomizableToolbarContent {
        ToolbarItem(id: "map-settings", placement: .primaryAction) {
            Button {
                mapSettings = MapSettingsRequest(map: document.campaign.activeMap, isNew: false)
            } label: {
                Label("Map Settings", systemImage: "slider.horizontal.3")
            }
            .help("Name, grid, daylight, map image and calibration")
        }
        ToolbarItem(id: "map-image", placement: .primaryAction) {
            Button {
                importTarget = .mapImage
            } label: {
                Label("Map Image", systemImage: "photo")
            }
            .help("Set this map's background image")
        }
        ToolbarItem(id: "add-tokens", placement: .primaryAction) {
            Button {
                importTarget = .tokens
            } label: {
                Label("Add Tokens", systemImage: "person.crop.circle.badge.plus")
            }
            .help("Add tokens from image files")
        }
        ToolbarItem(id: "world-view", placement: .primaryAction) {
            Button {
                openWindow(id: WorldWindow.id, value: document.sessionID)
            } label: {
                Label("World View", systemImage: "tv")
            }
            .help("Open the player-facing World View (drag it to the projector)")
        }
        ToolbarItem(id: "pause", placement: .primaryAction) {
            PauseToolbarButton(document: document)
        }
        ToolbarItem(id: "session-console", placement: .primaryAction) {
            Toggle(isOn: $showingConsole) {
                Label("Session Console", systemImage: "music.note.list")
            }
            .help("Plates and music for the World View")
            .onChange(of: showingConsole) { _, shown in if shown { inspectorTab = .console } }
        }
    }

    @ToolbarContentBuilder
    private var secondaryItems: some CustomizableToolbarContent {
        ToolbarItem(id: "daylight", placement: .secondaryAction) {
            Toggle(isOn: daylightBinding) {
                Label("Daylight", systemImage: "sun.max")
            }
            .help("Daylight: no fog of war on this map")
        }
        ToolbarItem(id: "reset-fog", placement: .secondaryAction) {
            Button {
                resetExploredFog()
            } label: {
                Label("Reset Explored Fog", systemImage: "eye.slash")
            }
            .help("Forget what the party has explored on this map")
            .disabled(document.campaign.activeMap.exploredRegions.isEmpty)
        }
        // Off by default; add them with Customize Toolbar.
        ToolbarItem(id: "console-window", placement: .secondaryAction) {
            Button {
                openWindow(id: SessionConsoleWindow.id, value: document.sessionID)
            } label: {
                Label("Session Console Window", systemImage: "macwindow.on.rectangle")
            }
            .help("Open the Session Console in its own window")
        }
        .defaultCustomization(.hidden)
        ToolbarItem(id: "palette", placement: .secondaryAction) {
            Button {
                showingPalette = true
            } label: {
                Label("Command Palette", systemImage: "command")
            }
            .help("Search actions and assets (⌘K)")
        }
        .defaultCustomization(.hidden)
        ToolbarItem(id: "dungeon", placement: .secondaryAction) {
            Button {
                showingDungeon = true
            } label: {
                Label("Generate Dungeon", systemImage: "square.grid.3x3.topleft.filled")
            }
            .help("Generate a random dungeon (⇧⌘G)")
        }
        .defaultCustomization(.hidden)
        ToolbarItem(id: "performance", placement: .secondaryAction) {
            Toggle(isOn: $showingPerformance) {
                Label("Performance Monitor", systemImage: "gauge.with.dots.needle.33percent")
            }
            .help("Canvas frame rate, memory and counts (⇧⌘M)")
        }
        .defaultCustomization(.hidden)
    }

    /// Options for the active tool, in one toolbar item so customisation keeps them together.
    @ViewBuilder
    private var toolOptions: some View {
        switch tools.tool {
        case .marker:
            HStack(spacing: 6) {
                Button {
                    showingColorPopover.toggle()
                } label: {
                    Image(systemName: "circle.fill")
                        .foregroundStyle(Color(nsColor: NSColor(hex: tools.markerColor) ?? .systemOrange))
                }
                .help("Marker colour (I)")
                .accessibilityLabel("Marker colour")
                .popover(isPresented: $showingColorPopover, arrowEdge: .bottom) {
                    MarkerColorPopover(color: markerColorBinding, recent: recentColors) { hex in
                        tools.markerColor = hex
                    }
                }
                ForEach(recentColors, id: \.self) { hex in
                    Button {
                        tools.markerColor = hex
                    } label: {
                        Image(systemName: "circle.fill").foregroundStyle(Color(nsColor: NSColor(hex: hex) ?? .black))
                    }
                    .help(hex)
                    .accessibilityLabel("Recent colour \(hex)")
                }
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
            HStack(spacing: 6) {
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
            }
        default:
            EmptyView()
        }
    }

    private var sidebarVisibility: Binding<NavigationSplitViewVisibility> {
        Binding(
            get: { sidebarHidden ? .detailOnly : .all },
            set: { sidebarHidden = $0 == .detailOnly })
    }

    private var canCalibrate: Bool {
        let map = document.campaign.activeMap
        return map.background != nil && map.gridType.isSquare
    }

    private func startCalibration() {
        selection = []
        calibrating = true
    }

    private func resetExploredFog() {
        document.edit("Reset Explored Fog", undoManager: undoManager) { $0.activeMap.exploredRegions = [] }
    }

    // MARK: Actions

    private func withAccess<T>(to url: URL, _ body: () throws -> T) rethrows -> T {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        return try body()
    }

    private func setMapImage(from url: URL) {
        let mapID = document.campaign.activeMapID
        importsInFlight += 1
        Task { @MainActor in
            defer { importsInFlight -= 1 }
            do {
                let image = try await ImportedImage.loadInBackground(from: url, kind: .map)
                let name = document.addAsset(image.data, preferredName: image.preferredName)
                document.edit("Set Map Image", undoManager: undoManager) { campaign in
                    // The map the user chose it for, even if they switched maps meanwhile.
                    guard let i = campaign.maps.firstIndex(where: { $0.id == mapID }) else { return }
                    campaign.maps[i].background = MapBackground(
                        src: name, width: Double(image.width), height: Double(image.height))
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Adds one token per image. `point` is the top-left for the first token, or its
    /// centre when `centred` (Finder drops land under the pointer). Each is snapped.
    private func addTokens(from urls: [URL], at point: Point2D, centred: Bool = false) {
        let map = document.campaign.activeMap
        importsInFlight += 1
        Task { @MainActor in
            defer { importsInFlight -= 1 }
            var created: [Token] = []
            for (offset, url) in urls.enumerated() {
                do {
                    let image = try await ImportedImage.loadInBackground(from: url, kind: .token)
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
            document.edit(created.count == 1 ? "Add Token" : "Add Tokens", undoManager: undoManager) { campaign in
                // The map they were added to, even if the user switched maps meanwhile.
                guard let i = campaign.maps.firstIndex(where: { $0.id == map.id }) else { return }
                campaign.maps[i].tokens.append(contentsOf: created)
            }
            if document.campaign.activeMapID == map.id { selection = Set(created.map(\.id)) }
        }
    }

    /// Deletes selected tokens, strokes and doors in one undoable step.
    private func deleteSelection() {
        let ids = selection
        let tokenCount = document.campaign.activeMap.tokens.filter { ids.contains($0.id) }.count
        let name =
            tokenCount == ids.count ? (ids.count == 1 ? "Delete Token" : "Delete Tokens") : "Delete Selection"
        document.edit(name, undoManager: undoManager) { $0.activeMap.removeItems(ids) }
        selection = []
    }

    private var hasSelectedTokens: Bool {
        document.campaign.activeMap.tokens.contains { selection.contains($0.id) }
    }

    private func saveMapSettings(_ map: GameMap, isNew: Bool) {
        document.edit(isNew ? "Add Map" : "Map Settings", undoManager: undoManager) { campaign in
            if isNew {
                campaign.maps.append(map)
                campaign.activeMapID = map.id
            } else if let i = campaign.maps.firstIndex(where: { $0.id == map.id }) {
                campaign.maps[i] = map
            }
        }
        if isNew { selection = [] }
    }

    /// One toast at a time; a new one replaces it (PARITY §1.6).
    private func showToast(_ message: String, _ kind: Toast.Kind = .info) {
        toast = Toast(message: message, kind: kind)
    }

    private func penAdjusted(_ state: ToolState) -> ToolState {
        var state = state
        state.pressureEnabled = pressureEnabled
        state.pressureCurve = PressureCurve(rawValue: pressureCurveRaw) ?? .normal
        return state
    }

    /// Calibration instructions, or a brief toast (PARITY §3.2).
    @ViewBuilder
    private var canvasBanner: some View {
        if calibrating {
            HStack(spacing: 12) {
                Label("Drag a box around exactly one grid cell on the map image", systemImage: "square.dashed")
                Button("Cancel") { calibrating = false }
                    .keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.regularMaterial, in: Capsule())
            .padding(.top, 12)
        } else if let toast {
            HStack(spacing: 10) {
                Image(systemName: toast.kind == .error ? "exclamationmark.triangle.fill" : toast.kind == .success ? "checkmark.circle.fill" : "info.circle.fill")
                    .foregroundStyle(toast.kind == .error ? Color.red : toast.kind == .success ? Color.green : Color.accentColor)
                Text(toast.message)
                Button {
                    self.toast = nil
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close notification")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.regularMaterial, in: Capsule())
            .padding(.top, 12)
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityElement(children: .contain)
            .task(id: toast.id) {
                try? await Task.sleep(for: .seconds(5))
                if self.toast?.id == toast.id { self.toast = nil }
            }
        }
    }

    private func deleteMap(_ id: String) {
        do {
            var next = document.campaign
            try next.deleteMap(id: id)
            selection = []
            document.edit("Delete Map", undoManager: undoManager) { $0 = next }
        } catch {
            errorMessage = SystemMessages.roll(.cannotDeleteOnlyMap)
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

