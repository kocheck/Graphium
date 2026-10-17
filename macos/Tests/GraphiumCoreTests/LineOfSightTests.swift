import XCTest

@testable import GraphiumCore

/// Mirrors fogVisibility.test.ts, geometry.test.ts and DoorBlocking.test.ts (CORE_SPEC §3.3).
final class LineOfSightTests: XCTestCase {
    let square = [Point2D(x: 0, y: 0), Point2D(x: 10, y: 0), Point2D(x: 10, y: 10), Point2D(x: 0, y: 10)]

    func testPointInPolygon() {
        XCTAssertFalse(LineOfSight.contains([], Point2D(x: 1, y: 1)))
        XCTAssertFalse(LineOfSight.contains([Point2D(x: 0, y: 0), Point2D(x: 5, y: 5)], Point2D(x: 1, y: 1)))
        XCTAssertTrue(LineOfSight.contains(square, Point2D(x: 5, y: 5)))
        XCTAssertFalse(LineOfSight.contains(square, Point2D(x: 15, y: 5)))
        let triangle = [Point2D(x: 0, y: 0), Point2D(x: 10, y: 0), Point2D(x: 5, y: 10)]
        XCTAssertTrue(LineOfSight.contains(triangle, Point2D(x: 5, y: 3)))
        XCTAssertFalse(LineOfSight.contains(triangle, Point2D(x: 1, y: 9)))
    }

    func testRectInAnyPolygonChecksCentreThenCorners() {
        XCTAssertFalse(LineOfSight.rectIntersectsAny(Bounds(x: 0, y: 0, width: 1, height: 1), []))
        XCTAssertTrue(LineOfSight.rectIntersectsAny(Bounds(x: 4, y: 4, width: 2, height: 2), [square]))
        XCTAssertTrue(LineOfSight.rectIntersectsAny(Bounds(x: 8, y: 8, width: 10, height: 10), [square]), "corner inside")
        XCTAssertFalse(LineOfSight.rectIntersectsAny(Bounds(x: 20, y: 20, width: 5, height: 5), [square]))
    }

    func testClosedDoorsBlockAndOpenDoorsDoNot() {
        var map = GameMap(gridSize: 50)
        map.doors = [
            Door(id: "h", x: 50, y: 0, orientation: .horizontal, size: 50),
            Door(id: "v", x: 0, y: 50, orientation: .vertical, isOpen: false, isLocked: true, size: 50),
            Door(id: "open", x: 500, y: 500, orientation: .vertical, isOpen: true, size: 50),
        ]
        XCTAssertEqual(
            LineOfSight.walls(of: map),
            [
                WallSegment(start: Point2D(x: 25, y: 0), end: Point2D(x: 75, y: 0)),
                WallSegment(start: Point2D(x: 0, y: 25), end: Point2D(x: 0, y: 75)),
            ])
    }

    func testRayStopsAtClosedDoorButPassesWhenOpened() {
        var map = GameMap(gridSize: 50)
        map.doors = [Door(x: 100, y: 0, orientation: .vertical, size: 100)]
        let origin = Point2D(x: 0, y: 0)
        let blocked = LineOfSight.castRay(from: origin, angle: 0, radius: 300, walls: LineOfSight.walls(of: map))
        XCTAssertEqual(blocked.x, 100, accuracy: 1e-9)
        map.doors[0].isOpen = true
        let clear = LineOfSight.castRay(from: origin, angle: 0, radius: 300, walls: LineOfSight.walls(of: map))
        XCTAssertEqual(clear.x, 300, accuracy: 1e-9)
    }

    func testWallDrawingsUseWorldTransform() {
        var map = GameMap()
        map.drawings = [Drawing(tool: .wall, points: [0, 0, 10, 0, 10, 10], color: "#f00", size: 8, scale: 2, x: 5, y: 5)]
        map.drawings.append(Drawing(tool: .marker, points: [0, 0, 1, 1], color: "#000", size: 5))
        XCTAssertEqual(
            LineOfSight.walls(of: map),
            [
                WallSegment(start: Point2D(x: 5, y: 5), end: Point2D(x: 25, y: 5)),
                WallSegment(start: Point2D(x: 25, y: 5), end: Point2D(x: 25, y: 25)),
            ], "markers never block")
    }

    func testRayCountScalesWithOnScreenRadius() {
        XCTAssertEqual(LineOfSight.rayCount(radius: 150), 90)
        XCTAssertEqual(LineOfSight.rayCount(radius: 300), 180)
        XCTAssertEqual(LineOfSight.rayCount(radius: 300, zoom: 3), 360)
    }

