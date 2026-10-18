import XCTest

@testable import GraphiumCore

/// Exact visibility (PARITY §3.7): checked against a brute-force oracle, not against itself.
final class VisibilitySweepTests: XCTestCase {
    private func wall(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> WallSegment {
        WallSegment(start: Point2D(x: x1, y: y1), end: Point2D(x: x2, y: y2))
    }

    /// The oracle: `p` is visible from `origin` when the sight line crosses no wall.
    private func oracleSees(_ p: Point2D, from origin: Point2D, walls: [WallSegment]) -> Bool {
        !walls.contains { LineOfSight.intersection(origin, p, $0.start, $0.end) != nil }
    }

    private func distance(_ p: Point2D, _ a: Point2D, _ b: Point2D) -> Double {
        VisibilitySweep.distance(from: p, to: WallSegment(start: a, end: b))
    }

    private func randomWalls(_ rng: inout SplitMix64, count: Int) -> [WallSegment] {
        (0..<count).map { _ in
            let x = Double.random(in: 0...600, using: &rng)
            let y = Double.random(in: 0...600, using: &rng)
            return wall(x, y, x + .random(in: -250...250, using: &rng), y + .random(in: -250...250, using: &rng))
        }
    }

    /// Random points the polygon must classify exactly: inside the arc's chords and at least
    /// half a pixel from any wall or polygon edge, where rounding could flip the answer.
    private func samples(
        _ rng: inout SplitMix64, origin: Point2D, radius: Double, arcRays: Int, walls: [WallSegment], polygon: [Point2D]
    ) -> [Point2D] {
        let reach = radius * cos(.pi / Double(arcRays)) - 1
        return (0..<300).compactMap { _ in
            let p = Point2D(
                x: origin.x + .random(in: -radius...radius, using: &rng),
                y: origin.y + .random(in: -radius...radius, using: &rng))
            guard hypot(p.x - origin.x, p.y - origin.y) < reach else { return nil }
            guard walls.allSatisfy({ distance(p, $0.start, $0.end) >= 0.5 }) else { return nil }
            guard polygon.indices.allSatisfy({ distance(p, polygon[$0], polygon[($0 + 1) % polygon.count]) >= 0.5 })
            else { return nil }
            return p
        }
    }

    func testWithoutWallsMatchesTheTSRayFan() {
        let origin = Point2D(x: 10, y: 20)
        let polygon = LineOfSight.polygon(from: origin, radius: 300, walls: [], rays: 180)
        XCTAssertEqual(polygon.count, 180)
        for (i, p) in polygon.enumerated() {
            let expected = LineOfSight.castRay(from: origin, angle: Double(i) * 2 * .pi / 180, radius: 300, walls: [])
            XCTAssertEqual(p.x, expected.x, accuracy: 1e-9)
            XCTAssertEqual(p.y, expected.y, accuracy: 1e-9)
        }
    }

    func testAgreesWithBruteForceOnRandomMaps() {
        var rng = SplitMix64(seed: 7)
        var checked = 0
        for _ in 0..<200 {
            let walls = randomWalls(&rng, count: .random(in: 1...14, using: &rng))
            let origin = Point2D(x: .random(in: 100...500, using: &rng), y: .random(in: 100...500, using: &rng))
            guard walls.allSatisfy({ distance(origin, $0.start, $0.end) >= 1 }) else { continue }
            let polygon = LineOfSight.polygon(from: origin, radius: 250, walls: walls, rays: 180)
            for p in samples(&rng, origin: origin, radius: 250, arcRays: 180, walls: walls, polygon: polygon) {
                checked += 1
                XCTAssertEqual(
                    LineOfSight.contains(polygon, p), oracleSees(p, from: origin, walls: walls),
                    "\(p) from \(origin) with \(walls)")
            }
        }
        XCTAssertGreaterThan(checked, 10_000, "enough samples to mean something")
    }

    func testNoVertexIsSeenThroughAWall() {
        var rng = SplitMix64(seed: 11)
        for _ in 0..<100 {
            let walls = randomWalls(&rng, count: 10)
            let origin = Point2D(x: 300, y: 300)
            guard walls.allSatisfy({ distance(origin, $0.start, $0.end) >= 1 }) else { continue }
            for v in LineOfSight.polygon(from: origin, radius: 250, walls: walls, rays: 90) {
                // Stop just short of the vertex: it may lie on the wall that stops the ray.
                let short = Point2D(x: origin.x + (v.x - origin.x) * 0.999, y: origin.y + (v.y - origin.y) * 0.999)
                XCTAssertTrue(oracleSees(short, from: origin, walls: walls), "\(v) from \(origin)")
            }
        }
    }

    func testAddingAWallOrClosingADoorNeverRevealsMore() {
        var rng = SplitMix64(seed: 23)
        for _ in 0..<100 {
            let walls = randomWalls(&rng, count: 6)
            let extra = randomWalls(&rng, count: 1)
            let origin = Point2D(x: 300, y: 300)
            guard (walls + extra).allSatisfy({ distance(origin, $0.start, $0.end) >= 1 }) else { continue }
            let before = LineOfSight.polygon(from: origin, radius: 250, walls: walls, rays: 180)
            let after = LineOfSight.polygon(from: origin, radius: 250, walls: walls + extra, rays: 180)
            let points = samples(&rng, origin: origin, radius: 250, arcRays: 180, walls: walls + extra, polygon: after)
            for p in points where LineOfSight.contains(after, p) {
                guard before.indices.allSatisfy({ distance(p, before[$0], before[($0 + 1) % before.count]) >= 0.5 })
                else { continue }
                XCTAssertTrue(LineOfSight.contains(before, p), "\(p) appeared when \(extra[0]) was added")
            }
        }
    }

    func testCornersAreExact() {
        // An L-shaped corner at (200, 100): TS rays cut across it; the sweep lands on it.
        let walls = [wall(200, 100, 200, 400), wall(200, 100, -100, 100)]
        let polygon = LineOfSight.polygon(from: Point2D(x: 100, y: 200), radius: 250, walls: walls, rays: 90)
        XCTAssertTrue(polygon.contains { hypot($0.x - 200, $0.y - 100) < 1e-6 }, "a vertex sits on the corner")
        XCTAssertFalse(LineOfSight.contains(polygon, Point2D(x: 215, y: 92)), "nothing past the corner")
    }

    func testAThinPillarCannotHideBetweenRays() {
        // A 2 px pillar 240 px away falls between two of 90 rays (4° apart is ~17 px there).
        let origin = Point2D(x: 0, y: 0)
        let pillar = [wall(240, 7, 240, 9)]
        let behind = Point2D(x: 245, y: 8.2)
        let polygon = LineOfSight.polygon(from: origin, radius: 250, walls: pillar, rays: 90)
        XCTAssertFalse(LineOfSight.contains(polygon, behind))
        XCTAssertTrue(LineOfSight.contains(polygon, Point2D(x: 245, y: 20)))
    }

    func testWeldClosesADoorSeamButNotADoorway() {
        // Walls stop 3 px short of a closed door: a seam sight slips through.
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "pc", x: 0, y: 25, src: "", type: .pc, visionRadius: 60)]
        map.drawings = [
            Drawing(tool: .wall, points: [200, -1000, 200, -3], color: "#f00", size: 8),
            Drawing(tool: .wall, points: [200, 103, 200, 1000], color: "#f00", size: 8),
        ]
        map.doors = [Door(id: "door", x: 200, y: 50, orientation: .vertical, size: 100)]
        let seam = Point2D(x: 400, y: 160.4)  // The sight line crosses x = 200 at y = 101.5.
        let viewer = LineOfSight.viewers(of: map, library: [:])[0]
        let unwelded = LineOfSight.polygon(
            from: viewer.centre, radius: viewer.radius, walls: LineOfSight.walls(of: map), rays: 360)
        XCTAssertTrue(LineOfSight.contains(unwelded, seam), "the seam leaks without welding")
        XCTAssertFalse(LineOfSight.containsInAny(LineOfSight.polygons(of: map, library: [:]).map(\.polygon), seam))

