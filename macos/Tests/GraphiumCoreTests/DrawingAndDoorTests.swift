import XCTest

@testable import GraphiumCore

/// Mirrors pathOptimization.test.ts, gameStore door operations and DoorInteraction tests.
final class DrawingAndDoorTests: XCTestCase {
    /// uiStore `setColor` (PARITY §2.2).
    func testRecentMarkerColours() {
        XCTAssertEqual(StrokeDefaults.recentMarkerColors, ["#df4b26", "#3b82f6", "#22c55e"])
        let seeded = StrokeDefaults.recentMarkerColors
        XCTAssertEqual(StrokeDefaults.recentColors(picking: "#ff0000", after: seeded), ["#ff0000", "#df4b26", "#3b82f6"])
        XCTAssertEqual(StrokeDefaults.recentColors(picking: "#3b82f6", after: seeded), ["#3b82f6", "#df4b26", "#22c55e"],
            "re-picking moves it to the front")
        XCTAssertEqual(StrokeDefaults.recentColors(picking: "#DF4B26", after: seeded), ["#DF4B26", "#3b82f6", "#22c55e"],
            "dedupe ignores case")
        XCTAssertEqual(StrokeDefaults.recentColors(picking: "#000000", after: []), ["#000000"])
    }

    func testSimplifyEdgeCases() {
        XCTAssertEqual(PathOptimization.simplify([], epsilon: 3), [])
        XCTAssertEqual(PathOptimization.simplify([1, 2], epsilon: 3), [1, 2])
        XCTAssertEqual(PathOptimization.simplify([0, 0, 10, 10], epsilon: 3), [0, 0, 10, 10])
    }

    func testCollinearPointsCollapseToEndpoints() {
        XCTAssertEqual(PathOptimization.simplify([0, 0, 5, 0, 10, 0, 15, 0], epsilon: 1), [0, 0, 15, 0])
        XCTAssertEqual(PathOptimization.simplify([0, 0, 1, 1, 2, 2, 3, 3], epsilon: 1), [0, 0, 3, 3])
    }

    func testCornersSurviveJitterDoesNot() {
        // L-shaped wall with 1px jitter on the first leg.
        let path: [Double] = [0, 0, 25, 1, 50, 0, 50, 25, 50, 50]
        XCTAssertEqual(PathOptimization.simplify(path, epsilon: 3), [0, 0, 50, 0, 50, 50])
        // A deviation beyond epsilon is kept.
        XCTAssertEqual(PathOptimization.simplify([0, 0, 5, 10, 10, 0], epsilon: 3), [0, 0, 5, 10, 10, 0])
    }

    func testSnapPrefersVerticesThenSegments() {
        let wall: [Double] = [0, 0, 100, 0]
        let vertex = PathOptimization.snap(Point2D(x: 97, y: 4), to: [wall], threshold: 10)
        XCTAssertEqual(vertex, .init(point: Point2D(x: 100, y: 0), snapped: true, pathIndex: 0))
        let segment = PathOptimization.snap(Point2D(x: 50, y: 6), to: [wall], threshold: 10)
        XCTAssertEqual(segment.point, Point2D(x: 50, y: 0))
        let none = PathOptimization.snap(Point2D(x: 50, y: 40), to: [wall], threshold: 10)
        XCTAssertFalse(none.snapped)
        XCTAssertEqual(none.pathIndex, -1)
        XCTAssertFalse(PathOptimization.snap(Point2D(x: 1, y: 1), to: [[0, 0]], threshold: 10).snapped)
    }

    func testFinalizeWallSmoothsThenSnapsEndsOnly() {
        let existing: [[Double]] = [[0, 0, 0, 100]]
        let stroke: [Double] = [4, 50, 30, 51, 60, 50]
        XCTAssertEqual(PathOptimization.finalizeWall(stroke, existingWalls: existing), [0, 50, 60, 50])
    }

    func testPressureCurves() {
        XCTAssertEqual(PressureCurve.normal.width(base: 10, pressure: 0), 3, accuracy: 1e-9)
        XCTAssertEqual(PressureCurve.normal.width(base: 10, pressure: 1), 15, accuracy: 1e-9)
        XCTAssertEqual(PressureCurve.light.width(base: 10, pressure: 0.5), 11, accuracy: 1e-9)
        XCTAssertEqual(PressureCurve.heavy.width(base: 10, pressure: 2), 12, accuracy: 1e-9, "clamped")
    }

    func testDoorPlacementSnapsToIntersectionAndIsOneCell() {
        var map = GameMap(gridSize: 50)
        let door = map.placeDoor(at: Point2D(x: 62, y: 96), orientation: .vertical)
        XCTAssertEqual(Point2D(x: door.x, y: door.y), Point2D(x: 50, y: 100))
        XCTAssertEqual(door.size, 50)
        XCTAssertFalse(door.isOpen)
        XCTAssertFalse(door.isLocked)
        XCTAssertEqual(map.door(at: Point2D(x: 54, y: 120))?.id, door.id)
        XCTAssertNil(map.door(at: Point2D(x: 70, y: 120)))
    }

    func testLockedDoorsDoNotToggleAndBulkOpsRespectLocks() {
        var map = GameMap()
        map.doors = [
            Door(id: "a", x: 0, y: 0, orientation: .horizontal, size: 50),
            Door(id: "b", x: 0, y: 100, orientation: .horizontal, isLocked: true, size: 50),
        ]
        map.toggleDoor(id: "b")
        XCTAssertFalse(map.doors[1].isOpen)
        map.toggleDoor(id: "a")
        XCTAssertTrue(map.doors[0].isOpen)
        map.setAllUnlockedDoors(open: false)
        XCTAssertFalse(map.doors[0].isOpen)
        map.doors[1].isOpen = true
        map.setAllDoorLocks(locked: false)
        XCTAssertTrue(map.doors[1].isOpen, "lock changes keep open state")
        XCTAssertFalse(map.doors[1].isLocked)
    }

    func testMeasurementLabels() {
        let origin = Point2D.zero
        XCTAssertEqual(MeasurementShape(mode: .ruler, origin: origin, pointer: Point2D(x: 300, y: 0)).label(gridSize: 50), "30ft (6 cells)")
        XCTAssertEqual(MeasurementShape(mode: .blast, origin: origin, pointer: Point2D(x: 0, y: 200)).label(gridSize: 50), "20ft radius (4 cells)")
        XCTAssertEqual(MeasurementShape(mode: .cone, origin: origin, pointer: Point2D(x: 300, y: 0)).label(gridSize: 50), "30ft 53° cone (6 cells)")
    }
}
