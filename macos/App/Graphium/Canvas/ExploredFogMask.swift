import CoreGraphics
import GraphiumCore

/// The union of explored regions as a cached greyscale mask in fog-bounds space
/// (PARITY §3.7, TS `FogOfWarLayer`'s offscreen canvas). New regions are stamped
/// onto the existing bitmap; it is rebuilt only when `ExploredMaskPlan` says the
/// history or bounds changed. Each frame then composites one image instead of
/// filling every explored polygon again.
final class ExploredFogMask {
    /// Longest side of the bitmap in pixels (8-bit grey: 16 MB at most). Larger fog
    /// bounds are downsampled; explored edges are soft anyway.
    private static let maxSide = 4096.0
    /// Up to 2 pixels per map unit so moderate zoom stays crisp on Retina displays.
    private static let maxScale = 2.0

    private var context: CGContext?
    private var plan: ExploredMaskPlan?
    private var cachedImage: CGImage?

    /// The mask for `regions` (white where explored, black elsewhere), covering `bounds`,
    /// for `CGContext.clip(to:mask:)`; nil when nothing is explored or the bounds are degenerate.
    func image(mapID: String, bounds: Bounds, regions: [ExploredRegion]) -> CGImage? {
        switch ExploredMaskPlan.update(from: plan, mapID: mapID, bounds: bounds, regions: regions) {
        case .unchanged:
            return cachedImage
        case .append(from: let start):
            if let context {
                stamp(regions[start...], into: context)
            } else {
                rebuild(bounds: bounds, regions: regions)
            }
        case .rebuild:
            rebuild(bounds: bounds, regions: regions)
        }
        plan = ExploredMaskPlan(mapID: mapID, bounds: bounds, regions: regions)
        cachedImage = regions.isEmpty ? nil : context?.makeImage()
        return cachedImage
    }

    private func rebuild(bounds: Bounds, regions: [ExploredRegion]) {
        context = nil
        guard !regions.isEmpty, bounds.width > 0, bounds.height > 0, bounds.width.isFinite, bounds.height.isFinite
        else { return }
        let scale = min(Self.maxScale, Self.maxSide / max(bounds.width, bounds.height))
        let width = max(1, Int((bounds.width * scale).rounded(.up)))
        let height = max(1, Int((bounds.height * scale).rounded(.up)))
        guard
            let mask = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)
        else { return }
        mask.setFillColor(CGColor(gray: 0, alpha: 1))
        mask.fill(CGRect(x: 0, y: 0, width: width, height: height))
        // Map space, top row first, so the image draws upright like any other in the flipped canvas.
        mask.translateBy(x: 0, y: CGFloat(height))
        mask.scaleBy(x: CGFloat(Double(width) / bounds.width), y: CGFloat(-Double(height) / bounds.height))
        mask.translateBy(x: -bounds.x, y: -bounds.y)
        mask.setFillColor(CGColor(gray: 1, alpha: 1))
        context = mask
        stamp(regions[...], into: mask)
    }

    /// Solid fills, so overlapping regions form one union (the canvas applies the 80%).
    /// One fill per region, so opposite windings can't cancel out.
    private func stamp(_ regions: ArraySlice<ExploredRegion>, into context: CGContext) {
        for region in regions where region.points.count >= 3 {
            let path = CGMutablePath()
            path.addPolygon(region.points)
            context.addPath(path)
            context.fillPath()
        }
    }
}
