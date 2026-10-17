import AppKit
import GraphiumCore
import UniformTypeIdentifiers

extension CampaignDocument {
    /// File > Export as .graphium… (PARITY §5.2): writes a ZIP the Electron app opens.
    /// The open document keeps its native format and location.
    @MainActor
    func exportLegacyGraphium() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.legacyGraphium]
        panel.nameFieldStringValue = campaign.name.isEmpty ? "Campaign.graphium" : "\(campaign.name).graphium"
        panel.message = "Export a copy that the Graphium web and Electron apps can open."
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let data = try LegacyExporter.export(CampaignPackage(campaign: campaign, assets: assets))
            try data.write(to: url, options: .atomic)
        } catch {
            NSAlert(error: error).runModal()
        }
    }
}
