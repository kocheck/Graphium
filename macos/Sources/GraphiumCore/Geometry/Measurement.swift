import Foundation

/// Distances, angles and labels for the ruler / blast / cone tools (CORE_SPEC §3.2).
public enum Measure {
    public enum DistanceMode: Sendable {
        case euclidean
        /// 5-10-5 diagonal rule.
        case dnd5e
    }

    public static let defaultConeAngle = 53.0

    public static func euclideanDistance(_ a: Point2D, _ b: Point2D) -> Double {
        ((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)).squareRoot()
    }

    /// Distance in cells under the 5-10-5 rule.
    public static func dnd5eDistance(_ a: Point2D, _ b: Point2D, gridSize: Double) -> Double {
        let cx = jsRound(abs(b.x - a.x) / gridSize)
        let cy = jsRound(abs(b.y - a.y) / gridSize)
        let diagonals = min(cx, cy)
        let straight = max(cx, cy) - diagonals
        return (diagonals / 2).rounded(.down) * 3 + diagonals.truncatingRemainder(dividingBy: 2) + straight
    }

    public static func pixelsToFeet(
        _ pixels: Double, gridSize: Double, mode: DistanceMode = .euclidean, from a: Point2D? = nil, to b: Point2D? = nil
    ) -> Double {
        if mode == .dnd5e, let a, let b { return dnd5eDistance(a, b, gridSize: gridSize) * 5 }
        return jsRound(pixels / gridSize * 5)
    }

    /// Radians, y-down (so "up" is −π/2).
    public static func angle(from a: Point2D, to b: Point2D) -> Double {
        atan2(b.y - a.y, b.x - a.x)
    }

    /// Degrees in [0, 360).
    public static func angleDegrees(from a: Point2D, to b: Point2D) -> Double {
        let degrees = angle(from: a, to: b) * 180 / .pi
        return degrees < 0 ? degrees + 360 : degrees
    }

    public static func coneVertices(origin: Point2D, target: Point2D, angle: Double = defaultConeAngle) -> [Point2D] {
        let length = euclideanDistance(origin, target)
        let theta = Self.angle(from: origin, to: target)
        let half = angle / 2 * .pi / 180
        return [
            origin,
            Point2D(x: origin.x + length * cos(theta + half), y: origin.y + length * sin(theta + half)),
            Point2D(x: origin.x + length * cos(theta - half), y: origin.y + length * sin(theta - half)),
        ]
    }

    public static func formatDistance(_ feet: Double, showCells: Bool = true) -> String {
        guard showCells else { return "\(jsNumber(feet))ft" }
        let cells = jsRound(feet / 5)
        return "\(jsNumber(feet))ft (\(jsNumber(cells)) cell\(cells == 1 ? "" : "s"))"
    }

    public static func formatRadius(_ feet: Double, showCells: Bool = true) -> String {
        showCells
            ? "\(jsNumber(feet))ft radius (\(jsNumber(jsRound(feet / 5))) cells)"
            : "\(jsNumber(feet))ft radius"
    }

    public static func formatCone(_ feet: Double, angle: Double = defaultConeAngle, showCells: Bool = true) -> String {
        let base = "\(jsNumber(feet))ft \(jsNumber(angle))° cone"
        return showCells ? "\(base) (\(jsNumber(jsRound(feet / 5))) cells)" : base
    }
}

/// Formats a number like JavaScript's `${n}`: integers without ".0".
public func jsNumber(_ value: Double) -> String {
    if value == value.rounded(), abs(value) < 1e15 {
        return String(Int64(value))
    }
    return "\(value)"
}

/// Cells reachable within a movement speed (CORE_SPEC §3.4): BFS from the cell
/// under the token's top-left, every step costs 1, in discovery order.
public func movementRange(
    tokenTopLeft: Point2D, speedFeet: Double, gridSize: Double, gridType: GridType
) -> [GridCell] {
    guard gridType != .hidden else { return [] }
    let grid = makeGridGeometry(gridType, cellSize: gridSize)
    let maxCells = Int((speedFeet / 5).rounded(.up))
    var queue: [(GridCell, Int)] = [(grid.pixelToGrid(tokenTopLeft), 0)]
    var head = 0
    var visited = Set<GridCell>()
    var result: [GridCell] = []
    while head < queue.count {
        let (cell, distance) = queue[head]
        head += 1
        if visited.contains(cell) || distance > maxCells { continue }
        visited.insert(cell)
        result.append(cell)
        for offset in grid.neighborOffsets {
            let next = GridCell(q: cell.q + offset.q, r: cell.r + offset.r)
            if !visited.contains(next) { queue.append((next, distance + 1)) }
        }
    }
    return result
}
