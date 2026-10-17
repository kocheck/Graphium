import XCTest

@testable import GraphiumCore

final class MapEditingTests: XCTestCase {
    func testCalibrationScalesBoxToOneCellAndAlignsIt() {
        var map = GameMap(gridSize: 50)
        map.background = MapBackground(src: "m", x: 0, y: 0, width: 1000, height: 1000, scale: 1)
        // The image's cells are 100 px; the DM boxes one at (130, 230).
        XCTAssertTrue(map.calibrate(to: Bounds(x: 130, y: 230, width: 100, height: 100)))
        let bg = map.background!
        XCTAssertEqual(bg.scale, 0.5)
        // The box's corner lands on a grid intersection after the transform.
        let cornerX = bg.x + 130 * bg.scale
        let cornerY = bg.y + 230 * bg.scale
        XCTAssertEqual(cornerX.truncatingRemainder(dividingBy: 50), 0, accuracy: 1e-9)
        XCTAssertEqual(cornerY.truncatingRemainder(dividingBy: 50), 0, accuracy: 1e-9)
    }

    func testTinyBoxesAndMissingMapAreIgnored() {
        var map = GameMap()
        XCTAssertFalse(map.calibrate(to: Bounds(x: 0, y: 0, width: 50, height: 50)), "no map image")
        map.background = MapBackground(src: "m", width: 10, height: 10)
        XCTAssertFalse(map.calibrate(to: Bounds(x: 0, y: 0, width: 5, height: 40)))
    }

    func testApplySettingsKeepsEditsMadeWhileTheSheetWasOpen() {
        var live = GameMap(name: "Cave", tokens: [Token(id: "pc", x: 0, y: 0, src: "a")])
        var edited = live  // the sheet's snapshot
        edited.name = "Deep Cave"
        edited.gridType = .hidden
        edited.gridColor = "#ff0000"
        edited.isDaylightMode = true
        edited.background = MapBackground(src: "m", width: 10, height: 10)
        // Meanwhile a player moves the PC and explores.
        live.tokens[0].x = 100
        live.exploredRegions = [ExploredRegion(points: [Point2D(x: 0, y: 0)], timestamp: 1)]

        live.applySettings(from: edited)
        XCTAssertEqual(live.name, "Deep Cave")
        XCTAssertEqual(live.gridType, .hidden)
        XCTAssertEqual(live.gridColor, "#ff0000")
        XCTAssertTrue(live.isDaylightMode)
        XCTAssertEqual(live.background?.src, "m")
        XCTAssertEqual(live.tokens[0].x, 100)
        XCTAssertEqual(live.exploredRegions.count, 1)
    }

    func testStrokeHitTestingIncludesWalls() {
        var map = GameMap()
        map.drawings = [
            Drawing(id: "m", tool: .marker, points: [0, 0, 100, 0], color: "#000", size: 6),
            Drawing(id: "w", tool: .wall, points: [0, 50, 100, 50], color: "#f00", size: 8),
        ]
        XCTAssertEqual(map.drawing(at: Point2D(x: 50, y: 5))?.id, "m")
        XCTAssertEqual(map.drawing(at: Point2D(x: 50, y: 50))?.id, "w", "walls are selectable (native change)")
        XCTAssertNil(map.drawing(at: Point2D(x: 50, y: 20)))
        XCTAssertEqual(map.drawingIDs(intersecting: Bounds(x: -10, y: -10, width: 200, height: 200)), ["m", "w"])
    }

    func testMoveAndDuplicateStrokes() {
        var map = GameMap()
        map.drawings = [Drawing(id: "m", tool: .marker, points: [0, 0, 10, 0], color: "#000", size: 5)]
        map.moveDrawings(["m"], dx: 20, dy: 5, duplicate: false)
        XCTAssertEqual(map.drawings[0].worldPoints.first, Point2D(x: 20, y: 5))
        let copies = map.moveDrawings(["m"], dx: 10, dy: 0, duplicate: true)
        XCTAssertEqual(map.drawings.count, 2)
        XCTAssertNotEqual(copies, ["m"])
        XCTAssertEqual(map.drawings[1].worldPoints.first, Point2D(x: 30, y: 5))
    }

    func testRemoveItemsAcrossKinds() {
        var map = GameMap()
        map.tokens = [Token(id: "t", x: 0, y: 0, src: "")]
        map.drawings = [Drawing(id: "d", tool: .marker, points: [0, 0], color: "#000", size: 5)]
        map.doors = [Door(id: "o", x: 0, y: 0, orientation: .vertical, size: 50)]
        XCTAssertEqual(map.doorIDs(intersecting: Bounds(x: -5, y: -5, width: 10, height: 10)), ["o"])
        map.removeItems(["t", "d", "o"])
        XCTAssertTrue(map.tokens.isEmpty && map.drawings.isEmpty && map.doors.isEmpty)
    }

    func testViewportClampKeepsCentreNearTheMap() {
        var map = GameMap()
        map.background = MapBackground(src: "m", x: 0, y: 0, width: 2000, height: 1000)
        let far = Viewport(origin: Point2D(x: 50_000, y: -40_000), zoom: 1)
        let clamped = far.clamped(map: map, library: [:], viewWidth: 800, viewHeight: 600)
        XCTAssertEqual(clamped.origin.x + 400, 3000, "right edge + 1000 padding")
        XCTAssertEqual(clamped.origin.y + 300, -1000, "top edge − 1000 padding")
        let inside = Viewport(origin: Point2D(x: 100, y: 100), zoom: 1)
        XCTAssertEqual(inside.clamped(map: map, library: [:], viewWidth: 800, viewHeight: 600), inside)
    }

    func testZoomOutFarFromTheMapIsClamped() {
        var map = GameMap()
        map.background = MapBackground(src: "m", x: 0, y: 0, width: 2000, height: 1000)
        let start = Viewport(origin: Point2D(x: 2500, y: 0), zoom: 1)
        let anchor = Point2D(x: 0, y: 300)
        var unclamped = start
        unclamped.zoom(by: 0.5, around: anchor)
        XCTAssertEqual(unclamped.origin.x + 400 / 0.5, 3300, "plain zoom leaves the centre past the padding")

        let zoomed = start.zoomed(by: 0.5, around: anchor, clampingTo: map, library: [:], viewWidth: 800, viewHeight: 600)
        XCTAssertEqual(zoomed.zoom, 0.5)
        XCTAssertEqual(zoomed.origin.x + 400 / 0.5, 3000, "right edge + 1000 padding")
        XCTAssertEqual(zoomed.origin.y, unclamped.origin.y, "the in-range axis is untouched")

        let inside = Viewport(origin: Point2D(x: 100, y: 100), zoom: 1)
        var plain = inside
        plain.zoom(by: 1.1, around: Point2D(x: 400, y: 300))
        let near = inside.zoomed(
            by: 1.1, around: Point2D(x: 400, y: 300), clampingTo: map, library: [:], viewWidth: 800, viewHeight: 600)
        XCTAssertEqual(near.zoom, plain.zoom)
        XCTAssertEqual(near.origin.x, plain.origin.x, accuracy: 1e-9, "inside the area the zoom is not moved")
        XCTAssertEqual(near.origin.y, plain.origin.y, accuracy: 1e-9)
    }
}
