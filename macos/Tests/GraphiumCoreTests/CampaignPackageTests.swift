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
                "deleted.png": Data([4]), "generic-token.png": Data([5]), "dm-added.png": Data([6]),
            ],
            preserved: .init(orphanedAssets: ["deleted.png", "old-map.jpg", "generic-token.png", "goblin.png"]))

        let removed = package.pruneUnreferencedAssets(keeping: ["generic-token.png"])

        XCTAssertEqual(removed, ["deleted.png", "old-map.jpg"])
        // A file the app never orphaned, like one the DM copied in by hand, stays.
        XCTAssertEqual(Set(package.assets.keys), ["goblin.png", "rain.mp3", "generic-token.png", "dm-added.png"])
        XCTAssertTrue(package.preserved.orphanedAssets.isEmpty)
    }

    func testOrphanListRoundTripsThroughTheManifest() throws {
        let package = CampaignPackage(
            campaign: .makeDefault(), assets: ["old.png": Data([1])], preserved: .init(orphanedAssets: ["old.png"]))
        var reopened = try CampaignPackage(manifest: package.encodeManifest(), assets: package.assets)
        XCTAssertEqual(reopened.preserved.orphanedAssets, ["old.png"])
        XCTAssertEqual(reopened.pruneUnreferencedAssets(), ["old.png"])
    }

    func testPruneDropsAssetsOnlyNamedByExternalURLs() {
        var campaign = Campaign.makeDefault()
        campaign.activeMap.tokens.append(Token(x: 0, y: 0, src: "https://example.com/a.png", type: .npc, name: "A"))
        var package = CampaignPackage(
            campaign: campaign, assets: ["a.png": Data([1])], preserved: .init(orphanedAssets: ["a.png"]))
        XCTAssertEqual(package.pruneUnreferencedAssets(), ["a.png"])
        XCTAssertTrue(package.assets.isEmpty)
    }
}

final class UnknownFieldTests: XCTestCase {
    private func manifest(_ json: String) -> Data { Data(json.utf8) }

    private func object(_ data: Data) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    /// A campaign.json written by this build, with extra keys spliced in where a newer
    /// Graphium (or a hand edit) might put them.
    private func manifestWithExtras() throws -> (Data, tokenID: String) {
        var campaign = Campaign.makeDefault()
        let token = Token(x: 0, y: 0, src: "goblin.png", type: .npc, name: "Goblin")
        campaign.activeMap.tokens.append(token)
        var root = try object(CampaignPackage(campaign: campaign).encodeManifest())
        root["futureTopLevel"] = ["a": 1]
        var campaignObject = try XCTUnwrap(root["campaign"] as? [String: Any])
        campaignObject["futureCampaignField"] = "kept"
        var maps = try XCTUnwrap(campaignObject["maps"] as? [[String: Any]])
        var tokens = try XCTUnwrap(maps[0]["tokens"] as? [[String: Any]])
        tokens[0]["futureTokenField"] = ["hp": 7]
        maps[0]["tokens"] = tokens
        campaignObject["maps"] = maps
        root["campaign"] = campaignObject
        return (try JSONSerialization.data(withJSONObject: root), token.id)
    }

    func testUnknownKeysSurviveASave() throws {
        let (data, _) = try manifestWithExtras()
        let package = try CampaignPackage(manifest: data, assets: [:])
        XCTAssertNotNil(package.preserved.unknownFields)

        let saved = try object(package.encodeManifest())
        XCTAssertEqual((saved["futureTopLevel"] as? [String: Int])?["a"], 1)
        let campaign = try XCTUnwrap(saved["campaign"] as? [String: Any])
        XCTAssertEqual(campaign["futureCampaignField"] as? String, "kept")
        let token = try XCTUnwrap(((campaign["maps"] as? [[String: Any]])?[0]["tokens"] as? [[String: Any]])?[0])
        XCTAssertEqual((token["futureTokenField"] as? [String: Int])?["hp"], 7)
    }

    func testUnknownTokenFieldsFollowTheTokenById() throws {
        let (data, tokenID) = try manifestWithExtras()
        var package = try CampaignPackage(manifest: data, assets: [:])
        // Another token goes in front; the kept field still belongs to the goblin.
        package.campaign.activeMap.tokens.insert(Token(x: 5, y: 5, src: "orc.png", type: .npc, name: "Orc"), at: 0)

        let saved = try object(package.encodeManifest())
        let tokens = try XCTUnwrap(
            ((saved["campaign"] as? [String: Any])?["maps"] as? [[String: Any]])?[0]["tokens"] as? [[String: Any]])
        XCTAssertNil(tokens[0]["futureTokenField"])
        XCTAssertEqual(tokens[1]["id"] as? String, tokenID)
        XCTAssertNotNil(tokens[1]["futureTokenField"])
    }

    func testDeletedObjectTakesItsUnknownFieldsWithIt() throws {
        let (data, _) = try manifestWithExtras()
        var package = try CampaignPackage(manifest: data, assets: [:])
        package.campaign.activeMap.tokens.removeAll()
        let text = String(decoding: try package.encodeManifest(), as: UTF8.self)
        XCTAssertFalse(text.contains("futureTokenField"))
        XCTAssertTrue(text.contains("futureCampaignField"))
    }

    func testAKnownFieldClearedByTheDMIsNotBroughtBack() throws {
        var campaign = Campaign.makeDefault()
        campaign.activeMap.tokens.append(Token(x: 0, y: 0, src: "a.png", type: .pc, name: "Ash", darkvision: 60))
        var package = try CampaignPackage(manifest: CampaignPackage(campaign: campaign).encodeManifest(), assets: [:])
        XCTAssertNil(package.preserved.unknownFields)
        package.campaign.activeMap.tokens[0].darkvision = nil
        let reopened = try CampaignPackage(manifest: package.encodeManifest(), assets: [:])
        XCTAssertNil(reopened.campaign.activeMap.tokens[0].darkvision)
    }

    func testAFileWithNothingUnknownIsWrittenExactlyAsBefore() throws {
        let package = CampaignPackage(campaign: .makeDefault(name: "Plain"))
        let first = try package.encodeManifest()
        let reopened = try CampaignPackage(manifest: first, assets: [:])
        XCTAssertNil(reopened.preserved.unknownFields)
        XCTAssertEqual(try reopened.encodeManifest(), first)
    }

    func testSavingWithUnknownFieldsKeepsTheStableFormat() throws {
        let (data, _) = try manifestWithExtras()
        let package = try CampaignPackage(manifest: data, assets: [:])
        let once = try package.encodeManifest()
        let twice = try CampaignPackage(manifest: once, assets: [:]).encodeManifest()
        XCTAssertEqual(once, twice)
        XCTAssertTrue(String(decoding: once, as: UTF8.self).contains("\"formatVersion\" : 1"))
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
