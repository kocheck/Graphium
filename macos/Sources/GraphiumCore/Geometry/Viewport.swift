import Foundation

/// Viewport state for one canvas: which map point sits at the view origin, and the zoom.
public struct Viewport: Equatable, Sendable {
    public var origin: Point2D
    public var zoom: Double

    public init(origin: Point2D = .zero, zoom: Double = 1) {
        self.origin = origin
        self.zoom = zoom
    }

    public static let zoomRange: ClosedRange<Double> = 0.1...8

    public func viewPoint(fromMap point: Point2D) -> Point2D {
        Point2D(x: (point.x - origin.x) * zoom, y: (point.y - origin.y) * zoom)
    }

    public func mapPoint(fromView point: Point2D) -> Point2D {
        Point2D(x: point.x / zoom + origin.x, y: point.y / zoom + origin.y)
    }

    /// Zooms by `factor` keeping the map point under `anchor` (view coordinates) fixed.
    public mutating func zoom(by factor: Double, around anchor: Point2D) {
        let pinned = mapPoint(fromView: anchor)
        zoom = min(max(zoom * factor, Self.zoomRange.lowerBound), Self.zoomRange.upperBound)
        origin = Point2D(x: pinned.x - anchor.x / zoom, y: pinned.y - anchor.y / zoom)
    }

    /// Pans by a drag of (`dx`, `dy`) view points: the map moves with the fingers.
    public mutating func pan(byViewDX dx: Double, dy: Double) {
        origin.x -= dx / zoom
        origin.y -= dy / zoom
    }
}
