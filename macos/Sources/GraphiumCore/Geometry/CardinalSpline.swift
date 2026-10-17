import Foundation

/// One step of a 2D path, for renderers to replay (CGPath and friends).
public enum PathElement: Equatable, Sendable {
    case move(to: Point2D)
    case line(to: Point2D)
    case quadCurve(to: Point2D, control: Point2D)
    case curve(to: Point2D, control1: Point2D, control2: Point2D)
}

/// Konva `Line` with `tension` (TS marker and eraser strokes use 0.5; PARITY §3.5):
/// a cardinal spline through every point, drawn as Bézier segments exactly as
/// Konva's scene function does for an open line.
public enum CardinalSpline {
    public static let strokeTension = 0.5

    /// Konva `Util._getControlPoints`: the incoming and outgoing control points at
    /// `p1`, scaled by the neighbouring segment lengths. Coincident points give `p1`.
    public static func controlPoints(
        _ p0: Point2D, _ p1: Point2D, _ p2: Point2D, tension: Double
    ) -> (incoming: Point2D, outgoing: Point2D) {
        let d01 = Measure.euclideanDistance(p0, p1)
        let d12 = Measure.euclideanDistance(p1, p2)
        guard d01 + d12 > 0 else { return (p1, p1) }
        let fa = tension * d01 / (d01 + d12)
        let fb = tension * d12 / (d01 + d12)
        return (
            Point2D(x: p1.x - fa * (p2.x - p0.x), y: p1.y - fa * (p2.y - p0.y)),
            Point2D(x: p1.x + fb * (p2.x - p0.x), y: p1.y + fb * (p2.y - p0.y))
        )
    }

    /// The open path through `points`. One point is a zero-length line (a dot); two
    /// points, or zero tension, are straight segments (Konva needs 3+ points to curve).
    /// Otherwise: a quadratic into the second point, cubics between interior points,
    /// and a quadratic out to the last point.
    public static func path(through points: [Point2D], tension: Double = strokeTension) -> [PathElement] {
        guard let first = points.first else { return [] }
        guard points.count > 2, tension != 0 else {
            let rest = points.count == 1 ? [first] : Array(points.dropFirst())
            return [PathElement.move(to: first)] + rest.map { PathElement.line(to: $0) }
        }
        let n = points.count
        // controls[i] belongs to interior point i (index 0 and n−1 unused).
        var controls: [(incoming: Point2D, outgoing: Point2D)] = Array(repeating: (incoming: first, outgoing: first), count: n)
        for i in 1..<(n - 1) {
            controls[i] = controlPoints(points[i - 1], points[i], points[i + 1], tension: tension)
        }
        var elements: [PathElement] = [.move(to: first), .quadCurve(to: points[1], control: controls[1].incoming)]
        for i in 1..<(n - 2) {
            elements.append(.curve(to: points[i + 1], control1: controls[i].outgoing, control2: controls[i + 1].incoming))
        }
        elements.append(.quadCurve(to: points[n - 1], control: controls[n - 2].outgoing))
        return elements
    }
}
