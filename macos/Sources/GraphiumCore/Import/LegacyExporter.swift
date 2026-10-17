import Foundation

/// Writes a campaign as the Electron app's `.graphium` ZIP (PARITY §5.2
/// compatibility): `manifest.json` plus `assets/<name>`. Maps are written as an
/// id-keyed object in navigator order, as TS `saveCampaign` does, and package
/// asset names become `assets/<name>` references.
public enum LegacyExporter {
    public static func export(_ package: CampaignPackage) throws -> Data {
        var campaign = package.campaign
        var used: [String] = []
        campaign.rewriteAssetReferences { src in
            guard AssetReference.isPackageAsset(src), package.assets[src] != nil else { return src }
            if !used.contains(src) { used.append(src) }
            return "assets/" + src
        }
        var zip = ZipWriter()
        try zip.add("manifest.json", try manifest(for: campaign))
        for name in used {
            if let data = package.assets[name] { try zip.add("assets/" + name, data) }
        }
        return zip.finish()
    }

    /// The campaign JSON with `maps` as an ordered `{ id: map }` object.
    /// JSONSerialization can't keep key order, so the maps object is spliced in.
    static func manifest(for campaign: Campaign) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        guard var root = try JSONSerialization.jsonObject(with: encoder.encode(campaign)) as? [String: Any] else {
            throw CocoaError(.coderInvalidValue)
        }
        root["maps"] = nil
        var json = [UInt8](try JSONSerialization.data(withJSONObject: root, options: [.sortedKeys, .withoutEscapingSlashes]))
        guard json.last == UInt8(ascii: "}") else { throw CocoaError(.coderInvalidValue) }
        json.removeLast()
        var maps: [UInt8] = Array(#""maps":{"#.utf8)
        for (index, map) in campaign.maps.enumerated() {
            if index > 0 { maps.append(UInt8(ascii: ",")) }
            maps += try JSONSerialization.data(withJSONObject: [map.id], options: [.withoutEscapingSlashes]).dropFirst().dropLast()
            maps.append(UInt8(ascii: ":"))
            maps += try encoder.encode(map)
        }
        maps.append(UInt8(ascii: "}"))
        if json.count > 1 { json.append(UInt8(ascii: ",")) }
        return Data(json + maps + [UInt8(ascii: "}")])
    }
}
