import XCTest

@testable import GraphiumCore

final class ExploredMaskPlanTests: XCTestCase {
    private let bounds = Bounds(x: 0, y: 0, width: 100, height: 100)

    private func region(_ t: Double) -> ExploredRegion {
        ExploredRegion(points: [Point2D(x: t, y: 0), Point2D(x: t + 1, y: 0), Point2D(x: t, y: 1)], timestamp: t)
    }

    private func update(_ stamped: [ExploredRegion]?, _ regions: [ExploredRegion], mapID: String = "m", bounds: Bounds? = nil)
        -> ExploredMaskPlan.Update
    {
        let plan = stamped.map { ExploredMaskPlan(mapID: "m", bounds: self.bounds, regions: $0) }
        return ExploredMaskPlan.update(from: plan, mapID: mapID, bounds: bounds ?? self.bounds, regions: regions)
    }

    func testFirstFrameBuilds() {
        XCTAssertEqual(update(nil, []), .rebuild)
        XCTAssertEqual(update(nil, [region(1)]), .rebuild)
    }

    func testNewRegionsAreStampedIncrementally() {
        let a = region(1), b = region(2), c = region(3)
        XCTAssertEqual(update([a, b], [a, b]), .unchanged)
        XCTAssertEqual(update([a, b], [a, b, c]), .append(from: 2))
        XCTAssertEqual(update([], [a]), .append(from: 0))
        XCTAssertEqual(update([], []), .unchanged)
    }

    func testRewrittenHistoryRebuilds() {
        let a = region(1), b = region(2), c = region(3)
        XCTAssertEqual(update([a, b, c], [a, b]), .rebuild, "undo shrinks the history")
        XCTAssertEqual(update([a, b], []), .rebuild, "reset")
        XCTAssertEqual(update([a, b], [b, c]), .rebuild, "the cap dropped the oldest")
        XCTAssertEqual(update([a, b], [a, c]), .rebuild, "undo then a different stamp")
    }

    func testMapOrBoundsChangeRebuilds() {
        let a = region(1)
        XCTAssertEqual(update([a], [a], mapID: "other"), .rebuild)
        XCTAssertEqual(update([a], [a], bounds: Bounds(x: 0, y: 0, width: 200, height: 100)), .rebuild)
    }
}
