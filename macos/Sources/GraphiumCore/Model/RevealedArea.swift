import Foundation

/// Native only: ground the DM revealed by hand with the Reveal tool. Players see it as if a
/// PC saw it, lit, with any NPCs on it, so a table that plays with miniatures on the TV (and
/// no PC tokens on the map) still gets fog of war. Hiding an area again leaves it explored.
public struct RevealedArea: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    /// A closed polygon in map pixels (the Reveal tool makes rectangles).
    public var points: [Point2D]

    public init(id: String = newID(), points: [Point2D]) {
        self.id = id
        self.points = points
    }

    /// A rectangle, snapped outward to whole cells on square grids so it covers what the
    /// DM dragged over.
    public init(id: String = newID(), rect: Bounds, gridSize: Double, snap: Bool) {
        var r = rect
        if snap, gridSize > 0 {
            let x0 = (r.x / gridSize).rounded(.down) * gridSize
            let y0 = (r.y / gridSize).rounded(.down) * gridSize
            let x1 = ((r.x + r.width) / gridSize).rounded(.up) * gridSize
            let y1 = ((r.y + r.height) / gridSize).rounded(.up) * gridSize
            r = Bounds(x: x0, y: y0, width: max(x1 - x0, gridSize), height: max(y1 - y0, gridSize))
        }
        self.init(
            id: id,
            points: [
                Point2D(x: r.x, y: r.y), Point2D(x: r.x + r.width, y: r.y),
                Point2D(x: r.x + r.width, y: r.y + r.height), Point2D(x: r.x, y: r.y + r.height),
            ])
    }

    /// The centre of the area's bounding box and the distance to its farthest corner.
    var circle: (centre: Point2D, radius: Double) {
        let xs = points.map(\.x), ys = points.map(\.y)
        guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else {
            return (.zero, 0)
        }
        let centre = Point2D(x: (minX + maxX) / 2, y: (minY + maxY) / 2)
        return (centre, points.map { hypot($0.x - centre.x, $0.y - centre.y) }.max() ?? 0)
    }
}

extension GameMap {
    /// The revealed area containing `point`, topmost first.
    public func revealedArea(at point: Point2D) -> RevealedArea? {
        revealedAreas.last { LineOfSight.contains($0.points, point) }
    }
}
