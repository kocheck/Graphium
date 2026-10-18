import AVFoundation
import CoreGraphics
import Foundation
import GraphiumCore

/// Video map backgrounds (animated battle maps) for the server, as the app handles them:
/// an MP4, MOV or M4V file is copied into the package as-is (`isVideoAsset`), and its first
/// frame stands in wherever a picture is drawn (render_map, via `VideoPoster`). Read with
/// AVFoundation, locally.
enum VideoImport {
    /// The video as an import: its bytes unchanged, and its natural size (the video track's
    /// size with its rotation applied) as both the stored and the original size.
    static func load(_ url: URL) throws -> ImageImport {
        guard FileManager.default.fileExists(atPath: url.path) else { throw ToolError("No file at \(url.path).") }
        guard let size = displaySize(of: url), size.width > 0, size.height > 0 else {
            throw ToolError(
                "\(url.lastPathComponent) isn't a video Graphium can play. Use an MP4, MOV or M4V file (H.264 or HEVC).")
        }
        let data = try Data(contentsOf: url)
        let width = Int(size.width), height = Int(size.height)
        return ImageImport(
            preferredName: url.lastPathComponent, data: data, width: width, height: height, originalWidth: width,
            originalHeight: height)
    }

    /// The video track's natural size with its preferred transform applied, or nil when the
    /// file has no playable video.
    static func displaySize(of url: URL) -> CGSize? {
        let size = waitFor { () async throws -> CGSize? in
            let asset = AVURLAsset(url: url)
            guard try await asset.load(.isPlayable),
                let track = try await asset.loadTracks(withMediaType: .video).first
            else { return nil }
            let (natural, transform) = try await track.load(.naturalSize, .preferredTransform)
            let rect = CGRect(origin: .zero, size: natural).applying(transform)
            return CGSize(width: abs(rect.width).rounded(), height: abs(rect.height).rounded())
        }
        return size ?? nil
    }

    /// Runs AVFoundation's asynchronous loading to the end for the synchronous tool handlers.
    /// They run on the server's own thread, never a Swift concurrency one, so waiting here
    /// can't hold up the task it waits for.
    private static func waitFor<T>(_ work: @escaping @Sendable () async throws -> T) -> T? {
        let box = ResultBox<T>()
        let done = DispatchSemaphore(value: 0)
        Task.detached(priority: .userInitiated) {
            box.value = try? await work()
            done.signal()
        }
        done.wait()
        return box.value
    }

    private final class ResultBox<T>: @unchecked Sendable {
        var value: T?
    }
}
