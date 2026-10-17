import XCTest

@testable import GraphiumCore

/// Mirrors the TS DoorShape swing animation (300 ms, ease-in-out quad; PARITY §3.6).
final class DoorSwingTests: XCTestCase {
    func testEaseInOutQuadMatchesTS() {
        XCTAssertEqual(DoorSwing.easeInOut(0), 0)
        XCTAssertEqual(DoorSwing.easeInOut(0.25), 0.125, accuracy: 1e-12)
        XCTAssertEqual(DoorSwing.easeInOut(0.5), 0.5, accuracy: 1e-12)
        XCTAssertEqual(DoorSwing.easeInOut(0.75), 0.875, accuracy: 1e-12)
        XCTAssertEqual(DoorSwing.easeInOut(1), 1)
        XCTAssertEqual(DoorSwing.easeInOut(-1), 0, "clamped")
        XCTAssertEqual(DoorSwing.easeInOut(2), 1, "clamped")
    }

    func testTransitionRunsForThreeHundredMilliseconds() {
        let swing = DoorSwing.Transition(from: 0, to: 1, start: 10)
        XCTAssertEqual(swing.openFraction(at: 10), 0)
        XCTAssertEqual(swing.openFraction(at: 10.15), 0.5, accuracy: 1e-9)
        XCTAssertFalse(swing.isFinished(at: 10.29))
        XCTAssertTrue(swing.isFinished(at: 10.3))
        XCTAssertEqual(swing.openFraction(at: 11), 1)
    }

    func testTrackerSwingsOnChangeOnly() {
        var tracker = DoorSwingTracker()
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: false, now: 0), 0, "first sight draws at rest")
        XCTAssertFalse(tracker.isAnimating)

        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: true, now: 1), 0, "a swing starts closed")
        XCTAssertTrue(tracker.isAnimating)
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: true, now: 1.15), 0.5, accuracy: 1e-9)
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: true, now: 1.4), 1)
        XCTAssertFalse(tracker.isAnimating, "finished swings are dropped")
    }

    func testTrackerReversesFromTheCurrentAngle() {
        var tracker = DoorSwingTracker()
        _ = tracker.openFraction(doorID: "d", isOpen: false, now: 0)
        _ = tracker.openFraction(doorID: "d", isOpen: true, now: 1)
        // Closed again half way through opening: the swing back starts at 0.5.
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: false, now: 1.15), 0.5, accuracy: 1e-9)
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: false, now: 1.3), 0.25, accuracy: 1e-9)
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: false, now: 1.5), 0)
    }

    func testReduceMotionJumpsStraightToTheNewState() {
        var tracker = DoorSwingTracker()
        _ = tracker.openFraction(doorID: "d", isOpen: false, now: 0)
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: true, now: 1, animate: false), 1)
        XCTAssertFalse(tracker.isAnimating)
    }

    func testPruneForgetsRemovedDoors() {
        var tracker = DoorSwingTracker()
        _ = tracker.openFraction(doorID: "d", isOpen: false, now: 0)
        _ = tracker.openFraction(doorID: "d", isOpen: true, now: 1)
        tracker.prune(now: 1.1, keeping: [])
        XCTAssertFalse(tracker.isAnimating)
        // Seen again later (e.g. back on its map): no swing from stale state.
        XCTAssertEqual(tracker.openFraction(doorID: "d", isOpen: false, now: 2), 0)
        XCTAssertFalse(tracker.isAnimating)
    }
}
