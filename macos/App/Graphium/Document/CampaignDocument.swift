import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    /// Native package format (see GraphiumCore.CampaignPackage). Declared in Info.plist.
    static let graphiumCampaign = UTType(exportedAs: "com.graphium.campaign-package")
    /// The Electron app's `.graphium` ZIP. Opened through LegacyImporter; never written.
    static let legacyGraphium = UTType(importedAs: "com.graphium.campaign")
}

/// One open campaign. Both the Architect (DM) window and the World View window
/// observe the same instance, so there is no state sync layer: players see
/// whatever this object holds.
final class CampaignDocument: ReferenceFileDocument {
    static var readableContentTypes: [UTType] { [.graphiumCampaign, .legacyGraphium] }
    // Legacy files aren't writable, so the first save of an imported campaign
    // asks for a new .graphiumcampaign location and leaves the original untouched.
    static var writableContentTypes: [UTType] { [.graphiumCampaign] }

    @Published var campaign: Campaign
    /// Asset bytes live outside `campaign` so undo snapshots stay small.
    @Published var assets: [String: Data]

    /// Identifies this open document to windows opened for it (World View).
    let sessionID = UUID()
    /// Where the campaign is saved, nil until its first save. Set by its Architect window,
    /// for the Agent window, which works on the file.
    @Published var fileURL: URL?
    /// "Blank the projector": hides the map from players. Session-only, starts unpaused.
    @Published var isPaused = false
    /// The DM's measurement mirrored to the World View when broadcasting. Transient.
    @Published var broadcastMeasurement: MeasurementShape?
    /// The DM asked the World View to show this map area ("Show This View on World View").
    /// Transient; a new request (new id) re-frames even the same area.
    @Published var worldFrameRequest: FitRequest?
    /// The note whose player notes the World View is showing (never its DM notes). Transient.
    @Published var worldNoteID: String? {
        didSet { if worldNoteID != oldValue { playSoundsOnShow() } }
    }
    /// The DM's in-progress token drag. Its own object, not `@Published` here, so a
    /// drag only re-renders the World View and not every view of the document.
    let liveDrag = LiveDragModel()
    /// What the World View is showing/playing (Session Console). Session-only.
    @Published var sessionRuntime = SessionConsoleRuntime(catalog: .empty(campaignName: ""))
    /// Open World View windows, for the master bar's link status.
    @Published var worldViewsOpen = 0
    /// Last playback problem reported by a World View.
    @Published var audioError: String?
    /// Something the DM should know about the file that was just opened (e.g. assets a
    /// `.graphium` import couldn't find). Shown once by `DocumentNoticeAlert`.
    @Published var importNotice: String?
    /// The title `DocumentNoticeAlert` gives `importNotice`.
    var importNoticeTitle = "Some Files Are Missing"
    /// The Architect window's undo manager, so World View edits are undoable and
    /// mark the document edited too.
    private weak var lastUndoManager: UndoManager?
    /// Decoded images, shared by every window showing this document.
    let imageCache = AssetImageCache()
    /// Keys in campaign.json this build couldn't read, written back on save (PRINCIPLES.md).
    private var unknownFields: UnknownFields?
    /// Objects that couldn't be read, kept in campaign.json under `setAside` (CampaignSalvage.swift).
    private var setAside: [RawJSON] = []
    /// Unreferenced files that were already in `assets/` when the campaign opened: someone
    /// else put them there, so they are never listed as orphaned and never pruned.
    private var foreignAssets: Set<String> = []
    /// Video map backgrounds written to files for playback, shared by every window.
    let videoFiles = VideoAssetFiles()
    /// Map > Pause Animation: holds video map backgrounds on their frame in every window.
    /// Session-only, starts playing.
    @Published var isMapAnimationPaused = false

    /// Stores asset bytes under a fresh package-safe name and returns that name.
    /// Not undoable on its own: callers reference it from an `edit`, and an
    /// unreferenced asset is harmless.
    func addAsset(_ data: Data, preferredName: String) -> String {
        let name = uniqueAssetName(for: preferredName, existing: Set(assets.keys))
        assets[name] = data
        return name
    }

    init(campaign: Campaign = .makeDefault()) {
        self.campaign = campaign
        self.assets = [:]
        self.sessionRuntime = SessionConsoleRuntime(catalog: campaign.sessionConsole)
        DocumentRegistry.shared.register(self)
    }

