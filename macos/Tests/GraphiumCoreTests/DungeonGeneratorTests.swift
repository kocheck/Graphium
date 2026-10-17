import XCTest

@testable import GraphiumCore

/// TS output is unseeded, so these check properties (CORE_SPEC §3.8 rule R8)
/// plus the TS dungeon-generator.test.ts expectations.
final class DungeonGeneratorTests: XCTestCase {
    func generate(seed: UInt64, rooms: Int = 6) -> DungeonResult {
        var rng = SplitMix64(seed: seed)
        return DungeonGenerator.generate(DungeonOptions(numRooms: rooms), using: &rng)
    }

    func testGeneratesRoomsWallsAndPairedDoors() {
        let result = generate(seed: 1)
        XCTAssertGreaterThan(result.rooms.count, 1)
        XCTAssertLessThanOrEqual(result.rooms.count, 6)
        XCTAssertEqual(result.doors.count, (result.rooms.count - 1) * 2, "two doors per connection")
        XCTAssertFalse(result.drawings.isEmpty)
        XCTAssertTrue(result.drawings.allSatisfy { $0.tool == .wall && $0.points.count == 4 && $0.color == "#ff0000" })
    }

    func testDoorsAlignToGridAndHaveValidProperties() {
        for seed in 1...20 {
            for door in generate(seed: UInt64(seed)).doors {
                XCTAssertEqual(door.x.truncatingRemainder(dividingBy: 50), 0, "seed \(seed)")
                XCTAssertEqual(door.y.truncatingRemainder(dividingBy: 50), 0, "seed \(seed)")
                XCTAssertEqual(door.size, 50)
                XCTAssertEqual(door.thickness, 12)
                XCTAssertFalse(door.isOpen)
                XCTAssertFalse(door.isLocked)
                XCTAssertNotNil(door.swingDirection)
            }
        }
    }

    func testRoomsSizesWithinLimitsAndNeverOverlap() {
        for seed in 1...20 {
            let rooms = generate(seed: UInt64(seed), rooms: 10).rooms
            for (i, a) in rooms.enumerated() {
                XCTAssertTrue((150...400).contains(a.width) && (150...400).contains(a.height), "3–8 cells")
                for b in rooms[(i + 1)...] {
                    XCTAssertFalse(a.intersects(b), "seed \(seed): rooms overlap")
                }
            }
        }
    }

    func testSameSeedSameDungeon() {
        let a = generate(seed: 42)
        let b = generate(seed: 42)
        XCTAssertEqual(a.rooms, b.rooms)
        XCTAssertEqual(a.doors.map { Point2D(x: $0.x, y: $0.y) }, b.doors.map { Point2D(x: $0.x, y: $0.y) })
    }

    func testDoorwayCutsWall() {
        var piece = DungeonGenerator.Piece(
            bounds: Bounds(x: 0, y: 0, width: 300, height: 200), isRoom: true, sides: [.north])
        DungeonGenerator.removeConnectingWalls(&piece, .north, at: Point2D(x: 150, y: 0), g: 50)
        XCTAssertEqual(
            piece.walls[.north],
            [Point2D(x: 0, y: 0), Point2D(x: 125, y: 0), Point2D(x: 175, y: 0), Point2D(x: 300, y: 0)])
        var narrow = DungeonGenerator.Piece(bounds: Bounds(x: 0, y: 0, width: 60, height: 60), isRoom: true, sides: [.west])
        DungeonGenerator.removeConnectingWalls(&narrow, .west, at: Point2D(x: 0, y: 30), g: 50)
        XCTAssertNil(narrow.walls[.west], "too short to keep any wall")
    }

    func testApplyCanClearFirst() {
        var map = GameMap()
        map.drawings = [Drawing(tool: .marker, points: [0, 0], color: "#000", size: 5)]
        map.doors = [Door(x: 0, y: 0, orientation: .vertical, size: 50)]
        let dungeon = generate(seed: 3)
        map.apply(dungeon, clearFirst: true)
        XCTAssertEqual(map.drawings.count, dungeon.drawings.count)
        XCTAssertEqual(map.doors.count, dungeon.doors.count)
    }
}
