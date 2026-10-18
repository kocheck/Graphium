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