    required init(configuration: ReadConfiguration) throws {
        if configuration.contentType.conforms(to: .legacyGraphium) {
            guard let data = configuration.file.regularFileContents else {
                throw CocoaError(.fileReadCorruptFile)
            }
            let imported = try LegacyImporter.importArchive(data)
            self.campaign = imported.package.campaign
            self.assets = imported.package.assets
            self.sessionRuntime = SessionConsoleRuntime(catalog: imported.package.campaign.sessionConsole)
            self.importNotice = imported.missingAssetsNotice
            DocumentRegistry.shared.register(self)
            if imported.usesGenericTokenAsset, assets[GenericToken.assetName] == nil {
                // Electron's SVG Generic Tokens import as the native placeholder image.
                Task { @MainActor [weak self] in
                    guard let self, self.assets[GenericToken.assetName] == nil, let png = GenericToken.pngData() else { return }
                    self.assets[GenericToken.assetName] = png
                }
            }
            return
        }
        let root = configuration.file
        let children = root.fileWrappers ?? [:]
        let manifest = children[CampaignPackage.manifestFileName]?.regularFileContents
        var assets: [String: Data] = [:]
        for (name, wrapper) in children[CampaignPackage.assetsDirectoryName]?.fileWrappers ?? [:] {
            if let data = wrapper.regularFileContents {
                assets[name] = data
            }
        }
        var package: CampaignPackage
        do {
            package = try CampaignPackage(manifest: manifest, assets: assets)
        } catch {
            Diagnostics.log(.error, "Couldn't open a campaign: \(error.localizedDescription)", category: "document")
            throw error
        }
        // Drop bytes the app orphaned in earlier sessions; the next save writes the smaller package.
        let pruned = package.pruneUnreferencedAssets(keeping: [GenericToken.assetName])
        Diagnostics.log(
            .info,
            "Opened a campaign: \(package.campaign.maps.count) maps, \(assets.count) assets "
                + "(\(assets.values.reduce(0) { $0 + $1.count } / 1024) KB), \(pruned.count) pruned, "
                + "unknown keys kept: \(package.preserved.unknownFields == nil ? "no" : "yes")",
            category: "document")
        self.campaign = package.campaign
        self.assets = package.assets
        self.unknownFields = package.preserved.unknownFields
        self.setAside = package.preserved.setAside
        if !setAside.isEmpty {
            importNoticeTitle = "Some Objects Couldn't Be Read"
            importNotice = Self.setAsideNotice(setAside)
        }
        self.foreignAssets = package.unreferencedAssets(keeping: [GenericToken.assetName])
        self.sessionRuntime = SessionConsoleRuntime(catalog: package.campaign.sessionConsole)
        DocumentRegistry.shared.register(self)
    }

    func snapshot(contentType: UTType) throws -> CampaignPackage {
        var package = CampaignPackage(campaign: campaign, assets: assets)
        // Assets this session stopped referencing are pruned the next time the campaign opens.
        let orphaned = package.unreferencedAssets(keeping: [GenericToken.assetName]).subtracting(foreignAssets)
        package.preserved = .init(unknownFields: unknownFields, orphanedAssets: orphaned.sorted(), setAside: setAside)
        return package
    }

    /// What the DM reads when a campaign opened without some of its objects.
    static func setAsideNotice(_ entries: [RawJSON]) -> String {
        let listed = entries.prefix(5).map { entry in
            "\(entry.field("from") ?? "?"): \(entry.field("reason") ?? "unreadable")"
        }
        let more = entries.count > 5 ? "\n…and \(entries.count - 5) more." : ""
        return "The campaign opened without \(entries.count == 1 ? "this object" : "these \(entries.count) objects"), "
            + "which Graphium couldn't read:\n\n\(listed.joined(separator: "\n"))\(more)\n\n"
            + "Nothing was deleted. They're kept in campaign.json under \"setAside\", so saving loses nothing, "
            + "and you can fix and move them back by hand."
    }

    func fileWrapper(snapshot: CampaignPackage, configuration: WriteConfiguration) throws -> FileWrapper {
        // Saves and autosaves rewrite only campaign.json and new assets (see GraphiumCore).
        let started = Date()
        do {
            let wrapper = try snapshot.fileWrapper(reusing: configuration.existingFile)
            let ms = Int(Date().timeIntervalSince(started) * 1000)
            Diagnostics.log(.info, "Encoded a save: \(snapshot.assets.count) assets, \(ms) ms", category: "document")
            return wrapper
        } catch {
            Diagnostics.log(.error, "Couldn't save a campaign: \(error)", category: "document")
            throw error
        }
    }

    /// Applies an edit and registers its undo. Registering with the window's
    /// UndoManager is also what marks the document edited, which drives
    /// autosave, the close-without-saving prompt, and the title-bar dot.
    /// `undoManager` nil (World View, detached Session Console) uses the Architect window's.
    func edit(_ actionName: String, undoManager: UndoManager?, _ change: (inout Campaign) -> Void) {
        if let undoManager { lastUndoManager = undoManager }
        let undoManager = undoManager ?? lastUndoManager
        let before = campaign
        var next = campaign
        change(&next)
        // Fog: whatever PCs can now see becomes explored, in the same undo step.
        if next.activeMapID == before.activeMapID {
            let library = next.libraryIndex
            // A library edit can change PCs' vision without touching the map.
            let previousLibrary = next.tokenLibrary == before.tokenLibrary ? nil : before.libraryIndex
            next.activeMap.recordExploration(
                since: before.activeMap, library: library, previousLibrary: previousLibrary,
                timestamp: Date().timeIntervalSince1970 * 1000)
        }
        guard next != before else { return }
        campaign = next
        undoManager?.registerUndo(withTarget: self) { document in
            document.restore(before, actionName: actionName, undoManager: undoManager)
        }
        undoManager?.setActionName(actionName)
    }

