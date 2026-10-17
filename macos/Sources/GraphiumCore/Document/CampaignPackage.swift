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

    public init(campaign: Campaign, assets: [String: Data] = [:]) {
        self.campaign = campaign
        self.assets = assets
    }

    public enum FormatError: Error, Equatable {
        case missingManifest
        case newerFormat(found: Int, supported: Int)
        case invalidAssetName(String)
    }

    private struct Manifest: Codable {
        var formatVersion: Int
        var campaign: Campaign
    }

    public func encodeManifest() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(Manifest(formatVersion: Self.currentFormatVersion, campaign: campaign))
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
        self.campaign = try JSONDecoder().decode(Manifest.self, from: manifest).campaign
        self.assets = assets
    }

    /// Flat, non-hidden names only, so a crafted package can't point outside `assets/`.
    public static func isValidAssetName(_ name: String) -> Bool {
        !name.isEmpty && !name.hasPrefix(".") && !name.contains("/") && !name.contains("\\")
    }
}
