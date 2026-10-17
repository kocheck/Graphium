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
