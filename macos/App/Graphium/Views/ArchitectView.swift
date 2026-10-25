import GraphiumCore
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

/// The DM's window: map navigator sidebar, the editable canvas, and the token, note or spell effect inspector.
struct ArchitectView: View {
    @ObservedObject var document: CampaignDocument
    @Environment(\.undoManager) private var undoManager
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
    /// What the open panel was for, kept once it closes until its result arrives.
    @State private var closedImportTarget: ImportTarget?
    @State private var renamingMapID: String?
    @State private var renameText = ""
    @State private var deletingMapID: String?
    @State private var confirmingFogReset = false
    @State private var errorMessage: String?
    @State private var tools = ToolState()
    /// The stairs the Stairs tool placed with its last click, waiting for its sister end.
    @State private var pendingStairsID: String?
    @State private var recentColors = StrokeDefaults.recentMarkerColors
    @State private var measurement: MeasurementShape?
    // Off by default, as in TS: measurements stay on the DM's screen until broadcasting is turned on.
    @State private var broadcastMeasurement = false
    @State private var showingLibrary = false
    @State private var showingConsole = false
    @State private var showingPalette = false
    @State private var showingDungeon = false
    @State private var editingLibraryItem: TokenLibraryItem?
    @State private var showingConsoleSettings = false
    @State private var inspectorTab = InspectorTab.selection
    @State private var mapSettings: MapSettingsRequest?
    @State private var calibrating = false
    @State private var zoomRequest: ZoomRequest?
    @State private var fitRequest: FitRequest?
    @State private var canvasZoom = 1.0
    /// The canvas camera, held without observing so panning doesn't redraw this view.
    @State private var camera = CanvasCamera()
    @State private var canvasViewportModel = CanvasViewportModel()
    @StateObject private var mapThumbnails = MapThumbnailStore()
    @SceneStorage("architect.sidebar.mapsExpanded") private var mapsExpanded = true
    @AppStorage("graphium.sidebar.sectionOrder") private var sidebarSectionOrderStored = ""
    @SceneStorage("architect.sidebar.libraryExpanded") private var libraryExpanded = true
    /// View > Show Players' Fog: the players' fog, dimmed, over the DM's map while prepping walls.
    @State private var fogPreview = false
    @State private var fogPreviewCache = VisibilityCache()
    @State private var toast: Toast?

    private enum InspectorTab: Hashable {
        /// The selected tokens, else the selected notes, else the selected effects.
        case selection, console
    }
    @State private var libraryUpload: ImportedImage?
    @State private var cropping: CropRequest?
    @ObservedObject private var library = LibraryStore.shared

    /// An image waiting in the cropper: a Finder drop that becomes a new token, or the
    /// new picture for existing tokens (Change Image).
    private struct CropRequest: Identifiable {
        enum Purpose {
            case newToken(centredAt: Point2D)
            case tokenImage(Set<String>)
        }

        let id = UUID()
        let image: CGImage
        let name: String
        let purpose: Purpose
    }

    private struct MapSettingsRequest: Identifiable {
        let id = UUID()
        let map: GameMap
        let isNew: Bool
    }

    private struct Toast: Equatable {
        enum Kind {
            case info, success, error

            var symbol: String {
                switch self {
                case .info: return "info.circle.fill"
                case .success: return "checkmark.circle.fill"
                case .error: return "exclamationmark.triangle.fill"
                }
            }

            var tint: Palette {
                switch self {
                case .info: return .inkSecondary
                case .success: return .statusOk
                case .error: return .statusCritical
                }
            }

            var accessibilityLabel: String {
                switch self {
                case .info: return "Note"
                case .success: return "Done"
                case .error: return "Error"
                }
            }
        }

        let id = UUID()
        let message: String
        let kind: Kind
    }