        // A real gap (a cell wide) stays open.
        map.drawings[1].points = [200, 150, 200, 1000]
        let doorway = Point2D(x: 400, y: 210.7)  // Crosses x = 200 at y = 125.
        XCTAssertTrue(LineOfSight.containsInAny(LineOfSight.polygons(of: map, library: [:]).map(\.polygon), doorway))
    }

    func testWeldMovesOnlyLooseEnds() {
        // A densely sampled stroke (1 px steps) must not collapse, and its far end, 2 px
        // from another wall, snaps onto it.
        let stroke = (0..<20).map { wall(Double($0), 0, Double($0 + 1), 0) }
        let other = wall(22, -50, 22, 50)
        let welded = WallWeld.weld(stroke + [other], tolerance: 5)
        XCTAssertEqual(Array(welded[0..<19]), Array(stroke[0..<19]))
        XCTAssertEqual(welded[19].end, Point2D(x: 22, y: 0))
        XCTAssertEqual(welded[0].start, Point2D(x: 0, y: 0), "nothing near the other end")
        XCTAssertEqual(welded[20], other, "the far wall's ends have nothing nearby")
    }

    func testWeldJoinsTwoNearlyMeetingEnds() {
        let welded = WallWeld.weld([wall(0, 0, 100, 0), wall(102, 1, 200, 50)], tolerance: 5)
        XCTAssertEqual(welded[0].end, welded[1].start, "one end moves onto the other, not past it")
    }
}
