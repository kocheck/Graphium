import Foundation

/// The native `.graphiumcampaign` document: a package directory containing
///
/// ```
/// campaign.json      // { "formatVersion": 1, "campaign": { ... } }
/// assets/<name>      // images and audio referenced by the campaign
/// ```
///
/// This type is the platform-independent half of the format; the app maps it
/// to and from `FileWrapper`. JSON is pretty-printed with sorted keys so
/// campaigns diff cleanly in version control.
public struct CampaignPackage: Equatable, Sendable {
    public static let manifestFileName = "campaign.json"
    public static let assetsDirectoryName = "assets"
    public static let currentFormatVersion = 1

    public var campaign: Campaign
    /// Asset file name → contents. Names are flat (no subdirectories).
    public var assets: [String: Data]
    /// What the file held that this build doesn't own, written back unchanged.
    public var preserved: Preserved

    /// Parts of the file that pass through a read and a write untouched by this build.
    public struct Preserved: Equatable, Sendable {
        /// Keys in `campaign.json` this build couldn't read (see `UnknownFields`).
        public var unknownFields: UnknownFields?
        /// Assets the app stopped referencing in an earlier session. Only these are pruned
        /// on open; a file someone else put in `assets/` is never in this list, so it stays.
        public var orphanedAssets: [String]

        public init(unknownFields: UnknownFields? = nil, orphanedAssets: [String] = []) {
            self.unknownFields = unknownFields
            self.orphanedAssets = orphanedAssets
        }
    }

    public init(campaign: Campaign, assets: [String: Data] = [:], preserved: Preserved = Preserved()) {
        self.campaign = campaign
        self.assets = assets
        self.preserved = preserved
    }

    public enum FormatError: Error, Equatable {
        case missingManifest
        case newerFormat(found: Int, supported: Int)
        case invalidAssetName(String)
    }

    private struct Manifest: Codable {
        var formatVersion: Int
        var campaign: Campaign
        var orphanedAssets: [String]?
    }

    public func encodeManifest() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let orphaned = preserved.orphanedAssets.isEmpty ? nil : preserved.orphanedAssets.sorted()
        let data = try encoder.encode(
            Manifest(formatVersion: Self.currentFormatVersion, campaign: campaign, orphanedAssets: orphaned))
        guard let unknown = preserved.unknownFields else { return data }
        var tree = try JSONDecoder().decode(RawJSON.self, from: data)
        unknown.merge(into: &tree)
        return try encoder.encode(tree)
    }

    public init(manifest: Data?, assets: [String: Data]) throws {
        guard let manifest else { throw FormatError.missingManifest }
        // Read the version on its own first so a newer file fails with a clear error,
        // not a decoding error from fields this build doesn't know.
        struct VersionOnly: Decodable { var formatVersion: Int }
        let version = try JSONDecoder().decode(VersionOnly.self, from: manifest).formatVersion
        guard version <= Self.currentFormatVersion else {
            throw FormatError.newerFormat(found: version, supported: Self.currentFormatVersion)
        }
        for name in assets.keys where !Self.isValidAssetName(name) {
            throw FormatError.invalidAssetName(name)
        }
        let decoded = try JSONDecoder().decode(Manifest.self, from: manifest)
        self.campaign = decoded.campaign
        self.assets = assets
        // Whatever this build drops when it decodes and encodes the file again is kept aside.
        let original = try JSONDecoder().decode(RawJSON.self, from: manifest)
        let known = try JSONDecoder().decode(RawJSON.self, from: JSONEncoder().encode(decoded))
        self.preserved = Preserved(
            unknownFields: UnknownFields.diff(original: original, known: known),
            orphanedAssets: decoded.orphanedAssets ?? [])
    }

    /// Asset names the campaign doesn't reference, other than `keeping`.
    public func unreferencedAssets(keeping: Set<String> = []) -> Set<String> {
        let referenced = Set(campaign.assetReferences).union(keeping)
        return Set(assets.keys.filter { !referenced.contains($0) })
    }

    /// Removes assets the app itself stopped referencing in an earlier session (replaced
    /// backgrounds, deleted tokens, plates and tracks, listed in `preserved.orphanedAssets`
    /// at save time), so a package doesn't grow forever. The app prunes on open, not at save
    /// time, because undo can still bring back a reference during a session. Files the app
    /// didn't orphan, such as one the DM copied into `assets/` by hand, are kept. `keeping`
    /// names survive regardless. Returns the removed names, sorted.
    @discardableResult
    public mutating func pruneUnreferencedAssets(keeping: Set<String> = []) -> [String] {
        let orphaned = Set(preserved.orphanedAssets)
        let removed = unreferencedAssets(keeping: keeping).filter { orphaned.contains($0) }.sorted()
        for name in removed { assets[name] = nil }
        preserved.orphanedAssets = []
        return removed
    }

    /// The package as a directory `FileWrapper`. Asset names are never reused for
    /// different bytes, so an asset already in `existing` (the saved package) with the
    /// same name and byte size is passed through untouched. Saves and autosaves then
    /// rewrite only campaign.json and new assets, not every image and track.
    public func fileWrapper(reusing existing: FileWrapper?) throws -> FileWrapper {
        let saved = existing?.fileWrappers?[Self.assetsDirectoryName]?.fileWrappers ?? [:]
        var assetWrappers: [String: FileWrapper] = [:]
        for (name, data) in assets {
            if let previous = saved[name], previous.isRegularFile,
                (previous.fileAttributes[FileAttributeKey.size.rawValue] as? NSNumber)?.intValue == data.count
            {
                assetWrappers[name] = previous
                continue
            }
            let wrapper = FileWrapper(regularFileWithContents: data)
            wrapper.preferredFilename = name
            assetWrappers[name] = wrapper
        }
        let manifest = FileWrapper(regularFileWithContents: try encodeManifest())
        manifest.preferredFilename = Self.manifestFileName
        let assetsDir = FileWrapper(directoryWithFileWrappers: assetWrappers)
        assetsDir.preferredFilename = Self.assetsDirectoryName
        return FileWrapper(directoryWithFileWrappers: [
            Self.manifestFileName: manifest,
            Self.assetsDirectoryName: assetsDir,
        ])
    }

    /// Flat, non-hidden names only, so a crafted package can't point outside `assets/`.
    public static func isValidAssetName(_ name: String) -> Bool {
        !name.isEmpty && !name.hasPrefix(".") && !name.contains("/") && !name.contains("\\")
    }
}
