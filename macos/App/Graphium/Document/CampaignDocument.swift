import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    /// Native package format (see GraphiumCore.CampaignPackage). Declared in Info.plist.
    static let graphiumCampaign = UTType(exportedAs: "com.graphium.campaign-package")
}

/// One open campaign. Both the Architect (DM) window and the World View window
/// observe the same instance, so there is no state sync layer: players see
/// whatever this object holds.
final class CampaignDocument: ReferenceFileDocument {
    static var readableContentTypes: [UTType] { [.graphiumCampaign] }

    @Published var campaign: Campaign
    /// Asset bytes live outside `campaign` so undo snapshots stay small.
    @Published var assets: [String: Data]

    /// Identifies this open document to windows opened for it (World View).
    let sessionID = UUID()

    init(campaign: Campaign = .makeDefault()) {
        self.campaign = campaign
        self.assets = [:]
        DocumentRegistry.shared.register(self)
    }

    required init(configuration: ReadConfiguration) throws {
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
@MainActor
final class DocumentRegistry {
    static let shared = DocumentRegistry()

    private struct WeakDocument {
        weak var document: CampaignDocument?
    }

    private var documents: [UUID: WeakDocument] = [:]

    nonisolated func register(_ document: CampaignDocument) {
        let id = document.sessionID
        Task { @MainActor in
            self.documents = self.documents.filter { $0.value.document != nil }
            self.documents[id] = WeakDocument(document: document)
        }
    }

    func document(for sessionID: UUID) -> CampaignDocument? {
        documents[sessionID]?.document
    }
}
