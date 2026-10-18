import Foundation
import GraphiumCore
import GraphiumRender

import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

/// An image file prepared for the package, as the app imports it (CORE_SPEC §3.13):
/// downscaled to the kind's limit; images with alpha stored as PNG, the rest as JPEG.
struct ImageImport {
    var preferredName: String
    var data: Data
    var width: Int
    var height: Int
    var originalWidth: Int
    var originalHeight: Int

    static func load(_ url: URL, kind: ImageKind) throws -> ImageImport {
        guard FileManager.default.fileExists(atPath: url.path) else { throw ToolError("No file at \(url.path).") }
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let pixelWidth = properties[kCGImagePropertyPixelWidth] as? Int,
            let pixelHeight = properties[kCGImagePropertyPixelHeight] as? Int
        else { throw ToolError("\(url.lastPathComponent) isn't an image Graphium can read.") }
        let fitted = kind.fittedSize(width: pixelWidth, height: pixelHeight)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: max(fitted.width, fitted.height),
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            throw ToolError("\(url.lastPathComponent) couldn't be decoded.")
        }
        let hasAlpha: Bool
        switch image.alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast: hasAlpha = false
        default: hasAlpha = true
        }
        guard let data = encode(image, png: hasAlpha) else {
            throw ToolError("\(url.lastPathComponent) couldn't be re-encoded.")
        }
        let stem = url.deletingPathExtension().lastPathComponent
        // Thumbnail options apply the EXIF orientation, so a rotated photo can swap its sides.
        let swapped = (image.width > image.height) != (pixelWidth > pixelHeight) && pixelWidth != pixelHeight
        return ImageImport(
            preferredName: "\(stem).\(hasAlpha ? "png" : "jpg")", data: data, width: image.width, height: image.height,
            originalWidth: swapped ? pixelHeight : pixelWidth, originalHeight: swapped ? pixelWidth : pixelHeight)
    }

    static func encode(_ image: CGImage, png: Bool) -> Data? {
        let output = NSMutableData()
        let type = (png ? UTType.png : UTType.jpeg).identifier as CFString
        guard let destination = CGImageDestinationCreateWithData(output, type, 1, nil) else { return nil }
        let options: [CFString: Any] = png ? [:] : [kCGImageDestinationLossyCompressionQuality: 0.85]
        CGImageDestinationAddImage(destination, image, options as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }
}

/// Placeholder token art: a coloured disc with the name's initials, so tokens made
/// without an image are still told apart at the table.
struct TokenArt {
    var name: String
    var initials: String
    var color: (r: CGFloat, g: CGFloat, b: CGFloat)

    static func disc(label: String, type: CreatureType?, color hex: String?) -> TokenArt {
        let words = label.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        var initials = words.prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
        if words.count == 1, let word = words.first, word.count > 1, word.allSatisfy(\.isLetter) {
            initials = String(word.prefix(2)).capitalized
        }
        if initials.isEmpty { initials = "?" }
        let fallback: (CGFloat, CGFloat, CGFloat) =
            type == .pc ? (0.20, 0.45, 0.85) : type == .npc ? (0.78, 0.25, 0.22) : (0.42, 0.45, 0.50)
        let rgb = hex.flatMap(MapRaster.parseHex) ?? fallback
        let hexName = String(format: "%02x%02x%02x", Int(rgb.0 * 255), Int(rgb.1 * 255), Int(rgb.2 * 255))
        let safe = initials.unicodeScalars.filter { $0.isASCII && CharacterSet.alphanumerics.contains($0) }
        return TokenArt(
            name: "token-\(String(safe).lowercased())-\(hexName).png", initials: initials,
            color: (rgb.0, rgb.1, rgb.2))
    }

    func png() -> Data? {
        let side = 256
        guard let ctx = MapRaster.makeContext(width: side, height: side) else { return nil }
        let bounds = CGRect(x: 0, y: 0, width: side, height: side)
        ctx.setFillColor(red: color.r, green: color.g, blue: color.b, alpha: 1)
        ctx.fillEllipse(in: bounds.insetBy(dx: 8, dy: 8))
        ctx.setStrokeColor(red: 1, green: 1, blue: 1, alpha: 0.9)
        ctx.setLineWidth(8)
        ctx.strokeEllipse(in: bounds.insetBy(dx: 16, dy: 16))
        let size: CGFloat = initials.count > 1 ? 104 : 132
        MapRaster.drawText(initials, in: ctx, centre: CGPoint(x: 128, y: 128), size: size, color: CGColor(gray: 1, alpha: 1), flipped: false)
        guard let image = ctx.makeImage() else { return nil }
        return ImageImport.encode(image, png: true)
    }
}

/// The text that goes with a `render_map` image: what it shows, in the tools' units, and a legend.
extension MapRenderer {
    func caption(region: Bounds?, units: Units, playersView: Bool) -> String {
        let a = area(region: region)
        let s = pixelScale(a, maxPixels: 1200)
        var lines = [
            "\(map.name): showing x \(units.out(a.x).serialized())…\(units.out(a.x + a.width).serialized()), "
                + "y \(units.out(a.y).serialized())…\(units.out(a.y + a.height).serialized()) (\(units.name)); "
                + "one cell ≈ \(Int(map.gridSize * s)) px in the image. Cell numbers are printed every 5 cells.",
            "Legend: red lines walls, blue dashed windows, orange one-way walls (tick on the side sight comes from), "
                + "brown bars closed doors, purple dashed bars hidden doors (wall in the players' view), green outline open doors, gold dot locked, yellow dots lights (solid ring bright, "
                + "dashed ring dim), white squares note pins (solid edge shared with players, dashed DM only; titles beside "
                + "them), tinted shapes spell effects (dashed edge hidden from players; labels inside), blue discs PCs, red discs NPCs.",
        ]
        if playersView {
            lines.append(
                map.isDaylightMode
                    ? "Daylight is on, so players see the whole map."
                    : map.ambientLight == nil
                        ? "Players' view: black is unseen, dim is explored earlier, clear is what PCs see now."
                        : "Players' view with lighting: black is unseen, dark grey explored earlier, grey is dim "
                            + "light, clear is bright light (darkvision counts).")
        }
        return lines.joined(separator: "\n")
    }

}
