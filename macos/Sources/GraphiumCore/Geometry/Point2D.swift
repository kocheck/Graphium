import Foundation

/// A 2-D point in map (world) or view coordinates. JSON shape `{ "x": …, "y": … }`
/// matches the TS `Point` type. The core avoids CoreGraphics so it stays portable.
public struct Point2D: Codable, Hashable, Sendable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    public static let zero = Point2D(x: 0, y: 0)
}

/// JavaScript `Math.round`: halves round toward +infinity (`-2.5 → -2`, `2.5 → 3`).
/// Swift's `.rounded()` rounds halves away from zero, which shifts snapping on
/// negative coordinates. See docs/CORE_SPEC.md rule R1.
@inlinable
public func jsRound(_ value: Double) -> Double {
    (value + 0.5).rounded(.down)
}
