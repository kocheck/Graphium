import Foundation

/// Wall smoothing and snapping (TS `pathOptimization.ts`, CORE_SPEC §3.5).
/// Paths are flat `[x1, y1, x2, y2, …]` arrays, like `Drawing.points`.
public enum PathOptimization {
    /// TS preferences defaults (no UI in TS).
    public static let smoothingEpsilon = 3.0
    public static let snapThreshold = 10.0
    public static let minPoints = 2

    /// Ramer–Douglas–Peucker. Two points or fewer are returned unchanged.
    public static func simplify(_ points: [Double], epsilon: Double) -> [Double] {
        guard points.count > 4 else { return points }
        let pts = stride(from: 0, to: points.count - 1, by: 2).map { Point2D(x: points[$0], y: points[$0 + 1]) }
        return rdp(pts[...], epsilon: epsilon).flatMap { [$0.x, $0.y] }
    }

    private static func rdp(_ points: ArraySlice<Point2D>, epsilon: Double) -> [Point2D] {
        guard let first = points.first, let last = points.last, points.count > 2 else { return Array(points) }
        var maxDistance = 0.0
        var index = points.startIndex
        for i in (points.startIndex + 1)..<(points.endIndex - 1) {
            let d = perpendicularDistance(points[i], first, last)
            if d > maxDistance {
                maxDistance = d
                index = i
            }
        }
        guard maxDistance > epsilon else { return [first, last] }
        let left = rdp(points[points.startIndex...index], epsilon: epsilon)
        let right = rdp(points[index..<points.endIndex], epsilon: epsilon)
        return Array(left.dropLast()) + right
    }

    static func perpendicularDistance(_ p: Point2D, _ start: Point2D, _ end: Point2D) -> Double {
        let dx = end.x - start.x
        let dy = end.y - start.y
        guard dx != 0 || dy != 0 else { return hypot(p.x - start.x, p.y - start.y) }
        return abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x) / (dx * dx + dy * dy).squareRoot()
    }

    static func closestPointOnSegment(_ p: Point2D, _ a: Point2D, _ b: Point2D) -> Point2D {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else { return a }
        let t = min(max(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0), 1)
        return Point2D(x: a.x + t * dx, y: a.y + t * dy)
    }

    public struct SnapResult: Equatable {
        public var point: Point2D
        public var snapped: Bool
        public var pathIndex: Int
    }

    /// Vertex snap first (closest vertex within `threshold`), else the closest point
    /// on any segment within `threshold`, else the point unchanged.
    public static func snap(_ point: Point2D, to paths: [[Double]], threshold: Double) -> SnapResult {
        var best: (point: Point2D, distance: Double, index: Int)?
        // Paths shorter than one segment are ignored entirely (TS).
        for (index, path) in paths.enumerated() where path.count >= 4 {
            for i in stride(from: 0, to: path.count - 1, by: 2) {
                let v = Point2D(x: path[i], y: path[i + 1])
                let d = hypot(v.x - point.x, v.y - point.y)
                if d < threshold, d < (best?.distance ?? .infinity) { best = (v, d, index) }
            }
        }
        if let best { return SnapResult(point: best.point, snapped: true, pathIndex: best.index) }

        for (index, path) in paths.enumerated() where path.count >= 4 {
            for i in stride(from: 0, to: path.count - 3, by: 2) {
                let c = closestPointOnSegment(
                    point, Point2D(x: path[i], y: path[i + 1]), Point2D(x: path[i + 2], y: path[i + 3]))
                let d = hypot(c.x - point.x, c.y - point.y)
                if d < threshold, d < (best?.distance ?? .infinity) { best = (c, d, index) }
            }
        }
        if let best { return SnapResult(point: best.point, snapped: true, pathIndex: best.index) }
        return SnapResult(point: point, snapped: false, pathIndex: -1)
    }

    /// What TS does when a wall stroke ends: smooth (kept only if ≥ minPoints remain),
    /// then snap the first and last points to existing walls' raw points.
    public static func finalizeWall(_ points: [Double], existingWalls: [[Double]]) -> [Double] {
        var result = points
        let smoothed = simplify(points, epsilon: smoothingEpsilon)
        if smoothed.count >= minPoints * 2 { result = smoothed }
        guard !existingWalls.isEmpty, result.count >= 4 else { return result }
        let first = snap(Point2D(x: result[0], y: result[1]), to: existingWalls, threshold: snapThreshold).point
        let n = result.count
        let last = snap(Point2D(x: result[n - 2], y: result[n - 1]), to: existingWalls, threshold: snapThreshold).point
        result[0] = first.x
        result[1] = first.y
        result[n - 2] = last.x
        result[n - 1] = last.y
        return result
    }
}

/// Stroke width under pen pressure (TS `CanvasUtils` pressure curves; "normal" is the default).
public enum PressureCurve: String, CaseIterable, Sendable {
    case light, normal, heavy

    /// Multiplier range applied to the base width.
    public var range: ClosedRange<Double> {
        switch self {
        case .light: return 0.2...2.0
        case .normal: return 0.3...1.5
        case .heavy: return 0.4...1.2
        }
    }

    /// Mouse input reports 0.5.
    public func width(base: Double, pressure: Double) -> Double {
        let p = min(max(pressure, 0), 1)
        return base * (range.lowerBound + p * (range.upperBound - range.lowerBound))
    }
}

/// Default stroke settings (TS `useCanvasInteraction`).
public enum StrokeDefaults {
    public static let markerSize = 5.0
    public static let eraserSize = 20.0
    public static let wallSize = 8.0
    public static let markerColor = "#df4b26"
    public static let eraserColor = "#000000"
    public static let wallColor = "#ff0000"