    /// Called by the Architect window so edits from other windows join its undo stack.
    func adoptUndoManager(_ undoManager: UndoManager?) {
        if let undoManager { lastUndoManager = undoManager }
    }

    /// The only edit the World View may make (PARITY §4.2): move tokens that exist
    /// on the active map. No duplication, deletion or property changes, and never a
    /// token hidden from the players, whatever the window's selection still holds.
    func playerMoveTokens(_ ids: [String], primary: String, dx: Double, dy: Double) {
        guard dx.isFinite, dy.isFinite else { return }
        edit("Move Token", undoManager: lastUndoManager) { campaign in
            let library = campaign.libraryIndex
            campaign.activeMap.playerMoveTokens(ids, primary: primary, dx: dx, dy: dy, library: library)
        }
    }

    /// Session Console transport (not undoable: it's live playback, not campaign content).
    func dispatch(_ command: SessionCommand) {
        var runtime = sessionRuntime
        if command.apply(to: &runtime, catalog: campaign.sessionConsole) { sessionRuntime = runtime }
    }

    /// Plays a note pin's sound (from its inspector), as the Session Console would.
    func play(_ sound: NoteSound) {
        dispatch(sound.command)
    }

    /// A note just put on the World View plays its "when shown" sounds. Only with a World
    /// View open and unpaused: otherwise nobody hears it and a track would start later, unasked.
    private func playSoundsOnShow() {
        guard let id = worldNoteID, worldViewsOpen > 0, !isPaused,
            let note = campaign.activeMap.notes.first(where: { $0.id == id })
        else { return }
        for sound in note.sounds where sound.playOnShow { play(sound) }
    }

    /// Undoable board edits; stage chrome and duck % follow into the runtime (TS).
    func editConsole(_ actionName: String, undoManager: UndoManager?, _ change: (inout SessionConsoleCatalog) -> Void) {
        edit(actionName, undoManager: undoManager) { change(&$0.sessionConsole) }
        sessionRuntime.copyChrome(from: campaign.sessionConsole)
    }

    private func restore(_ value: Campaign, actionName: String, undoManager: UndoManager?) {
        let current = campaign
        campaign = value
        undoManager?.registerUndo(withTarget: self) { document in
            document.restore(current, actionName: actionName, undoManager: undoManager)
        }
        undoManager?.setActionName(actionName)
    }
}

/// Shows the notice a document recorded while opening, once.
struct DocumentNoticeAlert: ViewModifier {
    @ObservedObject var document: CampaignDocument

    func body(content: Content) -> some View {
        content.alert(
            document.importNoticeTitle,
            isPresented: Binding(get: { document.importNotice != nil }, set: { if !$0 { document.importNotice = nil } })
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(document.importNotice ?? "")
        }
    }
}

/// Lets a World View window (opened with only a `sessionID`) find its live document.
/// Lock-protected rather than main-actor-bound because `ReferenceFileDocument`
/// initializers are nonisolated and may run off the main thread.
final class DocumentRegistry: @unchecked Sendable {
    static let shared = DocumentRegistry()

    private struct WeakDocument {
        weak var document: CampaignDocument?
    }

    private let lock = NSLock()
    private var documents: [UUID: WeakDocument] = [:]

    func register(_ document: CampaignDocument) {
        lock.lock()
        defer { lock.unlock() }
        documents = documents.filter { $0.value.document != nil }
        documents[document.sessionID] = WeakDocument(document: document)
    }

    func document(for sessionID: UUID) -> CampaignDocument? {
        lock.lock()
        defer { lock.unlock() }
        return documents[sessionID]?.document
    }
}

/// Unsnapped positions of tokens the DM is dragging, so players see the move as it
/// happens (PARITY §4.2). Transient; never saved or undoable.
final class LiveDragModel: ObservableObject {
    @Published var positions: [String: Point2D] = [:]

    func update(_ new: [String: Point2D]) {
        if new != positions { positions = new }
    }
}

extension CampaignDocument {
    /// Next or Previous Turn on the active map, from any of the campaign's windows. The
    /// Architect wraps this to also pan to the combatant.
    func stepTurn(forward: Bool, undoManager: UndoManager? = nil) {
        edit(forward ? "Next Turn" : "Previous Turn", undoManager: undoManager) { campaign in
            if forward { campaign.activeMap.initiative.next() } else { campaign.activeMap.initiative.previous() }
        }
    }
}
