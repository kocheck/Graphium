import AppKit
import GraphiumCore
import SwiftUI

/// The `I` colour picker (PARITY §1.4): swatches, recent colours and the system picker.
struct MarkerColorPopover: View {
    @Binding var color: Color
    let recent: [String]
    let choose: (String) -> Void

    static let swatches = [
        StrokeDefaults.markerColor, "#e5484d", "#f76b15", "#ffc53d", "#46a758", "#12a594",
        "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f", "#ffffff", "#8b8d98", "#000000",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Marker Colour").font(.headline)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(24), spacing: 6), count: 7), spacing: 6) {
                ForEach(Self.swatches, id: \.self) { hex in swatch(hex) }
            }
            if !recent.isEmpty {
                Text("Recent").font(.caption).foregroundStyle(.secondary)
                HStack(spacing: 6) { ForEach(recent, id: \.self) { hex in swatch(hex) } }
            }
            ColorPicker("Custom", selection: $color, supportsOpacity: false)
        }
        .padding(14)
        .frame(width: 230)
    }

    private func swatch(_ hex: String) -> some View {
        Button {
            choose(hex)
        } label: {
            Circle()
                .fill(Color(nsColor: NSColor(hex: hex) ?? .black))
                .overlay(Circle().strokeBorder(.separator))
                .frame(width: 22, height: 22)
        }
        .buttonStyle(.plain)
        .help(hex)
        .accessibilityLabel("Colour \(hex)")
    }
}
