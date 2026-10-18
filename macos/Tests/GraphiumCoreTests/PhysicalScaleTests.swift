import XCTest

@testable import GraphiumCore

final class PhysicalScaleTests: XCTestCase {
    func testPointsPerInchFromReportedWidth() throws {
        // A 1920-point-wide panel that is 1219.2 mm (48 in) wide: 40 points per inch.
        let ppi = try XCTUnwrap(PhysicalScale.pointsPerInch(widthPoints: 1920, widthMillimeters: 1219.2))
        XCTAssertEqual(ppi, 40, accuracy: 1e-9)
        XCTAssertNil(PhysicalScale.pointsPerInch(widthPoints: 1920, widthMillimeters: 0))
    }

    func testPointsPerInchFromTypedDiagonal() throws {
        // A 37" 1080p TV is about 60 points per inch (the Fantasy Grounds rule of thumb).
        let ppi = try XCTUnwrap(PhysicalScale.pointsPerInch(diagonalInches: 37, widthPoints: 1920, heightPoints: 1080))
        XCTAssertEqual(ppi, 59.5, accuracy: 0.1)
    }

    func testInchGridZoomMakesOneSquareOneInch() throws {
        let zoom = try XCTUnwrap(PhysicalScale.inchGridZoom(gridSize: 50, pointsPerInch: 40))
        XCTAssertEqual(zoom * 50, 40, accuracy: 1e-9)
    }

    func testBoundsFitBackToTheSameZoomAndCenter() {
        let bounds = PhysicalScale.bounds(center: Point2D(x: 500, y: 300), zoom: 0.8, viewWidth: 1920, viewHeight: 1080)
        var viewport = Viewport()
        viewport.fit(bounds, viewWidth: 1920, viewHeight: 1080)
        XCTAssertEqual(viewport.zoom, 0.8, accuracy: 1e-9)
        XCTAssertEqual(viewport.mapPoint(fromView: Point2D(x: 960, y: 540)).x, 500, accuracy: 1e-6)
    }
}
