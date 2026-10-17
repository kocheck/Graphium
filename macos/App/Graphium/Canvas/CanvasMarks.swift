import AppKit

/// Marks Graphium draws over map art (selection, handles, labels) sit on a dark halo so
/// they read on any map (design harness card canvas-marks-read-on-any-map).
extension CGContext {
    /// Strokes `path` twice: a wider solid halo, then `color` (dashed when `dash` is set).
    /// `width` is in the context's current units, so callers divide by zoom as usual.
    func strokeMark(
        _ path: CGPath, width: CGFloat, color: NSColor = Palette.canvasSelection.nsColor, dash: [CGFloat]? = nil
    ) {
        saveGState()
        setShadow(offset: .zero, blur: 0, color: nil)
        addPath(path)
        setStrokeColor(Palette.canvasHalo.nsColor.cgColor)
        setLineWidth(width * 2)
        setLineDash(phase: 0, lengths: [])
        strokePath()
        addPath(path)
        setStrokeColor(color.cgColor)
        setLineWidth(width)
        if let dash { setLineDash(phase: 0, lengths: dash) }
        strokePath()
        restoreGState()
    }
}

extension NSAttributedString {
    /// Map text: white with a dark outline, so it reads on parchment and black alike.
    static func mapLabel(_ string: String, font: NSFont) -> NSAttributedString {
        NSAttributedString(
            string: string,
            attributes: [
                .font: font,
                .foregroundColor: NSColor.white,
                .strokeColor: Palette.canvasHalo.nsColor.withAlphaComponent(1),
                // Negative width strokes and fills; the value is a percentage of the point size.
                .strokeWidth: -4,
            ])
    }
}
