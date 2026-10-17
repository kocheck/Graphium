import Foundation
import XCTest

@testable import GraphiumCore

final class ViewportTests: XCTestCase {
    func testMapAndViewPointsRoundTrip() {
        let viewport = Viewport(origin: CGPoint(x: 120, y: -40), zoom: 2.5)
        let map = CGPoint(x: 333, y: 77)
        let back = viewport.mapPoint(fromView: viewport.viewPoint(fromMap: map))
        XCTAssertEqual(back.x, map.x, accuracy: 1e-9)
        XCTAssertEqual(back.y, map.y, accuracy: 1e-9)
    }

    func testZoomKeepsPointUnderCursorFixed() {
        var viewport = Viewport(origin: CGPoint(x: 10, y: 20), zoom: 1)
        let cursor = CGPoint(x: 400, y: 300)
        let underCursor = viewport.mapPoint(fromView: cursor)
        viewport.zoom(by: 1.75, around: cursor)
        let after = viewport.mapPoint(fromView: cursor)
        XCTAssertEqual(viewport.zoom, 1.75, accuracy: 1e-9)
        XCTAssertEqual(after.x, underCursor.x, accuracy: 1e-9)
        XCTAssertEqual(after.y, underCursor.y, accuracy: 1e-9)
    }

    func testZoomIsClamped() {
        var viewport = Viewport()
        viewport.zoom(by: 1000, around: .zero)
        XCTAssertEqual(viewport.zoom, Viewport.zoomRange.upperBound)
        viewport.zoom(by: 0.00001, around: .zero)
        XCTAssertEqual(viewport.zoom, Viewport.zoomRange.lowerBound)
    }

    func testPanMovesMapOppositeToDragInMapUnits() {
        var viewport = Viewport(origin: .zero, zoom: 2)
        viewport.pan(byView: CGSize(width: 100, height: -50))
        XCTAssertEqual(viewport.origin, CGPoint(x: -50, y: 25))
    }
}
