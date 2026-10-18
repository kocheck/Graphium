import XCTest

@testable import GraphiumCore

/// Fog revealed by hand with the Reveal tool (native only, #357).
final class RevealedAreaTests: XCTestCase {
    private let room = Bounds(x: 210, y: 160, width: 120, height: 70)

    func testRectanglesSnapOutwardToWholeCells() {
        let area = RevealedArea(rect: room, gridSize: 50, snap: true)
        XCTAssertEqual(
            area.points,
            [Point2D(x: 200, y: 150), Point2D(x: 350, y: 150), Point2D(x: 350, y: 250), Point2D(x: 200, y: 250)])
        let exact = RevealedArea(rect: room, gridSize: 50, snap: false)
        XCTAssertEqual(exact.points.first, Point2D(x: 210, y: 160))
    }

    func testARevealedAreaIsSeenWithNoPCOnTheMap() {
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "orc", x: 250, y: 175, src: "", type: .npc)]
        XCTAssertEqual(map.tokensHiddenFromPlayers(library: [:]), ["orc"])

        map.revealedAreas = [RevealedArea(rect: room, gridSize: 50, snap: true)]
        let sight = LineOfSight.partySight(of: map, library: [:])
        XCTAssertTrue(sight.sees(Point2D(x: 210, y: 160)))
        XCTAssertTrue(sight.sees(Point2D(x: 345, y: 245)), "the whole area is clear, corners included")
        XCTAssertFalse(sight.sees(Point2D(x: 500, y: 500)))
        XCTAssertEqual(map.tokensHiddenFromPlayers(library: [:]), [])
    }

    func testARevealedAreaIsLitOnADarkMap() {
        var map = GameMap(gridSize: 50)
        map.ambientLight = .dark
        map.revealedAreas = [RevealedArea(rect: room, gridSize: 50, snap: true)]
        XCTAssertEqual(LineOfSight.partySight(of: map, library: [:]).perceived(at: Point2D(x: 220, y: 170)), .bright)
        XCTAssertNil(LineOfSight.partySight(of: map, library: [:]).perceived(at: Point2D(x: 600, y: 600)))
    }

    func testRevealingExploresAndResetForgets() {
        var map = GameMap(gridSize: 50)
        let before = map
        map.revealedAreas = [RevealedArea(rect: room, gridSize: 50, snap: true)]
        map.recordExploration(since: before, library: [:], timestamp: 1)
        XCTAssertEqual(map.exploredRegions.count, 1)

        // Hiding it again leaves the ground explored (remembered), not unexplored.
        let revealed = map
        map.revealedAreas = []
        map.recordExploration(since: revealed, library: [:], timestamp: 2)
        XCTAssertEqual(map.exploredRegions.count, 1)

        map.revealedAreas = [RevealedArea(rect: room, gridSize: 50, snap: true)]
        map.resetExploration(library: [:], timestamp: 3)
        XCTAssertTrue(map.revealedAreas.isEmpty)
        XCTAssertTrue(map.exploredRegions.isEmpty)
    }

    func testRevealedAreasRoundTripAndAreOmittedWhenEmpty() throws {
        var map = GameMap(gridSize: 50)
        let plain = String(decoding: try JSONEncoder().encode(map), as: UTF8.self)
        XCTAssertFalse(plain.contains("revealedAreas"))
        map.revealedAreas = [RevealedArea(rect: room, gridSize: 50, snap: false)]
        let decoded = try JSONDecoder().decode(GameMap.self, from: JSONEncoder().encode(map))
        XCTAssertEqual(decoded.revealedAreas, map.revealedAreas)
        XCTAssertEqual(decoded.revealedArea(at: Point2D(x: 250, y: 200))?.id, map.revealedAreas[0].id)
    }

    func testTheVisibilityCacheNoticesReveals() {
        let cache = VisibilityCache()
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "orc", x: 250, y: 175, src: "", type: .npc)]
        XCTAssertEqual(cache.visibility(of: map, library: [:]).hiddenNPCIDs, ["orc"])
        map.revealedAreas = [RevealedArea(rect: room, gridSize: 50, snap: true)]
        XCTAssertEqual(cache.visibility(of: map, library: [:]).hiddenNPCIDs, [])
    }
}
