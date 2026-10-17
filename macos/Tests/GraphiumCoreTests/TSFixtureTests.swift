import XCTest

@testable import GraphiumCore

/// Imports `.graphium` files written by the Electron app's real serializer (see
/// TSFixtures.swift and macos/Tests/make-ts-fixture.mts), not hand-built ZIPs.
final class TSFixtureTests: XCTestCase {
    /// The campaign with every package asset reference replaced by its bytes, so two
    /// imports compare equal whatever names the importer chose for the assets.
    private func resolved(_ package: CampaignPackage) -> Campaign {
        var campaign = package.campaign
        campaign.rewriteAssetReferences { src in
            package.assets[src].map { "bytes:" + $0.base64EncodedString() } ?? src
        }
        return campaign
    }

    func testImportsCampaignWrittenByElectron() throws {
        let result = try LegacyImporter.importArchive(TSFixtures.campaign)
        let campaign = result.package.campaign
        let assets = result.package.assets
        XCTAssertEqual(result.missingAssets.filter { $0.hasPrefix("assets/") }, [])

        XCTAssertEqual(campaign.name, "Fixture Campaign")
        XCTAssertEqual(campaign.maps.map(\.id), ["map-b", "map-a"], "file order, not alphabetical")
        XCTAssertEqual(campaign.activeMapID, "map-a")
        XCTAssertEqual(campaign.maps[0].tokens.count, 3)
        XCTAssertEqual(campaign.maps[1].tokens.first?.scale, 2)

        // Two different files named cave.png: Electron wrote the second as cave-2.png.
        let backgrounds = campaign.maps.compactMap { $0.background?.src }
        XCTAssertEqual(backgrounds.count, 2)
        XCTAssertEqual(backgrounds.map { assets[$0] }, [Data([1, 1, 1]), Data([2, 2, 2, 2])])

        let goblin = try XCTUnwrap(campaign.tokenLibrary.first)
        XCTAssertEqual(assets[goblin.src], Data([3, 3, 3, 3, 3]))
        XCTAssertEqual(assets[goblin.thumbnailSrc], Data([4]), "library thumbnails are in the ZIP")
        XCTAssertEqual(campaign.maps[0].tokens.first?.src, goblin.src, "one asset per distinct file")

        let plate = try XCTUnwrap(campaign.sessionConsole.imageSets.first?.images.first)
        XCTAssertEqual(assets[plate.src], Data([5, 5]))
        XCTAssertEqual(assets[plate.thumbnailSrc], Data([6]))

        let tracks = campaign.sessionConsole.trackGroups.first?.tracks ?? []
        XCTAssertEqual(tracks.count, 2)
        XCTAssertEqual(tracks.first?.src.flatMap { assets[$0] }, Data([7, 7, 7]))
        XCTAssertEqual(tracks.last?.source, .youtube)
        XCTAssertEqual(tracks.last?.youtubeId, "dQw4w9WgXcQ")
        XCTAssertNil(tracks.last?.src)
        XCTAssertEqual(tracks.last?.recommendedImageId, "plate-gate")

        let door = try XCTUnwrap(campaign.sessionConsole.sfx.first { $0.id == "door" })
        XCTAssertEqual(door.kind, .local)
        XCTAssertEqual(door.src.flatMap { assets[$0] }, Data([8, 8]))
        XCTAssertEqual(campaign.sessionConsole.sfx.count, 6)
    }

    func testElectronCampaignSurvivesExportAndReimport() throws {
        let first = try LegacyImporter.importArchive(TSFixtures.campaign).package
        let second = try LegacyImporter.importArchive(LegacyExporter.export(first)).package
        XCTAssertEqual(second.campaign, first.campaign)
        XCTAssertEqual(second.assets, first.assets)
        XCTAssertEqual(resolved(second), resolved(first))
    }

    func testWebExportWhitespaceImportsTheSameCampaign() throws {
        let compact = try LegacyImporter.importArchive(TSFixtures.campaign).package
        let web = try LegacyImporter.importArchive(TSFixtures.campaignWebWhitespace).package
        XCTAssertEqual(resolved(web), resolved(compact))
    }

    func testUnknownSynthTypeDoesNotBlockImport() {
        // Non-strict: passes either way, and stops recording a failure once #317 lands.
        let options = XCTExpectedFailure.Options()
        options.isStrict = false
        XCTExpectFailure("An unknown synthType fails the whole import (#317)", options: options)
        let result = try? LegacyImporter.importArchive(TSFixtures.campaignUnknownSynthType)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.package.campaign.maps.count, 2)
    }
}