    private enum ImportTarget: Hashable, Identifiable {
        case mapImage, tokens, libraryUpload
        /// Change Image for these tokens.
        case tokenImage(Set<String>)
        var id: Self { self }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: sidebarVisibility) {
            mapList
        } detail: {
            canvas
                .inspector(isPresented: inspectorShown) {
                    VStack(spacing: 0) {
                        if showingConsole && hasInspectableSelection {
                            Picker("Panel", selection: $inspectorTab) {
                                Text(hasSelectedTokens ? "Token" : hasSelectedNotes ? "Note" : "Spell Effect").tag(InspectorTab.selection)
                                Text("Session Console").tag(InspectorTab.console)
                            }
                            .pickerStyle(.segmented)
                            .labelsHidden()
                            .padding(8)
                        }
                        if hasInspectableSelection && (inspectorTab == .selection || !showingConsole) {
                            if hasSelectedTokens {
                                TokenInspector(
                                    document: document, selection: selection,
                                    notify: { message, isError in showToast(message, isError ? .error : .success) },
                                    chooseImageFile: { importTarget = .tokenImage(selection) },
                                    useImageFile: { url in cropTokenImage(from: url, for: selection) })
                            } else if hasSelectedNotes {
                                NoteInspector(document: document, selection: selection)
                            } else {
                                EffectInspector(document: document, selection: selection)
                            }
                        } else {
                            SessionConsolePanel(document: document)
                        }
                    }
                    .inspectorColumnWidth(min: 260, ideal: 300)
                }
                .toolbar(id: "architect") { toolbarContent }
                // The window could shrink to its traffic lights, with no canvas left (persona runs).
                .frame(minWidth: 560, minHeight: 420)
                .background {
                    // ⌘P also opens the palette, as in TS (PARITY §1.4); the menu lists ⌘K only.
                    Button("Command Palette") { showingPalette = true }
                        .keyboardShortcut("p")
                        .opacity(0)
                        .frame(width: 0, height: 0)
                        .accessibilityHidden(true)
                }
        }
        .fileImporter(
            isPresented: Binding(
                get: { importTarget != nil },
                set: {
                    // The panel can report itself closed before it hands over the file; keep what it
                    // was opened for, or a chosen map image lands as a token (docs/qa/LAUNCH_QA_RESULTS.md).
                    if !$0, let target = importTarget {
                        closedImportTarget = target
                        importTarget = nil
                    }
                }),
            allowedContentTypes: (importTarget ?? closedImportTarget) == .mapImage ? ImportedBackground.contentTypes : [.image],
            allowsMultipleSelection: (importTarget ?? closedImportTarget) == .tokens
        ) { result in
            let target = importTarget ?? closedImportTarget
            importTarget = nil
            closedImportTarget = nil
            switch result {
            case .success(let urls):
                if case .tokenImage(let ids) = target, let url = urls.first {
                    cropTokenImage(from: url, for: ids)
                } else if target == .mapImage, let url = urls.first {
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
        .confirmationDialog("Reset what the party has seen?", isPresented: $confirmingFogReset) {
            Button("Reset Explored Fog", role: .destructive) { resetExploredFog() }
        } message: {
            Text("The World View forgets everywhere the party has explored on this map, apart from what PCs can see right now. You can undo this.")
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
                switch request.purpose {
                case .newToken(let point):
                    addCroppedToken(cropped, name: request.name, centredAt: point)
                case .tokenImage(let ids):
                    if let src = document.addCroppedTokenImage(cropped, name: request.name) {
                        document.setTokenImage(src, for: ids, undoManager: undoManager)
                    }
                }
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
                isPerformanceMonitorShown: showingPerformance,
                toggleFogPreview: { fogPreview.toggle() },
                isFogPreviewShown: fogPreview,
                exportLegacy: { exportLegacy() },
                tool: tools.tool,
                selectTool: { selectTool($0) },
                showMapSettings: { mapSettings = MapSettingsRequest(map: document.campaign.activeMap, isNew: false) },
                newMap: { mapSettings = MapSettingsRequest(map: GameMap(name: "Untitled Map"), isNew: true) },
                chooseMapImage: { importTarget = .mapImage },
                addTokens: { importTarget = .tokens },
                calibrate: canCalibrate ? { startCalibration() } : nil,
                isDaylight: document.campaign.activeMap.isDaylightMode,
                toggleDaylight: {
                    let daylight = daylightBinding
                    daylight.wrappedValue.toggle()
                },
                resetFog: document.campaign.activeMap.exploredRegions.isEmpty ? nil : { confirmingFogReset = true },
                deleteSelection: selection.isEmpty ? nil : { deleteSelection() },
                showConsoleSettings: { showingConsoleSettings = true },
                zoomIn: { zoomCanvas(by: 1.25) },
                zoomOut: { zoomCanvas(by: 0.8) },
                zoomToFit: { zoomToFit() },
                showViewOnWorld: { showViewOnWorld() },
                addToInitiative: tokensWaitingForInitiative.isEmpty ? nil : { setInitiative(true, ids: tokensWaitingForInitiative) },
                nextTurn: hasInitiative ? { nextTurn() } : nil,
                previousTurn: hasInitiative ? { previousTurn() } : nil,
                sortInitiative: hasInitiative ? { sortInitiative() } : nil,
                clearInitiative: hasInitiative ? { clearInitiative() } : nil))
        .onAppear {
            #if DEBUG
                // UI audit screenshots: `-GraphiumAuditSelectFirstToken YES` selects the first token on launch.
                if UserDefaults.standard.bool(forKey: "GraphiumAuditSelectFirstToken"),
                    let firstTokenID = document.campaign.activeMap.tokens.first?.id
                {
                    selection = [firstTokenID]
                }
                if UserDefaults.standard.bool(forKey: "GraphiumAuditShowConsole") { showingConsole = true }
            #endif
            document.adoptUndoManager(undoManager)
            dismissWindow(id: WelcomeView.windowID)
            switch LaunchIntent.shared.take() {
            case .generateDungeon:
                // TS opens the dialog 100 ms after entering the editor.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { showingDungeon = true }
            case .template(let template):
                document.edit("Apply Template", undoManager: undoManager) { template.apply(to: &$0) }
                if let rooms = template.dungeonRooms {
                    generateDungeon(DungeonOptions(numRooms: rooms), clearFirst: true)
                }
                showToast("New campaign from the \(template.name) template", .success)
            case nil:
                break
            }
        }
        .onDisappear {
            // The campaign is closing: its projector and detached console go with it,
            // rather than lingering on a closed document (PARITY §1.1).
            dismissWindow(id: WorldWindow.id, value: document.sessionID)
            dismissWindow(id: SessionConsoleWindow.id, value: document.sessionID)
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
        .onChange(of: selection) { _, _ in if hasInspectableSelection { inspectorTab = .selection } }
        .onChange(of: document.campaign) { _, campaign in
            // Undo/redo or a map switch can remove selected items.
            let map = campaign.activeMap
            let live = Set(
                map.tokens.map(\.id) + map.drawings.map(\.id) + map.doors.map(\.id) + map.lights.map(\.id)
                    + map.notes.map(\.id) + map.effects.map(\.id))
            if !selection.isSubset(of: live) { selection.formIntersection(live) }
        }
        .onChange(of: document.campaign.activeMapID) { _, _ in
            calibrating = false
            document.worldNoteID = nil  // a note shown on the World View belongs to the map it is on
            setMeasurement(nil)  // so a broadcast measurement doesn't carry onto the new map's TV
        }
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
            Section {
                SidebarCampaignHeader(
                    campaignName: document.campaign.name,
                    mapCount: document.campaign.maps.count,
                    newMap: { mapSettings = MapSettingsRequest(map: GameMap(name: "Untitled Map"), isNew: true) },
                    openMapSettings: { mapSettings = MapSettingsRequest(map: document.campaign.activeMap, isNew: false) },
                    openCommandPalette: { showingPalette = true })
                SidebarActionRow(title: "Commands", symbolName: "magnifyingglass", shortcutHint: "⌘P") {
                    showingPalette = true
                }
                .selectionDisabled()
                SidebarActionRow(title: "New Map", symbolName: "plus.square") {
                    mapSettings = MapSettingsRequest(map: GameMap(name: "Untitled Map"), isNew: true)
                }
                .selectionDisabled()
            }
            .listRowSeparator(.hidden)
            ForEach(sidebarSectionOrder) { kind in
                switch kind {
                case .maps: mapsSection
                case .library: librarySection
                case .initiative: initiativeSection
                case .doors: doorsSection
                }
            }
        }
        .navigationSplitViewColumnWidth(min: 200, ideal: 240)
        .task(id: mapThumbnailFingerprint) {
            await mapThumbnails.refresh(campaign: document.campaign, packageURL: document.fileURL)
        }
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

    /// Changes when something that shows in a map's thumbnail changes, so thumbnails redraw then and not on every edit.
    private var mapThumbnailFingerprint: [String] {
        document.campaign.maps.map { map in
            "\(map.id)|\(map.gridSize)|\(map.tokens.count)|\(map.doors.count)|\(map.drawings.count)|\(map.background?.src ?? "")"
        }
    }

    private var sidebarSectionOrder: [SidebarSectionKind] { SidebarSectionKind.order(fromStored: sidebarSectionOrderStored) }

    private func sectionHeader(_ title: String, _ kind: SidebarSectionKind) -> some View {
        SidebarSectionHeader(title: title, kind: kind, order: sidebarSectionOrder) {
            sidebarSectionOrderStored = SidebarSectionKind.stored($0)
        }
    }

    @ViewBuilder
    private var mapsSection: some View {
            Section(isExpanded: $mapsExpanded) {
                // Alphabetical, as TS (PARITY §2.1).
                ForEach(document.campaign.maps.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }) { map in
                    SidebarMapRow(name: map.name, thumbnail: mapThumbnails.thumbnailsByMapID[map.id])
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
        } header: {
            sectionHeader("Maps", .maps)
        }
    }

    @ViewBuilder
    private var doorsSection: some View {
            let doors = document.campaign.activeMap.doors
            if !doors.isEmpty {
                // Bulk door controls (PARITY §2.1).
                Section {
                    Button("Open All Unlocked Doors") {
                        document.edit("Open Doors", undoManager: undoManager) {
                            $0.activeMap.setAllUnlockedDoors(open: true)
                        }
                    }
                    .help("Locked and hidden doors stay shut")
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
                    let hidden = Set(doors.filter { $0.isHidden == true }.map(\.id))
                    if !hidden.isEmpty {
                        Button("Reveal All Hidden Doors") {
                            document.edit("Reveal Doors", undoManager: undoManager) {
                                $0.activeMap.setDoorsHidden(hidden, hidden: false)
                            }
                        }
                    }
                } header: {
                    sectionHeader("Doors", .doors)
                }
                .buttonStyle(.borderless)
                .foregroundStyle(Palette.accentText.color)
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
                dropTokens: { ids, primary, dx, dy, duplicate, travel in
                    var placed: [String] = []
                    let current = document.campaign
                    let takesStairs =
                        travel
                        && current.activeMap.stairsTravel(forDropOf: primary, dx: dx, dy: dy, library: current.libraryIndex)
                            != nil
                    let name = duplicate ? "Duplicate Tokens" : takesStairs ? "Take Stairs" : "Move Tokens"
                    document.edit(name, undoManager: undoManager) { campaign in
                        var map = campaign.activeMap
                        placed = map.dropTokens(
                            ids, primary: primary, dx: dx, dy: dy, duplicate: duplicate,
                            library: campaign.libraryIndex, travel: travel)
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
                placeLight: { point in
                    document.edit("Place \(tools.lightPreset.name)", undoManager: undoManager) {
                        $0.activeMap.placeLight(tools.lightPreset, at: point)
                    }
                },
                placeStairs: { point in placeStairs(at: point) },
                pickStairs: { id in pickStairs(id) },
                stairsAction: { ids, action in performStairsAction(ids, action) },
                lightAction: { ids, action in performLightAction(ids, action) },
                placeNote: { point in
                    var placed: MapNote?
                    document.edit("Add Note", undoManager: undoManager) { placed = $0.activeMap.placeNote(at: point) }
                    if let placed { selection = [placed.id] }
                },
                noteAction: { ids, action in performNoteAction(ids, action) },
                placeEffect: { effect in
                    var placed: SpellEffect?
                    document.edit("Add \(effect.shape.title)", undoManager: undoManager) { campaign in
                        let library = campaign.libraryIndex
                        placed = campaign.activeMap.placeEffect(effect, library: library)
                    }
                    if let placed { selection = [placed.id] }
                },
                effectAction: { ids, action in performEffectAction(ids, action) },
                doorAction: { id, action in performDoorAction(id, action) },
                wallAction: { ids, action in performWallAction(ids, action) },
                markerAction: { ids, action in performMarkerAction(ids, action) },
                setMeasurement: { setMeasurement($0) },
                setTool: { selectTool($0) },
                toggleDoorOrientation: {
                    tools.doorOrientation = tools.doorOrientation == .horizontal ? .vertical : .horizontal
                },
                turnStairsTool: {
                    let order: [CompassDirection] = [.north, .east, .south, .west]
                    let i = order.firstIndex(of: tools.stairsDirection) ?? 0
                    tools.stairsDirection = order[(i + 1) % order.count]
                },
                deleteDoors: { ids in
                    document.edit(ids.count == 1 ? "Delete Door" : "Delete Doors", undoManager: undoManager) {
                        $0.activeMap.removeItems(ids)
                    }
                    selection.subtract(ids)
                },
                rotateDoors: { ids, degrees in
                    document.edit(ids.count == 1 ? "Rotate Door" : "Rotate Doors", undoManager: undoManager) {
                        $0.activeMap.rotateDoors(ids, by: degrees)
                    }
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
                    let map = document.campaign.activeMap
                    let one = ids.count == 1
                    let kinds = [
                        map.drawings.contains { ids.contains($0.id) } ? "Strokes" : nil,
                        map.lights.contains { ids.contains($0.id) } ? (one ? "Light" : "Lights") : nil,
                        map.notes.contains { ids.contains($0.id) } ? (one ? "Note" : "Notes") : nil,
                        map.effects.contains { ids.contains($0.id) } ? (one ? "Effect" : "Effects") : nil,
                        map.stairs.contains { ids.contains($0.id) } ? "Stairs" : nil,
                    ].compactMap { $0 }
                    let noun = kinds.count == 1 ? kinds[0] : "Items"
                    document.edit(duplicate ? "Duplicate \(noun)" : "Move \(noun)", undoManager: undoManager) {
                        placed = $0.activeMap.moveDrawings(ids, dx: dx, dy: dy, duplicate: duplicate)
                            + $0.activeMap.moveLights(ids, dx: dx, dy: dy, duplicate: duplicate)
                            + $0.activeMap.moveNotes(ids, dx: dx, dy: dy, duplicate: duplicate)
                            + $0.activeMap.moveEffects(ids, dx: dx, dy: dy, duplicate: duplicate)
                            + $0.activeMap.moveStairs(ids, dx: dx, dy: dy, duplicate: duplicate)
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
                    showToast(
                        applied ? "Map calibrated to the grid" : "That box was too small. Zoom in and drag around one grid cell.",
                        applied ? .success : .error)
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
                tokenMenu: { ids in
                    TokenMenu.make(
                        tokenIDs: ids, document: document,
                        chooseFile: { importTarget = .tokenImage(ids) },
                        pickLibraryItem: { item in
                            if !document.setTokenImage(from: item, for: ids, undoManager: undoManager) {
                                errorMessage = "“\(item.name)” is missing its image in the library."
                            }
                        },
                        setInitiative: { add in setInitiative(add, ids: ids) },
                        delete: {
                            document.edit(ids.count == 1 ? "Delete Token" : "Delete Tokens", undoManager: undoManager) {
                                $0.activeMap.removeItems(ids)
                            }
                            selection.subtract(ids)
                        })
                },
                openColorPicker: { openMarkerColorPicker() },
                stopAudio: { document.dispatch(.stop) },
                revealArea: { rect, snap in
                    document.edit("Reveal Area", undoManager: undoManager) { campaign in
                        let map = campaign.activeMap
                        campaign.activeMap.revealedAreas.append(RevealedArea(rect: rect, gridSize: map.gridSize, snap: snap))
                    }
                },
                hideRevealedArea: { id in
                    document.edit("Hide Area", undoManager: undoManager) { $0.activeMap.revealedAreas.removeAll { $0.id == id } }
                }
            ),
            fog: fogPreview ? playersFog(campaign) : nil,
            toolState: penAdjusted(tools),
            measurement: measurement,
            fitRequest: fitRequest,
            zoomRequest: zoomRequest,
            onViewportChange: { [camera] viewport, size in
                camera.viewport = viewport
                camera.size = size
                canvasViewportModel.viewport = viewport
                if canvasZoom != viewport.zoom { canvasZoom = viewport.zoom }
            },
            calibrating: calibrating,
            assetNamespace: document.sessionID.uuidString,
            videoProvider: { [document] name, ready in
                document.videoFiles.url(named: name, in: document.assets, ready: ready)
            },
            animationPaused: document.isMapAnimationPaused
        )
        .overlay(alignment: .top) {
            canvasBanner
                .animation(Motion.animation(Motion.quick, reduceMotion: reduceMotion), value: toast)
                .animation(Motion.animation(Motion.quick, reduceMotion: reduceMotion), value: calibrating)
        }
        .overlay {
            TokenSelectionPill(
                viewportModel: canvasViewportModel,
                selectionBoundsInMapUnits: selectedTokenBounds,
                addToInitiative: tokensWaitingForInitiative.isEmpty ? nil : { setInitiative(true, ids: tokensWaitingForInitiative) },
                deleteSelection: { deleteSelection() })
        }
        .overlay(alignment: .bottomTrailing) {
            MapZoomControls(zoomIn: { zoomCanvas(by: 1.25) }, zoomOut: { zoomCanvas(by: 0.8) }, zoomToFit: { zoomToFit() })
                .padding(Spacing.lg)
        }
        .overlay(alignment: .bottomLeading) {
            MapScaleReadout(zoom: canvasZoom, gridSize: campaign.activeMap.gridSize)
                .padding(Spacing.lg)
        }
        .overlay(alignment: .topTrailing) {
            if showingPerformance { PerformanceOverlay(document: document).padding(Spacing.lg) }
        }
        .overlay(alignment: .bottom) {
            // While the TV shows "Please Wait", say so where the DM is looking (#370), with the
            // way back. Glyph and words, so it doesn't rely on the toolbar item's tint.
            if document.isPaused, document.worldViewsOpen > 0 {
                HStack(spacing: Spacing.md) {
                    Label("Players see “Please Wait”", systemImage: "pause.circle.fill")
                    Button("Resume") { document.isPaused = false }
                }
                .glassPanel(.capsule, padding: GlassPadding.message)
                .padding(Spacing.lg)
                .transition(.opacity)
            } else if document.worldViewsOpen > 0, playersSeeOnlyFog {
                // Fog on and no PC: the TV is all black and nothing there may say why (players'
                // screen), so the DM hears it here, with both ways out (docs/qa/LAUNCH_QA.md, I1).
                HStack(spacing: Spacing.md) {
                    Label("Players see only fog: no PC on this map can see", systemImage: "eye.slash")
                    if hasSelectedTokens {
                        Button("Make PC") { makeSelectedTokensPCs() }
                    }
                    Button("Turn On Daylight") { daylightBinding.wrappedValue = true }
                        .help("Daylight: no fog of war on this map")
                }
                .glassPanel(.capsule, padding: GlassPadding.message)
                .padding(Spacing.lg)
                .transition(.opacity)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("fog-only-warning")
            }
        }
        .overlay {
            if importsInFlight > 0 {
                ProgressView("Importing image…")
                    .glassPanel(.card, padding: EdgeInsets(top: Spacing.lg, leading: Spacing.xl, bottom: Spacing.lg, trailing: Spacing.xl))
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
            "tool-wall": .wall, "tool-door": .door, "tool-stairs": .stairs, "tool-light": .light, "tool-note": .note, "tool-effect": .effect, "tool-reveal": .reveal,
            "tool-measure": .measure,
        ]
        if let tool = tools[command.id] {
            selectTool(tool)
            return
        }
        switch command.id {
        case "world-view-toggle-pause": document.isPaused.toggle()
        case "world-view-launch": openWindow(id: WorldWindow.id, value: document.sessionID)
        case "world-view-show-this-view": showViewOnWorld()
        case "dungeon-generate": showingDungeon = true
        // After the palette sheet has closed, so the open panel isn't dropped with it.
        case "map-image": DispatchQueue.main.async { importTarget = .mapImage }
        case "place-generic-token": placeGenericToken(at: nil)
        case "selection-make-pc": makeSelectedTokensPCs()
        case "fog-reset":
            // After the palette sheet has closed, so the dialog isn't dropped with it.
            DispatchQueue.main.async { confirmingFogReset = !document.campaign.activeMap.exploredRegions.isEmpty }
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
        Section(isExpanded: $libraryExpanded) {
            SidebarActionRow(title: "Place Token…", symbolName: "person.crop.circle.badge.plus") { showingPalette = true }
                .selectionDisabled()
            SidebarActionRow(title: "Add to Library…", symbolName: "square.and.arrow.down") { importTarget = .libraryUpload }
                .selectionDisabled()
            SidebarActionRow(title: "Manage Library…", symbolName: "square.grid.2x2") { showingLibrary = true }
                .selectionDisabled()
            Button {
                placeGenericToken(at: nil)
            } label: {
                HStack {
                    Image(systemName: "person.crop.circle.fill")
                        .frame(width: 32, height: 32)
                        .background(Palette.surfaceSunken.color, in: RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
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
        } header: {
            sectionHeader("Library", .library)
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
                .frame(width: 32, height: 32)
                .background(Palette.surfaceSunken.color, in: RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
                .clipShape(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
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
        if let id = document.placeLibraryItem(item, centredAt: point ?? freePlacementPoint(), undoManager: undoManager) {
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
        let package = CampaignPackage(campaign: document.campaign, assets: document.assets)
        let files = document.videoFiles
        Task { @MainActor in
            // Video map backgrounds go out as their first frame: the web app shows images only.
            let exported = await package.withVideoBackgroundsAsPosters(files: files)
            do {
                legacyExport = try LegacyGraphiumFile(package: exported)
            } catch {
                showToast(error.localizedDescription, .error)
            }
        }
    }

    /// Players see only what PCs see, so this is what turns an all-fog World View into the map.
    private func makeSelectedTokensPCs() {
        let ids = Set(document.campaign.activeMap.tokens.map(\.id)).intersection(selection)
        guard !ids.isEmpty else {
            showToast("Select a token first, then make it a PC.")
            return
        }
        document.edit(ids.count == 1 ? "Make PC" : "Make PCs", undoManager: undoManager) { campaign in
            let library = campaign.libraryIndex
            campaign.activeMap.makePCs(ids, library: library)
        }
    }

    private func placeGenericToken(at point: Point2D?) {
        if let id = document.placeGenericToken(centredAt: point ?? freePlacementPoint(), undoManager: undoManager) {
            selection = [id]
        }
    }

    /// The fog the World View draws (CORE_SPEC §3.3), for the DM's preview; none in daylight.
    private func playersFog(_ campaign: Campaign) -> FogState? {
        let map = campaign.activeMap
        guard !map.isDaylightMode else { return nil }
        let visibility = fogPreviewCache.visibility(of: map, library: campaign.libraryIndex)
        return FogState(
            mapID: map.id, bounds: LineOfSight.fogBounds(of: map), explored: map.exploredRegions,
            vision: visibility.vision, lit: visibility.sight.lit, ambient: visibility.sight.ambient,
            hatchWalls: LineOfSight.hatchWalls(of: map), gridSize: map.gridSize,
            flames: Set(map.lights.filter(\.isFlame).map(\.id)))
    }

    /// Where a click-to-place token lands: the centre of what the DM is looking at, stepped a
    /// cell right past tokens already there, so placing several doesn't stack them or drop them
    /// off-screen. Nil before the canvas has a size (falls back to the map centre).
    private func freePlacementPoint() -> Point2D? {
        guard camera.size.width > 0, camera.size.height > 0 else { return nil }
        let visible = camera.viewport.visibleBounds(viewWidth: camera.size.width, viewHeight: camera.size.height)
        let map = document.campaign.activeMap
        let library = document.campaign.libraryIndex
        var point = Point2D(x: visible.x + visible.width / 2, y: visible.y + visible.height / 2)
        for _ in 0..<12 where map.token(at: point, library: library) != nil { point.x += map.gridSize }
        return point
    }

    /// Finder drops: on an empty map, one image becomes the map; otherwise
    /// one image goes through the 1:1 cropper (TS) and several import directly.
    private func dropImages(_ urls: [URL], at point: Point2D) {
        if urls.count == 1, let url = urls.first, isMapEmpty {
            setMapImage(from: url)
        } else if urls.count == 1, let url = urls.first,
            let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
        {
            cropping = CropRequest(image: image, name: url.lastPathComponent, purpose: .newToken(centredAt: point))
        } else {
            addTokens(from: urls, at: point, centred: true)
        }
    }

    /// Change Image: the chosen file goes through the same 1:1 cropper as a Finder drop.
    private func cropTokenImage(from url: URL, for ids: Set<String>) {
        guard !ids.isEmpty else { return }
        let image = withAccess(to: url) { () -> CGImage? in
            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
            // Decoded now, while the file is still accessible.
            return CGImageSourceCreateImageAtIndex(
                source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
        }
        guard let image else {
            errorMessage = ImportedImage.ImportError.unreadable(url.lastPathComponent).localizedDescription
            return
        }
        cropping = CropRequest(image: image, name: url.lastPathComponent, purpose: .tokenImage(ids))
    }

    private func addCroppedToken(_ image: CGImage, name: String, centredAt point: Point2D) {
        guard let asset = document.addCroppedTokenImage(image, name: name) else { return }
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
        pendingStairsID = nil  // a lone end stays as plain stairs
        setMeasurement(nil)  // changing tool clears the measurement (TS)
        // A door picked under another tool shouldn't take R and the arrows under this one.
        let doorIDs = Set(document.campaign.activeMap.doors.map(\.id))
        if !selection.isDisjoint(with: doorIDs) { selection.subtract(doorIDs) }
    }

    private var markerColorBinding: Binding<Color> {
        Binding(
            get: { Color(nsColor: NSColor(hex: tools.markerColor) ?? .systemOrange) },
            set: { color in
                let hex = NSColor(color).usingColorSpace(.sRGB)?.hexString ?? StrokeDefaults.markerColor
                pickMarkerColor(hex)
            })
    }

    /// Sets the marker colour and moves it to the front of the recents (TS `setColor`, PARITY §2.2).
    private func pickMarkerColor(_ hex: String) {
        tools.markerColor = hex
        recentColors = StrokeDefaults.recentColors(picking: hex, after: recentColors)
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
            // World points, so walls that were moved still snap where they are drawn.
            let existing = document.campaign.activeMap.drawings.filter { $0.tool == .wall }
                .map { $0.worldPoints.flatMap { [$0.x, $0.y] } }
            stroke.points = PathOptimization.finalizeWall(drawing.points, existingWalls: existing)
            name = "Draw Wall"
        case .marker:
            name = "Draw"
        case .eraser:
            name = "Erase"
        }
        document.edit(name, undoManager: undoManager) {
            $0.activeMap.drawings.append(stroke)
            // A wall drawn up to a door meets its end, so no light slips past.
            if stroke.tool == .wall { $0.activeMap.joinWallToDoors(id: stroke.id) }
        }
    }

    private func performWallAction(_ ids: Set<String>, _ action: WallAction) {
        let plural = ids.count == 1 ? "Wall" : "Walls"
        switch action {
        case .kind(let kind):
            document.edit("Change \(plural) to \(kind.title)", undoManager: undoManager) {
                $0.activeMap.setWallKind(kind, ids: ids)
            }
        case .oneWay(let oneWay):
            document.edit(oneWay ? "Make \(plural) One-Way" : "Make \(plural) Two-Way", undoManager: undoManager) {
                $0.activeMap.setOneWay(oneWay, ids: ids)
            }
        case .flip:
            document.edit("Flip \(plural)", undoManager: undoManager) { $0.activeMap.flipWalls(ids) }
        case .delete:
            document.edit("Delete \(plural)", undoManager: undoManager) { $0.activeMap.removeItems(ids) }
            selection.subtract(ids)
        }
    }

    private func performMarkerAction(_ ids: Set<String>, _ action: MarkerAction) {
        let plural = ids.count == 1 ? "Marker" : "Markers"
        switch action {
        case .dmOnly(let dmOnly):
            document.edit(dmOnly ? "Hide \(plural) from Players" : "Show \(plural) to Players", undoManager: undoManager) {
                $0.activeMap.setMarkersDMOnly(dmOnly, ids: ids)
            }
        case .delete:
            document.edit("Delete \(plural)", undoManager: undoManager) { $0.activeMap.removeItems(ids) }
            selection.subtract(ids)
        }
    }

    private func performLightAction(_ ids: Set<String>, _ action: LightAction) {
        let plural = ids.count == 1 ? "Light" : "Lights"
        switch action {
        case .on(let on):
            document.edit(on ? "Turn On \(plural)" : "Turn Off \(plural)", undoManager: undoManager) {
                $0.activeMap.setLights(ids, on: on)
            }
        case .preset(let preset):
            document.edit("Change \(plural) to \(preset.name)", undoManager: undoManager) {
                $0.activeMap.applyLightPreset(preset, to: ids)
            }
        case .delete:
            document.edit("Delete \(plural)", undoManager: undoManager) { $0.activeMap.removeItems(ids) }
            selection.subtract(ids)
        }
    }

    private func performNoteAction(_ ids: Set<String>, _ action: NoteAction) {
        let plural = ids.count == 1 ? "Note" : "Notes"
        switch action {
        case .share(let shared):
            document.edit(shared ? "Share \(plural)" : "Unshare \(plural)", undoManager: undoManager) {
                $0.activeMap.setNotesShared(ids, shared: shared)
            }
        case .showOnWorldView:
            document.worldNoteID = ids.first
        case .delete:
            document.edit("Delete \(plural)", undoManager: undoManager) { $0.activeMap.removeItems(ids) }
            selection.subtract(ids)
            if let shown = document.worldNoteID, ids.contains(shown) { document.worldNoteID = nil }
        }
    }

    private func performEffectAction(_ ids: Set<String>, _ action: EffectAction) {
        let plural = ids.count == 1 ? "Effect" : "Effects"
        switch action {
        case .hide(let hidden):
            document.edit(hidden ? "Hide \(plural) from Players" : "Show \(plural) to Players", undoManager: undoManager) {
                $0.activeMap.setEffectsHidden(ids, hidden: hidden)
            }
        case .look(let look):
            document.edit("Change \(plural) to \(look.title)", undoManager: undoManager) { campaign in
                for id in ids {
                    campaign.activeMap.updateEffect(id: id) {
                        $0.look = look
                        $0.color = nil
                    }
                }
            }
        case .rotate(let degrees):
            document.edit("Rotate \(plural)", undoManager: undoManager) { $0.activeMap.rotateEffects(ids, by: degrees) }
        case .detach:
            document.edit("Leave \(plural) on the Map", undoManager: undoManager) { campaign in
                let library = campaign.libraryIndex
                campaign.activeMap.attachEffects(ids, to: nil, library: library)
            }
        case .delete:
            document.edit("Delete \(plural)", undoManager: undoManager) { $0.activeMap.removeItems(ids) }
            selection.subtract(ids)
        }
    }

    // MARK: Stairs

    /// A Stairs tool click on open ground: the first end of a pair, or its sister.
    private func placeStairs(at point: Point2D) {
        var placed: Stairs?
        let sister = pendingStairsID
        document.edit(sister == nil ? "Add Stairs" : "Link Stairs", undoManager: undoManager) {
            placed = $0.activeMap.placeStairs(at: point, direction: tools.stairsDirection, linkingTo: sister)
        }
        guard let placed else { return }
        selection = [placed.id]
        pendingStairsID = placed.linkedStairsId == nil ? placed.id : nil
    }

    /// A Stairs tool click on stairs: links them to the end waiting for a sister, else selects them.
    private func pickStairs(_ id: String) {
        if let pending = pendingStairsID, pending != id,
            document.campaign.activeMap.stairs.contains(where: { $0.id == pending })
        {
            document.edit("Link Stairs", undoManager: undoManager) { $0.activeMap.linkStairs(pending, id) }
            pendingStairsID = nil
        } else {
            pendingStairsID = nil
        }
        selection = [id]
    }

    private func performStairsAction(_ ids: Set<String>, _ action: StairsAction) {
        switch action {
        case .rotate:
            document.edit("Rotate Stairs", undoManager: undoManager) { $0.activeMap.rotateStairs(ids) }
        case .unlink:
            document.edit("Unlink Stairs", undoManager: undoManager) { $0.activeMap.unlinkStairs(ids) }
        case .delete:
            document.edit("Delete Stairs", undoManager: undoManager) { $0.activeMap.removeStairs(ids) }
            selection.subtract(ids)
            if let pending = pendingStairsID, ids.contains(pending) { pendingStairsID = nil }
        }
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
        case .hide, .reveal:
            document.edit(action == .hide ? "Hide Door" : "Reveal Door", undoManager: undoManager) { campaign in
                campaign.activeMap.setDoorsHidden([id], hidden: action == .hide)
                // A hidden door reads as wall only while shut, so hiding an open one shuts it.
                if action == .hide, let i = campaign.activeMap.doors.firstIndex(where: { $0.id == id }) {
                    campaign.activeMap.doors[i].isOpen = false
                }
            }
        case .delete:
            document.edit("Delete Door", undoManager: undoManager) { $0.activeMap.doors.removeAll { $0.id == id } }
            selection.remove(id)
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
            get: { hasInspectableSelection || showingConsole },
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
            .help("Set this map's background: an image, or an MP4 or MOV video for an animated map")
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
        // Blanking the projector must always be one click away, so it can't be customised out.
        .customizationBehavior(.disabled)
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
                confirmingFogReset = true
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
            .help("Generate a random dungeon (⇧⌘D)")
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
                        pickMarkerColor(hex)
                    }
                }
                ForEach(recentColors, id: \.self) { hex in
                    Button {
                        pickMarkerColor(hex)
                    } label: {
                        Image(systemName: "circle.fill").foregroundStyle(Color(nsColor: NSColor(hex: hex) ?? .black))
                    }
                    .help(hex)
                    .accessibilityLabel("Recent colour \(hex)")
                }
            }
        case .wall:
            HStack(spacing: 6) {
                Picker("Wall Type", selection: $tools.wallKind) {
                    ForEach(WallKind.allCases, id: \.self) { kind in
                        Text(kind.title).tag(kind)
                    }
                }
                .pickerStyle(.segmented)
                .help("Walls block sight; windows let it through")
                Toggle(isOn: $tools.wallOneWay) {
                    Label("One-Way", systemImage: "arrow.forward")
                }
                .toggleStyle(.button)
                .help("Sight passes from the left of the wall as you draw it; ticks mark the blocked side")
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
        case .stairs:
            HStack(spacing: 6) {
                Picker("Facing", selection: $tools.stairsDirection) {
                    Label("North", systemImage: "arrow.up").tag(CompassDirection.north)
                    Label("East", systemImage: "arrow.right").tag(CompassDirection.east)
                    Label("South", systemImage: "arrow.down").tag(CompassDirection.south)
                    Label("West", systemImage: "arrow.left").tag(CompassDirection.west)
                }
                .pickerStyle(.segmented)
                .labelStyle(.iconOnly)
                .help("Which way the steps face (R turns them)")
                Text(pendingStairsID == nil ? "Click the first end" : "Click the other end")
                    .foregroundStyle(.secondary)
                    .help("A token dropped on one end arrives at the other. Hold ⌘ while dropping to stop on the stairs.")
            }
        case .light:
            Picker("Light", selection: $tools.lightPreset) {
                ForEach(LightPreset.all) { preset in
                    Text(preset.name).tag(preset)
                }
            }
            .help(
                "\(tools.lightPreset.name): \(jsNumber(tools.lightPreset.bright)) ft bright light, dim light out to \(jsNumber(tools.lightPreset.dim)) ft")
        case .effect:
            HStack(spacing: 6) {
                Picker("Shape", selection: $tools.effectShape) {
                    ForEach(SpellEffect.Shape.allCases) { shape in
                        Text(shape.title).tag(shape)
                    }
                }
                .pickerStyle(.segmented)
                .help("Drag from the point of origin to size and aim it; Shift snaps the direction to 45°")
                Picker("Look", selection: $tools.effectLook) {
                    ForEach(SpellEffect.Look.allCases) { look in
                        Text(look.title).tag(look)
                    }
                }
                .help("How the area looks: each has its own colour and pattern")
            }
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
        document.edit("Reset Explored Fog", undoManager: undoManager) { campaign in
            let library = campaign.libraryIndex
            campaign.activeMap.resetExploration(library: library, timestamp: Date().timeIntervalSince1970 * 1000)
        }
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
                let background = try await ImportedBackground.load(from: url)
                let name = document.addAsset(background.data, preferredName: background.preferredName)
                document.edit(background.isVideo ? "Set Map Video" : "Set Map Image", undoManager: undoManager) {
                    campaign in
                    // The map the user chose it for, even if they switched maps meanwhile.
                    guard let i = campaign.maps.firstIndex(where: { $0.id == mapID }) else { return }
                    campaign.maps[i].background = MapBackground(
                        src: name, width: background.width, height: background.height)
                }
                // Same next step as Map Settings: show the whole image, then calibrate its grid.
                guard document.campaign.activeMapID == mapID else { return }
                zoomToFit()
                if canCalibrate { startCalibration() }
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
        let map = document.campaign.activeMap
        let tokenCount = map.tokens.filter { ids.contains($0.id) }.count
        let doorCount = map.doors.filter { ids.contains($0.id) }.count
        let name =
            tokenCount == ids.count
            ? (ids.count == 1 ? "Delete Token" : "Delete Tokens")
            : doorCount == ids.count ? (ids.count == 1 ? "Delete Door" : "Delete Doors") : "Delete Selection"
        document.edit(name, undoManager: undoManager) { $0.activeMap.removeItems(ids) }
        selection = []
        if let shown = document.worldNoteID, ids.contains(shown) { document.worldNoteID = nil }
    }

    /// The selected tokens' combined footprint in map units, for the selection pill.
    private var selectedTokenBounds: Bounds? {
        let map = document.campaign.activeMap
        let library = document.campaign.libraryIndex
        let footprints = map.tokens.filter { selection.contains($0.id) }.map { map.tokenBounds($0, library: library) }
        guard let first = footprints.first else { return nil }
        let left = footprints.map(\.x).min() ?? first.x
        let top = footprints.map(\.y).min() ?? first.y
        let right = footprints.map { $0.x + $0.width }.max() ?? first.x + first.width
        let bottom = footprints.map { $0.y + $0.height }.max() ?? first.y + first.height
        return Bounds(x: left, y: top, width: right - left, height: bottom - top)
    }

    private var hasSelectedTokens: Bool {
        document.campaign.activeMap.tokens.contains { selection.contains($0.id) }
    }

    private var hasSelectedNotes: Bool {
        document.campaign.activeMap.notes.contains { selection.contains($0.id) }
    }

    private var hasSelectedEffects: Bool {
        document.campaign.activeMap.effects.contains { selection.contains($0.id) }
    }

    /// Tokens, notes or effects, which the inspector edits.
    private var hasInspectableSelection: Bool { hasSelectedTokens || hasSelectedNotes || hasSelectedEffects }

    // MARK: Initiative (issue #356)

    private var hasInitiative: Bool { !document.campaign.activeMap.initiative.isEmpty }

    /// Selected tokens not yet in the turn order.
    private var tokensWaitingForInitiative: Set<String> {
        let map = document.campaign.activeMap
        return Set(map.tokens.lazy.map(\.id).filter { selection.contains($0) && !map.initiative.contains($0) })
    }

    /// Adds tokens to the active map's turn order, or takes them out.
    private func setInitiative(_ add: Bool, ids: Set<String>) {
        document.edit(add ? "Add to Initiative" : "Remove from Initiative", undoManager: undoManager) { campaign in
            if add {
                campaign.activeMap.addToInitiative(ids)
            } else {
                campaign.activeMap.initiative.remove(ids)
            }
        }
    }

    private func editInitiative(_ actionName: String, _ change: (inout Initiative) -> Void) {
        document.edit(actionName, undoManager: undoManager) { change(&$0.activeMap.initiative) }
    }

    private func nextTurn() {
        document.stepTurn(forward: true, undoManager: undoManager)
        revealCurrentCombatant()
    }
    private func previousTurn() {
        document.stepTurn(forward: false, undoManager: undoManager)
        revealCurrentCombatant()
    }

    /// Pans (same zoom) to whose turn it is when their token is entirely off-screen, so the turn
    /// ring is always in view. A token already partly visible doesn't move the camera.
    private func revealCurrentCombatant() {
        let map = document.campaign.activeMap
        guard camera.size.width > 0, camera.size.height > 0, let id = map.initiative.currentTokenID,
            let token = map.tokens.first(where: { $0.id == id })
        else { return }
        let visible = camera.viewport.visibleBounds(viewWidth: camera.size.width, viewHeight: camera.size.height)
        let box = map.tokenDisplayBounds(token, library: document.campaign.libraryIndex)
        guard !visible.intersects(box) else { return }
        fitRequest = FitRequest(
            bounds: Bounds(
                x: box.x + box.width / 2 - visible.width / 2, y: box.y + box.height / 2 - visible.height / 2,
                width: visible.width, height: visible.height))
    }
    private func sortInitiative() { editInitiative("Sort Initiative") { $0.sort() } }
    /// Ends the encounter.
    private func clearInitiative() { editInitiative("Clear Initiative") { $0 = Initiative() } }

    /// The active map's turn order: whose turn it is, each combatant's initiative, and the turn
    /// controls. The World View lists the same order for players (decision 016).
    @ViewBuilder
    private var initiativeSection: some View {
        let map = document.campaign.activeMap
        let initiative = map.initiative
        if !initiative.isEmpty {
            let library = document.campaign.libraryIndex
            Section {
                ForEach(initiative.entries, id: \.tokenID) { entry in
                    initiativeRow(entry, map: map, library: library, isCurrent: entry.tokenID == initiative.currentTokenID)
                }
                HStack(spacing: Spacing.md) {
                    Button { previousTurn() } label: {
                        Label("Previous Turn", systemImage: "backward.end.fill")
                    }
                    .help("Previous turn (⌘[)")
                    Button { nextTurn() } label: {
                        Label("Next Turn", systemImage: "forward.end.fill")
                    }
                    .help("Next turn (⌘])")
                    Spacer(minLength: 0)
                    // Clear Initiative stays in the Session menu: a small icon next to Sort is
                    // too easy to hit at a dim table.
                    Button { sortInitiative() } label: {
                        Label("Sort", systemImage: "arrow.down.to.line")
                    }
                    .help("Sort by initiative, highest first (the first Next Turn sorts too)")
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.borderless)
            } header: {
                let round: String = initiative.currentTokenID == nil ? "" : " · Round \(initiative.round)"
                sectionHeader("Initiative\(round)", .initiative)
            }
        }
    }

    /// One combatant: a play glyph on the current turn, the token's real name (the DM's view)
    /// and its initiative, editable in place.
    private func initiativeRow(
        _ entry: Initiative.Entry, map: GameMap, library: [String: TokenLibraryItem], isCurrent: Bool
    ) -> some View {
        let token = map.tokens.first { $0.id == entry.tokenID }
        let name = token.map { ResolvedToken($0, library: library).name } ?? "Missing Token"
        let id = entry.tokenID
        return HStack(spacing: Spacing.sm) {
            Image(systemName: "play.fill")
                .font(.caption)
                .opacity(isCurrent ? 1 : 0)
                .accessibilityHidden(true)
            Text(name)
                .fontWeight(isCurrent ? .semibold : .regular)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture { if token != nil { selection = [id] } }
                .accessibilityAddTraits(.isButton)
                .accessibilityHint("Selects the token")
                .accessibilityValue(isCurrent ? "Current turn" : "")
            TextField(
                "Initiative",
                value: Binding(
                    get: { entry.value },
                    set: { value in editInitiative("Change Initiative") { $0.setValue(value, for: id) } }),
                format: .number
            )
            .labelsHidden()
            .multilineTextAlignment(.trailing)
            .monospacedDigit()
            .frame(width: 44)
        }
        // Contain, not combine, so VoiceOver can still reach and edit the initiative field.
        .accessibilityElement(children: .contain)
        .contextMenu {
            Button("Make Current Turn") { editInitiative("Change Turn") { $0.currentTokenID = id } }
                .disabled(isCurrent)
            Button("Select Token") { selection = [id] }
                .disabled(token == nil)
            Divider()
            Button("Remove from Initiative") { setInitiative(false, ids: [id]) }
        }
    }

    private func saveMapSettings(_ map: GameMap, isNew: Bool) {
        document.edit(isNew ? "Add Map" : "Map Settings", undoManager: undoManager) { campaign in
            if isNew {
                campaign.maps.append(map)
                campaign.activeMapID = map.id
            } else if let i = campaign.maps.firstIndex(where: { $0.id == map.id }) {
                campaign.maps[i].applySettings(from: map)
            }
        }
        if isNew { selection = [] }
    }

    /// One toast at a time; a new one replaces it (PARITY §1.6).
    private func showToast(_ message: String, _ kind: Toast.Kind = .info) {
        toast = Toast(message: message, kind: kind)
        // VoiceOver hears what the toast says, errors first (docs/qa/LAUNCH_QA.md, K2).
        NSAccessibility.post(
            element: NSApp as Any, notification: .announcementRequested,
            userInfo: [
                .announcement: "\(kind.accessibilityLabel): \(message)",
                .priority: (kind == .error ? NSAccessibilityPriorityLevel.high : .medium).rawValue,
            ])
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
            HStack(spacing: Spacing.md) {
                Label {
                    Text("Zoom in, then drag a box around one grid cell")
                } icon: {
                    Image(systemName: "square.dashed").foregroundStyle(Palette.accentText.color)
                }
                Button("Cancel") { calibrating = false }
                    .keyboardShortcut(.cancelAction)
            }
            .glassPanel(.capsule, padding: GlassPadding.message)
            .padding(.top, Spacing.md)
            .transition(.opacity)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("calibration-banner")
        } else if let toast {
            HStack(spacing: Spacing.sm + 2) {
                Image(systemName: toast.kind.symbol)
                    .foregroundStyle(toast.kind.tint.color)
                    .accessibilityLabel(toast.kind.accessibilityLabel)
                Text(toast.message)
                    .lineLimit(2)
                Button {
                    self.toast = nil
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.borderless)
                .foregroundStyle(Palette.inkSecondary.color)
                .accessibilityLabel("Close notification")
            }
            .glassPanel(.capsule, padding: GlassPadding.message)
            .frame(maxWidth: 560)
            .padding(.top, Spacing.md)
            .transition(.opacity)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("toast-\(toast.kind)")
            .task(id: toast.id) {
                try? await Task.sleep(for: .seconds(5))
                if self.toast?.id == toast.id { self.toast = nil }
            }
        } else if isBlankMap {
            // Empty state: a new map is blank paper, and nothing else says where the art goes.
            HStack(spacing: Spacing.md) {
                Label("Drop a map image here to start", systemImage: "photo")
                    .foregroundStyle(Palette.inkSecondary.color)
                Button("Choose…") { importTarget = .mapImage }
            }
            .glassPanel(.capsule, padding: GlassPadding.message)
            .padding(.top, Spacing.md)
            .transition(.opacity)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("empty-map-banner")
        }
    }

    /// A map with no art and nothing on it yet. Drawing, walls or tokens mean the DM chose paper
    /// (a generated dungeon, say), where a dropped image is a token, not the floor.
    private var isMapEmpty: Bool {
        let map = document.campaign.activeMap
        return map.background == nil && map.tokens.isEmpty && map.drawings.isEmpty && map.doors.isEmpty
            && map.notes.isEmpty
    }

    private var isBlankMap: Bool { importsInFlight == 0 && isMapEmpty }

    /// Fog of war is on and nothing lets the players see: no PC, and no ground revealed by hand.
    private var playersSeeOnlyFog: Bool {
        let campaign = document.campaign
        let map = campaign.activeMap
        return !map.isDaylightMode && map.revealedAreas.isEmpty && !map.hasSightedPC(library: campaign.libraryIndex)
    }

    private func zoomCanvas(by factor: Double) {
        zoomRequest = ZoomRequest(factor: factor)
    }

    /// Sends the area the DM is looking at to the World View, so the TV can be framed
    /// without reaching for the TV's window.
    private func showViewOnWorld() {
        guard camera.size.width > 0, camera.size.height > 0 else { return }
        guard document.worldViewsOpen > 0 else {
            showToast("Open the World View first (⇧⌘W), then show it this view.")
            return
        }
        document.worldFrameRequest = FitRequest(
            bounds: camera.viewport.visibleBounds(viewWidth: camera.size.width, viewHeight: camera.size.height))
        if document.isPaused {
            showToast("Framed. The World View is paused, so players will see it when you resume.")
        }
    }

    /// Frames the map image, else the party, else the default world (as the minimap does).
    private func zoomToFit() {
        let campaign = document.campaign
        fitRequest = FitRequest(bounds: campaign.activeMap.minimapBounds(library: campaign.libraryIndex))
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

/// Play/Pause for the World View (PARITY §1.12). Native: only the paused state carries the
/// accent, with its own symbol and label (design harness: state-without-colour, one-warm-accent).
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
        .tint(document.isPaused ? Palette.accent.color : nil)
        .help(document.isPaused ? "Resume: players will see the map" : "Pause: hide the map from players")
    }
}

/// The Architect canvas's last camera, for "Show This View on World View".
final class CanvasCamera {
    var viewport = Viewport()
    var size = CGSize.zero
}
