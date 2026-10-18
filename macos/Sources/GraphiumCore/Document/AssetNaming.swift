import Foundation

/// Makes a flat, package-safe, unused asset file name (TS `rewriteSafeAssetFileName`
/// plus `allocateUniqueZipBasename`, CORE_SPEC §2.8).
public func uniqueAssetName(for preferred: String, existing: Set<String>) -> String {
    let base = (preferred as NSString).lastPathComponent
    let ext = (base as NSString).pathExtension.lowercased().filter { $0.isLetter || $0.isNumber }
    let rawStem = (base as NSString).deletingPathExtension
    var stem = ""
    var lastWasDash = false
    for scalar in rawStem.unicodeScalars {
        let allowed = CharacterSet.alphanumerics.contains(scalar) && scalar.isASCII || "._-".unicodeScalars.contains(scalar)
        if allowed {
            stem.unicodeScalars.append(scalar)
            lastWasDash = false
        } else if !lastWasDash {
            stem.append("-")
            lastWasDash = true
        }
    }
    stem = stem.trimmingCharacters(in: CharacterSet(charactersIn: "-."))
    if stem.isEmpty { stem = "asset" }
    let suffix = ext.isEmpty ? "" : ".\(ext)"
    var candidate = stem + suffix
    var counter = 2
    while existing.contains(candidate) || !CampaignPackage.isValidAssetName(candidate) {
        candidate = "\(stem)-\(counter)\(suffix)"
        counter += 1
    }
    return candidate
}

/// File extensions of the videos a map background may be (animated battle maps): MP4,
/// QuickTime and M4V, which AVFoundation plays (H.264 or HEVC, HEVC with alpha too).
/// Stored in `assets/` as-is; a video is an asset like any image, told apart by its name.
public let videoAssetExtensions: Set<String> = ["mp4", "mov", "m4v"]

/// Whether `name` (an asset or file name) is a video Graphium plays, by its extension.
public func isVideoAsset(_ name: String) -> Bool {
    videoAssetExtensions.contains((name as NSString).pathExtension.lowercased())
}

/// Whether `name` is a WebM video: common for animated maps, but macOS has no decoder for
/// it, so importers say so and ask for MP4 or MOV instead.
public func isWebMVideo(_ name: String) -> Bool {
    (name as NSString).pathExtension.lowercased() == "webm"
}
