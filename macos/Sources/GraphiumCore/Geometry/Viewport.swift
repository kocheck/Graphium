import Foundation

/// Viewport state for one canvas: which map point sits at the view origin, and the zoom.
public struct Viewport: Equatable, Sendable {
    public var origin: CGPoint
    public var zoom: CGFloat

    public init(origin: CGPoint = .zero, zoom: CGFloat = 1) {
        self.origin = origin
        self.zoom = zoom
    }

    public static let zoomRange: ClosedRange<CGFloat> = 0.1...8

    public func viewPoint(fromMap point: CGPoint) -> CGPoint {
        CGPoint(x: (point.x - origin.x) * zoom, y: (point.y - origin.y) * zoom)
    }

    public func mapPoint(fromView point: CGPoint) -> CGPoint {
        CGPoint(x: point.x / zoom + origin.x, y: point.y / zoom + origin.y)
    }

    /// Zooms by `factor` keeping the map point under `anchor` (view coordinates) fixed.
    public mutating func zoom(by factor: CGFloat, around anchor: CGPoint) {
        let pinned = mapPoint(fromView: anchor)
        zoom = min(max(zoom * factor, Self.zoomRange.lowerBound), Self.zoomRange.upperBound)
        origin = CGPoint(x: pinned.x - anchor.x / zoom, y: pinned.y - anchor.y / zoom)
    }

    public mutating func pan(byView delta: CGSize) {
        origin.x -= delta.width / zoom
        origin.y -= delta.height / zoom
    }
}
