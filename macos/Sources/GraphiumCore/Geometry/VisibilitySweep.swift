import Foundation

/// Exact visibility polygons (deliberate change from TS, PARITY §3.7). TS fires a fixed fan of
/// rays, so corners are cut and thin walls can be missed between two rays. Here rays also go
/// at every wall end in range and a hair either side of it, at every point where a wall
/// crosses the vision circle, and at every point where two walls cross. Between two
/// neighbouring rays the nearest wall can't change, so each polygon edge either lies on a
/// wall or is a chord of the arc (Red Blob Games, "2D Visibility"). The evenly spaced rays
/// still draw the arc, so with no walls in range the polygon is exactly the TS one.
public enum VisibilitySweep {
    /// Radians either side of a wall end: the rays that slip just past a corner.
    static let nudge = 1e-5
    /// Slack on a wall's extent, so a corner or a wall end snapped onto another wall
    /// can't be missed through rounding.
    static let endSlack = 1e-9

    public static func polygon(from origin: Point2D, radius: Double, walls: [WallSegment], arcRays: Int) -> [Point2D] {
        guard radius > 0, arcRays > 0 else { return [] }
        let nearby = walls.filter { distance(from: origin, to: $0) < radius }
        func angle(to p: Point2D) -> Double { atan2(p.y - origin.y, p.x - origin.x) }

        var angles = (0..<arcRays).map { Double($0) * 2 * .pi / Double(arcRays) }
        for (i, wall) in nearby.enumerated() {
            for end in [wall.start, wall.end] where hypot(end.x - origin.x, end.y - origin.y) < radius {
                let a = angle(to: end)
                angles += [a - nudge, a, a + nudge]
            }
            for crossing in circleCrossings(of: wall, centre: origin, radius: radius) {
                angles.append(angle(to: crossing))
            }
            for other in nearby[(i + 1)...] {
                if let hit = LineOfSight.intersection(wall.start, wall.end, other.start, other.end),
                    hypot(hit.x - origin.x, hit.y - origin.y) < radius
                {
                    angles.append(angle(to: hit))
                }
            }
        }

        var polygon: [Point2D] = []
        polygon.reserveCapacity(angles.count)
        var previous = -Double.infinity
        for a in angles.map(normalised).sorted() where a - previous > 1e-12 {
            previous = a
            polygon.append(castRay(from: origin, angle: a, radius: radius, walls: nearby))
        }
        return polygon
    }

    /// `LineOfSight.castRay` with `endSlack` on each wall's extent.
    static func castRay(from origin: Point2D, angle: Double, radius: Double, walls: [WallSegment]) -> Point2D {
        let end = Point2D(x: origin.x + radius * cos(angle), y: origin.y + radius * sin(angle))
        var closest = end
        var closestDistance = Double.infinity
        for wall in walls {
            guard let hit = hitPoint(origin, end, wall) else { continue }
            let distance = hypot(hit.x - origin.x, hit.y - origin.y)
            if distance < closestDistance {
                closestDistance = distance
                closest = hit
            }
        }
        return closest
    }

    private static func hitPoint(_ p1: Point2D, _ p2: Point2D, _ wall: WallSegment) -> Point2D? {
        let p3 = wall.start
        let p4 = wall.end
        let den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x)
        guard abs(den) >= 1e-10 else { return nil }
        let t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den
        let u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den
        guard (0...1).contains(t), (-endSlack...(1 + endSlack)).contains(u) else { return nil }
        return Point2D(x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y))
    }

    /// Where `wall` crosses the circle.
    static func circleCrossings(of wall: WallSegment, centre: Point2D, radius: Double) -> [Point2D] {
        let dx = wall.end.x - wall.start.x
        let dy = wall.end.y - wall.start.y
        let fx = wall.start.x - centre.x
        let fy = wall.start.y - centre.y
        let a = dx * dx + dy * dy
        let b = 2 * (fx * dx + fy * dy)
        let c = fx * fx + fy * fy - radius * radius
        let discriminant = b * b - 4 * a * c
        guard a > 1e-12, discriminant >= 0 else { return [] }
        let root = discriminant.squareRoot()
        return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
            .filter { (0...1).contains($0) }
            .map { Point2D(x: wall.start.x + $0 * dx, y: wall.start.y + $0 * dy) }
    }

    static func distance(from p: Point2D, to wall: WallSegment) -> Double {
        let c = PathOptimization.closestPointOnSegment(p, wall.start, wall.end)
        return hypot(c.x - p.x, c.y - p.y)
    }

    private static func normalised(_ angle: Double) -> Double {
        let a = angle.truncatingRemainder(dividingBy: 2 * .pi)
        return a < 0 ? a + 2 * .pi : a
    }
}

