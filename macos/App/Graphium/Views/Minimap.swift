import GraphiumCore
import SwiftUI

/// Camera state the minimap observes (kept out of the World View body so panning
/// doesn't recompute fog every frame).
@MainActor
final class MinimapModel: ObservableObject {
    @Published var viewport = Viewport()
    @Published var viewSize = CGSize.zero
}

/// World View minimap (PARITY §3.12): map (or party, or fixed) bounds, PCs as green dots,
/// the current view as a rectangle; click to recentre there.
struct Minimap: View {
    let map: GameMap
    let library: [String: TokenLibraryItem]
    @ObservedObject var model: MinimapModel
    let recentre: (Point2D) -> Void

    private let side: CGFloat = 200

    var body: some View {
        let world = worldBounds
        Canvas { context, size in
            guard world.width > 0, world.height > 0 else { return }
            let scale = min(size.width / world.width, size.height / world.height)
            func p(_ point: Point2D) -> CGPoint {
                CGPoint(x: (point.x - world.x) * scale, y: (point.y - world.y) * scale)
            }
            context.fill(Path(CGRect(origin: .zero, size: CGSize(width: world.width * scale, height: world.height * scale))),
                         with: .color(Palette.worldRule.color.opacity(0.4)))
            for token in map.tokens where ResolvedToken(token, library: library).type == .pc {
                let b = map.tokenBounds(token, library: library)
                let centre = p(Point2D(x: b.x + b.width / 2, y: b.y + b.height / 2))
                context.fill(Path(ellipseIn: CGRect(x: centre.x - 4, y: centre.y - 4, width: 8, height: 8)), with: .color(Palette.worldParty.color))
            }
            let v = model.viewport
            let topLeft = p(v.origin)
            let rect = CGRect(
                x: topLeft.x, y: topLeft.y, width: model.viewSize.width / v.zoom * scale,
                height: model.viewSize.height / v.zoom * scale)
            context.stroke(Path(rect), with: .color(Palette.worldFrame.color), lineWidth: 2)
        }
        .frame(width: side, height: side)
        .background(Palette.worldPanel.color, in: RoundedRectangle(cornerRadius: Radius.panel))
        .overlay(RoundedRectangle(cornerRadius: Radius.panel).strokeBorder(Palette.worldRule.color, lineWidth: 2))
        .contentShape(Rectangle())
        .onTapGesture { location in
            guard world.width > 0, world.height > 0 else { return }
            let scale = min(side / world.width, side / world.height)
            recentre(Point2D(x: world.x + location.x / scale, y: world.y + location.y / scale))
        }
        .accessibilityLabel("Minimap")
        .accessibilityHint("Click to move the view there")
    }

    /// The map image's extent, else the party's, else a fixed world, so the viewport
    /// rectangle and click-to-recentre always work (TS).
    private var worldBounds: Bounds { map.minimapBounds(library: library) }
}
