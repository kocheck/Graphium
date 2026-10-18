import CoreSpotlight
import Foundation
import GraphiumCore

/// Spotlight's importer for `.graphiumcampaign` packages, so `mdfind` and Finder search find a
/// campaign by its name, a map, a token or an NPC named in the DM's notes, even one never
/// opened in Graphium. Reads only `campaign.json`; the index stays on this Mac.
final class ImportExtension: CSImportExtension {
    static let contentType = "com.graphium.campaign-package"

    override func update(_ attributes: CSSearchableItemAttributeSet, forFileAt contentURL: URL) throws {
        let text = CampaignSearchText(campaign: try CampaignPackage.readCampaign(packageAt: contentURL))
        attributes.contentType = Self.contentType
        attributes.title = text.title
        attributes.contentDescription = text.summary
        attributes.keywords = text.keywords
        attributes.textContent = text.textContent
    }
}
