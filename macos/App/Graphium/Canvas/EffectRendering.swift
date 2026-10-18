import AppKit
import GraphiumCore

/// Spell effects (native, decision 015). Each look paints its area with a gradient in its own
/// colours and a pattern of its own (flames, bubbles, waves, shards, bolts, clouds, wisps, rays,
/// sparks), so looks never differ by colour alone, under a solid edge in the tint. The pattern is
/// seeded by the effect's id, so it holds still from frame to frame. In the Architect every effect
/// shows, the ones hidden from players with a dashed edge; the World View shows the rest, over
/// the fog, as shared note pins are: the DM chose to show them.
extension MapCanvasNSView {
    /// On-screen points: the origin handle's radius, and the hit slack around it.
    static let effectHandleRadius = 5.0

    var effectHitTolerance: Double { (Self.effectHandleRadius + 4) / viewport.zoom }

    /// `map` should already carry any live token drag, so carried effects follow it.
    func drawEffects(
        _ map: GameMap, moving: Set<String> = [], offset: CGSize = .zero, duplicate: Bool = false,
        preview: SpellEffect? = nil, context: CGContext
    ) {
        var drawn = map.effects
        if !moving.isEmpty, offset != .zero {
            let moved = drawn.filter { moving.contains($0.id) }.map { effect -> SpellEffect in
                var copy = effect
                copy.x += offset.width
                copy.y += offset.height
                if duplicate { copy.id = "preview-" + copy.id }
                return copy
            }
            drawn = duplicate ? drawn + moved : drawn.map { e in moved.first { $0.id == e.id } ?? e }
        }
        if let preview { drawn.append(preview) }
        for effect in drawn {
            if isPlayerView {
                // Never shown: hidden effects, and effects a hidden NPC carries (they'd give it away).
                guard !effect.isHidden, !(effect.tokenID.map(hiddenTokenIDs.contains) ?? false) else { continue }
            }
            let origin = map.effectOrigin(effect, library: library)
            let polygon = effect.polygon(origin: origin, gridSize: map.gridSize)
            guard polygon.count >= 3 else { continue }
            drawEffectArea(effect, polygon: polygon, origin: origin, gridSize: map.gridSize, context: context)
            if !isPlayerView {
                drawEffectHandle(effect, origin: origin, selected: selection.contains(effect.id), context: context)
                if selection.contains(effect.id) {
                    let path = CGMutablePath()
                    path.addPolygon(polygon)
                    context.strokeMark(path, width: 2 / viewport.zoom, dash: [6 / viewport.zoom, 4 / viewport.zoom])
                }
            }
            drawEffectLabel(effect, at: effect.labelPoint(origin: origin, gridSize: map.gridSize), context: context)
        }
    }

