import AppKit
import GraphiumCore

/// Map-layer rendering beyond the grid and tokens: ink, doors, stairs, and the
/// Architect/World overlays. Everything draws in map coordinates.
extension MapCanvasNSView {
    /// Markers, erasers and walls share one transparency layer, so an eraser stroke
    /// removes ink (including wall lines) but never the map or tokens (PARITY §3.5).
    /// Wall *geometry* for vision is unaffected by erasing.
    func drawInk(_ drawings: [Drawing], live: Drawing?, context: CGContext) {
        let all = live.map { drawings + [$0] } ?? drawings
        guard !all.isEmpty else { return }
        context.saveGState()
        context.beginTransparencyLayer(auxiliaryInfo: nil)
        for drawing in all {
            drawStroke(drawing, context: context)
        }
        context.endTransparencyLayer()
        context.restoreGState()
    }

    private func drawStroke(_ drawing: Drawing, context: CGContext) {
        let points = drawing.worldPoints
        guard let first = points.first else { return }
        let scale = drawing.scale ?? 1
        context.saveGState()
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

    func drawDoors(_ doors: [Door], context: CGContext) {
        for door in doors {
            let thickness = door.thickness ?? max(6, door.size * 0.16)
            let half = door.size / 2
            let closed: CGRect =
                door.orientation == .horizontal
                ? CGRect(x: door.x - half, y: door.y - thickness / 2, width: door.size, height: thickness)
                : CGRect(x: door.x - thickness / 2, y: door.y - half, width: thickness, height: door.size)
            let openFraction = CGFloat(doorSwings.openFraction(for: door, in: self))
            context.saveGState()
            if isPlayerView {
                // Projector legibility: white glow and a heavier outline.
                context.setShadow(offset: .zero, blur: 8, color: NSColor.white.cgColor)
            }
            let fill = NSColor(srgbRed: 0.55, green: 0.36, blue: 0.2, alpha: 1)
            context.setStrokeColor(NSColor.black.cgColor)
            context.setLineWidth(isPlayerView ? 3 : 1.5)
            if openFraction > 0 {
                // Swung up to 90° about the hinge end (animated, TS DoorShape), with the swing arc.
                // The closed leaf points along +x (horizontal) or +y (vertical) and turns towards −y / +x.
                let hinge =
                    door.orientation == .horizontal
                    ? CGPoint(x: door.x - half, y: door.y) : CGPoint(x: door.x, y: door.y - half)
                let closedAngle: CGFloat = door.orientation == .horizontal ? 0 : .pi / 2
                let leafAngle = closedAngle - .pi / 2 * openFraction
                context.saveGState()
                context.translateBy(x: hinge.x, y: hinge.y)
                context.rotate(by: leafAngle)
                let leaf = CGRect(x: 0, y: -thickness / 2, width: door.size, height: thickness)
                context.setFillColor(fill.withAlphaComponent(1 - 0.15 * openFraction).cgColor)
                context.fill(leaf)
                context.stroke(leaf)
                context.restoreGState()
                context.setLineDash(phase: 0, lengths: [4, 4])
                context.setLineWidth(1)
                context.addArc(center: hinge, radius: door.size, startAngle: leafAngle, endAngle: closedAngle, clockwise: false)
                context.strokePath()
            } else {
                context.setFillColor(fill.cgColor)
                context.fill(closed)
                context.stroke(closed)
            }
            context.restoreGState()
            if door.isLocked {
                drawSymbol("lock.fill", centredAt: CGPoint(x: door.x, y: door.y), size: max(12, door.size * 0.35), context: context)
            }
            if selectedDoorID == door.id || selection.contains(door.id) {
                context.strokeMark(CGPath(rect: closed.insetBy(dx: -4, dy: -4), transform: nil), width: 2 / viewport.zoom)
            }
        }
        doorSwings.finishFrame(doorIDs: Set(doors.map(\.id)))
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

    func drawDoorGhost(at point: Point2D, map: GameMap, context: CGContext) {
        let snapped = snapToGrid(point, gridSize: map.gridSize, gridType: map.gridType)
        let half = map.gridSize / 2
        let t = max(6, map.gridSize * 0.16)
        let rect =
            toolState.doorOrientation == .horizontal
            ? CGRect(x: snapped.x - half, y: snapped.y - t / 2, width: map.gridSize, height: t)
            : CGRect(x: snapped.x - t / 2, y: snapped.y - half, width: t, height: map.gridSize)
        context.saveGState()
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
