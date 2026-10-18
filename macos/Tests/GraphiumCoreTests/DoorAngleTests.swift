import XCTest

@testable import GraphiumCore

/// Doors at any angle, and open doors cutting the wall under them (PARITY §3.6, native).
final class DoorAngleTests: XCTestCase {
    private let pc = Token(id: "pc", x: 0, y: 25, src: "", type: .pc, visionRadius: 60)  // centre (25, 50)

    private func sees(_ point: Point2D, in map: GameMap) -> Bool {
        LineOfSight.containsInAny(LineOfSight.polygons(of: map, library: [:]).map(\.polygon), point)
    }

    private func wall(_ points: [Double], id: String = "w", oneWay: Bool? = nil) -> Drawing {
        Drawing(id: id, tool: .wall, points: points, color: "#f00", size: 8, oneWay: oneWay)
    }

    func testAxisDoorsKeepTheirTSGeometry() {
        var map = GameMap(gridSize: 50)
        map.doors = [
            Door(id: "h", x: 100, y: 0, orientation: .horizontal, size: 50),
            Door(id: "v", x: 0, y: 100, orientation: .vertical, size: 50),
        ]
        XCTAssertEqual(
            LineOfSight.walls(of: map),
            [
                WallSegment(start: Point2D(x: 75, y: 0), end: Point2D(x: 125, y: 0)),
                WallSegment(start: Point2D(x: 0, y: 75), end: Point2D(x: 0, y: 125)),
            ])
        XCTAssertEqual(map.door(at: Point2D(x: 120, y: 7))?.id, "h")
        XCTAssertNil(map.door(at: Point2D(x: 130, y: 0)))
        XCTAssertEqual(map.doorIDs(intersecting: Bounds(x: -2, y: 110, width: 4, height: 4)), ["v"])
    }

    func testAngleIsOptionalInTheFile() throws {
        let axis = Door(id: "a", x: 0, y: 0, orientation: .vertical, size: 50)
        XCTAssertFalse(String(decoding: try JSONEncoder().encode(axis), as: UTF8.self).contains("angle"))
        let old = #"{"id":"d","x":1,"y":2,"orientation":"horizontal","isOpen":false,"isLocked":false,"size":50}"#
        XCTAssertNil(try JSONDecoder().decode(Door.self, from: Data(old.utf8)).angle)
        let angled = Door(id: "b", x: 0, y: 0, orientation: .vertical, size: 50, angle: 63.4)
        XCTAssertEqual(try JSONDecoder().decode(Door.self, from: JSONEncoder().encode(angled)), angled)
    }

    func testAClickOnADiagonalWallLinesTheDoorUpWithIt() {
        var map = GameMap(gridSize: 50)
        map.drawings = [wall([150, -250, 450, 350])]  // through (300, 50), slope 2
        let door = map.placeDoor(at: Point2D(x: 303, y: 52), orientation: .horizontal)
        XCTAssertEqual(door.angle ?? 0, atan2(600, 300) * 180 / .pi, accuracy: 1e-9)
        XCTAssertEqual(door.orientation, .vertical, "nearest axis, for the web app")
        for end in [door.ends.hinge, door.ends.latch] {
            XCTAssertLessThan(VisibilitySweep.distance(from: end, to: LineOfSight.strokeWalls(of: map)[0]), 1e-9)
        }
        XCTAssertEqual(hypot(door.ends.latch.x - door.ends.hinge.x, door.ends.latch.y - door.ends.hinge.y), 50, accuracy: 1e-9)

        // Hit-testing follows the door, not its bounding box.
        XCTAssertEqual(map.door(at: Point2D(x: door.x + 5, y: door.y + 10))?.id, door.id)
        XCTAssertNil(map.door(at: Point2D(x: door.x + 10, y: door.y - 10)))
    }

    func testAClickOnAGridWallTakesTheWallsOrientation() {
        var map = GameMap(gridSize: 50)
        map.drawings = [wall([0, 100, 500, 100])]
        let door = map.placeDoor(at: Point2D(x: 162, y: 104), orientation: .vertical)
        XCTAssertEqual(Point2D(x: door.x, y: door.y), Point2D(x: 150, y: 100))
        XCTAssertEqual(door.orientation, .horizontal)
        XCTAssertNil(door.angle)
    }

    func testAClickNearTheEndOfAWallKeepsTheDoorOnIt() {
        var map = GameMap(gridSize: 50)
        map.drawings = [wall([0, 0, 300, 100])]
        let door = map.placeDoor(at: Point2D(x: 2, y: 1), orientation: .horizontal)
        XCTAssertGreaterThanOrEqual(min(door.ends.hinge.x, door.ends.latch.x), -1e-9)
    }

    func testAnOpenDoorCutsTheWallUnderIt() {
        // One stroke for the whole wall, and a door dropped on it.
        var map = GameMap(gridSize: 50)
        map.tokens = [pc]
        map.drawings = [wall([200, -1000, 200, 1000])]
        map.doors = [Door(id: "d", x: 200, y: 50, orientation: .vertical, size: 50)]
        let through = Point2D(x: 400, y: 50)
        let past = Point2D(x: 400, y: 300)
        XCTAssertFalse(sees(through, in: map))
        XCTAssertTrue(LineOfSight.wallGaps(of: map).isEmpty)

        map.toggleDoor(id: "d")
        XCTAssertTrue(sees(through, in: map), "the open door is a gap in the wall")
        XCTAssertFalse(sees(past, in: map), "the rest of the wall still blocks")
        XCTAssertEqual(LineOfSight.wallGaps(of: map).map(\.id), ["d"])
    }

    func testAnOpenDiagonalDoorCutsADiagonalWall() {
        var map = GameMap(gridSize: 50)
        map.tokens = [pc]
        map.drawings = [wall([150, -250, 450, 350])]
        let door = map.placeDoor(at: Point2D(x: 300, y: 50), orientation: .horizontal)
        let through = Point2D(x: 500, y: 50)
        XCTAssertFalse(sees(through, in: map))
        map.toggleDoor(id: door.id)
        XCTAssertTrue(sees(through, in: map))
        XCTAssertFalse(sees(Point2D(x: 500, y: 300), in: map))
    }

    func testDoorsInADoorwayOrOffTheWallCutNothing() {
        // Dungeon-generator style: the wall already stops at the door, and a door across the wall.
        var map = GameMap(gridSize: 50)
        map.drawings = [wall([0, 0, 100, 0], id: "a"), wall([150, 0, 300, 0], id: "b")]
        map.doors = [
            Door(id: "gap", x: 125, y: 0, orientation: .horizontal, isOpen: true, size: 50),
            Door(id: "across", x: 50, y: 0, orientation: .vertical, isOpen: true, size: 50),
        ]
        XCTAssertEqual(LineOfSight.walls(of: map), LineOfSight.strokeWalls(of: map))
        XCTAssertTrue(LineOfSight.wallGaps(of: map).isEmpty)
    }

    func testCutPiecesStayOneWay() {
        let segment = WallSegment(start: Point2D(x: 0, y: 0), end: Point2D(x: 300, y: 0), oneWay: true)
        let door = Door(x: 150, y: 1, orientation: .horizontal, isOpen: true, size: 50)
        let pieces = LineOfSight.cut(segment, under: door, tolerance: 5)
        XCTAssertEqual(pieces.count, 2)
        XCTAssertEqual(pieces[0].end.x, 125, accuracy: 1e-9)
        XCTAssertEqual(pieces[1].start.x, 175, accuracy: 1e-9)
        XCTAssertTrue(pieces.allSatisfy(\.oneWay))
    }
}
