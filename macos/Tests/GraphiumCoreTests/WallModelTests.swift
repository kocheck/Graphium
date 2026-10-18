import XCTest

@testable import GraphiumCore

/// Wall kinds, one-way walls and wall editing (PARITY §3.5, native additions).
final class WallModelTests: XCTestCase {
    /// A PC at (25, 50) west of a wall at x = 200 running top to bottom (y −1000 → 1000).
    private func map(_ wall: Drawing) -> GameMap {
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "pc", x: 0, y: 25, src: "", type: .pc, visionRadius: 60)]
        map.drawings = [wall]
        return map
    }

    private func wall(kind: WallKind? = nil, oneWay: Bool? = nil, downwards: Bool = true) -> Drawing {
        Drawing(
            id: "w", tool: .wall, points: downwards ? [200, -1000, 200, 1000] : [200, 1000, 200, -1000],
            color: "#f00", size: 8, wallKind: kind, oneWay: oneWay)
    }

    private func seesBeyond(_ map: GameMap) -> Bool {
        LineOfSight.containsInAny(LineOfSight.polygons(of: map, library: [:]).map(\.polygon), Point2D(x: 400, y: 50))
    }

    func testWallsBlockAndWindowsDoNot() {
        XCTAssertFalse(seesBeyond(map(wall())))
        XCTAssertTrue(seesBeyond(map(wall(kind: .window))))
        XCTAssertTrue(LineOfSight.walls(of: map(wall(kind: .window))).isEmpty)
    }

    func testOneWayWallPassesFromItsLeftOnly() {
        // Drawn downwards (south) on screen, a wall's left is the east: the PC, to the west, is blocked.
        XCTAssertFalse(seesBeyond(map(wall(oneWay: true, downwards: true))))
        // Drawn upwards (north), its left is the west: the PC sees through.
        XCTAssertTrue(seesBeyond(map(wall(oneWay: true, downwards: false))))
    }

    func testFlipTurnsAOneWayWallAround() {
        var m = map(wall(oneWay: true))
        XCTAssertFalse(seesBeyond(m))
        m.flipWalls(["w"])
        XCTAssertEqual(m.drawings[0].points, [200, 1000, 200, -1000])
        XCTAssertTrue(seesBeyond(m))
    }

    func testFlipReversesEveryPoint() {
        var m = GameMap()
        m.drawings = [
            Drawing(id: "w", tool: .wall, points: [0, 0, 10, 0, 10, 10], color: "#f00", size: 8),
            Drawing(id: "m", tool: .marker, points: [0, 0, 5, 5], color: "#000", size: 5),
        ]
        m.flipWalls(["w", "m"])
        XCTAssertEqual(m.drawings[0].points, [10, 10, 10, 0, 0, 0])
        XCTAssertEqual(m.drawings[1].points, [0, 0, 5, 5], "markers aren't walls")
    }

    func testDefaultsAreStoredAsNil() {
        var m = map(wall())
        m.setWallKind(.window, ids: ["w"])
        m.setOneWay(true, ids: ["w"])
        XCTAssertEqual(m.drawings[0].wallKind, .window)
        XCTAssertEqual(m.drawings[0].oneWay, true)
        m.setWallKind(.wall, ids: ["w"])
        m.setOneWay(false, ids: ["w"])
        XCTAssertNil(m.drawings[0].wallKind)
        XCTAssertNil(m.drawings[0].oneWay)
        XCTAssertEqual(m.drawings[0], wall(), "back to an ordinary wall, byte for byte")
    }

    func testOldWallsDecodeAndUnknownKindsReadAsWalls() throws {
        let old = ##"{"id":"w","tool":"wall","points":[0,0,100,0],"color":"#ff0000","size":8}"##
        let decoded = try JSONDecoder().decode(Drawing.self, from: Data(old.utf8))
        XCTAssertNil(decoded.wallKind)
        XCTAssertTrue(decoded.blocksSight)
        let encoded = String(decoding: try JSONEncoder().encode(decoded), as: UTF8.self)
        XCTAssertFalse(encoded.contains("wallKind"), "untouched walls write no new keys")
        XCTAssertFalse(encoded.contains("oneWay"))

        let newer = ##"{"id":"w","tool":"wall","points":[0,0,100,0],"color":"#ff0000","size":8,"wallKind":"forcefield"}"##
        XCTAssertEqual(try JSONDecoder().decode(Drawing.self, from: Data(newer.utf8)).wallKind, .wall)
    }

    func testWallsCanBeMovedLikeStrokes() {
        var m = map(wall())
        m.moveDrawings(["w"], dx: 300, dy: 0, duplicate: false)
        XCTAssertEqual(m.drawings[0].worldPoints.first, Point2D(x: 500, y: -1000))
        XCTAssertTrue(seesBeyond(m), "the wall moved past the point")
    }

    func testChangingAWallsKindRestampsExploration() {
        var m = map(wall())
        let before = m
        m.setWallKind(.window, ids: ["w"])
        XCTAssertEqual(m.recordExploration(since: before, library: [:], timestamp: 1), 1)
    }
}
