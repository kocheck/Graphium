import AppKit
import GraphiumCore
import GraphiumRender

/// Map-layer rendering beyond the grid and tokens: ink, doors, stairs, and the
/// Architect/World overlays. Everything draws in map coordinates.
extension MapCanvasNSView {
    /// Markers, erasers and walls share one transparency layer, so an eraser stroke
    /// removes ink (including wall lines) but never the map or tokens (PARITY §3.5).
    /// Wall *geometry* for vision is unaffected by erasing. Walls leave a gap under each
    /// door in `gaps` (open doors on a wall, `LineOfSight.wallGaps`), as vision does.
    func drawInk(_ drawings: [Drawing], live: Drawing?, gaps: [Door] = [], context: CGContext) {
        let all = live.map { drawings + [$0] } ?? drawings
        guard !all.isEmpty else { return }
        var gapClip: CGPath?
        if !gaps.isEmpty {
            let path = CGMutablePath()
            path.addRect(CGRect(x: -1e7, y: -1e7, width: 2e7, height: 2e7))
            for door in gaps {
                let transform = CGAffineTransform(translationX: door.x, y: door.y).rotated(by: door.radians)
                path.addRect(CGRect(x: -door.size / 2, y: -12, width: door.size, height: 24), transform: transform)
            }
            gapClip = path
        }
        context.saveGState()
        context.beginTransparencyLayer(auxiliaryInfo: nil)
        for drawing in all {
            drawStroke(drawing, gapClip: drawing.tool == .wall ? gapClip : nil, context: context)
        }
        context.endTransparencyLayer()
        context.restoreGState()
    }

    private func drawStroke(_ drawing: Drawing, gapClip: CGPath?, context: CGContext) {
        let points = drawing.worldPoints
        guard let first = points.first else { return }
        let scale = drawing.scale ?? 1
        context.saveGState()
        if let gapClip {
            context.addPath(gapClip)
            context.clip(using: .evenOdd)
        }
        context.setLineCap(.round)
        context.setLineJoin(.round)
        switch drawing.tool {
        case .eraser:
            context.setBlendMode(.clear)
            context.setStrokeColor(NSColor.black.cgColor)
        case .wall:
            // Walls stay straight so they match the vision segments (PARITY §3.5). Kinds differ
            // by shape, not colour: a window is dotted, a one-way wall has ticks on its blocked side.
            let isWindow = drawing.wallKind == .window
            if isPlayerView {
                // World View: black 6px, solid for walls and dotted for windows (decision 008).
                context.setStrokeColor(NSColor.black.cgColor)
                context.setLineWidth(6)
                if isWindow { context.setLineDash(phase: 0, lengths: [0.01, 14]) }
            } else {
                let width = drawing.size * scale
                context.setStrokeColor((NSColor(hex: drawing.color) ?? .systemRed).cgColor)
                context.setLineWidth(width)
                context.setLineDash(phase: 0, lengths: isWindow ? [0.01, width * 2] : [10, 5])
            }
            context.move(to: CGPoint(first))
            if points.count == 1 {
                context.addLine(to: CGPoint(first))  // a dot
            }
            for p in points.dropFirst() { context.addLine(to: CGPoint(p)) }
            context.strokePath()
            if drawing.oneWay == true, !isPlayerView {
                drawOneWayTicks(points, width: drawing.size * scale, context: context)
            }
            context.restoreGState()
            return
        case .marker:
            context.setStrokeColor((NSColor(hex: drawing.color) ?? .labelColor).cgColor)
        }
        // Marker and eraser.
        if let pressures = drawing.pressures, pressures.count == points.count, points.count > 1 {
            // Variable width: one segment at a time.
            for i in 1..<points.count {
                let p = (pressures[i - 1] + pressures[i]) / 2
                context.setLineWidth(toolState.pressureCurve.width(base: drawing.size * scale, pressure: p))
                context.move(to: CGPoint(points[i - 1]))
                context.addLine(to: CGPoint(points[i]))
                context.strokePath()
            }
            context.restoreGState()
            return
        }
        // Without pressure, a 0.5-tension cardinal spline (TS Konva `tension={0.5}`).
        context.setLineWidth(drawing.size * scale)
        let path = CGMutablePath()
        path.addElements(CardinalSpline.path(through: points))
        context.addPath(path)
        context.strokePath()
        context.restoreGState()
    }

