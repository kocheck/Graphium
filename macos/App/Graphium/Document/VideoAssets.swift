import AVFoundation
import CoreGraphics
import Foundation
import GraphiumCore
import ImageIO
import UniformTypeIdentifiers

/// A map background chosen from a file (PARITY §3.2): an image, downscaled and re-encoded
/// like any map image (`ImportedImage`), or an animated map video, stored as-is in the
/// package's `assets/` (`isVideoAsset`). Nothing is fetched; the file is on the Mac.
struct ImportedBackground: Sendable {
    var preferredName: String
    var data: Data
    /// Natural size in pixels: for a video, its track's size with its rotation applied.
    var width: Double
    var height: Double
    var isVideo: Bool

    enum ImportError: LocalizedError {
        case webM(String)
        case unsupportedVideo(String)
        case unreadableVideo(String)

        var errorDescription: String? {
            switch self {
            case .webM(let name):
                return "“\(name)” is a WebM video, which macOS can't play. Convert it to MP4 (H.264 or HEVC) and choose that."
            case .unsupportedVideo(let name):
                return "“\(name)” isn't a video Graphium can play. Use an MP4, MOV or M4V file (H.264 or HEVC)."
            case .unreadableVideo(let name):
                return "“\(name)” couldn't be played. Use an MP4, MOV or M4V file (H.264 or HEVC)."
            }
        }
    }

    /// What the map image pickers offer: images and videos. WebM is offered too, so choosing
    /// one explains why it can't be used instead of leaving it greyed out.
    static var contentTypes: [UTType] {
        var types: [UTType] = [.image, .movie]
        if let webM = UTType(filenameExtension: "webm") { types.append(webM) }
        return types
    }

    /// Reads the file off the main thread, with security-scoped access held for the duration.
    static func load(from url: URL) async throws -> ImportedBackground {
        let name = url.lastPathComponent
        if isWebMVideo(name) { throw ImportError.webM(name) }
        if isVideoAsset(name) { return try await loadVideo(from: url) }
        if UTType(filenameExtension: url.pathExtension)?.conforms(to: .movie) == true {
            throw ImportError.unsupportedVideo(name)
        }
        let image = try await ImportedImage.loadInBackground(from: url, kind: .map)
        return ImportedBackground(
            preferredName: image.preferredName, data: image.data, width: Double(image.width),
            height: Double(image.height), isVideo: false)
    }

    private static func loadVideo(from url: URL) async throws -> ImportedBackground {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let name = url.lastPathComponent
        guard let size = await VideoAsset.displaySize(of: url), size.width > 0, size.height > 0 else {
            throw ImportError.unreadableVideo(name)
        }
        // Read into memory, not mapped: the package keeps its own copy, so the original file
        // can be moved or deleted afterwards.
        let data = try await Task.detached(priority: .userInitiated) { try Data(contentsOf: url) }.value
        return ImportedBackground(
            preferredName: name, data: data, width: Double(size.width), height: Double(size.height), isVideo: true)
    }
}

/// AVFoundation helpers for video map backgrounds.
enum VideoAsset {
    /// The video track's natural size with its preferred transform applied (a phone video
    /// shot upright is taller than wide), or nil when the file has no playable video.
    static func displaySize(of url: URL) async -> CGSize? {
        let asset = AVURLAsset(url: url)
        do {
            guard try await asset.load(.isPlayable),
                let track = try await asset.loadTracks(withMediaType: .video).first
            else { return nil }
            let (natural, transform) = try await track.load(.naturalSize, .preferredTransform)
            let rect = CGRect(origin: .zero, size: natural).applying(transform)
            return CGSize(width: abs(rect.width).rounded(), height: abs(rect.height).rounded())
        } catch {
            return nil
        }
    }

    /// The first frame, upright, for places that need a picture instead of a video.
    static func posterImage(of url: URL) async -> CGImage? {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        return try? await generator.image(at: .zero).image
    }

