import Foundation

extension GameMap {
    /// TS map calibration (CORE_SPEC §3.2): the dragged box should be exactly one grid
    /// cell. Scales the map so it is, then shifts it so the box sits on grid lines.
    /// Ignored for boxes of 5 px or less, or without a map image.
    @discardableResult
    public mutating func calibrate(to box: Bounds) -> Bool {
        guard box.width > 5, box.height > 5, var bg = background else { return false }
        let s = gridSize / ((box.width + box.height) / 2)
        let newScale = bg.scale * s
        let projected = Point2D(x: bg.x + (box.x - bg.x) * s, y: bg.y + (box.y - bg.y) * s)
        let target = Point2D(x: jsRound(projected.x / gridSize) * gridSize, y: jsRound(projected.y / gridSize) * gridSize)
        bg.scale = newScale
        bg.x += target.x - projected.x
        bg.y += target.y - projected.y
        background = bg
        return true
    }

    /// TS "Reset Map Position & Scale".
    public mutating func resetBackgroundTransform() {
        background?.x = 0
        background?.y = 0
        background?.scale = 1
    }

    // MARK: Drawings (marker and eraser strokes are selectable; walls are not)

    public func drawingBounds(_ drawing: Drawing) -> Bounds {
        let points = drawing.worldPoints
        guard let first = points.first else { return Bounds(x: 0, y: 0, width: 0, height: 0) }
        var minX = first.x, minY = first.y, maxX = first.x, maxY = first.y
        for p in points {
            minX = min(minX, p.x)
            minY = min(minY, p.y)
            maxX = max(maxX, p.x)
            maxY = max(maxY, p.y)
        }
        let pad = drawing.size * (drawing.scale ?? 1) / 2
        return Bounds(x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad)
    }

    /// The topmost selectable stroke within its line width (plus `tolerance`) of `point`.
    public func drawing(at point: Point2D, tolerance: Double = 4) -> Drawing? {
        drawings.last { drawing in
            guard drawing.tool != .wall else { return false }
            let points = drawing.worldPoints
            let reach = drawing.size * (drawing.scale ?? 1) / 2 + tolerance
            if points.count == 1 { return Measure.euclideanDistance(points[0], point) <= reach }
            for i in 1..<max(points.count, 1) where i < points.count {
                let closest = PathOptimization.closestPointOnSegment(point, points[i - 1], points[i])
                if Measure.euclideanDistance(closest, point) <= reach { return true }
            }
            return false
        }
    }

    public func drawingIDs(intersecting rect: Bounds) -> [String] {
        drawings.filter { $0.tool != .wall && drawingBounds($0).intersects(rect) }.map(\.id)
    }

    public func doorIDs(intersecting rect: Bounds) -> [String] {
        doors.filter { door in
            let half = door.size / 2
            let b =
                door.orientation == .horizontal
                ? Bounds(x: door.x - half, y: door.y - 4, width: door.size, height: 8)
                : Bounds(x: door.x - 4, y: door.y - half, width: 8, height: door.size)
            return b.intersects(rect)
        }.map(\.id)
    }

    /// Moves strokes by a map-space offset (no snapping, as TS). With `duplicate`,
    /// copies move and originals stay. Returns the ids now at the destination.
    @discardableResult
    public mutating func moveDrawings(_ ids: Set<String>, dx: Double, dy: Double, duplicate: Bool) -> [String] {
        var placed: [String] = []
        for index in drawings.indices where ids.contains(drawings[index].id) && drawings[index].tool != .wall {
            var moved = drawings[index]
            moved.x = (moved.x ?? 0) + dx
            moved.y = (moved.y ?? 0) + dy
            if duplicate {
                moved.id = newID()
                drawings.append(moved)
            } else {
                drawings[index] = moved
            }
            placed.append(moved.id)
        }
        return placed
    }

    /// Removes any tokens, strokes and doors whose ids are in `ids`.
    public mutating func removeItems(_ ids: Set<String>) {
        tokens.removeAll { ids.contains($0.id) }
        drawings.removeAll { ids.contains($0.id) }
        doors.removeAll { ids.contains($0.id) }
    }
}

extension Viewport {
    /// TS viewport clamp (PARITY §3.1): the view's centre stays within the map (or
    /// ±5000 without one), widened to include the party, plus 1000 px of padding.
    public func clamped(map: GameMap, library: [String: TokenLibraryItem], viewWidth: Double, viewHeight: Double) -> Viewport {
        var area =
            map.background.map { Bounds(x: $0.x, y: $0.y, width: $0.width * $0.scale, height: $0.height * $0.scale) }
            ?? Bounds(x: -5000, y: -5000, width: 10_000, height: 10_000)
        if let party = map.partyBounds(library: library, paddingCells: 0) {
            let minX = min(area.x, party.x)
            let minY = min(area.y, party.y)
            area = Bounds(
                x: minX, y: minY, width: max(area.x + area.width, party.x + party.width) - minX,
                height: max(area.y + area.height, party.y + party.height) - minY)
        }
        let pad = 1000.0
        let halfW = viewWidth / (2 * zoom)
        let halfH = viewHeight / (2 * zoom)
        let centre = Point2D(
            x: min(max(origin.x + halfW, area.x - pad), area.x + area.width + pad),
            y: min(max(origin.y + halfH, area.y - pad), area.y + area.height + pad))
        return Viewport(origin: Point2D(x: centre.x - halfW, y: centre.y - halfH), zoom: zoom)
    }

    /// Zooms around `anchor` (view coordinates), then clamps. TS `performZoom` runs
    /// `clampPosition` on every zoom step (pinch, wheel and keyboard).
    public func zoomed(
        by factor: Double, around anchor: Point2D, clampingTo map: GameMap, library: [String: TokenLibraryItem],
        viewWidth: Double, viewHeight: Double
    ) -> Viewport {
        var next = self
        next.zoom(by: factor, around: anchor)
        return next.clamped(map: map, library: library, viewWidth: viewWidth, viewHeight: viewHeight)
    }
}
