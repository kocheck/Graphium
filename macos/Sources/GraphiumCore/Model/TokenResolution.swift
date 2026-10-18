import Foundation

/// A token with library inheritance applied (TS `resolveTokenData`, CORE_SPEC §3.7):
/// instance value → linked library item's default → system default.
public struct ResolvedToken: Equatable, Sendable {
    public static let defaultScale = 1.0
    public static let defaultName = "Token"
    public static let defaultMovementSpeed = 30.0

    public var token: Token
    public var name: String
    public var type: CreatureType?
    public var visionRadius: Double?
    public var scale: Double
    public var movementSpeed: Double
    /// Feet; nil is none.
    public var darkvision: Double?
    /// Which values came from the library item (category-inferred PC does not count).
    public var inherited: Set<Field>

    public enum Field: Hashable, Sendable {
        case name, type, visionRadius, scale, movementSpeed, darkvision
    }

    public init(_ token: Token, library: [String: TokenLibraryItem]) {
        let item = token.libraryItemId.flatMap { library[$0] }
        self.token = token
        var inherited = Set<Field>()
        func pick<T>(_ instance: T?, _ libraryValue: T?, _ field: Field) -> T? {
            if let instance { return instance }
            if libraryValue != nil { inherited.insert(field) }
            return libraryValue
        }
        name = pick(token.name, item?.name, .name) ?? Self.defaultName
        scale = pick(token.scale, item?.defaultScale, .scale) ?? Self.defaultScale
        visionRadius = pick(token.visionRadius, item?.defaultVisionRadius, .visionRadius)
        movementSpeed = pick(token.movementSpeed, item?.defaultMovementSpeed, .movementSpeed) ?? Self.defaultMovementSpeed
        darkvision = pick(token.darkvision, item?.defaultDarkvision, .darkvision)
        type = pick(token.type, item?.defaultType, .type) ?? (item?.category == "PC" ? .pc : nil)
        self.inherited = inherited
    }

    /// The name players see under the token: `Token.playerName` when set, nil when that is
    /// empty (no name), else the token's name.
    public var playerName: String? {
        guard let custom = token.playerName else { return name }
        return custom.isEmpty ? nil : custom
    }
}

extension Campaign {
    /// Library items by id (last duplicate wins, like TS `indexTokenLibrary`).
    public var libraryIndex: [String: TokenLibraryItem] {
        Dictionary(tokenLibrary.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    }
}

extension GameMap {
    /// Token footprint: a square `gridSize × resolved scale`.
    public func tokenSize(_ token: Token, library: [String: TokenLibraryItem]) -> Double {
        gridSize * ResolvedToken(token, library: library).scale
    }

    /// The stored footprint (top-left `x`, `y`). Vision, party framing and the minimap use this.
    public func tokenBounds(_ token: Token, library: [String: TokenLibraryItem]) -> Bounds {
        let size = tokenSize(token, library: library)
        return Bounds(x: token.x, y: token.y, width: size, height: size)
    }

    /// TS `TokenNode` `displayYOffset`: on isometric grids a token is drawn half its
    /// height higher, so it stands on its diamond. Zero on every other grid.
    public func tokenDisplayYOffset(size: Double) -> Double {
        gridType == .isometric ? -size / 2 : 0
    }

    /// Where the token is drawn, hit and marquee-selected: `tokenBounds` lifted on iso grids.
    public func tokenDisplayBounds(_ token: Token, library: [String: TokenLibraryItem]) -> Bounds {
        let size = tokenSize(token, library: library)
        return Bounds(x: token.x, y: token.y + tokenDisplayYOffset(size: size), width: size, height: size)
    }

    /// Where a token placed "at the map centre" goes (TS `addLibraryTokenToMap`):
    /// the background's centre used as the token's top-left, or (500, 500).
    public var centrePlacementPoint: Point2D {
        guard let bg = background else { return Point2D(x: 500, y: 500) }
        return Point2D(x: bg.x + bg.width * bg.scale / 2, y: bg.y + bg.height * bg.scale / 2)
    }

    /// Ids of tokens whose drawn bounds intersect `rect` (marquee selection).
    public func tokenIDs(intersecting rect: Bounds, library: [String: TokenLibraryItem]) -> [String] {
        tokens.filter { tokenDisplayBounds($0, library: library).intersects(rect) }.map(\.id)
    }

