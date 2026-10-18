import Foundation

extension GameMap {
    /// Bounds around every PC token, padded by `paddingCells` grid cells
    /// (TS "Center on Party": 2 cells). Nil when there are no PCs.
    public func partyBounds(library: [String: TokenLibraryItem], paddingCells: Double = 2) -> Bounds? {
        let pcs = tokens.filter { ResolvedToken($0, library: library).type == .pc }
        guard !pcs.isEmpty else { return nil }
        var minX = Double.infinity, minY = Double.infinity
        var maxX = -Double.infinity, maxY = -Double.infinity
        for token in pcs {
            let b = tokenBounds(token, library: library)
            minX = min(minX, b.x)
            minY = min(minY, b.y)
            maxX = max(maxX, b.x + b.width)
            maxY = max(maxY, b.y + b.height)
        }
        let pad = gridSize * paddingCells
        return Bounds(x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad)
    }
}

extension GameMap {
    /// TS minimap: PC bounds padding and the fixed world used when there is nothing to frame.
    public static let minimapPartyPadding = 500.0
    public static let minimapDefaultBounds = Bounds(x: 0, y: 0, width: 2000, height: 2000)

    /// What the World View minimap frames (PARITY §3.12, TS `Minimap`): the map image's
    /// extent, else every PC token padded by 500 px, else a fixed 2000 × 2000 world.
    public func minimapBounds(library: [String: TokenLibraryItem]) -> Bounds {
        if let bg = background, bg.width * bg.scale > 0, bg.height * bg.scale > 0 {
            return Bounds(x: bg.x, y: bg.y, width: bg.width * bg.scale, height: bg.height * bg.scale)
        }
        let pad = Self.minimapPartyPadding
        guard let party = partyBounds(library: library, paddingCells: 0) else { return Self.minimapDefaultBounds }
        return Bounds(x: party.x - pad, y: party.y - pad, width: party.width + 2 * pad, height: party.height + 2 * pad)
    }
}

extension GameMap {
    /// NPCs the players can't see right now (CORE_SPEC §3.3; none in daylight).
    /// Recomputed from this map, so it never trusts a window's possibly stale copy.
    public func tokensHiddenFromPlayers(library: [String: TokenLibraryItem]) -> Set<String> {
        guard !isDaylightMode else { return [] }
        return LineOfSight.hiddenNPCIDs(of: self, library: library, sight: LineOfSight.partySight(of: self, library: library))
    }

    /// This map with some tokens at in-progress drag positions (top-left corners), so
    /// fog and NPC hiding can follow a drag before it is dropped (TS `fogVisibility`).
    public func withTokenPositions(_ positions: [String: Point2D]) -> GameMap {
        guard !positions.isEmpty else { return self }
        var map = self
        for i in map.tokens.indices {
            if let p = positions[map.tokens[i].id] {
                map.tokens[i].x = p.x
                map.tokens[i].y = p.y
            }
        }
        return map
    }

    /// The tokens a drag moves, in map order: `selected` minus anything `hidden`
    /// (PARITY §3.7/§4.2: hidden NPCs are not interactive, even when still selected).
    public func draggedTokenIDs(selected: Set<String>, hidden: Set<String> = []) -> [String] {
        tokens.map(\.id).filter { selected.contains($0) && !hidden.contains($0) }
    }

    /// A player's drop in the World View (PARITY §4.2). Tokens hidden from the players
    /// are never moved, and nothing moves when the primary token itself is hidden.
    /// Returns the ids that moved.
    @discardableResult
    public mutating func playerMoveTokens(
        _ ids: [String], primary: String, dx: Double, dy: Double, library: [String: TokenLibraryItem]
    ) -> [String] {
        let hidden = tokensHiddenFromPlayers(library: library)
        guard !hidden.contains(primary) else { return [] }
        return dropTokens(
            ids.filter { !hidden.contains($0) }, primary: primary, dx: dx, dy: dy, duplicate: false, library: library)
    }
}
