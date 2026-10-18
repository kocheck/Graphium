import XCTest

@testable import GraphiumCore

/// Turning placed doors, and walls joining door ends so no light slips past (PARITY §3.6).
final class DoorEditingTests: XCTestCase {
    private func wall(_ points: [Double], id: String = "w") -> Drawing {
        Drawing(id: id, tool: .wall, points: points, color: "#f00", size: 8)
    }

    func testRotatingWrapsAndKeepsTheAxisField() {
        var map = GameMap(gridSize: 50)
        map.doors = [Door(id: "d", x: 100, y: 100, orientation: .horizontal, size: 50)]
        map.rotateDoors(["d"], by: 45)
        XCTAssertEqual(map.doors[0].angle ?? .nan, 45, accuracy: 1e-9)
        XCTAssertEqual(map.doors[0].orientation, .horizontal)
        map.rotateDoors(["d"], by: 45)
        XCTAssertNil(map.doors[0].angle, "90° is the plain vertical door the web app knows")
        XCTAssertEqual(map.doors[0].orientation, .vertical)
        map.rotateDoors(["d"], by: 45)
        XCTAssertEqual(map.doors[0].angle ?? .nan, -45, accuracy: 1e-9, "kept in (−90, 90]")
        map.rotateDoors(["d"], by: -15)
        XCTAssertEqual(map.doors[0].angle ?? .nan, -60, accuracy: 1e-9)
        XCTAssertEqual(map.doors[0].orientation, .vertical)
        XCTAssertEqual(Point2D(x: map.doors[0].x, y: map.doors[0].y), Point2D(x: 100, y: 100), "turns about its centre")
    }

    func testRotatingOnlyTurnsTheGivenDoors() {
        var map = GameMap(gridSize: 50)
        map.doors = [
            Door(id: "a", x: 0, y: 0, orientation: .horizontal, size: 50),
            Door(id: "b", x: 200, y: 0, orientation: .horizontal, size: 50),
        ]
        map.rotateDoors(["b"], by: 90)
        XCTAssertEqual(map.doors.map(\.orientation), [.horizontal, .vertical])
    }

    func testWallsThatMetTheDoorFollowItsEnds() {
        // A doorway: walls stop at the door's ends, (75, 100) and (125, 100).
        var map = GameMap(gridSize: 50)
        map.drawings = [wall([0, 100, 75, 100], id: "left"), wall([125, 100, 300, 100], id: "right")]
        map.doors = [Door(id: "d", x: 100, y: 100, orientation: .horizontal, size: 50)]
        map.rotateDoors(["d"], by: 30)
        let door = map.doors[0]
        let ends = [door.ends.hinge, door.ends.latch]
        let left = map.drawings[0].worldPoints.last!
        let right = map.drawings[1].worldPoints.first!
        for p in [left, right] {
            XCTAssertTrue(ends.contains { hypot($0.x - p.x, $0.y - p.y) < 1e-9 }, "\(p) is on a door end")
        }
        XCTAssertEqual(map.drawings[0].points.count, 4, "moved, not stubbed")
        XCTAssertEqual(map.drawings[0].worldPoints.first, Point2D(x: 0, y: 100), "the far end stays")
    }

    func testPlacingADoorReachesNearbyWallEnds() {
        var map = GameMap(gridSize: 50)
        // Walls stopping a little short of where the door goes (75…125 on y = 100).
        map.drawings = [wall([0, 100, 71, 100], id: "close"), wall([135, 100, 300, 100], id: "short")]
        let door = map.placeDoor(at: Point2D(x: 100, y: 100), orientation: .horizontal)
        XCTAssertEqual(door.x, 100)
        XCTAssertEqual(map.drawings[0].worldPoints, [Point2D(x: 0, y: 100), Point2D(x: 75, y: 100)], "a small gap closes")
        XCTAssertEqual(
            map.drawings[1].worldPoints, [Point2D(x: 125, y: 100), Point2D(x: 135, y: 100), Point2D(x: 300, y: 100)],
            "a wider one gains a stub, so the wall keeps its shape")
        XCTAssertFalse(LineOfSight.walls(of: map).isEmpty)
    }

