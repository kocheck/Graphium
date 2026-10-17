import XCTest

@testable import GraphiumCore

final class VisibilityCacheTests: XCTestCase {
    private func makeMap() -> GameMap {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "pc", x: 0, y: 0, src: "", type: .pc, visionRadius: 60),
            Token(id: "npc", x: 2000, y: 2000, src: "", type: .npc),
        ]
        return map
    }

    func testReusesResultUntilVisionInputsChange() {
        let cache = VisibilityCache()
        var map = makeMap()
        let first = cache.visibility(of: map, library: [:])
        XCTAssertEqual(first.vision.count, 1)
        XCTAssertEqual(first.hiddenNPCIDs, ["npc"])

        map.exploredRegions = [ExploredRegion(points: [Point2D(x: 1, y: 1)], timestamp: 1)]
        map.gridColor = "#ff0000"
        XCTAssertEqual(cache.visibility(of: map, library: [:]), first)
        XCTAssertEqual(cache.computeCount, 1, "fog memory and grid colour don't affect vision")

        map.tokens[0].x = 100
        _ = cache.visibility(of: map, library: [:])
        XCTAssertEqual(cache.computeCount, 2, "moving a PC recomputes")
    }

    func testDaylightHasNoFog() {
        var map = makeMap()
        map.isDaylightMode = true
        let result = VisibilityCache().visibility(of: map, library: [:])
        XCTAssertTrue(result.vision.isEmpty)
        XCTAssertTrue(result.hiddenNPCIDs.isEmpty)
    }
}
