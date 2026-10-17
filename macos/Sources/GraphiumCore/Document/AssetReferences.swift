import Foundation

/// Asset references in the native format.
///
/// Every `src`-like field holds either the name of a file in the package's
/// `assets/` folder (no scheme, e.g. `1712-cave.webp`) or an external URL string
/// kept as-is (`https:`, or a dangling `file:` from an import).
public enum AssetReference {
    public static func isPackageAsset(_ src: String) -> Bool {
        !src.isEmpty && !src.contains(":") && CampaignPackage.isValidAssetName(src)
    }
}

extension Campaign {
    /// Every asset-bearing field, in the order the TS `rewriteCampaignAssetSrcs`
    /// visits them (CORE_SPEC §2.3). Empty strings are skipped; YouTube tracks
    /// and synth SFX carry no asset.
    public mutating func rewriteAssetReferences(_ rewrite: (String) -> String) {
        func apply(_ src: inout String) {
            if !src.isEmpty { src = rewrite(src) }
        }
        func apply(_ src: inout String?) {
            if let value = src, !value.isEmpty { src = rewrite(value) }
        }
        for m in maps.indices {
            if maps[m].background != nil { apply(&maps[m].background!.src) }
            for t in maps[m].tokens.indices { apply(&maps[m].tokens[t].src) }
        }
        for i in tokenLibrary.indices {
            apply(&tokenLibrary[i].src)
            apply(&tokenLibrary[i].thumbnailSrc)
        }
        for s in sessionConsole.imageSets.indices {
            for i in sessionConsole.imageSets[s].images.indices {
                apply(&sessionConsole.imageSets[s].images[i].src)
                apply(&sessionConsole.imageSets[s].images[i].thumbnailSrc)
            }
        }
        for g in sessionConsole.trackGroups.indices {
            for t in sessionConsole.trackGroups[g].tracks.indices
            where sessionConsole.trackGroups[g].tracks[t].source == .local {
                apply(&sessionConsole.trackGroups[g].tracks[t].src)
            }
        }
        for i in sessionConsole.sfx.indices where sessionConsole.sfx[i].kind == .local {
            apply(&sessionConsole.sfx[i].src)
        }
    }

    /// All asset references currently in the campaign.
    public var assetReferences: [String] {
        var copy = self
        var found: [String] = []
        copy.rewriteAssetReferences { found.append($0); return $0 }
        return found
    }
}
