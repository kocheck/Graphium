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
        let package = try CampaignPackage(manifest: manifest, assets: assets)
        self.campaign = package.campaign
        self.assets = package.assets
        DocumentRegistry.shared.register(self)
    }

    func snapshot(contentType: UTType) throws -> CampaignPackage {
        CampaignPackage(campaign: campaign, assets: assets)
    }

    func fileWrapper(snapshot: CampaignPackage, configuration: WriteConfiguration) throws -> FileWrapper {
        var assetWrappers: [String: FileWrapper] = [:]
        for (name, data) in snapshot.assets {
            let wrapper = FileWrapper(regularFileWithContents: data)
            wrapper.preferredFilename = name
            assetWrappers[name] = wrapper
        }
        let manifest = FileWrapper(regularFileWithContents: try snapshot.encodeManifest())
        manifest.preferredFilename = CampaignPackage.manifestFileName
        let assetsDir = FileWrapper(directoryWithFileWrappers: assetWrappers)
        assetsDir.preferredFilename = CampaignPackage.assetsDirectoryName
        return FileWrapper(directoryWithFileWrappers: [
            CampaignPackage.manifestFileName: manifest,
            CampaignPackage.assetsDirectoryName: assetsDir,
        ])
    }

    /// Applies an edit and registers its undo. Registering with the window's
    /// UndoManager is also what marks the document edited, which drives
    /// autosave, the close-without-saving prompt, and the title-bar dot.
    func edit(_ actionName: String, undoManager: UndoManager?, _ change: (inout Campaign) -> Void) {
        let before = campaign
        change(&campaign)
        guard campaign != before else { return }
        undoManager?.registerUndo(withTarget: self) { document in
            document.restore(before, actionName: actionName, undoManager: undoManager)
        }
        undoManager?.setActionName(actionName)
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
