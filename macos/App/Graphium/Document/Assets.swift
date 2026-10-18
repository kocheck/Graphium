import CoreGraphics
import Foundation
import GraphiumCore
import ImageIO
import UniformTypeIdentifiers

/// Decodes package assets to CGImages once and shares them between the
/// Architect and World View canvases.
final class AssetImageCache: @unchecked Sendable {
    /// Decoded images are large (4 bytes a pixel), so the cache is bounded and
    /// evicts under memory pressure; evicted images decode again on demand.
    private let cache: NSCache<NSString, CGImage> = {
        let cache = NSCache<NSString, CGImage>()
        cache.totalCostLimit = 512 * 1024 * 1024
        return cache
    }()

    /// The decoded image if it is still cached; never decodes.
    func cached(named name: String) -> CGImage? {
        cache.object(forKey: name as NSString)
    }

    func image(named name: String, in assets: [String: Data]) -> CGImage? {
        if let hit = cached(named: name) { return hit }
        guard let data = assets[name],
            let source = CGImageSourceCreateWithData(data as CFData, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
        else { return nil }
        cache.setObject(image, forKey: name as NSString, cost: image.bytesPerRow * image.height)
        return image
    }
}

/// An image file prepared for the package: downscaled to the kind's limit
/// (CORE_SPEC §3.13) and re-encoded. WebP can't be encoded with ImageIO on every
/// supported macOS, so images with alpha are stored as PNG and the rest as
/// JPEG at 85% (the TS app's WebP quality).
struct ImportedImage: Sendable {
    var preferredName: String
    var data: Data
    var width: Int
    var height: Int

    enum ImportError: LocalizedError {
        case unreadable(String)

        var errorDescription: String? {
            switch self {
            case .unreadable(let name): return "“\(name)” isn't an image Graphium can read."
            }
        }
    }

    /// Decodes, resizes and re-encodes off the main thread (PARITY §3.15), with
    /// security-scoped access held for the duration.
    static func loadInBackground(from url: URL, kind: ImageKind) async throws -> ImportedImage {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        return try await Task.detached(priority: .userInitiated) { try load(from: url, kind: kind) }.value
    }

    static func load(from url: URL, kind: ImageKind) throws -> ImportedImage {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            throw ImportError.unreadable(url.lastPathComponent)
        }
        return try load(source: source, name: url.lastPathComponent, kind: kind)
    }

    /// The same pipeline for bytes already in memory (board pack plates).
    static func load(data: Data, name: String, kind: ImageKind) throws -> ImportedImage {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { throw ImportError.unreadable(name) }
        return try load(source: source, name: name, kind: kind)
    }

    private static func load(source: CGImageSource, name: String, kind: ImageKind) throws -> ImportedImage {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let pixelWidth = properties[kCGImagePropertyPixelWidth] as? Int,
            let pixelHeight = properties[kCGImagePropertyPixelHeight] as? Int
        else { throw ImportError.unreadable(name) }

        let fitted = kind.fittedSize(width: pixelWidth, height: pixelHeight)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: max(fitted.width, fitted.height),
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            throw ImportError.unreadable(name)
        }

        let hasAlpha: Bool
        switch image.alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast: hasAlpha = false
        default: hasAlpha = true
        }
        let type: UTType = hasAlpha ? .png : .jpeg
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, type.identifier as CFString, 1, nil) else {
            throw ImportError.unreadable(name)
        }
        let encodeOptions: [CFString: Any] = hasAlpha ? [:] : [kCGImageDestinationLossyCompressionQuality: 0.85]
        CGImageDestinationAddImage(destination, image, encodeOptions as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw ImportError.unreadable(name) }

        let stem = (name as NSString).deletingPathExtension
        let ext = type.preferredFilenameExtension ?? (hasAlpha ? "png" : "jpg")
        return ImportedImage(
            preferredName: "\(stem).\(ext)", data: output as Data, width: image.width, height: image.height)
    }
}
