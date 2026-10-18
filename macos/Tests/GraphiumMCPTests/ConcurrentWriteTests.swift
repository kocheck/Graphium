import XCTest

@testable import GraphiumCore
@testable import GraphiumMCP

/// The app, graphium-mcp and the Agent window all write the same package. A save that
/// lands between another writer's load and save must not be thrown away.
final class ConcurrentWriteTests: XCTestCase {
    var folder: URL!
    var store: CampaignStore!
    var tools: GraphiumTools!

    override func setUpWithError() throws {
        folder = FileManager.default.temporaryDirectory.appendingPathComponent("graphium-race-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        store = CampaignStore(roots: [folder], undoDirectory: folder.appendingPathComponent(".undo"))
        tools = GraphiumTools(store: store)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: folder)
    }

    private var manifestURL: URL { folder.appendingPathComponent("Race.graphiumcampaign/campaign.json") }

    /// What Graphium does on save: rewrite campaign.json with the DM's change.
    private func saveFromApp(_ change: (inout Campaign) -> Void) throws {
        var package = try CampaignPackage(manifest: Data(contentsOf: manifestURL), assets: [:])
        change(&package.campaign)
        try package.encodeManifest().write(to: manifestURL, options: .atomic)
    }

    func testASaveAfterSomeoneElseSavedIsRefusedAndWritesNothing() throws {
        _ = try store.create("Race", campaign: .makeDefault(name: "Race"))
        var first = try store.load("Race")
        var second = try store.load("Race")
        first.campaign.name = "First"
        try store.save(&first)

        second.campaign.name = "Second"
        _ = second.addAsset(Data([1, 2, 3]), preferredName: "late.png")
        XCTAssertThrowsError(try store.save(&second)) { XCTAssertTrue($0 is CampaignStore.ChangedOnDisk) }
        XCTAssertEqual(try store.load("Race").campaign.name, "First")
        let assets = folder.appendingPathComponent("Race.graphiumcampaign/assets")
        XCTAssertFalse(FileManager.default.fileExists(atPath: assets.appendingPathComponent("late.png").path))
    }

    func testAToolRunsAgainWhenTheAppSavesUnderIt() throws {
        _ = try store.create("Race", campaign: .makeDefault(name: "Race"))
        var landed = false
        store.willSave = { [unowned self] _ in
            guard !landed else { return }
            landed = true
            try? self.saveFromApp { $0.name = "Renamed in Graphium" }
        }

        let result = tools.call("add_map", arguments: ["campaign": "Race", "name": "Cellar"])
        XCTAssertFalse(result.isError, "\(result)")

        let campaign = try store.load("Race").campaign
        XCTAssertEqual(campaign.name, "Renamed in Graphium", "the app's save survived")
        XCTAssertEqual(campaign.maps.map(\.name), ["Map 1", "Cellar"], "and so did the tool's change")
    }

    func testAToolGivesUpCleanlyWhenTheFileNeverSettles() throws {
        _ = try store.create("Race", campaign: .makeDefault(name: "Race"))
        var saves = 0
        store.willSave = { [unowned self] _ in
            saves += 1
            try? self.saveFromApp { $0.name = "Save \(saves)" }
        }

        let result = tools.call("add_map", arguments: ["campaign": "Race", "name": "Cellar"])
        XCTAssertTrue(result.isError)
        XCTAssertEqual(saves, GraphiumTools.maxAttempts)
        XCTAssertEqual(try store.load("Race").campaign.maps.count, 1, "nothing half-written")
    }

    func testAToolSavingNaNStillSavesAndTheFileOpens() throws {
        _ = try store.create("Race", campaign: .makeDefault(name: "Race"))
        var loaded = try store.load("Race")
        loaded.campaign.activeMap.tokens.append(Token(x: .nan, y: .infinity, src: "a.png", type: .npc, name: "Wisp"))
        try store.save(&loaded)
        let token = try XCTUnwrap(try store.load("Race").campaign.activeMap.tokens.first)
        XCTAssertEqual(token.x, 0)
        XCTAssertEqual(token.y, 0)
    }

    func testADamagedTokenIsReportedAndKeptThroughAnEdit() throws {
        _ = try store.create("Race", campaign: .makeDefault(name: "Race"))
        _ = tools.call(
            "add_tokens", arguments: ["campaign": "Race", "tokens": [["name": "Goblin", "position": [1, 1]]]])
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: manifestURL)) as? [String: Any])
        var campaign = try XCTUnwrap(root["campaign"] as? [String: Any])
        var maps = try XCTUnwrap(campaign["maps"] as? [[String: Any]])
        var tokens = try XCTUnwrap(maps[0]["tokens"] as? [[String: Any]])
        tokens[0]["x"] = "left"
        maps[0]["tokens"] = tokens
        campaign["maps"] = maps
        root["campaign"] = campaign
        try JSONSerialization.data(withJSONObject: root).write(to: manifestURL)

        let described = tools.call("get_campaign", arguments: ["campaign": "Race"])
        XCTAssertFalse(described.isError)
        XCTAssertTrue("\(described)".contains("set_aside"), "\(described)")

        let added = tools.call(
            "add_tokens", arguments: ["campaign": "Race", "tokens": [["name": "Orc", "position": [2, 2]]]])
        XCTAssertFalse(added.isError, "\(added)")
        let text = try String(contentsOf: manifestURL, encoding: .utf8)
        XCTAssertTrue(text.contains("\"setAside\""))
        XCTAssertTrue(text.contains("\"left\""), "the unreadable goblin is still in the file")
        XCTAssertEqual(try store.load("Race").campaign.activeMap.tokens.count, 1)
    }
}
