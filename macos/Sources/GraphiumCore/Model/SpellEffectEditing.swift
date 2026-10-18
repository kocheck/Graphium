import Foundation

/// Placing and editing spell effects (native only).
extension GameMap {
    /// Where `effect`'s point of origin is now: on the map, or offset from the centre of the token
    /// that carries it. An effect whose token is gone stays where it was stored.
    public func effectOrigin(_ effect: SpellEffect, library: [String: TokenLibraryItem]) -> Point2D {
        guard let id = effect.tokenID, let token = tokens.first(where: { $0.id == id }) else {
            return Point2D(x: effect.x, y: effect.y)
        }
        let box = tokenBounds(token, library: library)
        return Point2D(x: box.x + box.width / 2 + effect.x, y: box.y + box.height / 2 + effect.y)
    }

    /// The effect's area, world pixels.
    public func effectPolygon(_ effect: SpellEffect, library: [String: TokenLibraryItem]) -> [Point2D] {
        effect.polygon(origin: effectOrigin(effect, library: library), gridSize: gridSize)
    }

    /// Where a new effect's point of origin goes for a press at `point`: a circle on the cell
    /// centre, the others on the nearest grid corner (5e: a template's origin is a corner).
    public func effectOriginSnap(_ point: Point2D, shape: SpellEffect.Shape) -> Point2D {
        guard gridType.isSquare else { return snapToGrid(point, gridSize: gridSize, gridType: gridType) }
        if shape == .circle {
            return Point2D(
                x: (point.x / gridSize).rounded(.down) * gridSize + gridSize / 2,
                y: (point.y / gridSize).rounded(.down) * gridSize + gridSize / 2)
        }
        return snapToGrid(point, gridSize: gridSize, gridType: gridType)
    }

    /// Adds `effect`. With a `tokenID`, its stored point is taken as a world point and turned into
    /// the offset from that token.
    @discardableResult
    public mutating func placeEffect(_ effect: SpellEffect, library: [String: TokenLibraryItem]) -> SpellEffect {
        var placed = effect
        if let id = effect.tokenID {
            if let token = tokens.first(where: { $0.id == id }) {
                let box = tokenBounds(token, library: library)
                placed.x = effect.x - (box.x + box.width / 2)
                placed.y = effect.y - (box.y + box.height / 2)
            } else {
                placed.tokenID = nil
            }
        }
        effects.append(placed)
        return placed
    }

    /// The topmost effect whose area contains `point`, or whose origin is within `tolerance`.
    public func effect(at point: Point2D, tolerance: Double, library: [String: TokenLibraryItem], sharedOnly: Bool = false)
        -> SpellEffect?
    {
        effects.last { effect in
            if sharedOnly, effect.isHidden { return false }
            let origin = effectOrigin(effect, library: library)
            return hypot(origin.x - point.x, origin.y - point.y) <= tolerance
                || LineOfSight.contains(effect.polygon(origin: origin, gridSize: gridSize), point)
        }
    }

    /// Effects whose point of origin is inside `rect`.
    public func effectIDs(intersecting rect: Bounds, library: [String: TokenLibraryItem]) -> [String] {
        effects.filter {
            let p = effectOrigin($0, library: library)
            return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
        }.map(\.id)
    }

    /// Moves effects by a map-space offset (a carried effect moves relative to its token). With
    /// `duplicate`, copies move and originals stay.
    @discardableResult
    public mutating func moveEffects(_ ids: Set<String>, dx: Double, dy: Double, duplicate: Bool) -> [String] {
        var placed: [String] = []
        for index in effects.indices where ids.contains(effects[index].id) {
            var moved = effects[index]
            moved.x += dx
            moved.y += dy
            if duplicate {
                moved.id = newID()
                effects.append(moved)
            } else {
                effects[index] = moved
            }
            placed.append(moved.id)
        }
        return placed
    }

    public mutating func setEffectsHidden(_ ids: Set<String>, hidden: Bool) {
        for index in effects.indices where ids.contains(effects[index].id) { effects[index].isHidden = hidden }
    }

    /// Turns directional effects by `degrees`, clockwise on screen.
    public mutating func rotateEffects(_ ids: Set<String>, by degrees: Double) {
        for index in effects.indices where ids.contains(effects[index].id) && effects[index].shape.hasDirection {
            var angle = (effects[index].angle + degrees).truncatingRemainder(dividingBy: 360)
            if angle < 0 { angle += 360 }
            effects[index].angle = angle
        }
    }

    /// Hands effects to `tokenID`, centred on it, which is where a caster's spell starts. Nil
    /// leaves them on the map where they are now.
    public mutating func attachEffects(_ ids: Set<String>, to tokenID: String?, library: [String: TokenLibraryItem]) {
        let token = tokenID.flatMap { id in tokens.first { $0.id == id } }
        for index in effects.indices where ids.contains(effects[index].id) {
            if let token {
                guard effects[index].tokenID != token.id else { continue }
                effects[index].x = 0
                effects[index].y = 0
                effects[index].tokenID = token.id
            } else {
                let origin = effectOrigin(effects[index], library: library)
                effects[index].x = origin.x
                effects[index].y = origin.y
                effects[index].tokenID = nil
            }
        }
    }

    /// Applies `change` to the effect `id`, if it is on this map.
    public mutating func updateEffect(id: String, _ change: (inout SpellEffect) -> Void) {
        guard let index = effects.firstIndex(where: { $0.id == id }) else { return }
        change(&effects[index])
    }
}
