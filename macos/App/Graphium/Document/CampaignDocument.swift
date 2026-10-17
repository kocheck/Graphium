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
    /// "Blank the projector": hides the map from players. Session-only, starts unpaused.
    @Published var isPaused = false
    /// The DM's measurement mirrored to the World View when broadcasting. Transient.
    @Published var broadcastMeasurement: MeasurementShape?
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
    /// The Architect window's undo manager, so World View edits are undoable and
    /// mark the document edited too.
    private weak var lastUndoManager: UndoManager?
    /// Decoded images, shared by every window showing this document.
    let imageCache = AssetImageCache()

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
        var package = try CampaignPackage(manifest: manifest, assets: assets)
        // Drop orphaned bytes left by earlier sessions; the next save writes the smaller package.
        package.pruneUnreferencedAssets(keeping: [GenericToken.assetName])
        self.campaign = package.campaign
        self.assets = package.assets
        self.sessionRuntime = SessionConsoleRuntime(catalog: package.campaign.sessionConsole)
        DocumentRegistry.shared.register(self)
    }

    func snapshot(contentType: UTType) throws -> CampaignPackage {
        CampaignPackage(campaign: campaign, assets: assets)
    }

    func fileWrapper(snapshot: CampaignPackage, configuration: WriteConfiguration) throws -> FileWrapper {
        // Saves and autosaves rewrite only campaign.json and new assets (see GraphiumCore).
        try snapshot.fileWrapper(reusing: configuration.existingFile)
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
            next.activeMap.recordExploration(
                since: before.activeMap, library: library, timestamp: Date().timeIntervalSince1970 * 1000)
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
    /// on the active map. No duplication, deletion or property changes.
    func playerMoveTokens(_ ids: [String], primary: String, dx: Double, dy: Double) {
        guard dx.isFinite, dy.isFinite else { return }
        edit("Move Token", undoManager: lastUndoManager) { campaign in
            let library = campaign.libraryIndex
            campaign.activeMap.dropTokens(ids, primary: primary, dx: dx, dy: dy, duplicate: false, library: library)
        }
    }

    /// Session Console transport (not undoable: it's live playback, not campaign content).
    func dispatch(_ command: SessionCommand) {
        var runtime = sessionRuntime
        if command.apply(to: &runtime, catalog: campaign.sessionConsole) { sessionRuntime = runtime }
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
            "Some Files Are Missing",
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
