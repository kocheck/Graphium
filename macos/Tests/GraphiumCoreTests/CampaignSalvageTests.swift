import XCTest

@testable import GraphiumCore

/// A partly unreadable campaign opens without the bad pieces, and saving keeps them.
final class CampaignSalvageTests: XCTestCase {
    private var goblin: Token!
    private var orc: Token!
    private var campaign: Campaign!

    override func setUp() {
        goblin = Token(x: 1, y: 1, src: "goblin.png", type: .npc, name: "Goblin")
        orc = Token(x: 2, y: 2, src: "orc.png", type: .npc, name: "Orc")
        campaign = Campaign.makeDefault()
        campaign.activeMap.tokens = [goblin, orc]
    }

    /// The default campaign as JSON with `edit` applied to its first map.
    private func manifest(editingFirstMap edit: (inout [String: Any]) throws -> Void) throws -> Data {
        let data = try CampaignPackage(campaign: campaign).encodeManifest()
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        var campaignObject = try XCTUnwrap(root["campaign"] as? [String: Any])
        var maps = try XCTUnwrap(campaignObject["maps"] as? [[String: Any]])
        try edit(&maps[0])
        campaignObject["maps"] = maps
        root["campaign"] = campaignObject
        return try JSONSerialization.data(withJSONObject: root)
    }

    private func editToken(_ index: Int, _ change: @escaping (inout [String: Any]) -> Void) -> (inout [String: Any]) throws -> Void {
        { map in
            var tokens = try XCTUnwrap(map["tokens"] as? [[String: Any]])
            change(&tokens[index])
            map["tokens"] = tokens
        }
    }

    func testABadRequiredFieldSetsAsideOnlyThatToken() throws {
        let data = try manifest(editingFirstMap: editToken(0) { $0["x"] = "left" })
        let package = try CampaignPackage(manifest: data, assets: [:])

        XCTAssertEqual(package.campaign.activeMap.tokens.map(\.id), [orc.id])
        XCTAssertEqual(package.setAsideOnOpen, 1)
        let entry = try XCTUnwrap(package.preserved.setAside.first)
        XCTAssertEqual(entry.field("from"), "campaign › maps[0] › tokens[0]")
        XCTAssertEqual(entry.field("reason"), "campaign › maps[0] › tokens[0] › x should be a number")
    }

    func testABadOptionalFieldSetsAsideOnlyThatField() throws {
        let data = try manifest(editingFirstMap: editToken(0) { $0["scale"] = "huge" })
        let package = try CampaignPackage(manifest: data, assets: [:])

        XCTAssertEqual(package.campaign.activeMap.tokens.map(\.id), [goblin.id, orc.id], "the goblin stays")
        XCTAssertNil(package.campaign.activeMap.tokens[0].scale)
        XCTAssertEqual(package.preserved.setAside.first?.field("from"), "campaign › maps[0] › tokens[0] › scale")
    }

    func testSeveralBadTokensAreEachSetAside() throws {
        let data = try manifest(editingFirstMap: { map in
            var tokens = try XCTUnwrap(map["tokens"] as? [[String: Any]])
            tokens[0]["src"] = nil
            tokens[1]["y"] = ["not": "a number"]
            map["tokens"] = tokens
        })
        let package = try CampaignPackage(manifest: data, assets: [:])
        XCTAssertTrue(package.campaign.activeMap.tokens.isEmpty)
        XCTAssertEqual(package.preserved.setAside.count, 2)
        XCTAssertFalse(package.campaign.maps.isEmpty, "the map itself survives")
    }

    func testANonObjectInAListOfObjectsIsSetAside() throws {
        let data = try manifest(editingFirstMap: { map in
            var tokens = try XCTUnwrap(map["tokens"] as? [Any])
            tokens.insert("stray text", at: 1)
            map["tokens"] = tokens
        })
        let package = try CampaignPackage(manifest: data, assets: [:])
        XCTAssertEqual(package.campaign.activeMap.tokens.map(\.id), [goblin.id, orc.id])
        XCTAssertEqual(package.preserved.setAside.first?.field("from"), "campaign › maps[0] › tokens[1]")
    }

    func testSetAsideSurvivesSaveAndReopenUnchanged() throws {
        let data = try manifest(editingFirstMap: editToken(0) { $0["x"] = "left"; $0["homebrew"] = true })
        let opened = try CampaignPackage(manifest: data, assets: [:])
        let saved = try opened.encodeManifest()

        let text = String(decoding: saved, as: UTF8.self)
        XCTAssertTrue(text.contains("\"setAside\""))
        XCTAssertTrue(text.contains("\"left\""), "the bad value is kept as it was")
        XCTAssertTrue(text.contains("homebrew"), "so are its other fields")

        let reopened = try CampaignPackage(manifest: saved, assets: [:])
        XCTAssertEqual(reopened.setAsideOnOpen, 0, "nothing new to set aside")
        XCTAssertEqual(reopened.preserved.setAside, opened.preserved.setAside)
        XCTAssertEqual(try reopened.encodeManifest(), saved, "stable across saves")
    }

    func testAnUnreadableActiveMapFallsBackToTheFirstMap() throws {
        var campaign = Campaign.makeDefault()
        let second = campaign.addMap(named: "Vault")
        let data = try CampaignPackage(campaign: campaign).encodeManifest()
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        var campaignObject = try XCTUnwrap(root["campaign"] as? [String: Any])
        var maps = try XCTUnwrap(campaignObject["maps"] as? [[String: Any]])
        maps[1]["id"] = nil  // the active map
        campaignObject["maps"] = maps
        root["campaign"] = campaignObject

        let package = try CampaignPackage(manifest: JSONSerialization.data(withJSONObject: root), assets: [:])
        XCTAssertEqual(package.campaign.maps.count, 1)
        XCTAssertEqual(package.campaign.activeMapID, campaign.maps[0].id)
        XCTAssertNotEqual(package.campaign.activeMapID, second)
        XCTAssertEqual(package.preserved.setAside.count, 2, "the map, and the old activeMapId")
    }

    func testAPointsListIsNeverShortened() throws {
        var drawing = try XCTUnwrap(
            try JSONSerialization.jsonObject(
                with: JSONEncoder().encode(Drawing(tool: .wall, points: [0, 0, 10, 0, 10, 10], color: "#000000", size: 4)))
                as? [String: Any])
        drawing["points"] = [0, 0, "ten", 0, 10, 10]
        let data = try manifest(editingFirstMap: { $0["drawings"] = [drawing] })
        let package = try CampaignPackage(manifest: data, assets: [:])
        XCTAssertTrue(package.campaign.activeMap.drawings.isEmpty, "the whole wall goes, not one coordinate")
        XCTAssertEqual(package.preserved.setAside.first?.field("from"), "campaign › maps[0] › drawings[0]")
    }

    func testAHealthyFileSetsNothingAside() throws {
        let package = try CampaignPackage(manifest: CampaignPackage(campaign: campaign).encodeManifest(), assets: [:])
        XCTAssertTrue(package.preserved.setAside.isEmpty)
        XCTAssertFalse(String(decoding: try package.encodeManifest(), as: UTF8.self).contains("setAside"))
    }
}
