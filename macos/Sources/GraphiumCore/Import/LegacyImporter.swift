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
    }

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

        // `assets/<x>` → package asset named by basename; everything else is kept as-is.
        var assets: [String: Data] = [:]
        var missing: [String] = []
        campaign.rewriteAssetReferences { src in
            guard src.hasPrefix("assets/") else { return src }
            let name = (src as NSString).lastPathComponent
            guard CampaignPackage.isValidAssetName(name), let bytes = zipAssets[name] else {
                if !missing.contains(src) { missing.append(src) }
                return src
            }
            assets[name] = bytes
            return name
        }
        return Result(package: CampaignPackage(campaign: campaign, assets: assets), missingAssets: missing)
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