    /// TS `uiStore` initial recent marker colours (PARITY §2.2).
    public static let recentMarkerColors = ["#df4b26", "#3b82f6", "#22c55e"]

    /// TS `setColor`: the picked colour first, then the rest minus case-insensitive
    /// duplicates, keeping `limit`.
    public static func recentColors(picking color: String, after recent: [String], limit: Int = 3) -> [String] {
        let key = color.lowercased()
        return Array(([color] + recent.filter { $0.lowercased() != key }).prefix(limit))
    }
}

extension GameMap {
    /// Places a closed, unlocked, one-cell door (`doorPlacement`).
    @discardableResult
    public mutating func placeDoor(at point: Point2D, orientation: DoorOrientation) -> Door {
        let door = doorPlacement(at: point, orientation: orientation)
        doors.append(door)
        joinWalls(to: door)
        return door
    }

    /// The door a click at `point` places. Away from walls: `orientation`, at the TS legacy
    /// snap (square grids → nearest intersection; hex/iso → cell centre). On a wall stroke
    /// (within a fifth of a cell): lined up with that wall at any angle (native, PARITY §3.6),
    /// at the snapped point when it lies on the wall, else at the nearest point of the wall,
    /// kept clear of the segment's ends when the segment is long enough.
    public func doorPlacement(at point: Point2D, orientation: DoorOrientation) -> Door {
        let snapped = snapToGrid(point, gridSize: gridSize, gridType: gridType)
        let nearby = LineOfSight.strokeWalls(of: self)
            .map { (wall: $0, distance: VisibilitySweep.distance(from: point, to: $0)) }
            .filter { $0.distance <= gridSize * 0.2 }
        guard let wall = nearby.min(by: { $0.distance < $1.distance })?.wall else {
            return Door(x: snapped.x, y: snapped.y, orientation: orientation, size: gridSize)
        }
        let dx = wall.end.x - wall.start.x
        let dy = wall.end.y - wall.start.y
        var degrees = atan2(dy, dx) * 180 / .pi
        if degrees > 90 { degrees -= 180 } else if degrees <= -90 { degrees += 180 }
        let axis: DoorOrientation = abs(degrees) <= 45 ? .horizontal : .vertical
        let isAxis = abs(degrees) < 0.5 || abs(abs(degrees) - 90) < 0.5
        if isAxis, VisibilitySweep.distance(from: snapped, to: wall) <= 1 {
            return Door(x: snapped.x, y: snapped.y, orientation: axis, size: gridSize)
        }
        let length = hypot(dx, dy)
        var t = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / (length * length)
        let half = gridSize / 2 / length
        t = half <= 0.5 ? min(max(t, half), 1 - half) : 0.5
        return Door(
            x: wall.start.x + t * dx, y: wall.start.y + t * dy, orientation: axis, size: gridSize,
            angle: isAxis ? nil : degrees)
    }

    /// The door under `point` (a thick hit area around the door line).
    public func door(at point: Point2D, tolerance: Double = 8) -> Door? {
        doors.last { door in
            let p = door.local(point)
            return abs(p.across) <= tolerance && abs(p.along) <= door.size / 2
        }
    }

    /// TS `toggleDoor`, respecting locks as the UI does.
    public mutating func toggleDoor(id: String) {
        guard let i = doors.firstIndex(where: { $0.id == id }), !doors[i].isLocked else { return }
        doors[i].isOpen.toggle()
    }

    /// TS `updateAllDoorStates`: only unlocked doors change. Native: opening skips hidden
    /// doors, so a bulk open never shows players a secret door.
    public mutating func setAllUnlockedDoors(open: Bool) {
        for i in doors.indices where !doors[i].isLocked && !(open && doors[i].isHidden == true) {
            doors[i].isOpen = open
        }
    }

    /// Hides doors from players (they see wall while shut) or reveals them. Revealing leaves
    /// the flag out of the file.
    public mutating func setDoorsHidden(_ ids: Set<String>, hidden: Bool) {
        for i in doors.indices where ids.contains(doors[i].id) { doors[i].isHidden = hidden ? true : nil }
    }

    public mutating func setAllDoorLocks(locked: Bool) {
        for i in doors.indices { doors[i].isLocked = locked }
    }
}

/// A live ruler / blast / cone (TS `Measurement`, CORE_SPEC §1.13). Transient.
public enum MeasurementShape: Equatable, Sendable {
    case ruler(origin: Point2D, end: Point2D)
    case blast(origin: Point2D, edge: Point2D)
    case cone(origin: Point2D, target: Point2D)

    public enum Mode: String, CaseIterable, Sendable {
        case ruler, blast, cone
    }

    public init(mode: Mode, origin: Point2D, pointer: Point2D) {
        switch mode {
        case .ruler: self = .ruler(origin: origin, end: pointer)
        case .blast: self = .blast(origin: origin, edge: pointer)
        case .cone: self = .cone(origin: origin, target: pointer)
        }
    }

    /// All feet values use the Euclidean distance (the app never uses the 5e mode).
    public func label(gridSize: Double) -> String {
        switch self {
        case .ruler(let o, let e):
            return Measure.formatDistance(Measure.pixelsToFeet(Measure.euclideanDistance(o, e), gridSize: gridSize))
        case .blast(let o, let e):
            return Measure.formatRadius(Measure.pixelsToFeet(Measure.euclideanDistance(o, e), gridSize: gridSize))
        case .cone(let o, let t):
            return Measure.formatCone(Measure.pixelsToFeet(Measure.euclideanDistance(o, t), gridSize: gridSize))
        }
    }
}
