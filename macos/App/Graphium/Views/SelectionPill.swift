import GraphiumCore
import SwiftUI

/// Where the canvas is looking, shared with the views that float over it. A plain class that the
/// Architect view holds but does not observe, so a pan or zoom redraws only the pill, not the window.
@MainActor
final class CanvasViewportModel: ObservableObject {
    @Published var viewport = Viewport()
}

/// A small glass pill that follows the selected tokens, with the two actions a DM reaches for first.
/// Each action is also a menu command (Session > Add Selection to Initiative, Map > Delete Selection),
/// so the pill is a shortcut and never the only way (rule card `glass-overlays`).
struct TokenSelectionPill: View {
    @ObservedObject var viewportModel: CanvasViewportModel
    /// The selected tokens' footprint in map units, or nil when no token is selected.
    let selectionBoundsInMapUnits: Bounds?
    let addToInitiative: (() -> Void)?
    let deleteSelection: () -> Void

    private let pillHeight: CGFloat = 40
    private let pillHalfWidth: CGFloat = 44
    private let gapToSelection: CGFloat = Spacing.sm

    var body: some View {
        GeometryReader { canvas in
            if let bounds = selectionBoundsInMapUnits {
                let viewport = viewportModel.viewport
                let topLeft = viewport.viewPoint(fromMap: Point2D(x: bounds.x, y: bounds.y))
                let selectionWidth = bounds.width * viewport.zoom
                let selectionHeight = bounds.height * viewport.zoom
                let centreX = min(max(topLeft.x + selectionWidth / 2, pillHalfWidth + Spacing.sm), canvas.size.width - pillHalfWidth - Spacing.sm)
                let aboveY = topLeft.y - gapToSelection - pillHeight / 2
                // Flip below the selection when there is no room above it.
                let centreY = aboveY < pillHeight / 2 + Spacing.sm
                    ? topLeft.y + selectionHeight + gapToSelection + pillHeight / 2
                    : aboveY
                pill
                    .position(x: centreX, y: centreY)
                    .transition(.opacity)
            }
        }
        .allowsHitTesting(selectionBoundsInMapUnits != nil)
    }

    private var pill: some View {
        HStack(spacing: Spacing.xs) {
            if let addToInitiative {
                pillButton("Add to Initiative", symbol: "list.number", action: addToInitiative)
            }
            pillButton("Delete", symbol: "trash", action: deleteSelection)
        }
        .glassPanel(.capsule, padding: EdgeInsets(top: Spacing.xs, leading: Spacing.sm, bottom: Spacing.xs, trailing: Spacing.sm))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Selection actions")
    }

    private func pillButton(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
        .accessibilityLabel(title)
    }
}