    /// Topmost token drawn under `point` (tokens draw in array order, so search from the end).
    public func token(at point: Point2D, library: [String: TokenLibraryItem]) -> Token? {
        tokens.last { tokenDisplayBounds($0, library: library).contains(point) }
    }

    /// Drops dragged tokens (TS `useTokenDrag`, CORE_SPEC §3.1): the primary token is
    /// snapped with its own size; every other selected token gets the same offset and
    /// is then snapped again with its own size. With `duplicate` (Option-drag) the
    /// originals stay and copies land at the destinations. Returns the ids now at the
    /// destinations (the copies when duplicating).
    @discardableResult
    public mutating func dropTokens(
        _ ids: [String], primary: String, dx: Double, dy: Double, duplicate: Bool,
        library: [String: TokenLibraryItem]
    ) -> [String] {
        guard let primaryToken = tokens.first(where: { $0.id == primary }) else { return [] }
        let grid = makeGridGeometry(gridType, cellSize: gridSize)
        func snapped(_ token: Token, x: Double, y: Double) -> Point2D {
            let size = tokenSize(token, library: library)
            return grid.snapPoint(Point2D(x: x, y: y), width: size, height: size)
        }
        let dragged = Point2D(x: primaryToken.x + dx, y: primaryToken.y + dy)
        let primaryTarget = snapped(primaryToken, x: dragged.x, y: dragged.y)
        let offset = Point2D(x: primaryTarget.x - primaryToken.x, y: primaryTarget.y - primaryToken.y)

        var placed: [String] = []
        for id in ids {
            guard let index = tokens.firstIndex(where: { $0.id == id }) else { continue }
            let original = tokens[index]
            let target =
                id == primary
                ? primaryTarget : snapped(original, x: original.x + offset.x, y: original.y + offset.y)
            if duplicate {
                var copy = original
                copy.id = newID()
                copy.x = target.x
                copy.y = target.y
                tokens.append(copy)
                placed.append(copy.id)
            } else {
                tokens[index].x = target.x
                tokens[index].y = target.y
                placed.append(id)
            }
        }
        return placed
    }

    public mutating func removeTokens(_ ids: Set<String>) {
        tokens.removeAll { ids.contains($0.id) }
    }
}

extension Campaign {
    public enum MapEditError: Error, Equatable {
        case cannotDeleteOnlyMap
    }

    /// TS `deleteMap`: the last map can't be deleted; deleting the active map
    /// activates the next map in order, else the previous one.
    public mutating func deleteMap(id: String) throws {
        guard maps.count > 1 else { throw MapEditError.cannotDeleteOnlyMap }
        guard let index = maps.firstIndex(where: { $0.id == id }) else { return }
        if id == activeMapID {
            activeMapID = index + 1 < maps.count ? maps[index + 1].id : maps[index - 1].id
        }
        maps.remove(at: index)
    }

    public mutating func renameMap(id: String, to name: String) {
        guard let index = maps.firstIndex(where: { $0.id == id }) else { return }
        maps[index].name = name
    }
}

extension Bounds {
    public func intersects(_ other: Bounds) -> Bool {
        x < other.x + other.width && other.x < x + width && y < other.y + other.height && other.y < y + height
    }

    public func contains(_ p: Point2D) -> Bool {
        p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height
    }

    /// The rectangle spanned by two corners, in any order.
    public init(corner a: Point2D, corner b: Point2D) {
        self.init(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(b.x - a.x), height: abs(b.y - a.y))
    }
}

/// Image import size limits (TS `imageMaxDimensions`, CORE_SPEC §3.13).
public enum ImageKind: Sendable {
    case map, token, thumbnail

    public var maxDimension: Int {
        switch self {
        case .map: return 4096
        case .token: return 512
        case .thumbnail: return 256
        }
    }

    /// Scaled size that fits within `maxDimension`, never upscaling. Square images
    /// take the portrait branch, as in TS.
    public func fittedSize(width: Int, height: Int) -> (width: Int, height: Int) {
        let limit = maxDimension
        guard width > limit || height > limit else { return (width, height) }
        let ratio = Double(width) / Double(height)
        if width > height {
            return (limit, Int(jsRound(Double(limit) / ratio)))
        }
        return (Int(jsRound(Double(limit) * ratio)), limit)
    }
}
