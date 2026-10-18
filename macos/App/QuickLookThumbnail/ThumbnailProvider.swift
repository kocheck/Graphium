import CoreGraphics
import Foundation
import GraphiumCore
import GraphiumRender
import QuickLookThumbnailing

/// Finder's icon for a `.graphiumcampaign` package: the active map as the DM sees it
/// (background, walls, doors, tokens), without text. Reads only the package itself; when
/// `campaign.json` can't be read, Finder keeps the plain document icon.
final class ThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest, _ handler: @escaping (QLThumbnailReply?, Error?) -> Void
    ) {
        let maximum = request.maximumSize
        let maxPixels = Int((max(maximum.width, maximum.height) * max(request.scale, 1)).rounded(.up))
        guard maximum.width > 0, maximum.height > 0,
            let renderer = MapRenderer(activeMapOfPackageAt: request.fileURL),
            let image = renderer.image(region: nil, maxPixels: max(maxPixels, 16), playersView: false, labels: false),
            image.width > 0, image.height > 0
        else {
            handler(nil, CocoaError(.fileReadCorruptFile))
            return
        }
        // The map's shape, fitted inside the size Finder asked for.
        let aspect = CGFloat(image.width) / CGFloat(image.height)
        var size = maximum
        if aspect > maximum.width / maximum.height {
            size.height = max(1, (maximum.width / aspect).rounded())
        } else {
            size.width = max(1, (maximum.height * aspect).rounded())
        }
        // The context's clip box is the whole thumbnail, whatever scale Quick Look gives it.
        let reply = QLThumbnailReply(
            contextSize: size,
            drawing: { context in
                context.interpolationQuality = .high
                context.draw(image, in: context.boundingBoxOfClipPath)
                return true
            })
        handler(reply, nil)
    }
}