    func testOnlyPCsWithVisionAreViewers() {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "pc", x: 0, y: 0, src: "", type: .pc, visionRadius: 30),
            Token(id: "blind", x: 0, y: 0, src: "", type: .pc),
            Token(id: "npc", x: 0, y: 0, src: "", type: .npc, visionRadius: 60),
        ]
        let viewers = LineOfSight.viewers(of: map, library: [:])
        XCTAssertEqual(viewers.map(\.tokenID), ["pc"])
        XCTAssertEqual(viewers[0].centre, Point2D(x: 25, y: 25))
        XCTAssertEqual(viewers[0].radius, 300, "30 ft = 6 cells of 50 px")
    }

    func testHidesNPCsOutsideVisionButNeverUntypedTokens() {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "pc", x: 0, y: 0, src: "", type: .pc, visionRadius: 30),
            Token(id: "near", x: 100, y: 0, src: "", type: .npc),
            Token(id: "far", x: 2000, y: 0, src: "", type: .npc),
            Token(id: "untyped", x: 3000, y: 0, src: ""),
        ]
        let polygons = LineOfSight.polygons(of: map, library: [:]).map(\.polygon)
        XCTAssertEqual(LineOfSight.hiddenNPCIDs(of: map, library: [:], polygons: polygons), ["far"])
    }

    func testFogBoundsUseMapOrFixedArea() {
        var map = GameMap()
        XCTAssertEqual(LineOfSight.fogBounds(of: map), LineOfSight.noMapFogBounds)
        map.background = MapBackground(src: "m", x: 10, y: 20, width: 100, height: 50, scale: 2)
        XCTAssertEqual(LineOfSight.fogBounds(of: map), Bounds(x: 10, y: 20, width: 200, height: 100))
    }

    func testExplorationRecordsOnlyViewersThatMoved() {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "a", x: 0, y: 0, src: "", type: .pc, visionRadius: 30),
            Token(id: "b", x: 500, y: 0, src: "", type: .pc, visionRadius: 30),
        ]
        let before = map
        map.tokens[0].x = 100
        map.recordExploration(since: before, library: [:], timestamp: 42)
        XCTAssertEqual(map.exploredRegions.count, 1)
        XCTAssertEqual(map.exploredRegions[0].timestamp, 42)
        XCTAssertEqual(map.exploredRegions[0].points.count, 180, "300 px radius → 180 rays")

        var daylight = before
        daylight.isDaylightMode = true
        let start = daylight
        daylight.tokens[0].x = 100
        daylight.recordExploration(since: start, library: [:], timestamp: 0)
        XCTAssertTrue(daylight.exploredRegions.isEmpty, "no fog in daylight")
    }

    /// A PC standing west of a closed door in a wall at x = 200 (the door spans y 0…100).
    private func doorwayMap() -> GameMap {
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "pc", x: 0, y: 25, src: "", type: .pc, visionRadius: 60)]
        map.drawings = [
            Drawing(tool: .wall, points: [200, -1000, 200, 0], color: "#f00", size: 8),
            Drawing(tool: .wall, points: [200, 100, 200, 1000], color: "#f00", size: 8),
        ]
        map.doors = [Door(id: "door", x: 200, y: 50, orientation: .vertical, size: 100)]
        return map
    }

    func testOpeningThenClosingADoorKeepsTheGlimpseExplored() {
        var map = doorwayMap()
        let beyond = Point2D(x: 400, y: 50)
        let closed = map
        map.doors[0].isOpen = true
        XCTAssertEqual(map.recordExploration(since: closed, library: [:], timestamp: 1), 1, "the standing PC is stamped")
        let opened = map
        map.doors[0].isOpen = false
        map.recordExploration(since: opened, library: [:], timestamp: 2)
        XCTAssertEqual(map.exploredRegions.count, 2)
        XCTAssertTrue(
            LineOfSight.containsInAny(map.exploredRegions.map(\.points), beyond), "the room seen through the door stays explored")
        XCTAssertFalse(LineOfSight.contains(map.exploredRegions[1].points, beyond), "but the PC can no longer see it")
    }

    func testUnrelatedEditDoesNotRaycast() {
        var map = doorwayMap()
        let before = map
        map.gridColor = "#ff0000"
        map.exploredRegions = [ExploredRegion(points: [Point2D(x: 1, y: 1)], timestamp: 1)]
        XCTAssertEqual(map.recordExploration(since: before, library: [:], timestamp: 3), 0)
        XCTAssertEqual(map.exploredRegions.count, 1)

        // A marker stroke changes drawings but not walls: only moved viewers (none) are cast.
        let unmoved = map
        map.drawings.append(Drawing(tool: .marker, points: [0, 0, 5, 5], color: "#000", size: 5))
        XCTAssertEqual(map.recordExploration(since: unmoved, library: [:], timestamp: 4), 0)
    }

    func testOnlyMovedViewersAreRaycast() {
        var map = doorwayMap()
        map.tokens.append(Token(id: "other", x: 0, y: 500, src: "", type: .pc, visionRadius: 30))
        let before = map
        map.tokens[1].x = 50
        XCTAssertEqual(map.recordExploration(since: before, library: [:], timestamp: 5), 1)
    }

    func testLibraryVisionChangeStampsAffectedViewers() {
        let item = TokenLibraryItem(
            id: "hero", name: "Hero", src: "", thumbnailSrc: "", category: "PC", dateAdded: 0, defaultVisionRadius: 30)
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "pc", x: 0, y: 0, src: "", libraryItemId: "hero")]
        let before = map
        var wider = item
        wider.defaultVisionRadius = 60
        XCTAssertEqual(
            map.recordExploration(
                since: before, library: ["hero": wider], previousLibrary: ["hero": item], timestamp: 6), 1)
        XCTAssertEqual(map.recordExploration(since: map, library: ["hero": wider], timestamp: 7), 0)
    }
}
