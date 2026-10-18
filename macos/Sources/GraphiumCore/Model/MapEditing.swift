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

    /// Applies only what the Map Settings sheet edits (TS MapSettingsSheet.tsx:183-196).
    /// Tokens, drawings, doors and explored regions keep their current values, so edits
    /// made in other windows while the sheet was open survive the save.
    public mutating func applySettings(from edited: GameMap) {
        name = edited.name
        gridType = edited.gridType
        gridColor = edited.gridColor
        isDaylightMode = edited.isDaylightMode
        ambientLight = edited.ambientLight
        background = edited.background
    }

    // MARK: Drawings (every stroke is selectable, walls too: a native change, PARITY §3.5).
    // The canvas offers walls only to the Wall tool (decision 018) through `include`.

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
    /// Strokes `include` turns down are passed through to the ones under them.
    public func drawing(at point: Point2D, tolerance: Double = 4, include: (Drawing) -> Bool = { _ in true }) -> Drawing? {
        drawings.last { drawing in
            guard include(drawing) else { return false }
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

    public func drawingIDs(intersecting rect: Bounds, include: (Drawing) -> Bool = { _ in true }) -> [String] {
        drawings.filter { include($0) && drawingBounds($0).intersects(rect) }.map(\.id)
    }

    public func doorIDs(intersecting rect: Bounds) -> [String] {
        doors.filter { $0.bounds(padding: 4).intersects(rect) }.map(\.id)
    }

    /// Moves strokes by a map-space offset (no snapping, as TS). With `duplicate`,
    /// copies move and originals stay. Returns the ids now at the destination.
    @discardableResult
    public mutating func moveDrawings(_ ids: Set<String>, dx: Double, dy: Double, duplicate: Bool) -> [String] {
        var placed: [String] = []
        for index in drawings.indices where ids.contains(drawings[index].id) {
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

    /// Makes the given walls `kind` (strokes that aren't walls are left alone). `.wall` is
    /// stored as nil so files that never use windows don't change.
    public mutating func setWallKind(_ kind: WallKind, ids: Set<String>) {
        for i in drawings.indices where drawings[i].tool == .wall && ids.contains(drawings[i].id) {
            drawings[i].wallKind = kind == .wall ? nil : kind
        }
    }

    /// Hides the given markers from players (World View) or shows them again. Showing
    /// leaves the flag out of the file.
    public mutating func setMarkersDMOnly(_ dmOnly: Bool, ids: Set<String>) {
        for i in drawings.indices where drawings[i].tool == .marker && ids.contains(drawings[i].id) {
            drawings[i].isDMOnly = dmOnly ? true : nil
        }
    }

    /// Makes the given walls one-way or two-way.
    public mutating func setOneWay(_ oneWay: Bool, ids: Set<String>) {
        for i in drawings.indices where drawings[i].tool == .wall && ids.contains(drawings[i].id) {
            drawings[i].oneWay = oneWay ? true : nil
        }
    }

    /// Reverses the given walls' point order, which turns a one-way wall around.
    public mutating func flipWalls(_ ids: Set<String>) {
        for i in drawings.indices where drawings[i].tool == .wall && ids.contains(drawings[i].id) {
            let p = drawings[i].points
            drawings[i].points = stride(from: p.count - 2, through: 0, by: -2).flatMap { [p[$0], p[$0 + 1]] }
        }
    }

    /// Removes any tokens, strokes, doors, lights, notes and spell effects whose ids are in `ids`,
    /// and the effects the removed tokens carried and their places in the initiative order.
    public mutating func removeItems(_ ids: Set<String>) {
        let removedTokens = Set(tokens.lazy.map(\.id).filter { ids.contains($0) })
        effects.removeAll { ids.contains($0.id) || $0.tokenID.map(removedTokens.contains) == true }
        initiative.remove(removedTokens)
        tokens.removeAll { ids.contains($0.id) }
        drawings.removeAll { ids.contains($0.id) }
        doors.removeAll { ids.contains($0.id) }
        lights.removeAll { ids.contains($0.id) }
        notes.removeAll { ids.contains($0.id) }
        removeStairs(ids)
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

extension GameMap {
    /// The box around everything on the map (background, walls, doors, tokens), in pixels.
    public func contentBounds(library: [String: TokenLibraryItem]) -> Bounds? {
        var boxes: [Bounds] = []
        if let bg = background { boxes.append(Bounds(x: bg.x, y: bg.y, width: bg.width * bg.scale, height: bg.height * bg.scale)) }
        boxes += drawings.filter { !$0.points.isEmpty }.map { drawingBounds($0) }
        boxes += doors.map { $0.bounds(padding: 0) }
        boxes += tokens.map { tokenBounds($0, library: library) }
        boxes += lights.map { Bounds(x: $0.x - gridSize / 2, y: $0.y - gridSize / 2, width: gridSize, height: gridSize) }
        boxes += notes.map { Bounds(x: $0.x - gridSize / 2, y: $0.y - gridSize / 2, width: gridSize, height: gridSize) }
        boxes += effects.map { effectBounds($0, library: library) }
        boxes += stairs.map { Bounds(x: $0.x - $0.width / 2, y: $0.y - $0.height / 2, width: $0.width, height: $0.height) }
        guard var minX = boxes.first?.x, var minY = boxes.first?.y else { return nil }
        var maxX = minX, maxY = minY
        for b in boxes {
            minX = min(minX, b.x)
            minY = min(minY, b.y)
            maxX = max(maxX, b.x + b.width)
            maxY = max(maxY, b.y + b.height)
        }
        return Bounds(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// The box around an effect's area, in pixels.
    public func effectBounds(_ effect: SpellEffect, library: [String: TokenLibraryItem]) -> Bounds {
        let points = effectPolygon(effect, library: library)
        let xs = points.map(\.x)
        let ys = points.map(\.y)
        let minX = xs.min() ?? 0, minY = ys.min() ?? 0
        return Bounds(x: minX, y: minY, width: (xs.max() ?? minX) - minX, height: (ys.max() ?? minY) - minY)
    }
}
