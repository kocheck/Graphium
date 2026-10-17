import XCTest

@testable import GraphiumCore

/// Konva `Line` tension maths (marker and eraser strokes, tension 0.5; PARITY §3.5).
final class CardinalSplineTests: XCTestCase {
    func testControlPointsScaleWithNeighbouringSegments() {
        let even = CardinalSpline.controlPoints(
            Point2D(x: 0, y: 0), Point2D(x: 10, y: 0), Point2D(x: 20, y: 0), tension: 0.5)
        XCTAssertEqual(even.incoming, Point2D(x: 5, y: 0))
        XCTAssertEqual(even.outgoing, Point2D(x: 15, y: 0))

        // d01 = 10, d12 = 30: fa = 0.125 and fb = 0.375, along p2 − p0 = (10, 30).
        let uneven = CardinalSpline.controlPoints(
            Point2D(x: 0, y: 0), Point2D(x: 10, y: 0), Point2D(x: 10, y: 30), tension: 0.5)
        XCTAssertEqual(uneven.incoming.x, 10 - 0.125 * 10, accuracy: 1e-12)
        XCTAssertEqual(uneven.incoming.y, 0 - 0.125 * 30, accuracy: 1e-12)
        XCTAssertEqual(uneven.outgoing.x, 10 + 0.375 * 10, accuracy: 1e-12)
        XCTAssertEqual(uneven.outgoing.y, 0 + 0.375 * 30, accuracy: 1e-12)
    }

    func testCoincidentPointsDoNotProduceNaN() {
        let p = Point2D(x: 4, y: 4)
        let c = CardinalSpline.controlPoints(p, p, p, tension: 0.5)
        XCTAssertEqual(c.incoming, p)
        XCTAssertEqual(c.outgoing, p)
    }

    func testShortStrokesStayStraight() {
        let a = Point2D(x: 1, y: 2)
        let b = Point2D(x: 3, y: 4)
        XCTAssertEqual(CardinalSpline.path(through: []), [])
        XCTAssertEqual(CardinalSpline.path(through: [a]), [.move(to: a), .line(to: a)], "a dot")
        XCTAssertEqual(CardinalSpline.path(through: [a, b]), [.move(to: a), .line(to: b)])
        XCTAssertEqual(
            CardinalSpline.path(through: [a, b, a], tension: 0), [.move(to: a), .line(to: b), .line(to: a)])
    }

    func testThreePointsAreTwoQuadratics() {
        let points = [Point2D(x: 0, y: 0), Point2D(x: 10, y: 0), Point2D(x: 20, y: 0)]
        XCTAssertEqual(
            CardinalSpline.path(through: points),
            [
                .move(to: points[0]),
                .quadCurve(to: points[1], control: Point2D(x: 5, y: 0)),
                .quadCurve(to: points[2], control: Point2D(x: 15, y: 0)),
            ])
    }

    func testLongerStrokesUseCubicsBetweenInteriorPoints() {
        let points = [Point2D(x: 0, y: 0), Point2D(x: 10, y: 0), Point2D(x: 20, y: 0), Point2D(x: 30, y: 0)]
        let path = CardinalSpline.path(through: points)
        XCTAssertEqual(path.count, 4)
        XCTAssertEqual(path[0], .move(to: points[0]))
        XCTAssertEqual(path[1], .quadCurve(to: points[1], control: Point2D(x: 5, y: 0)))
        XCTAssertEqual(path[2], .curve(to: points[2], control1: Point2D(x: 15, y: 0), control2: Point2D(x: 15, y: 0)))
        XCTAssertEqual(path[3], .quadCurve(to: points[3], control: Point2D(x: 25, y: 0)))
    }
}
