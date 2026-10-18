import AppKit
import GraphiumCore

/// Note pins (native). In the Architect every pin shows: a white card with a note glyph for
/// a DM-only note and a speech bubble for a shared one, the private ones with a dashed edge.
/// The World View shows only shared pins, larger and on `world-action`, over the fog: the DM
/// chose to share them (decision 011). Architect titles sit on a `canvas-halo` plate and the
/// card casts a halo shadow, so both read on parchment as well as on black (decision 018).
extension MapCanvasNSView {
    /// On-screen points: half the pin's side, and with the slack, its hit radius.
    static let noteMarkerRadius = 12.0
    static let worldNoteMarkerRadius = 20.0

    var noteHitRadius: Double {
        ((isPlayerView ? Self.worldNoteMarkerRadius : Self.noteMarkerRadius) + 3) / viewport.zoom
    }

    func drawNotes(
        _ notes: [MapNote], moving: Set<String> = [], offset: CGSize = .zero, duplicate: Bool = false, context: CGContext
    ) {
        var drawn = notes
        if !moving.isEmpty, offset != .zero {
            let moved = notes.filter { moving.contains($0.id) }.map { note -> MapNote in
                var copy = note
                copy.x += offset.width
                copy.y += offset.height
                return copy
            }
            drawn = duplicate ? drawn + moved : drawn.filter { !moving.contains($0.id) } + moved
        }
        for note in drawn {
            if isPlayerView {
                guard note.isShared else { continue }
                drawWorldNote(note, context: context)
            } else {
                drawArchitectNote(note, context: context)
            }
        }
    }

    private func drawArchitectNote(_ note: MapNote, context: CGContext) {
        let zoom = viewport.zoom
        let r = Self.noteMarkerRadius / zoom
        let rect = CGRect(x: note.x - r, y: note.y - r, width: 2 * r, height: 2 * r)
        let card = CGPath(roundedRect: rect, cornerWidth: 5 / zoom, cornerHeight: 5 / zoom, transform: nil)
        context.saveGState()
        // A white card is 1.4:1 on parchment; the shadow gives it a dark edge to stand on.
        // Shadow blur is in base space, so it keeps its on-screen size without dividing by zoom.
        context.setShadow(offset: .zero, blur: 4, color: Palette.canvasHalo.nsColor.cgColor)
        context.addPath(card)
        context.setFillColor(NSColor.white.cgColor)
        context.fillPath()
        context.restoreGState()
        context.strokeMark(card, width: 1.5 / zoom, color: .black, dash: note.isShared ? nil : [3 / zoom, 2 / zoom])
        drawNoteSymbol(
            note.isShared ? "text.bubble.fill" : "note.text", centredAt: CGPoint(x: note.x, y: note.y), size: 12 / zoom,
            color: .black)
        if selection.contains(note.id) {
            let ring = rect.insetBy(dx: -4 / zoom, dy: -4 / zoom)
            context.strokeMark(
                CGPath(roundedRect: ring, cornerWidth: 8 / zoom, cornerHeight: 8 / zoom, transform: nil), width: 2 / zoom)
        }
        drawNoteTitle(note, below: rect, size: 11 / zoom, plate: true, context: context)
    }

    private func drawWorldNote(_ note: MapNote, context: CGContext) {
        let zoom = viewport.zoom
        let r = Self.worldNoteMarkerRadius / zoom
        let rect = CGRect(x: note.x - r, y: note.y - r, width: 2 * r, height: 2 * r)
        let card = CGPath(roundedRect: rect, cornerWidth: 8 / zoom, cornerHeight: 8 / zoom, transform: nil)
        context.saveGState()
        context.addPath(card)
        context.setFillColor(Palette.worldAction.nsColor.cgColor)
        context.fillPath()
        context.addPath(card)
        context.setStrokeColor(Palette.worldInk.nsColor.cgColor)
        context.setLineWidth(2.5 / zoom)
        context.strokePath()
        context.restoreGState()
        drawNoteSymbol(
            "text.bubble.fill", centredAt: CGPoint(x: note.x, y: note.y), size: 20 / zoom, color: Palette.worldInk.nsColor)
        // Projector legibility: 24 pt labels (world-view-player-safe).
        drawNoteTitle(note, below: rect, size: 24 / zoom, context: context)
    }

    /// With `plate`, the title sits on a `canvas-halo` backing: white on it is at least 7:1 over
    /// pure white map art (the outline alone is under half a point at 11 pt). Increase Contrast
    /// makes the plate opaque.
    private func drawNoteTitle(_ note: MapNote, below rect: CGRect, size: CGFloat, plate: Bool = false, context: CGContext) {
        let title = note.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let shown = title.count > 32 ? String(title.prefix(31)) + "…" : title
        let label = NSAttributedString.mapLabel(shown, font: NSFont.boldSystemFont(ofSize: size))
        let labelSize = label.size()
        let origin = NSPoint(x: rect.midX - labelSize.width / 2, y: rect.maxY + size * 0.3)
        if plate {
            let backing = CGRect(origin: origin, size: labelSize).insetBy(dx: -size * 0.4, dy: -size * 0.1)
            let halo = Palette.canvasHalo.nsColor
            context.saveGState()
            context.addPath(
                CGPath(roundedRect: backing, cornerWidth: size * 0.35, cornerHeight: size * 0.35, transform: nil))
            context.setFillColor((highContrast ? halo.withAlphaComponent(1) : halo).cgColor)
            context.fillPath()
            context.restoreGState()
        }
        label.draw(at: origin)
    }

    /// An SF Symbol in one colour, centred on `centre`. Token badges use it too.
    func drawNoteSymbol(_ name: String, centredAt centre: CGPoint, size: CGFloat, color: NSColor) {
        let config = NSImage.SymbolConfiguration(pointSize: size, weight: .bold)
            .applying(NSImage.SymbolConfiguration(paletteColors: [color]))
        guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(config)
        else { return }
        let rect = CGRect(
            x: centre.x - image.size.width / 2, y: centre.y - image.size.height / 2, width: image.size.width,
            height: image.size.height)
        image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    }
}
