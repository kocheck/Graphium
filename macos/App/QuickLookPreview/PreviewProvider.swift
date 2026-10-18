import Cocoa
import GraphiumCore
import GraphiumRender
import Quartz
import UniformTypeIdentifiers

/// Quick Look's preview of a `.graphiumcampaign` package (space bar in Finder): the campaign's
/// name, a picture of the active map as the DM sees it, and the list of maps. A plain HTML
/// page with the picture attached; no scripts, nothing fetched.
final class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let url = request.fileURL
        let campaign = try CampaignPackage.readCampaign(packageAt: url)
        let renderer = MapRenderer(map: campaign.activeMap, campaign: campaign, packageURL: url)
        let reply = QLPreviewReply(dataOfContentType: .html, contentSize: CGSize(width: 960, height: 760)) {
            (replyToUpdate: QLPreviewReply) in
            let png = renderer.png(region: nil, maxPixels: 1600, playersView: false)
            replyToUpdate.stringEncoding = .utf8
            replyToUpdate.title = campaign.name
            if let png {
                replyToUpdate.attachments = [
                    PreviewProvider.imageName: QLPreviewReplyAttachment(data: png, contentType: .png)
                ]
            }
            return Data(PreviewProvider.page(campaign, hasImage: png != nil).utf8)
        }
        return reply
    }

    private static let imageName = "map.png"

    private static func page(_ campaign: Campaign, hasImage: Bool) -> String {
        let active = campaign.activeMap
        let maps = campaign.maps.map { map -> String in
            var details: [String] = []
            if !map.tokens.isEmpty { details.append(map.tokens.count == 1 ? "1 token" : "\(map.tokens.count) tokens") }
            if !map.notes.isEmpty { details.append(map.notes.count == 1 ? "1 note" : "\(map.notes.count) notes") }
            let suffix = details.isEmpty ? "" : " <span class=\"dim\">· \(details.joined(separator: ", "))</span>"
            let name = escape(map.name)
            return "<li>" + (map.id == active.id ? "<strong>\(name)</strong>" : name) + suffix + "</li>"
        }
        let picture =
            hasImage
            ? "<img src=\"cid:\(imageName)\" alt=\"\(escape(active.name))\">"
            : "<p class=\"dim\">This map couldn't be drawn.</p>"
        return """
            <!doctype html>
            <html><head><meta charset="utf-8">
            <style>
            :root { color-scheme: light dark; }
            body { font: 13px -apple-system, system-ui, sans-serif; margin: 20px; background: Canvas; color: CanvasText; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            h2 { font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
            .dim { opacity: 0.6; }
            img { display: block; max-width: 100%; max-height: 70vh; border-radius: 6px; }
            ul { margin: 0; padding-left: 18px; }
            li { margin: 2px 0; }
            </style></head><body>
            <h1>\(escape(campaign.name))</h1>
            <h2>\(escape(active.name))</h2>
            \(picture)
            <h2>Maps</h2>
            <ul>\(maps.joined())</ul>
            </body></html>
            """
    }

    private static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
    }
}
