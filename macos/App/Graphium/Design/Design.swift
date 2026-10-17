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

/// App-owned radii (DESIGN.md#shapes): etched, never pill-shaped.
enum Radius {
    static let control: CGFloat = 4
    static let panel: CGFloat = 4
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

    /// Flat panel with a hairline edge (DESIGN.md#depth). For surfaces Graphium draws itself.
    func etchedPanel(padding: EdgeInsets = EdgeInsets(top: Spacing.sm, leading: Spacing.md, bottom: Spacing.sm, trailing: Spacing.md))
        -> some View
    {
        modifier(EtchedPanel(padding: padding))
    }
}

private struct EtchedPanel: ViewModifier {
    let padding: EdgeInsets
    @Environment(\.colorSchemeContrast) private var contrast

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Radius.panel, style: .continuous)
        content
            .foregroundStyle(Palette.inkPrimary.color)
            .padding(padding)
            .background(Palette.surfacePanel.color, in: shape)
            .overlay(
                shape.strokeBorder(
                    contrast == .increased ? Palette.ruleStrong.color : Palette.ruleHairline.color, lineWidth: 1))
    }
}
