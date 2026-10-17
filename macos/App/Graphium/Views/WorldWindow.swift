import GraphiumCore
import SwiftUI

/// The player-facing World View for one open campaign. It observes the same
/// CampaignDocument as the Architect window, so it updates live with no sync layer.
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

    var body: some View {
        // Read-only: no selection or editing callbacks; dragging pans.
        MapCanvas(
            map: document.campaign.activeMap,
            library: document.campaign.libraryIndex,
            imageProvider: { [document] name in document.imageCache.image(named: name, in: document.assets) }
        )
        .navigationTitle("World View — \(document.campaign.name)")
    }
}
