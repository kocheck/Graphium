import SwiftUI

/// Floating map controls, bottom-trailing as in Maps: zoom in and out, and frame the whole map.
/// Each one is also in the View menu with its shortcut.
struct MapZoomControls: View {
    let zoomIn: () -> Void
    let zoomOut: () -> Void
    let zoomToFit: () -> Void

    private static let inset = EdgeInsets(top: 2, leading: 2, bottom: 2, trailing: 2)

    var body: some View {
        VStack(spacing: Spacing.sm) {
            VStack(spacing: 0) {
                control("Zoom In", symbol: "plus", help: "Zoom In (⌘=)", action: zoomIn)
                Divider().frame(width: 20)
                control("Zoom Out", symbol: "minus", help: "Zoom Out (⌘-)", action: zoomOut)
            }
            .glassPanel(.capsule, padding: Self.inset)
            control("Zoom to Fit", symbol: "arrow.up.left.and.arrow.down.right", help: "Zoom to Fit (⌘0)", action: zoomToFit)
                .glassPanel(.capsule, padding: Self.inset)
        }
    }

    private func control(_ title: String, symbol: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .labelStyle(.iconOnly)
                .font(.system(size: 14, weight: .medium))
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

/// Bottom-leading readout: zoom level and a one-cell scale bar, as Maps shows its scale.
struct MapScaleReadout: View {
    let zoom: Double
    let gridSize: Double

    var body: some View {
        let percent = Int((zoom * 100).rounded())
        let cell = gridSize * zoom
        HStack(spacing: Spacing.md) {
            Text("\(percent)%")
            // One grid cell is 5 ft (Measure.cellCount); hide the bar when it would be unreadable.
            if (8...160).contains(cell) {
                HStack(spacing: 6) {
                    ScaleBar()
                        .stroke(.secondary, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                        .frame(width: cell, height: 6)
                    Text("5 ft")
                }
            }
        }
        .readoutStyle(.callout)
        .foregroundStyle(.secondary)
        .glassPanel(.capsule, padding: EdgeInsets(top: 7, leading: 14, bottom: 7, trailing: 14))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Zoom \(percent) percent. One grid cell is 5 feet.")
    }
}

/// A baseline with end ticks.
private struct ScaleBar: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return path
    }
}