    func testFarWallsAreLeftAlone() {
        var map = GameMap(gridSize: 50)
        map.drawings = [wall([0, 100, 50, 100])]
        _ = map.placeDoor(at: Point2D(x: 100, y: 100), orientation: .horizontal)
        XCTAssertEqual(map.drawings[0].worldPoints, [Point2D(x: 0, y: 100), Point2D(x: 50, y: 100)])
    }

    func testANewWallJoinsADoor() {
        var map = GameMap(gridSize: 50)
        map.doors = [Door(id: "d", x: 100, y: 100, orientation: .vertical, size: 50)]  // ends (100, 75), (100, 125)
        map.drawings = [wall([100, 0, 100, 72], id: "n")]
        map.joinWallToDoors(id: "n")
        XCTAssertEqual(map.drawings[0].worldPoints.last, Point2D(x: 100, y: 75))
    }

    func testMovedWallsJoinInWorldSpace() {
        var map = GameMap(gridSize: 50)
        var moved = wall([0, 0, 68, 0], id: "m")
        moved.x = 5
        moved.y = 100
        map.drawings = [moved]
        _ = map.placeDoor(at: Point2D(x: 100, y: 100), orientation: .horizontal)
        XCTAssertEqual(map.drawings[0].worldPoints.last, Point2D(x: 75, y: 100))
    }

    func testHatchWallsLeaveDoorwaysOpen() {
        var map = GameMap(gridSize: 50)
        map.drawings = [wall([0, 0, 300, 0])]
        map.doors = [Door(id: "d", x: 150, y: 0, orientation: .horizontal, size: 50)]
        let pieces = LineOfSight.hatchWalls(of: map)
        XCTAssertEqual(pieces.count, 2, "cut under a closed door too")
        XCTAssertEqual(pieces[0].end.x, 125, accuracy: 1e-9)
        XCTAssertEqual(pieces[1].start.x, 175, accuracy: 1e-9)
        map.drawings[0].wallKind = .window
        XCTAssertTrue(LineOfSight.hatchWalls(of: map).isEmpty, "windows aren't rock")
    }

    func testFlamesFlickerGentlyAndMagicIsSteady() {
        XCTAssertTrue(LightPreset.torch.light(at: .zero).isFlame)
        XCTAssertTrue(LightPreset.candle.light(at: .zero).isFlame)
        XCTAssertTrue(LightSource(x: 0, y: 0, bright: 10, dim: 20).isFlame)
        XCTAssertFalse(LightPreset.lightCantrip.light(at: .zero).isFlame)
        XCTAssertFalse(LightPreset.daylight.light(at: .zero).isFlame)

        var radii: [Double] = []
        var glows: [Double] = []
        for i in 0..<600 {
            let s = TorchFlicker.sample(seed: "torch", time: Double(i) / 60)
            radii.append(s.radius)
            glows.append(s.glow)
        }
        XCTAssertGreaterThanOrEqual(radii.min()!, 0.93 - 1e-9, "never shrinks much")
        XCTAssertLessThanOrEqual(radii.max()!, 1 + 1e-9, "never reaches past its walls")
        XCTAssertGreaterThan(radii.max()! - radii.min()!, 0.02, "but it moves")
        XCTAssertGreaterThanOrEqual(glows.min()!, 0.8 - 1e-9)
        XCTAssertLessThanOrEqual(glows.max()!, 1.1 + 1e-9)
        XCTAssertEqual(
            TorchFlicker.sample(seed: "a", time: 3), TorchFlicker.sample(seed: "a", time: 3), "the same light, the same flame")
        XCTAssertNotEqual(TorchFlicker.sample(seed: "a", time: 3), TorchFlicker.sample(seed: "b", time: 3))
    }
}
