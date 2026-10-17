import Foundation

/// One-time importer for the Electron app's `.graphium` ZIP campaigns
/// (CORE_SPEC §2). Produces a native package; the original file is not modified.
public enum LegacyImporter {
    public enum ImportError: Error, Equatable {
        case invalidGraphiumFile
        case invalidManifest(String)
    }

    public struct Result: Equatable {
        public var package: CampaignPackage
        /// `assets/…` references whose file was not in the ZIP (left as-is).
        public var missingAssets: [String]
        /// Some src pointed at `genericTokenAssetName` because it was an SVG `data:`
        /// URL; the app supplies that asset's bytes if the package lacks them.
        public var usesGenericTokenAsset = false
    }

    /// Native Generic Token image. Electron stores its Generic Token as an SVG
    /// `data:` URL (CanvasManager.tsx:880-902), which ImageIO can't draw, so SVG
    /// srcs import as this placeholder instead.
    public static let genericTokenAssetName = "generic-token.png"

    public static func importArchive(_ data: Data) throws -> Result {
        let zip = try ZipArchive(data: data)
        guard let manifest = zip.entries["manifest.json"] else { throw ImportError.invalidGraphiumFile }
        var zipAssets: [String: Data] = [:]
        for (path, bytes) in zip.entries where path.hasPrefix("assets/") {
            zipAssets[(path as NSString).lastPathComponent] = bytes
        }
        return try importManifest(manifest, zipAssets: zipAssets)
    }

    /// `zipAssets` maps a basename under `assets/` to its bytes.
    public static func importManifest(_ manifest: Data, zipAssets: [String: Data]) throws -> Result {
        guard var object = try JSONSerialization.jsonObject(with: manifest) as? [String: Any] else {
            throw ImportError.invalidManifest("manifest is not a JSON object")
        }

        if let maps = object["maps"] as? [String: Any], !maps.isEmpty {
            // Modern campaign: id-keyed object → ordered array, keeping file order.
            let order = JSONKeyOrder.keysOfTopLevelObject("maps", in: manifest) ?? Array(maps.keys)
            let ordered = order.compactMap { maps[$0] } + maps.filter { !order.contains($0.key) }.map(\.value)
            object["maps"] = ordered
        } else {
            object = migrateLegacyState(object)
        }

        let normalized = try JSONSerialization.data(withJSONObject: object)
        var campaign: Campaign
        do {
            campaign = try JSONDecoder().decode(Campaign.self, from: normalized)
        } catch {
            throw ImportError.invalidManifest(String(describing: error))
        }

        // `assets/<x>` → package asset named by basename; base64 `data:` URLs (images
        // dropped on the Electron canvas, CanvasManager.tsx:941-960) → new package
        // assets, one per distinct URL; everything else is kept as-is.
        var assets: [String: Data] = [:]
        var missing: [String] = []
        var embedded: [String: String] = [:]
        var usesGenericToken = false
        campaign.rewriteAssetReferences { src in
            if src.hasPrefix("data:") {
                if let name = embedded[src] { return name }
                guard let (mime, bytes) = decodeDataURL(src) else { return src }
                let name: String
                if mime == "image/svg+xml" {
                    name = genericTokenAssetName
                    usesGenericToken = true
                } else {
                    name = embeddedAssetName(mime: mime, taken: Set(zipAssets.keys).union(assets.keys))
                    assets[name] = bytes
                }
                embedded[src] = name
                return name
            }
            guard src.hasPrefix("assets/") else { return src }
            let name = (src as NSString).lastPathComponent
            guard CampaignPackage.isValidAssetName(name), let bytes = zipAssets[name] else {
                if !missing.contains(src) { missing.append(src) }
                return src
            }
            assets[name] = bytes
            return name
        }
        return Result(
            package: CampaignPackage(campaign: campaign, assets: assets), missingAssets: missing,
            usesGenericTokenAsset: usesGenericToken)
    }

    /// `data:<mime>[;params];base64,<payload>` → (lowercased mime, bytes). Non-base64
    /// data URLs aren't produced by the Electron app and are left alone.
    static func decodeDataURL(_ src: String) -> (String, Data)? {
        guard let comma = src.firstIndex(of: ",") else { return nil }
        let header = src[src.index(src.startIndex, offsetBy: 5)..<comma].lowercased()
        let parts = header.split(separator: ";", omittingEmptySubsequences: false)
        guard parts.dropFirst().contains("base64"),
            let bytes = Data(base64Encoded: String(src[src.index(after: comma)...]), options: .ignoreUnknownCharacters),
            !bytes.isEmpty
        else { return nil }
        return (String(parts.first ?? ""), bytes)
    }

    private static func embeddedAssetName(mime: String, taken: Set<String>) -> String {
        let subtype = mime.split(separator: "/").last.map(String.init) ?? ""
        var ext = subtype == "jpeg" ? "jpg" : subtype == "mpeg" ? "mp3" : subtype.filter { $0.isLetter || $0.isNumber }
        if ext.isEmpty { ext = "bin" }
        var n = 1
        while taken.contains("embedded-\(n).\(ext)") { n += 1 }
        return "embedded-\(n).\(ext)"
    }

    /// TS `migrateLegacyCampaign`: a pre-campaign single-map game state (CORE_SPEC §2.6).
    private static func migrateLegacyState(_ legacy: [String: Any]) -> [String: Any] {
        let mapID = newID()
        var map: [String: Any] = ["id": mapID, "name": "Imported Map"]
        for key in ["tokens", "drawings", "exploredRegions", "map", "gridSize", "gridType", "isDaylightMode"] {
            if let value = legacy[key], !(value is NSNull) { map[key] = value }
        }
        return [
            "id": newID(),
            "name": "Imported Campaign",
            "maps": [map],
            "activeMapId": mapID,
            "tokenLibrary": [Any](),
        ]
    }
}
