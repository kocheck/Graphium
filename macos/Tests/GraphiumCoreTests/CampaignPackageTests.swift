import XCTest

@testable import GraphiumCore

final class CampaignPackageTests: XCTestCase {
    func testDefaultCampaignHasOneActiveMap() {
        let campaign = Campaign.makeDefault()
        XCTAssertEqual(campaign.name, "New Campaign")
        XCTAssertEqual(campaign.maps.count, 1)
        XCTAssertEqual(campaign.activeMap.name, "Map 1")
        XCTAssertEqual(campaign.activeMap.gridSize, 50)
        XCTAssertEqual(campaign.activeMap.gridType, .lines)
        XCTAssertEqual(campaign.sessionConsole.stage.title, "New Campaign")
    }

    func testAddMapAppendsAndActivates() {
        var campaign = Campaign.makeDefault()
        let id = campaign.addMap()
        XCTAssertEqual(campaign.maps.map(\.name), ["Map 1", "Map 2"])
        XCTAssertEqual(campaign.activeMapID, id)
    }

    func testRoundTripPreservesCampaignAndAssets() throws {
        var campaign = Campaign.makeDefault(name: "Crypt of Ash")
        campaign.addMap(named: "Lower Vault")
        let assets = ["map.webp": Data([1, 2, 3])]
        let package = CampaignPackage(campaign: campaign, assets: assets)

        let decoded = try CampaignPackage(manifest: package.encodeManifest(), assets: assets)
        XCTAssertEqual(decoded, package)
    }

    func testManifestIsStableForDiffs() throws {
        let package = CampaignPackage(campaign: .makeDefault())
        XCTAssertEqual(try package.encodeManifest(), try package.encodeManifest())
        let text = String(decoding: try package.encodeManifest(), as: UTF8.self)
        XCTAssertTrue(text.contains("\"formatVersion\" : 1"))
    }

    func testRejectsMissingManifest() {
        XCTAssertThrowsError(try CampaignPackage(manifest: nil, assets: [:])) { error in
            XCTAssertEqual(error as? CampaignPackage.FormatError, .missingManifest)
        }
    }

    func testRejectsNewerFormatWithClearError() {
        let future = Data(#"{"formatVersion": 99, "campaign": {"somethingNew": true}}"#.utf8)
        XCTAssertThrowsError(try CampaignPackage(manifest: future, assets: [:])) { error in
            XCTAssertEqual(
                error as? CampaignPackage.FormatError,
                .newerFormat(found: 99, supported: CampaignPackage.currentFormatVersion))
        }
    }

    func testRejectsAssetNamesThatEscapeTheAssetsFolder() throws {
        let manifest = try CampaignPackage(campaign: .makeDefault()).encodeManifest()
        for bad in ["../evil.png", "sub/dir.png", ".hidden", ""] {
            XCTAssertThrowsError(try CampaignPackage(manifest: manifest, assets: [bad: Data()]), bad)
        }
    }
}

final class AssetPruningTests: XCTestCase {
    func testPruneKeepsReferencedAndKeptAssetsOnly() {
        var campaign = Campaign.makeDefault()
        campaign.activeMap.tokens.append(Token(x: 0, y: 0, src: "goblin.png", type: .npc, name: "Goblin"))
        campaign.sessionConsole.trackGroups = [
            TrackGroup(title: "Tracks", accent: .bed, tracks: [Track(title: "Rain", source: .local, src: "rain.mp3")])
        ]
        var package = CampaignPackage(
            campaign: campaign,
            assets: [
                "goblin.png": Data([1]), "rain.mp3": Data([2]), "old-map.jpg": Data([3]),
                "deleted.png": Data([4]), "generic-token.png": Data([5]),
            ])

        let removed = package.pruneUnreferencedAssets(keeping: ["generic-token.png"])

        XCTAssertEqual(removed, ["deleted.png", "old-map.jpg"])
        XCTAssertEqual(Set(package.assets.keys), ["goblin.png", "rain.mp3", "generic-token.png"])
    }

    func testPruneDropsAssetsOnlyNamedByExternalURLs() {
        var campaign = Campaign.makeDefault()
        campaign.activeMap.tokens.append(Token(x: 0, y: 0, src: "https://example.com/a.png", type: .npc, name: "A"))
        var package = CampaignPackage(campaign: campaign, assets: ["a.png": Data([1])])
        XCTAssertEqual(package.pruneUnreferencedAssets(), ["a.png"])
        XCTAssertTrue(package.assets.isEmpty)
    }
}

final class PackageFileWrapperTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("graphium-fw-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    /// Writes a package to disk and reads it back, as a saved document's `existingFile`.
    private func saved(_ package: CampaignPackage) throws -> FileWrapper {
        let url = directory.appendingPathComponent("Saved.graphiumcampaign")
        try package.fileWrapper(reusing: nil).write(to: url, options: [], originalContentsURL: nil)
        return try FileWrapper(url: url, options: .immediate)
    }

    private func assetWrappers(_ wrapper: FileWrapper) -> [String: FileWrapper] {
        wrapper.fileWrappers?[CampaignPackage.assetsDirectoryName]?.fileWrappers ?? [:]
    }

    func testRoundTripThroughDisk() throws {
        let package = CampaignPackage(campaign: .makeDefault(), assets: ["map.jpg": Data([1, 2, 3])])
        let read = try saved(package)
        let manifest = read.fileWrappers?[CampaignPackage.manifestFileName]?.regularFileContents
        let assets = assetWrappers(read).compactMapValues(\.regularFileContents)
        XCTAssertEqual(try CampaignPackage(manifest: manifest, assets: assets), package)
    }

    func testReusesSavedAssetWithSameNameAndSize() throws {
        let original = CampaignPackage(campaign: .makeDefault(), assets: ["map.jpg": Data([1, 2, 3])])
        let existing = try saved(original)
        let savedMap = try XCTUnwrap(assetWrappers(existing)["map.jpg"])

        var next = original
        next.assets["token.png"] = Data([9])
        let wrapper = try next.fileWrapper(reusing: existing)

        XCTAssertTrue(assetWrappers(wrapper)["map.jpg"] === savedMap, "unchanged asset is passed through")
        XCTAssertFalse(assetWrappers(wrapper)["token.png"] === assetWrappers(existing)["token.png"])
        XCTAssertEqual(assetWrappers(wrapper)["token.png"]?.regularFileContents, Data([9]))
    }

    func testWritesFreshBytesWhenSizeDiffers() throws {
        let existing = try saved(CampaignPackage(campaign: .makeDefault(), assets: ["map.jpg": Data([1, 2, 3])]))
        let changed = CampaignPackage(campaign: .makeDefault(), assets: ["map.jpg": Data([4, 5])])
        let wrapper = try changed.fileWrapper(reusing: existing)
        XCTAssertFalse(assetWrappers(wrapper)["map.jpg"] === assetWrappers(existing)["map.jpg"])
        XCTAssertEqual(assetWrappers(wrapper)["map.jpg"]?.regularFileContents, Data([4, 5]))
    }

    func testDropsAssetsNoLongerInThePackage() throws {
        let existing = try saved(
            CampaignPackage(campaign: .makeDefault(), assets: ["a.png": Data([1]), "b.png": Data([2])]))
        let wrapper = try CampaignPackage(campaign: .makeDefault(), assets: ["a.png": Data([1])]).fileWrapper(reusing: existing)
        XCTAssertEqual(Set(assetWrappers(wrapper).keys), ["a.png"])
    }
}