    /// Short ticks on the side a one-way wall blocks: the right of its points as drawn on
    /// screen, since sight passes from the left (`WallSegment.letsSightThrough`).
    private func drawOneWayTicks(_ points: [Point2D], width: Double, context: CGContext) {
        let spacing = max(width * 3, 16)
        let length = max(width * 1.5, 8)
        context.setLineDash(phase: 0, lengths: [])
        context.setLineWidth(max(width / 3, 2))
        for (a, b) in zip(points, points.dropFirst()) {
            let dx = b.x - a.x
            let dy = b.y - a.y
            let segment = hypot(dx, dy)
            guard segment > 0 else { continue }
            // Map y points down, so (−dy, dx) is the on-screen right of a → b.
            let normal = CGPoint(x: -dy / segment * length, y: dx / segment * length)
            var t = spacing / 2
            while t < segment {
                let p = CGPoint(x: a.x + dx * t / segment, y: a.y + dy * t / segment)
                context.move(to: p)
                context.addLine(to: CGPoint(x: p.x + normal.x, y: p.y + normal.y))
                t += spacing
            }
        }
        context.strokePath()
    }

    /// Doors in the Architect's look: wood with a black edge, swinging open about the hinge.
    /// A hidden door is drawn faded with a dashed edge and an eye-slash, so the DM always
    /// knows it is there and that players don't. The World View draws doors with
    /// `drawWorldDoors` instead, and its shut hidden doors with `drawSecretDoorWalls`.
    func drawDoors(_ doors: [Door], context: CGContext) {
        for door in doors {
            let thickness = door.thickness ?? max(6, door.size * 0.16)
            let half = door.size / 2
            let hidden = door.isHidden == true
            // Drawn in the door's own frame: centre at the origin, hinge at (−half, 0), latch along +x.
            let frame = CGAffineTransform(translationX: door.x, y: door.y).rotated(by: door.radians)
            let closed = CGRect(x: -half, y: -thickness / 2, width: door.size, height: thickness)
            let openFraction = CGFloat(doorSwings.openFraction(for: door, in: self))
            context.saveGState()
            context.concatenate(frame)
            let fill = NSColor(srgbRed: 0.55, green: 0.36, blue: 0.2, alpha: hidden ? 0.45 : 1)
            context.setStrokeColor(NSColor.black.cgColor)
            context.setLineWidth(1.5)
            if hidden { context.setLineDash(phase: 0, lengths: [4, 3]) }
            if openFraction > 0 {
                // Swung up to 90° about the hinge end (animated, TS DoorShape), with the swing arc.
                // The leaf turns towards the door's on-screen left (−y for a horizontal door, +x for a vertical one).
                let hinge = CGPoint(x: -half, y: 0)
                let leafAngle = -.pi / 2 * openFraction
                context.saveGState()
                context.translateBy(x: hinge.x, y: hinge.y)
                context.rotate(by: leafAngle)
                let leaf = CGRect(x: 0, y: -thickness / 2, width: door.size, height: thickness)
                context.setFillColor(fill.withAlphaComponent(fill.alphaComponent * (1 - 0.15 * openFraction)).cgColor)
                context.fill(leaf)
                context.stroke(leaf)
                context.restoreGState()
                context.setLineDash(phase: 0, lengths: [4, 4])
                context.setLineWidth(1)
                context.addArc(center: hinge, radius: door.size, startAngle: leafAngle, endAngle: 0, clockwise: false)
                context.strokePath()
            } else {
                context.setFillColor(fill.cgColor)
                context.fill(closed)
                context.stroke(closed)
            }
            context.restoreGState()
            drawDoorGlyphs(door, locked: door.isLocked, hidden: hidden, context: context)
            if selection.contains(door.id) {
                var transform = frame
                context.strokeMark(
                    CGPath(rect: closed.insetBy(dx: -4, dy: -4), transform: &transform), width: 2 / viewport.zoom)
            }
        }
    }