    /// A poster frame as package-ready bytes: PNG when it has transparency (HEVC with
    /// alpha), else JPEG at 85%, as image imports are stored.
    static func encodePoster(_ image: CGImage) -> (data: Data, fileExtension: String)? {
        let hasAlpha: Bool
        switch image.alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast: hasAlpha = false
        default: hasAlpha = true
        }
        let type: UTType = hasAlpha ? .png : .jpeg
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, type.identifier as CFString, 1, nil) else {
            return nil
        }
        let options: [CFString: Any] = hasAlpha ? [:] : [kCGImageDestinationLossyCompressionQuality: 0.85]
        CGImageDestinationAddImage(destination, image, options as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return (output as Data, hasAlpha ? "png" : "jpg")
    }
}

/// Called on the main actor once a video asset's file is written.
typealias VideoFileReady = @MainActor @Sendable () -> Void

/// Video assets written to files for AVFoundation, which plays files, not bytes in memory.
/// One temporary folder per open document, removed when the document closes: rebuildable,
/// never campaign content (PRINCIPLES: app-private storage).
final class VideoAssetFiles: @unchecked Sendable {
    private let lock = NSLock()
    private let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("Graphium-Videos-\(UUID().uuidString)", isDirectory: true)
    /// Written files by asset name, with the byte count they were written from.
    private var written: [String: (url: URL, size: Int)] = [:]
    /// Callers waiting for a file being written, by asset name.
    private var waiting: [String: [VideoFileReady]] = [:]
    /// Byte counts of assets whose file couldn't be written, by asset name.
    private var failed: [String: Int] = [:]

    deinit {
        try? FileManager.default.removeItem(at: directory)
    }

    private func locked<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }

    /// The file for this video asset if it is written; otherwise starts writing it off the
    /// main thread, calls `ready` on the main actor once it is, and returns nil.
    func url(named name: String, in assets: [String: Data], ready: @escaping VideoFileReady) -> URL? {
        guard isVideoAsset(name), let data = assets[name] else { return nil }
        let size = data.count
        if let hit = locked({ written[name] }), hit.size == size { return hit.url }
        // A file that couldn't be written (disk full) isn't retried on every redraw.
        if locked({ failed[name] }) == size { return nil }
        let alreadyWriting = locked { () -> Bool in
            let started = waiting[name] != nil
            waiting[name, default: []].append(ready)
            return started
        }
        guard !alreadyWriting else { return nil }
        Task.detached(priority: .userInitiated) { [self] in
            let url = await fileURL(named: name, data: data)
            let callbacks = locked { () -> [VideoFileReady] in
                if url == nil { failed[name] = size }
                return waiting.removeValue(forKey: name) ?? []
            }
            await MainActor.run {
                for callback in callbacks { callback() }
            }
        }
        return nil
    }

    /// The file for this video asset, written first if needed.
    func fileURL(named name: String, data: Data) async -> URL? {
        guard CampaignPackage.isValidAssetName(name) else { return nil }
        let size = data.count
        if let hit = locked({ written[name] }), hit.size == size { return hit.url }
        let directory = self.directory
        let target = directory.appendingPathComponent(name, isDirectory: false)
        let ok = await Task.detached(priority: .userInitiated) { () -> Bool in
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: target, options: .atomic)
                return true
            } catch {
                return false
            }
        }.value
        guard ok else { return nil }
        locked { written[name] = (target, size) }
        return target
    }
}

extension CampaignPackage {
    /// For File > Export as .graphium: the web and Electron apps show map images only, so
    /// each video background is exported as its first frame. The open campaign keeps its video.
    func withVideoBackgroundsAsPosters(files: VideoAssetFiles) async -> CampaignPackage {
        var package = self
        var posters: [String: String] = [:]
        for index in package.campaign.maps.indices {
            guard let src = package.campaign.maps[index].background?.src, isVideoAsset(src) else { continue }
            if posters[src] == nil {
                guard let data = package.assets[src], let url = await files.fileURL(named: src, data: data),
                    let image = await VideoAsset.posterImage(of: url), let poster = VideoAsset.encodePoster(image)
                else { continue }
                let stem = (src as NSString).deletingPathExtension
                let name = uniqueAssetName(
                    for: "\(stem)-poster.\(poster.fileExtension)", existing: Set(package.assets.keys))
                package.assets[name] = poster.data
                posters[src] = name
            }
            if let poster = posters[src] { package.campaign.maps[index].background?.src = poster }
        }
        return package
    }
}
