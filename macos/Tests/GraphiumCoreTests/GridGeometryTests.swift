import XCTest

@testable import GraphiumCore

/// Mirrors archive/web/src/utils/grid.test.ts and gridGeometry.test.ts (CORE_SPEC §3.1).
final class GridGeometryTests: XCTestCase {
    let square = SquareGrid(cellSize: 50)

    func testSquarePixelToGridHandlesNegatives() {
        XCTAssertEqual(square.pixelToGrid(Point2D(x: 75, y: 125)), GridCell(q: 1, r: 2))
        XCTAssertEqual(square.pixelToGrid(Point2D(x: -10, y: -60)), GridCell(q: -1, r: -2))
    }

    func testSquareGridToPixelIsCellCentre() {
        XCTAssertEqual(square.gridToPixel(GridCell(q: 1, r: 2)), Point2D(x: 75, y: 125))
    }

    func testLegacySnapGoesToNearestIntersection() {
        XCTAssertEqual(square.snapPoint(Point2D(x: 74, y: 26)), Point2D(x: 50, y: 50))
        XCTAssertEqual(square.snapPoint(Point2D(x: -74, y: -26)), Point2D(x: -50, y: -50))
    }

    func testLegacySnapUsesJavaScriptHalfRounding() {
        // Math.round(-0.5) is -0 in JS; Swift's .rounded() would give -1 → -50.
        XCTAssertEqual(square.snapPoint(Point2D(x: -25, y: 25)), Point2D(x: 0, y: 50))
    }

    func testOddTokensSnapToCellCentreEvenToIntersection() {
        // 1×1 at x 60: centre 85 → cell centre 75 → top-left 50.
        XCTAssertEqual(square.snapPoint(Point2D(x: 60, y: 60), width: 50, height: 50), Point2D(x: 50, y: 50))
        // 2×2 at x 60: centre 110 → intersection 100 → top-left 50.
        XCTAssertEqual(square.snapPoint(Point2D(x: 60, y: 60), width: 100, height: 100), Point2D(x: 50, y: 50))
        // 3×3 at x 10: centre 85 → cell centre 75 → top-left 0.
        XCTAssertEqual(square.snapPoint(Point2D(x: 10, y: 10), width: 150, height: 150), Point2D(x: 0, y: 0))
    }

    func testNonSquareTokensSnapEachAxisIndependently() {
        // width 1 cell (odd), height 2 cells (even).
        XCTAssertEqual(square.snapPoint(Point2D(x: 60, y: 60), width: 50, height: 100), Point2D(x: 50, y: 50))
    }

    func testAlreadyAlignedTokensStayPut() {
        XCTAssertEqual(square.snapPoint(Point2D(x: 100, y: 150), width: 50, height: 50), Point2D(x: 100, y: 150))
        XCTAssertEqual(square.snapPoint(Point2D(x: 100, y: 150), width: 100, height: 100), Point2D(x: 100, y: 150))
    }

    func testDotsAndHiddenUseSquareGeometry() {
        for type in [GridType.lines, .dots, .hidden] {
            XCTAssertEqual(snapToGrid(Point2D(x: 74, y: 26), gridSize: 50, gridType: type), Point2D(x: 50, y: 50))
        }
    }

    func testSquareVisibleCellsCoverViewportInclusive() {
        let cells = square.visibleCells(in: Bounds(x: 0, y: 0, width: 100, height: 50))
        XCTAssertEqual(cells.count, 3 * 2)
        XCTAssertEqual(cells.first, GridCell(q: 0, r: 0))
    }

    func testHexRoundTripsCells() {
        let hex = HexGrid(cellSize: 40)
        for q in -3...3 {
            for r in -3...3 {
                let cell = GridCell(q: q, r: r)
                XCTAssertEqual(hex.pixelToGrid(hex.gridToPixel(cell)), cell)
            }
        }
    }

    func testHexVerticesAreSixAtCircumradius() {
        let hex = HexGrid(cellSize: 40)
        let cell = GridCell(q: 2, r: -1)
        let centre = hex.gridToPixel(cell)
        let vertices = hex.cellVertices(cell)
        XCTAssertEqual(vertices.count, 6)
        for v in vertices {
            XCTAssertEqual(Measure.euclideanDistance(v, centre), 40, accuracy: 1e-9)
        }
        XCTAssertEqual(vertices[0].x, centre.x + 40, accuracy: 1e-9, "first vertex is due east")
    }

    func testHexSizedSnapCentresTokenOnHex() {
        let hex = HexGrid(cellSize: 40)
        let snapped = hex.snapPoint(Point2D(x: 52, y: 30), width: 40, height: 40)
        let cell = hex.pixelToGrid(Point2D(x: 72, y: 50))  // the token's centre before snapping
        let centre = hex.gridToPixel(cell)
        XCTAssertEqual(snapped.x + 20, centre.x, accuracy: 1e-9)
        XCTAssertEqual(snapped.y + 20, centre.y, accuracy: 1e-9)
    }

    func testIsoRoundTripsCells() {
        let iso = IsoGrid(cellSize: 50)
        for q in -3...3 {
            for r in -3...3 {
                let cell = GridCell(q: q, r: r)
                XCTAssertEqual(iso.pixelToGrid(iso.gridToPixel(cell)), cell)
            }
        }
    }

    func testIsoPointInUpperHalfOfDiamondSnapsToThatDiamond() {
        // Deliberate fix vs TS (floor): 5px above the drawn centre of cell (2,1).
        let iso = IsoGrid(cellSize: 50)
        let centre = iso.gridToPixel(GridCell(q: 2, r: 1))
        XCTAssertEqual(iso.pixelToGrid(Point2D(x: centre.x, y: centre.y - 5)), GridCell(q: 2, r: 1))
        XCTAssertEqual(iso.snapPoint(Point2D(x: centre.x, y: centre.y - 5)), centre)
    }

    func testIsoVerticesFormDiamond() {
        let iso = IsoGrid(cellSize: 50)
        let v = iso.cellVertices(GridCell(q: 0, r: 0))
        XCTAssertEqual(v, [Point2D(x: 0, y: -25), Point2D(x: 50, y: 0), Point2D(x: 0, y: 25), Point2D(x: -50, y: 0)])
    }

    func testFactoryPicksGeometryByType() {
        XCTAssertTrue(makeGridGeometry(.lines, cellSize: 50) is SquareGrid)
        XCTAssertTrue(makeGridGeometry(.hexagonal, cellSize: 50) is HexGrid)
        XCTAssertTrue(makeGridGeometry(.isometric, cellSize: 50) is IsoGrid)
    }

    func testLargeViewportVisibleCellsIsFast() {
        measure {
            _ = HexGrid(cellSize: 20).visibleCells(in: Bounds(x: -2000, y: -2000, width: 4000, height: 4000))
        }
    }
}
