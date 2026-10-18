import Foundation

/// Real-world size on a display, for tables that put miniatures on a flat TV: one grid
/// square at exactly one inch (25.4 mm), the size of a standard mini's base.
public enum PhysicalScale {
    public static let millimetersPerInch = 25.4

    /// Screen points per physical inch, from the display's width in points and in mm
    /// (what the display reports through EDID).
    public static func pointsPerInch(widthPoints: Double, widthMillimeters: Double) -> Double? {
        guard widthPoints > 0, widthMillimeters > 0 else { return nil }
        return widthPoints / (widthMillimeters / millimetersPerInch)
    }

    /// Screen points per physical inch, from the diagonal the DM typed (for TVs that report
    /// a wrong size or none) and the display's shape in points.
    public static func pointsPerInch(diagonalInches: Double, widthPoints: Double, heightPoints: Double) -> Double? {
        guard diagonalInches > 0, widthPoints > 0, heightPoints > 0 else { return nil }
        return (widthPoints * widthPoints + heightPoints * heightPoints).squareRoot() / diagonalInches
    }

    /// The canvas zoom (view points per map unit) at which one `gridSize` square is one inch.
    public static func inchGridZoom(gridSize: Double, pointsPerInch: Double) -> Double? {
        guard gridSize > 0, pointsPerInch > 0 else { return nil }
        return pointsPerInch / gridSize
    }

    /// The map area to fit so a view of the given size shows `zoom`, keeping `center` in the
    /// middle. Same shape as the view, so `Viewport.fit` lands on exactly that zoom.
    public static func bounds(center: Point2D, zoom: Double, viewWidth: Double, viewHeight: Double) -> Bounds {
        let width = viewWidth / zoom
        let height = viewHeight / zoom
        return Bounds(x: center.x - width / 2, y: center.y - height / 2, width: width, height: height)
    }
}
