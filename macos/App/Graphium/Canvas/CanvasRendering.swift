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
            context.setLineWidth(drawing.size * scale)
        case .wall:
            if isPlayerView {
                // World View: black 6px solid.
                context.setStrokeColor(NSColor.black.cgColor)
                context.setLineWidth(6)
            } else {
                context.setStrokeColor((NSColor(hex: drawing.color) ?? .systemRed).cgColor)
                context.setLineWidth(drawing.size * scale)
                context.setLineDash(phase: 0, lengths: [10, 5])
            }
        case .marker:
            context.setStrokeColor((NSColor(hex: drawing.color) ?? .labelColor).cgColor)
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
            context.setLineWidth(drawing.size * scale)
        }
        context.move(to: CGPoint(first))
        if points.count == 1 {
            context.addLine(to: CGPoint(first))  // a dot
        }
        for p in points.dropFirst() { context.addLine(to: CGPoint(p)) }
        context.strokePath()
        context.restoreGState()
    }

    func drawDoors(_ doors: [Door], context: CGContext) {
        for door in doors {
            let thickness = door.thickness ?? max(6, door.size * 0.16)
            let half = door.size / 2
            let closed: CGRect =
                door.orientation == .horizontal
                ? CGRect(x: door.x - half, y: door.y - thickness / 2, width: door.size, height: thickness)
                : CGRect(x: door.x - thickness / 2, y: door.y - half, width: thickness, height: door.size)
            context.saveGState()
            if isPlayerView {
                // Projector legibility: white glow and a heavier outline.
                context.setShadow(offset: .zero, blur: 8, color: NSColor.white.cgColor)
            }
            let fill = NSColor(srgbRed: 0.55, green: 0.36, blue: 0.2, alpha: 1)
            context.setStrokeColor(NSColor.black.cgColor)
            context.setLineWidth(isPlayerView ? 3 : 1.5)
            if door.isOpen {
                // Swung 90° about the hinge end, with the swing arc.
                let hinge =
                    door.orientation == .horizontal
                    ? CGPoint(x: door.x - half, y: door.y) : CGPoint(x: door.x, y: door.y - half)
                let leaf =
                    door.orientation == .horizontal
                    ? CGRect(x: hinge.x - thickness / 2, y: hinge.y - door.size, width: thickness, height: door.size)
                    : CGRect(x: hinge.x, y: hinge.y - thickness / 2, width: door.size, height: thickness)
                context.setFillColor(fill.withAlphaComponent(0.85).cgColor)
                context.fill(leaf)
                context.stroke(leaf)
                context.setLineDash(phase: 0, lengths: [4, 4])
                context.setLineWidth(1)
                let start: CGFloat = door.orientation == .horizontal ? -.pi / 2 : 0
                context.addArc(center: hinge, radius: door.size, startAngle: start, endAngle: start + .pi / 2, clockwise: false)
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
            if selectedDoorID == door.id {
                context.saveGState()
                context.setStrokeColor(NSColor.systemBlue.cgColor)
                context.setLineWidth(2 / viewport.zoom)
                context.stroke(closed.insetBy(dx: -4, dy: -4))
                context.restoreGState()
            }
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
        context.setFillColor(NSColor.systemBlue.withAlphaComponent(0.22).cgColor)
        context.fillPath()
        context.restoreGState()
    }

    func drawMeasurement(_ shape: MeasurementShape, gridSize: Double, context: CGContext) {
        context.saveGState()
        let color = NSColor.systemYellow
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

        // 16pt label on a dark backing, constant on-screen size.
        let label = NSAttributedString(
            string: shape.label(gridSize: gridSize),
            attributes: [.font: NSFont.boldSystemFont(ofSize: 16 / viewport.zoom), .foregroundColor: NSColor.white])
        let size = label.size()
        let pad = 6 / viewport.zoom
        let box = CGRect(
            x: labelAnchor.x + 10 / viewport.zoom, y: labelAnchor.y - size.height - pad * 2,
            width: size.width + pad * 2, height: size.height + pad * 2)
        context.saveGState()
        context.setFillColor(NSColor.black.withAlphaComponent(0.75).cgColor)
        context.addPath(CGPath(roundedRect: box, cornerWidth: pad, cornerHeight: pad, transform: nil))
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
