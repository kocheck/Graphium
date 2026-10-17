import AppKit
import SwiftUI

/// App-owned spacing (DESIGN.md#layout). Native controls keep their own metrics.
enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    /// Pen and touch targets.
    static let hitMin: CGFloat = 44
}

/// App-owned radii (DESIGN.md#shapes). Small marks stay crisp; glass overlays are
/// capsules or 20 pt cards, concentric with the window corners.
enum Radius {
    static let control: CGFloat = 4
    /// World View panels keep the etched plate look (world-view-player-safe).
    static let panel: CGFloat = 4
    static let card: CGFloat = 20
}

/// The outline of a glass overlay (DESIGN.md#shapes).
enum GlassShape {
    /// Single-line controls and readouts: zoom buttons, status, toasts.
    case capsule
    /// Multi-line overlays: HUDs, progress.
    case card
}

/// Fast, decisive, no bounce (DESIGN.md#motion). Reduce Motion drops the animation, not the change.
enum Motion {
    static let quick = Animation.easeOut(duration: 0.15)
    static let panel = Animation.easeOut(duration: 0.2)

    static func animation(_ animation: Animation, reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : animation
    }
}

/// Readout type (DESIGN.md#typography): SF Mono-style monospaced digits for numbers a DM reads at a glance.
enum ReadoutFont {
    static func ns(size: CGFloat, weight: NSFont.Weight = .medium) -> NSFont {
        NSFont.monospacedDigitSystemFont(ofSize: size, weight: weight)
    }
}

extension View {
    /// A number as a display element: monospaced, medium weight.
    func readoutStyle(_ font: Font = .body) -> some View {
        self.font(font.monospaced().weight(.medium))
    }

    /// Floating glass over the map (DESIGN.md#depth). Only for overlays Graphium draws on the
    /// canvas; never inside the sidebar, inspector, a sheet or another glass surface.
    func glassPanel(
        _ shape: GlassShape = .card,
        padding: EdgeInsets = EdgeInsets(top: Spacing.sm, leading: Spacing.md, bottom: Spacing.sm, trailing: Spacing.md)
    ) -> some View {
        modifier(GlassPanel(shape: shape, padding: padding))
    }
}

private struct GlassPanel: ViewModifier {
    let shape: GlassShape
    let padding: EdgeInsets
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    private var outline: AnyShape {
        switch shape {
        case .capsule: AnyShape(Capsule(style: .continuous))
        case .card: AnyShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }

    func body(content: Content) -> some View {
        let padded = content.padding(padding)
        let edge = outline.stroke(
            contrast == .increased ? Palette.ruleStrong.color : Color.white.opacity(0.14),
            lineWidth: contrast == .increased ? 1 : 0.5)
        if reduceTransparency {
            // Reduce Transparency: the same shape, opaque, so the map never shows through.
            padded
                .background(Palette.surfacePanel.color, in: outline)
                .overlay(outline.stroke(Palette.ruleStrong.color, lineWidth: 1))
        } else {
            glass(padded).overlay(edge)
        }
    }

    #if compiler(>=6.2)
        @ViewBuilder
        private func glass(_ view: some View) -> some View {
            if #available(macOS 26, *) {
                view.glassEffect(.regular, in: outline)
            } else {
                material(view)
            }
        }
    #else
        private func glass(_ view: some View) -> some View { material(view) }
    #endif

    /// macOS 14 and 15: the closest system material, with a soft lift off the map.
    private func material(_ view: some View) -> some View {
        view
            .background(.regularMaterial, in: outline)
            .shadow(color: .black.opacity(0.3), radius: 14, y: 6)
    }
}
