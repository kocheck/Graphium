import Foundation

extension LegacyImporter.Result {
    /// What to tell the DM after importing a `.graphium` whose ZIP lacked files the
    /// campaign refers to (they stay as dangling references); nil when nothing is missing.
    public var missingAssetsNotice: String? {
        guard !missingAssets.isEmpty else { return nil }
        let names = missingAssets.map { ($0 as NSString).lastPathComponent }
        let limit = 5
        var lines = Array(names.prefix(limit))
        if names.count > limit { lines.append("…and \(names.count - limit) more") }
        let lead =
            names.count == 1
            ? "1 image or sound this campaign uses isn't in the file, so it will show as missing:"
            : "\(names.count) images or sounds this campaign uses aren't in the file, so they will show as missing:"
        return ([lead] + lines).joined(separator: "\n")
    }
}