    private func drawEffectArea(
        _ effect: SpellEffect, polygon: [Point2D], origin: Point2D, gridSize: Double, context: CGContext
    ) {
        let tint = NSColor(hex: effect.tint) ?? .systemPurple
        let core = effect.color == nil ? (NSColor(hex: effect.look.core) ?? .white) : tint.blended(withFraction: 0.5, of: .white) ?? tint
        let length = effect.size / 5 * gridSize
        let path = CGMutablePath()
        path.addPolygon(polygon)

        context.saveGState()
        context.addPath(path)
        context.clip()
        // The fill: the core colour at the point of origin fading to the tint at the far edge.
        let colors = [core.withAlphaComponent(0.55).cgColor, tint.withAlphaComponent(0.42).cgColor, tint.withAlphaComponent(0.3).cgColor] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.6, 1]) {
            let centre = CGPoint(origin)
            context.drawRadialGradient(
                gradient, startCenter: centre, startRadius: 0, endCenter: centre, endRadius: max(1, length),
                options: [.drawsAfterEndLocation])
        }
        var random = SeededRandom(seed: effect.id)
        let box = path.boundingBoxOfPath
        drawLookPattern(effect.look, tint: tint, core: core, box: box, origin: origin, length: length, random: &random, context: context)
        context.restoreGState()

        // The edge: solid in the tint over a dark halo (dashed in the Architect when hidden from players).
        let width = (isPlayerView ? 3.0 : 2.5) / viewport.zoom
        context.strokeMark(
            path, width: width, color: tint, dash: !isPlayerView && effect.isHidden ? [8 / viewport.zoom, 5 / viewport.zoom] : nil)
    }

    // swiftlint:disable:next function_body_length
    private func drawLookPattern(
        _ look: SpellEffect.Look, tint: NSColor, core: NSColor, box: CGRect, origin: Point2D, length: Double,
        random: inout SeededRandom, context: CGContext
    ) {
        let cell = max(8, length / 6)
        let count = min(60, max(6, Int((box.width * box.height) / (cell * cell))))
        func spot() -> CGPoint {
            CGPoint(x: box.minX + random.next() * box.width, y: box.minY + random.next() * box.height)
        }
        let o = CGPoint(origin)
        switch look {
        case .fire:
            // Flames: soft hot blobs.
            for _ in 0..<count {
                let p = spot()
                let r = cell * (0.4 + random.next() * 0.8)
                let colors = [core.withAlphaComponent(0.55).cgColor, tint.withAlphaComponent(0).cgColor] as CFArray
                if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
                    context.drawRadialGradient(g, startCenter: p, startRadius: 0, endCenter: p, endRadius: r, options: [])
                }
            }
        case .acid, .poison:
            // Bubbles (acid) or a drifting cloud (poison).
            for _ in 0..<count {
                let p = spot()
                let r = cell * (look == .acid ? 0.15 + random.next() * 0.25 : 0.5 + random.next() * 0.7)
                let rect = CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)
                if look == .acid {
                    context.setStrokeColor(core.withAlphaComponent(0.8).cgColor)
                    context.setLineWidth(max(1, r * 0.25))
                    context.strokeEllipse(in: rect)
                } else {
                    context.setFillColor(core.withAlphaComponent(0.18).cgColor)
                    context.fillEllipse(in: rect)
                }
            }
        case .water:
            // Waves: rows of gentle curves.
            context.setStrokeColor(core.withAlphaComponent(0.7).cgColor)
            context.setLineWidth(max(1, cell * 0.12))
            context.setLineCap(.round)
            var y = box.minY + cell * 0.5
            var row = 0
            while y < box.maxY {
                let wave = CGMutablePath()
                var x = box.minX - cell + (row % 2 == 0 ? 0 : cell / 2)
                wave.move(to: CGPoint(x: x, y: y))
                while x < box.maxX + cell {
                    wave.addQuadCurve(to: CGPoint(x: x + cell, y: y), control: CGPoint(x: x + cell / 2, y: y - cell * 0.35))
                    x += cell
                }
                context.addPath(wave)
                context.strokePath()
                y += cell * 0.9
                row += 1
            }
        case .ice:
            // Shards: thin crystals with a cross.
            context.setStrokeColor(core.withAlphaComponent(0.8).cgColor)
            context.setLineWidth(max(1, cell * 0.08))
            for _ in 0..<count {
                let p = spot()
                let r = cell * (0.25 + random.next() * 0.35)
                let a = random.next() * .pi
                for turn in [0.0, .pi / 3, 2 * .pi / 3] {
                    context.move(to: CGPoint(x: p.x - r * cos(a + turn), y: p.y - r * sin(a + turn)))
                    context.addLine(to: CGPoint(x: p.x + r * cos(a + turn), y: p.y + r * sin(a + turn)))
                }
                context.strokePath()
            }
        case .lightning:
            // Bolts: zigzags out from the point of origin.
            context.setLineJoin(.miter)
            for bolt in 0..<max(4, count / 6) {
                let a = random.next() * 2 * .pi
                let reach = length * (0.6 + random.next() * 0.5)
                let path = CGMutablePath()
                path.move(to: o)
                let steps = 6
                for step in 1...steps {
                    let d = reach * Double(step) / Double(steps)
                    let jitter = (random.next() - 0.5) * cell * 1.2
                    path.addLine(
                        to: CGPoint(x: o.x + d * cos(a) - jitter * sin(a), y: o.y + d * sin(a) + jitter * cos(a)))
                }
                context.addPath(path)
                context.setStrokeColor(tint.withAlphaComponent(0.9).cgColor)
                context.setLineWidth(max(1.5, cell * (bolt % 2 == 0 ? 0.22 : 0.14)))
                context.strokePath()
                context.addPath(path)
                context.setStrokeColor(core.withAlphaComponent(0.95).cgColor)
                context.setLineWidth(max(0.75, cell * 0.07))
                context.strokePath()
            }
        case .necrotic:
            // Wisps: dark curls.
            context.setStrokeColor(core.withAlphaComponent(0.55).cgColor)
            context.setLineWidth(max(1, cell * 0.18))
            context.setLineCap(.round)
            for _ in 0..<count {
                let p = spot()
                let r = cell * (0.4 + random.next() * 0.6)
                let a = random.next() * 2 * .pi
                context.addArc(center: p, radius: r, startAngle: a, endAngle: a + .pi * 1.2, clockwise: false)
                context.strokePath()
            }
        case .radiant:
            // Rays: spokes from the point of origin.
            context.setStrokeColor(core.withAlphaComponent(0.6).cgColor)
            context.setLineCap(.round)
            let spokes = 24
            for i in 0..<spokes {
                let a = Double(i) / Double(spokes) * 2 * .pi + random.next() * 0.1
                context.setLineWidth(max(1, cell * (i % 2 == 0 ? 0.25 : 0.12)))
                context.move(to: o)
                context.addLine(to: CGPoint(x: o.x + length * 1.2 * cos(a), y: o.y + length * 1.2 * sin(a)))
                context.strokePath()
            }
        case .arcane:
            // Sparks: four-pointed stars.
            context.setFillColor(core.withAlphaComponent(0.85).cgColor)
            for _ in 0..<count {
                let p = spot()
                let r = cell * (0.15 + random.next() * 0.25)
                let star = CGMutablePath()
                for i in 0..<8 {
                    let a = Double(i) * .pi / 4
                    let d = i % 2 == 0 ? r : r * 0.3
                    let q = CGPoint(x: p.x + d * cos(a), y: p.y + d * sin(a))
                    if i == 0 { star.move(to: q) } else { star.addLine(to: q) }
                }
                star.closeSubpath()
                context.addPath(star)
                context.fillPath()
            }
        }
    }

    /// The point of origin (Architect): a small dot the DM grabs to move the effect.
    private func drawEffectHandle(_ effect: SpellEffect, origin: Point2D, selected: Bool, context: CGContext) {
        let r = Self.effectHandleRadius / viewport.zoom
        let rect = CGRect(x: origin.x - r, y: origin.y - r, width: 2 * r, height: 2 * r)
        context.saveGState()
        context.setFillColor(NSColor.white.cgColor)
        context.fillEllipse(in: rect)
        context.restoreGState()
        context.strokeMark(
            CGPath(ellipseIn: rect, transform: nil), width: 1.5 / viewport.zoom,
            color: selected ? Palette.canvasSelection.nsColor : .black)
    }

    private func drawEffectLabel(_ effect: SpellEffect, at point: Point2D, context: CGContext) {
        // Projector legibility: 18 pt labels (world-view-player-safe).
        let size = (isPlayerView ? 18 : 12) / viewport.zoom
        let text = effect.displayLabel
        let shown = text.count > 32 ? String(text.prefix(31)) + "…" : text
        let label = NSAttributedString.mapLabel(shown, font: NSFont.boldSystemFont(ofSize: size))
        let labelSize = label.size()
        label.draw(at: NSPoint(x: point.x - labelSize.width / 2, y: point.y - labelSize.height / 2))
    }
}

/// A small deterministic generator (SplitMix64) seeded from a string, so an effect's pattern is the
/// same every frame and on every Mac.
struct SeededRandom {
    private var state: UInt64

    init(seed: String) {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325  // FNV-1a
        for byte in seed.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100_0000_01b3
        }
        state = hash
    }

    /// In [0, 1).
    mutating func next() -> Double {
        state &+= 0x9e37_79b9_7f4a_7c15
        var z = state
        z = (z ^ (z >> 30)) &* 0xbf58_476d_1ce4_e5b9
        z = (z ^ (z >> 27)) &* 0x94d0_49bb_1331_11eb
        z ^= z >> 31
        return Double(z >> 11) / Double(1 << 53)
    }
}
