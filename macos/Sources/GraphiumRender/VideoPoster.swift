import AVFoundation
import CoreGraphics
import Foundation

/// First frames of video map backgrounds: where the app plays the video, the Core Graphics
/// pictures (render_map, Quick Look) draw this still. Read with AVFoundation, locally.
public enum VideoPoster {
    /// The first frame, upright, or nil when the file has no readable video.
    public static func firstFrame(of url: URL) -> CGImage? {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        // Synchronous on purpose: callers (tool handlers, Quick Look) draw synchronously, and
        // blocking on the async API from them could wait on the thread it needs.
        return try? generator.copyCGImage(at: .zero, actualTime: nil)
    }
}
