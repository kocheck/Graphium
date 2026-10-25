import AppKit
import SwiftUI

/// App-owned spacing (DESIGN.md#layout). Native controls keep their own metrics.
enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    /// Hero and section breathing room (Welcome).
    static let xxl: CGFloat = 32
    /// Pen and touch targets.
    static let hitMin: CGFloat = 44
}

/// App-owned radii (DESIGN.md#shapes). Small marks stay crisp; glass overlays are
/// capsules or 12 pt cards, concentric with the window corners.
enum Radius {
    static let control: CGFloat = 4
    static let card: CGFloat = 12
    /// Thumbnails and cards inside app-owned panels (decision 019).
    static let tile: CGFloat = 8
}

/// The outline of a glass overlay (DESIGN.md#shapes).
enum GlassShape {
    /// Single-line controls and readouts: zoom buttons, status, toasts.
    case capsule
    /// Multi-line overlays: HUDs, progress.
    case card
}

/// Padding for a one-line glass message (toast, banner, pause and fog capsules), set in from the
/// leading edge to clear the capsule's curve and tighter on the trailing side for its close or action button.
enum GlassPadding {
    static let message = EdgeInsets(top: Spacing.sm, leading: Spacing.lg, bottom: Spacing.sm, trailing: Spacing.md)
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

    /// A raised tile on `surface-panel` (DESIGN.md#components): hairline edge, no shadow, a small lift on hover.
    /// Hover only moves the tile; it never reveals a control.
    func tileSurface() -> some View {
        modifier(TileSurface())
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

private struct TileSurface: ViewModifier {
    @State private var isHovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let outline = RoundedRectangle(cornerRadius: Radius.tile, style: .continuous)
        content
            .background(Palette.surfaceRaised.color, in: outline)
            .overlay(outline.strokeBorder(Palette.ruleHairline.color, lineWidth: 1))
            .offset(y: isHovering ? -2 : 0)
            .animation(Motion.animation(Motion.quick, reduceMotion: reduceMotion), value: isHovering)
            .onHover { isHovering = $0 }
    }
}