    /// The World View's doors, drawn over the fog in the ink-on-paper look of its walls (an
    /// old-school map door): a paper slab outlined in heavy ink across the wall, with a jamb at
    /// each end so the doorway still reads when the door stands open. Only doors the players
    /// know (`LineOfSight.knownDoors`) are passed in.
    func drawWorldDoors(_ doors: [Door], context: CGContext) {
        let ink = NSColor.black.cgColor
        let paper = NSColor(white: FogShading.paper, alpha: 1).cgColor
        for door in doors {
            let half = door.size / 2
            let slab = max(10, door.size * 0.26)
            let jamb = slab * 0.75
            let openFraction = CGFloat(doorSwings.openFraction(for: door, in: self))
            context.saveGState()
            context.concatenate(CGAffineTransform(translationX: door.x, y: door.y).rotated(by: door.radians))
            context.setStrokeColor(ink)
            context.setLineJoin(.miter)
            // Jambs: short ink bars across the wall line at both ends of the doorway.
            context.setLineCap(.butt)
            context.setLineWidth(5)
            for x in [-half, half] {
                context.move(to: CGPoint(x: x, y: -jamb))
                context.addLine(to: CGPoint(x: x, y: jamb))
            }
            context.strokePath()
            context.setLineWidth(3)
            if openFraction > 0 {
                // The leaf swings about the hinge as in the Architect, with a dashed arc.
                let hinge = CGPoint(x: -half, y: 0)
                let leafAngle = -.pi / 2 * openFraction
                context.saveGState()
                context.translateBy(x: hinge.x, y: hinge.y)
                context.rotate(by: leafAngle)
                let leaf = CGRect(x: 0, y: -slab / 4, width: door.size, height: slab / 2)
                context.setFillColor(paper)
                context.fill(leaf)
                context.stroke(leaf)
                context.restoreGState()
                context.setLineDash(phase: 0, lengths: [6, 5])
                context.setLineWidth(2)
                context.addArc(center: hinge, radius: door.size, startAngle: leafAngle, endAngle: 0, clockwise: false)
                context.strokePath()
            } else {
                let rect = CGRect(x: -half, y: -slab / 2, width: door.size, height: slab)
                context.setFillColor(paper)
                context.fill(rect)
                context.stroke(rect)
            }
            context.restoreGState()
            drawDoorGlyphs(door, locked: door.isLocked, hidden: false, context: context)
        }
    }

    /// Shut hidden doors on the World View: the same black 6-unit line as a wall, drawn under
    /// the fog with the walls, so players can't tell them from wall.
    func drawSecretDoorWalls(_ doors: [Door], context: CGContext) {
        context.saveGState()
        context.setStrokeColor(NSColor.black.cgColor)
        context.setLineWidth(6)
        context.setLineCap(.round)
        for door in doors where door.looksLikeWall {
            let (hinge, latch) = door.ends
            context.move(to: CGPoint(hinge))
            context.addLine(to: CGPoint(latch))
        }
        context.strokePath()
        context.restoreGState()
    }

    /// The lock and hidden glyphs, side by side along the door when it has both.
    private func drawDoorGlyphs(_ door: Door, locked: Bool, hidden: Bool, context: CGContext) {
        let glyphs = [locked ? "lock.fill" : nil, hidden ? "eye.slash.fill" : nil].compactMap { $0 }
        guard !glyphs.isEmpty else { return }
        let size = max(12, door.size * 0.35)
        let step = glyphs.count > 1 ? size * 0.7 : 0
        for (i, name) in glyphs.enumerated() {
            let along = (Double(i) - Double(glyphs.count - 1) / 2) * 2 * step
            let centre = CGPoint(x: door.x + along * cos(door.radians), y: door.y + along * sin(door.radians))
            drawSymbol(name, centredAt: centre, size: size, context: context)
        }
    }

