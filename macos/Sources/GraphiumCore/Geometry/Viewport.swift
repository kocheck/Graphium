import Foundation

/// Viewport state for one canvas: which map point sits at the view origin, and the zoom.
public struct Viewport: Equatable, Sendable {
    public var origin: Point2D
    public var zoom: Double

    public init(origin: Point2D = .zero, zoom: Double = 1) {
        self.origin = origin
        self.zoom = zoom
    }

    public static let zoomRange: ClosedRange<Double> = 0.1...5

    public func viewPoint(fromMap point: Point2D) -> Point2D {
        Point2D(x: (point.x - origin.x) * zoom, y: (point.y - origin.y) * zoom)
    }

    public func mapPoint(fromView point: Point2D) -> Point2D {
        Point2D(x: point.x / zoom + origin.x, y: point.y / zoom + origin.y)
    }

    /// The map area a view of the given size shows (what "Show This View on World View"
    /// sends to the players' screen).
    public func visibleBounds(viewWidth: Double, viewHeight: Double) -> Bounds {
        Bounds(x: origin.x, y: origin.y, width: viewWidth / zoom, height: viewHeight / zoom)
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

    /// Fits `bounds` (map units) into a view of the given size, centred, with the
    /// zoom clamped to `zoomRange` (TS "Center on Party").
    public mutating func fit(_ bounds: Bounds, viewWidth: Double, viewHeight: Double) {
        guard bounds.width > 0, bounds.height > 0, viewWidth > 0, viewHeight > 0 else { return }
        let scale = min(viewWidth / bounds.width, viewHeight / bounds.height)
        zoom = min(max(scale, Self.zoomRange.lowerBound), Self.zoomRange.upperBound)
        origin = Point2D(
            x: bounds.x + bounds.width / 2 - viewWidth / (2 * zoom),
            y: bounds.y + bounds.height / 2 - viewHeight / (2 * zoom))
    }
}