/// Closes seams between walls that look joined but aren't, such as a door whose ends stop
/// short of the wall either side, or two strokes whose ends nearly meet. Only loose ends
/// (points no other segment shares) move: each in turn moves to the nearest point on
/// another wall within `tolerance`. Points shared inside a stroke never move, and a loose end
/// ignores its own stroke for its first few tolerances of length, so a densely sampled
/// stroke can't fold onto itself, while a room drawn in one stroke still closes.
public enum WallWeld {
    /// Seams narrower than a tenth of a cell are closed: 0.5 ft, too narrow for any passage.
    public static let toleranceInCells = 0.1

    public static func weld(_ walls: [WallSegment], tolerance: Double) -> [WallSegment] {
        guard tolerance > 0, walls.count > 1 else { return walls }
        var touching: [Point2D: [Int]] = [:]
        for (i, wall) in walls.enumerated() {
            touching[wall.start, default: []].append(i)
            touching[wall.end, default: []].append(i)
        }
        let index = SegmentGrid(walls, cell: max(tolerance * 4, 1), margin: tolerance * 2)
        var result = walls
        for i in walls.indices {
            for end in [walls[i].start, walls[i].end] where touching[end]?.count == 1 {
                let own = stroke(from: end, of: i, within: tolerance * 3, walls: walls, touching: touching)
                var best: (point: Point2D, distance: Double)?
                for j in index.candidates(near: end) where !own.contains(j) {
                    let c = PathOptimization.closestPointOnSegment(end, result[j].start, result[j].end)
                    let d = hypot(c.x - end.x, c.y - end.y)
                    if d <= tolerance, d < (best?.distance ?? .infinity) { best = (c, d) }
                }
                guard let best else { continue }
                if end == walls[i].start { result[i].start = best.point } else { result[i].end = best.point }
            }
        }
        return result
    }

    /// Segments reached by walking from `end` along shared points for less than `length`.
    private static func stroke(
        from end: Point2D, of segment: Int, within length: Double, walls: [WallSegment], touching: [Point2D: [Int]]
    ) -> Set<Int> {
        var reached: Set<Int> = [segment]
        var pending = [(segment: segment, entry: end, walked: 0.0)]
        while let next = pending.popLast() {
            let wall = walls[next.segment]
            let exit = wall.start == next.entry ? wall.end : wall.start
            let walked = next.walked + hypot(exit.x - next.entry.x, exit.y - next.entry.y)
            guard walked < length else { continue }
            for j in touching[exit] ?? [] where !reached.contains(j) {
                reached.insert(j)
                pending.append((segment: j, entry: exit, walked: walked))
            }
        }
        return reached
    }
}

/// Buckets segments by the grid cells their bounding box, padded by `margin`, covers. A point
/// within `margin / 2` of a segment finds it even after its ends have moved by `margin / 2`.
struct SegmentGrid {
    private struct Cell: Hashable {
        var x: Int
        var y: Int
    }

    /// Segments covering more cells than this are checked on every query instead.
    private static let maxCellsPerSegment = 4096

    private let cell: Double
    private var buckets: [Cell: [Int]] = [:]
    private var everywhere: [Int] = []

    init(_ walls: [WallSegment], cell: Double, margin: Double) {
        self.cell = cell
        for (i, wall) in walls.enumerated() {
            let x0 = ((min(wall.start.x, wall.end.x) - margin) / cell).rounded(.down)
            let x1 = ((max(wall.start.x, wall.end.x) + margin) / cell).rounded(.down)
            let y0 = ((min(wall.start.y, wall.end.y) - margin) / cell).rounded(.down)
            let y1 = ((max(wall.start.y, wall.end.y) + margin) / cell).rounded(.down)
            let cells = (x1 - x0 + 1) * (y1 - y0 + 1)
            guard cells.isFinite, cells <= Double(Self.maxCellsPerSegment), max(abs(x0), abs(x1), abs(y0), abs(y1)) < 1e15 else {
                everywhere.append(i)
                continue
            }
            for x in Int(x0)...Int(x1) {
                for y in Int(y0)...Int(y1) { buckets[Cell(x: x, y: y), default: []].append(i) }
            }
        }
    }

    func candidates(near p: Point2D) -> [Int] {
        let x = (p.x / cell).rounded(.down)
        let y = (p.y / cell).rounded(.down)
        guard abs(x) < 1e15, abs(y) < 1e15 else { return everywhere }
        return (buckets[Cell(x: Int(x), y: Int(y))] ?? []) + everywhere
    }
}