    /// Render-only stairs (PARITY §3.6): step lines plus a direction arrow; "down" is darker.
    func drawStairs(_ stairs: [Stairs], context: CGContext) {
        for s in stairs {
            let rect = CGRect(x: s.x - s.width / 2, y: s.y - s.height / 2, width: s.width, height: s.height)
            context.saveGState()
            context.setFillColor(NSColor.gray.withAlphaComponent(s.type == .down ? 0.55 : 0.3).cgColor)
            context.fill(rect)
            context.setStrokeColor(NSColor.black.withAlphaComponent(0.7).cgColor)
            context.setLineWidth(1.5)
            let vertical = s.direction == .north || s.direction == .south
            for i in 1..<5 {
                let t = CGFloat(i) / 5
                if vertical {
                    context.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * t))
                    context.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * t))
                } else {
                    context.move(to: CGPoint(x: rect.minX + rect.width * t, y: rect.minY))
                    context.addLine(to: CGPoint(x: rect.minX + rect.width * t, y: rect.maxY))
                }
            }
            context.strokePath()
            context.stroke(rect)
            context.restoreGState()
            let arrow: String
            switch s.direction {
            case .north: arrow = "arrow.up"
            case .south: arrow = "arrow.down"
            case .east: arrow = "arrow.right"
            case .west: arrow = "arrow.left"
            }
            drawSymbol(arrow, centredAt: CGPoint(x: rect.midX, y: rect.midY), size: min(s.width, s.height) * 0.5, context: context)
        }
    }

    /// Light markers for the DM (Architect only, never the World View): a bulb on a disc, a
    /// solid ring where bright light ends and a dashed ring where dim light ends. A light
    /// that is off shows a hollow bulb on a grey disc and no rings. `offset` moves the ones
    /// in `moving` during a drag; `duplicate` keeps the originals too.
    func drawLights(
        _ lights: [LightSource], map: GameMap, moving: Set<String> = [], offset: CGSize = .zero, duplicate: Bool = false,
        context: CGContext
    ) {
        let feet = map.gridSize / 5
        var drawn: [(light: LightSource, preview: Bool)] = lights.map { ($0, false) }
        if !moving.isEmpty, offset != .zero {
            let moved = lights.filter { moving.contains($0.id) }.map { light -> (light: LightSource, preview: Bool) in
                var copy = light
                copy.x += offset.width
                copy.y += offset.height
                return (copy, true)
            }
            drawn = duplicate ? drawn + moved : drawn.filter { !moving.contains($0.light.id) } + moved
        }
        for (light, _) in drawn {
            let centre = CGPoint(x: light.x, y: light.y)
            if light.isOn {
                context.strokeMark(
                    CGPath(ellipseIn: circle(centre, light.bright * feet), transform: nil), width: 1.5 / viewport.zoom,
                    color: .white)
                context.strokeMark(
                    CGPath(ellipseIn: circle(centre, light.dim * feet), transform: nil), width: 1.5 / viewport.zoom,
                    color: .white, dash: [6 / viewport.zoom, 4 / viewport.zoom])
            }
            let marker = circle(centre, Self.lightMarkerRadius / viewport.zoom)
            context.saveGState()
            context.setFillColor((light.isOn ? NSColor.white : NSColor.systemGray).cgColor)
            context.fillEllipse(in: marker)
            context.restoreGState()
            context.strokeMark(CGPath(ellipseIn: marker, transform: nil), width: 1 / viewport.zoom, color: .black)
            drawSymbol(
                light.isOn ? "lightbulb.fill" : "lightbulb", centredAt: centre, size: 11 / viewport.zoom, context: context)
            if selection.contains(light.id) {
                context.strokeMark(
                    CGPath(ellipseIn: marker.insetBy(dx: -4 / viewport.zoom, dy: -4 / viewport.zoom), transform: nil),
                    width: 2 / viewport.zoom)
            }
        }
    }

    /// On-screen points; also the hit radius for clicks.
    static let lightMarkerRadius = 11.0

    /// Where a click with the Light tool would place a light, and how far it would reach.
    func drawLightGhost(at point: Point2D, map: GameMap, context: CGContext) {
        var trial = map
        let light = trial.placeLight(toolState.lightPreset, at: point)
        let centre = CGPoint(x: light.x, y: light.y)
        let feet = map.gridSize / 5
        context.saveGState()
        context.setAlpha(0.6)
        context.strokeMark(
            CGPath(ellipseIn: circle(centre, light.bright * feet), transform: nil), width: 1 / viewport.zoom, color: .white)
        context.strokeMark(
            CGPath(ellipseIn: circle(centre, light.dim * feet), transform: nil), width: 1 / viewport.zoom, color: .white,
            dash: [6 / viewport.zoom, 4 / viewport.zoom])
        context.restoreGState()
    }

    private func circle(_ centre: CGPoint, _ radius: Double) -> CGRect {
        CGRect(x: centre.x - radius, y: centre.y - radius, width: 2 * radius, height: 2 * radius)
    }

    /// Where a click would place a door: the same `doorPlacement`, so it shows the wall alignment.
    func drawDoorGhost(at point: Point2D, map: GameMap, context: CGContext) {
        let door = map.doorPlacement(at: point, orientation: toolState.doorOrientation)
        let t = max(6, door.size * 0.16)
        let rect = CGRect(x: -door.size / 2, y: -t / 2, width: door.size, height: t)
        context.saveGState()
        context.translateBy(x: door.x, y: door.y)
        context.rotate(by: door.radians)
        context.setFillColor(NSColor.white.withAlphaComponent(0.6).cgColor)
        context.fill(rect)
        context.setStrokeColor(NSColor.black.withAlphaComponent(0.6).cgColor)
        context.setLineWidth(1 / viewport.zoom)
        context.stroke(rect)
        context.restoreGState()
    }

    func drawMovementRange(_ cells: [GridCell], map: GameMap, context: CGContext) {
        let geometry = makeGridGeometry(map.gridType, cellSize: map.gridSize)
        let path = CGMutablePath()
        for cell in cells { path.addPolygon(geometry.cellVertices(cell)) }
        context.saveGState()
        context.addPath(path)
        context.setFillColor(Palette.canvasRange.nsColor.cgColor)
        context.fillPath()
        context.restoreGState()
    }

    func drawMeasurement(_ shape: MeasurementShape, gridSize: Double, context: CGContext) {
        context.saveGState()
        let color = Palette.canvasMeasure.nsColor
        context.setStrokeColor(color.cgColor)
        context.setFillColor(color.withAlphaComponent(0.18).cgColor)
        context.setLineWidth(3 / viewport.zoom)
        let labelAnchor: CGPoint
        switch shape {
        case .ruler(let o, let e):
            context.move(to: CGPoint(o))
            context.addLine(to: CGPoint(e))
            context.strokePath()
            labelAnchor = CGPoint(e)
        case .blast(let o, let e):
            let r = Measure.euclideanDistance(o, e)
            let rect = CGRect(x: o.x - r, y: o.y - r, width: r * 2, height: r * 2)
            context.fillEllipse(in: rect)
            context.strokeEllipse(in: rect)
            labelAnchor = CGPoint(o)
        case .cone(let o, let t):
            let path = CGMutablePath()
            path.addPolygon(Measure.coneVertices(origin: o, target: t))
            context.addPath(path)
            context.drawPath(using: .fillStroke)
            labelAnchor = CGPoint(t)
        }
        context.restoreGState()

        // A readout on a dark backing, constant on-screen size: 16 pt for the DM, 18 pt on the
        // projector (design harness: world-view-player-safe, readouts-in-mono).
        let label = NSAttributedString(
            string: shape.label(gridSize: gridSize),
            attributes: [
                .font: ReadoutFont.ns(size: (isPlayerView ? 18 : 16) / viewport.zoom, weight: .semibold),
                .foregroundColor: NSColor.white,
            ])
        let size = label.size()
        let pad = 6 / viewport.zoom
        let radius = Radius.control / viewport.zoom
        let box = CGRect(
            x: labelAnchor.x + 10 / viewport.zoom, y: labelAnchor.y - size.height - pad * 2,
            width: size.width + pad * 2, height: size.height + pad * 2)
        context.saveGState()
        context.setFillColor(Palette.worldScrim.nsColor.cgColor)
        context.addPath(CGPath(roundedRect: box, cornerWidth: radius, cornerHeight: radius, transform: nil))
        context.fillPath()
        context.restoreGState()
        label.draw(at: CGPoint(x: box.minX + pad, y: box.minY + pad))
    }

    private func drawSymbol(_ name: String, centredAt centre: CGPoint, size: CGFloat, context: CGContext) {
        let config = NSImage.SymbolConfiguration(pointSize: size, weight: .bold)
        guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(config)
        else { return }
        let rect = CGRect(
            x: centre.x - image.size.width / 2, y: centre.y - image.size.height / 2, width: image.size.width,
            height: image.size.height)
        image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    }
}

extension CGMutablePath {
    /// Replays core path elements (e.g. `CardinalSpline.path`).
    func addElements(_ elements: [PathElement]) {
        for element in elements {
            switch element {
            case .move(let to): move(to: CGPoint(to))
            case .line(let to): addLine(to: CGPoint(to))
            case .quadCurve(let to, let control): addQuadCurve(to: CGPoint(to), control: CGPoint(control))
            case .curve(let to, let control1, let control2):
                addCurve(to: CGPoint(to), control1: CGPoint(control1), control2: CGPoint(control2))
            }
        }
    }
}
