import XCTest

@testable import GraphiumCore

final class ModelDecodingTests: XCTestCase {
    private func decodeMap(_ json: String) throws -> GameMap {
        try JSONDecoder().decode(GameMap.self, from: Data(json.utf8))
    }

    func testMapDecodeAppliesLoadCampaignFallbacks() throws {
        let map = try decodeMap(#"{"id":"m1"}"#)
        XCTAssertEqual(map.name, "New Map")
        XCTAssertEqual(map.gridSize, 50)
        XCTAssertEqual(map.gridType, .lines)
        XCTAssertEqual(map.gridColor, "#222222")
        XCTAssertTrue(map.tokens.isEmpty && map.doors.isEmpty && map.stairs.isEmpty)
        XCTAssertNil(map.background)
        XCTAssertFalse(map.isDaylightMode)
    }

    func testZeroGridSizeBecomesDefaultLikeTSOrOperator() throws {
        XCTAssertEqual(try decodeMap(#"{"id":"m1","gridSize":0}"#).gridSize, 50)
    }

    func testNullBackgroundDecodesAsNoBackground() throws {
        XCTAssertNil(try decodeMap(#"{"id":"m1","map":null}"#).background)
    }

    func testNilOptionalsAreOmittedNotNull() throws {
        let token = Token(id: "t1", x: 1, y: 2, src: "goblin.webp")
        let json = String(decoding: try JSONEncoder().encode(token), as: UTF8.self)
        XCTAssertFalse(json.contains("null"), json)
        XCTAssertFalse(json.contains("scale"), json)
    }

    func testCampaignRejectsActiveMapThatDoesNotExist() {
        let json = #"{"id":"c","name":"C","activeMapId":"nope","maps":[{"id":"m1"}]}"#
        XCTAssertThrowsError(try JSONDecoder().decode(Campaign.self, from: Data(json.utf8)))
    }

    func testCampaignWithoutSessionConsoleGetsEmptyCatalog() throws {
        let json = #"{"id":"c","name":"Crypt","activeMapId":"m1","maps":[{"id":"m1"}]}"#
        let campaign = try JSONDecoder().decode(Campaign.self, from: Data(json.utf8))
        XCTAssertEqual(campaign.sessionConsole.stage.title, "Crypt")
        XCTAssertEqual(campaign.sessionConsole.sfx.map(\.id), ["chime", "drone", "snap", "ping", "test-tone"])
        XCTAssertEqual(campaign.sessionConsole.defaults.volume, 45)
        XCTAssertEqual(campaign.sessionConsole.defaults.duckPercent, 27)
    }

    func testDrawingWorldPointsApplyScaleThenOffset() {
        let drawing = Drawing(tool: .marker, points: [1, 2, 3, 4], color: "#000", size: 5, scale: 2, x: 10, y: -1)
        XCTAssertEqual(drawing.worldPoints, [Point2D(x: 12, y: 3), Point2D(x: 16, y: 7)])
    }

    func testExploredRegionsAreCappedOldestFirst() {
        var map = GameMap()
        for i in 0..<(GameMap.maxExploredRegions + 5) {
            map.addExploredRegion(ExploredRegion(points: [], timestamp: Double(i)))
        }
        XCTAssertEqual(map.exploredRegions.count, GameMap.maxExploredRegions)
        XCTAssertEqual(map.exploredRegions.first?.timestamp, 5)
    }

    func testNewIDsAreLowercaseUUIDs() {
        let id = newID()
        XCTAssertEqual(id, id.lowercased())
        XCTAssertNotNil(UUID(uuidString: id))
    }
}
