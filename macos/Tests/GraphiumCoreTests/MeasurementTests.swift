import XCTest

@testable import GraphiumCore

/// Mirrors archive/web/src/utils/measurement.test.ts and MovementRangeOverlay behaviour (CORE_SPEC §3.2, §3.4).
final class MeasurementTests: XCTestCase {
    func testEuclideanDistance() {
        XCTAssertEqual(Measure.euclideanDistance(Point2D(x: 0, y: 0), Point2D(x: 3, y: 4)), 5)
        XCTAssertEqual(Measure.euclideanDistance(Point2D(x: -1, y: -1), Point2D(x: -1, y: -1)), 0)
    }

    func testDnd5eDiagonalsAlternateFiveAndTen() {
        let o = Point2D(x: 0, y: 0)
        XCTAssertEqual(Measure.dnd5eDistance(o, Point2D(x: 150, y: 0), gridSize: 50), 3, "straight")
        XCTAssertEqual(Measure.dnd5eDistance(o, Point2D(x: 50, y: 50), gridSize: 50), 1, "one diagonal")
        XCTAssertEqual(Measure.dnd5eDistance(o, Point2D(x: 100, y: 100), gridSize: 50), 3, "two diagonals")
        XCTAssertEqual(Measure.dnd5eDistance(o, Point2D(x: 150, y: 150), gridSize: 50), 4, "three diagonals")
        XCTAssertEqual(Measure.dnd5eDistance(o, Point2D(x: 200, y: 200), gridSize: 50), 6, "four diagonals")
        XCTAssertEqual(Measure.dnd5eDistance(o, Point2D(x: -100, y: 150), gridSize: 50), 4, "mixed, negative")
    }

    func testPixelsToFeetRoundsLikeJavaScript() {
        XCTAssertEqual(Measure.pixelsToFeet(50, gridSize: 50), 5)
        XCTAssertEqual(Measure.pixelsToFeet(75, gridSize: 50), 8)  // 7.5 → 8
        XCTAssertEqual(
            Measure.pixelsToFeet(0, gridSize: 50, mode: .dnd5e, from: .zero, to: Point2D(x: 100, y: 100)), 15)
        XCTAssertEqual(Measure.pixelsToFeet(100, gridSize: 50, mode: .dnd5e), 10, "falls back without points")
    }

    func testAngles() {
        let o = Point2D.zero
        XCTAssertEqual(Measure.angle(from: o, to: Point2D(x: 0, y: -1)), -.pi / 2, accuracy: 1e-12)
        XCTAssertEqual(Measure.angleDegrees(from: o, to: Point2D(x: 0, y: -1)), 270, accuracy: 1e-9)
        XCTAssertEqual(Measure.angleDegrees(from: o, to: Point2D(x: -1, y: 0)), 180, accuracy: 1e-9)
        XCTAssertEqual(Measure.angleDegrees(from: o, to: Point2D(x: 1, y: 1)), 45, accuracy: 1e-9)
    }

    func testConeVertices() {
        let v = Measure.coneVertices(origin: .zero, target: Point2D(x: 100, y: 0))
        XCTAssertEqual(v.count, 3)
        XCTAssertEqual(v[0], .zero)
        let half = 26.5 * .pi / 180
        XCTAssertEqual(v[1].x, 100 * cos(half), accuracy: 1e-9)
        XCTAssertEqual(v[1].y, 100 * sin(half), accuracy: 1e-9)
        XCTAssertEqual(v[2].y, -100 * sin(half), accuracy: 1e-9)
    }

    func testFormatting() {
        XCTAssertEqual(Measure.formatDistance(30), "30ft (6 cells)")
        XCTAssertEqual(Measure.formatDistance(5), "5ft (1 cell)")
        XCTAssertEqual(Measure.formatDistance(0), "0ft (0 cells)")
        XCTAssertEqual(Measure.formatDistance(30, showCells: false), "30ft")
        XCTAssertEqual(Measure.formatRadius(20), "20ft radius (4 cells)")
        XCTAssertEqual(Measure.formatCone(15), "15ft 53° cone (3 cells)")
        XCTAssertEqual(Measure.formatCone(15, angle: 90, showCells: false), "15ft 90° cone")
        XCTAssertEqual(Measure.formatRadius(5), "5ft radius (1 cell)", "singular, as in TS")
        XCTAssertEqual(Measure.formatCone(5), "5ft 53° cone (1 cell)", "singular, as in TS")
        XCTAssertEqual(Measure.formatRadius(0), "0ft radius (0 cells)")
        XCTAssertEqual(jsNumber(2.5), "2.5")
    }

    func testMovementRangeSquareIsDiamondInBFSOrder() {
        let one = movementRange(tokenTopLeft: Point2D(x: 60, y: 60), speedFeet: 5, gridSize: 50, gridType: .lines)
        XCTAssertEqual(
            one,
            [
                GridCell(q: 1, r: 1), GridCell(q: 2, r: 1), GridCell(q: 0, r: 1),
                GridCell(q: 1, r: 2), GridCell(q: 1, r: 0),
            ])
        XCTAssertEqual(movementRange(tokenTopLeft: .zero, speedFeet: 10, gridSize: 50, gridType: .lines).count, 13)
    }

    func testMovementRangeHexAndHidden() {
        XCTAssertEqual(movementRange(tokenTopLeft: .zero, speedFeet: 5, gridSize: 40, gridType: .hexagonal).count, 7)
        XCTAssertTrue(movementRange(tokenTopLeft: .zero, speedFeet: 30, gridSize: 50, gridType: .hidden).isEmpty)
    }

    func testMovementRangeOnIsoStartsUnderTheSnappedTokenCentre() {
        let grid = IsoGrid(cellSize: 50)
        // A 1×1 token snapped onto diamond (3,1): centre (100,100), top-left (75,75).
        let topLeft = grid.snapPoint(Point2D(x: 80, y: 80), width: 50, height: 50)
        XCTAssertEqual(topLeft, Point2D(x: 75, y: 75))
        let range = movementRange(tokenTopLeft: topLeft, tokenSize: 50, speedFeet: 5, gridSize: 50, gridType: .isometric)
        XCTAssertEqual(range.first, GridCell(q: 3, r: 1))
        XCTAssertEqual(range.first, grid.pixelToGrid(Point2D(x: 100, y: 100)), "the cell under the token's centre")
        XCTAssertEqual(range.count, 5)
    }

    func testMovementRangeOnHexStartsUnderTheSnappedTokenCentre() {
        let grid = HexGrid(cellSize: 40)
        let cell = GridCell(q: 2, r: -1)
        let centre = grid.gridToPixel(cell)
        let topLeft = Point2D(x: centre.x - 20, y: centre.y - 20)
        let range = movementRange(tokenTopLeft: topLeft, tokenSize: 40, speedFeet: 5, gridSize: 40, gridType: .hexagonal)
        XCTAssertEqual(range.first, cell)
    }

    func testMovementRangeOnSquareStillSeedsFromTopLeft() {
        let range = movementRange(
            tokenTopLeft: Point2D(x: 50, y: 50), tokenSize: 100, speedFeet: 5, gridSize: 50, gridType: .lines)
        XCTAssertEqual(range.first, GridCell(q: 1, r: 1))
    }
}
