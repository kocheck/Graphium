import Foundation

public enum CreatureType: String, Codable, CaseIterable, Sendable {
    case pc = "PC"
    case npc = "NPC"
}

/// A token on a map (TS `Token`, CORE_SPEC §1.4). Optional fields are
/// per-token overrides of the library item; nil means "inherit".
/// Optionals are omitted from JSON when nil (rule R3).
public struct Token: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    /// Top-left corner, world pixels.
    public var x: Double
    public var y: Double
    /// Asset reference (see AssetReference).
    public var src: String
    public var libraryItemId: String?
    public var scale: Double?
    public var type: CreatureType?
    /// Feet.
    public var visionRadius: Double?
    public var name: String?
    /// Feet.
    public var movementSpeed: Double?
    /// Native only: darkvision range in feet, used on maps with lighting (`GameMap.ambientLight`).
    public var darkvision: Double?
    /// Native only: the name players see on the World View. Nil shows the token's name;
    /// empty shows none (decision 014).
    public var playerName: String?
    /// Native only, DM only: current hit points. Nil is untracked.
    public var hitPoints: Int?
    /// Native only, DM only: maximum hit points. Nil is no maximum.
    public var maxHitPoints: Int?
    /// Native only, DM only: active conditions, in the order added. Nil and empty are both
    /// left out of the file.
    public var conditions: [Condition]?

    private enum CodingKeys: String, CodingKey {
        case id, x, y, src, libraryItemId, scale, type, visionRadius, name, movementSpeed, darkvision, playerName
        case hitPoints, maxHitPoints, conditions
    }

    public init(
        id: String = newID(), x: Double, y: Double, src: String, libraryItemId: String? = nil,
        scale: Double? = nil, type: CreatureType? = nil, visionRadius: Double? = nil,
        name: String? = nil, movementSpeed: Double? = nil, darkvision: Double? = nil, playerName: String? = nil,
        hitPoints: Int? = nil, maxHitPoints: Int? = nil, conditions: [Condition]? = nil
    ) {
        self.id = id
        self.x = x
        self.y = y
        self.src = src
        self.libraryItemId = libraryItemId
        self.scale = scale
        self.type = type
        self.visionRadius = visionRadius
        self.name = name
        self.movementSpeed = movementSpeed
        self.darkvision = darkvision
        self.playerName = playerName
        self.hitPoints = hitPoints
        self.maxHitPoints = maxHitPoints
        self.conditions = conditions
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        x = try c.decode(Double.self, forKey: .x)
        y = try c.decode(Double.self, forKey: .y)
        src = try c.decode(String.self, forKey: .src)
        libraryItemId = try c.decodeIfPresent(String.self, forKey: .libraryItemId)
        scale = try c.decodeIfPresent(Double.self, forKey: .scale)
        type = try c.decodeIfPresent(CreatureType.self, forKey: .type)
        visionRadius = try c.decodeIfPresent(Double.self, forKey: .visionRadius)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        movementSpeed = try c.decodeIfPresent(Double.self, forKey: .movementSpeed)
        darkvision = try c.decodeIfPresent(Double.self, forKey: .darkvision)
        playerName = try c.decodeIfPresent(String.self, forKey: .playerName)
        hitPoints = try c.decodeIfPresent(Int.self, forKey: .hitPoints)
        maxHitPoints = try c.decodeIfPresent(Int.self, forKey: .maxHitPoints)
        // A condition this app doesn't know (from a newer one) is skipped, not fatal to the map.
        let known = (try c.decodeIfPresent([String].self, forKey: .conditions) ?? []).compactMap(Condition.init(rawValue:))
        conditions = known.isEmpty ? nil : known
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        try c.encode(src, forKey: .src)
        try c.encodeIfPresent(libraryItemId, forKey: .libraryItemId)
        try c.encodeIfPresent(scale, forKey: .scale)
        try c.encodeIfPresent(type, forKey: .type)
        try c.encodeIfPresent(visionRadius, forKey: .visionRadius)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(movementSpeed, forKey: .movementSpeed)
        try c.encodeIfPresent(darkvision, forKey: .darkvision)
        try c.encodeIfPresent(playerName, forKey: .playerName)
        try c.encodeIfPresent(hitPoints, forKey: .hitPoints)
        try c.encodeIfPresent(maxHitPoints, forKey: .maxHitPoints)
        if let conditions, !conditions.isEmpty { try c.encode(conditions, forKey: .conditions) }
    }
}

/// A 5e (2024) condition on a token (native only). The DM tracks them; players never see them.
public enum Condition: String, Codable, CaseIterable, Identifiable, Sendable {
    case blinded, charmed, deafened, exhausted, frightened, grappled, incapacitated, invisible
    case paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious

    public var id: Self { self }

    public var title: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }

    /// The SF Symbol shown beside the condition's name in the inspector and on the canvas badge.
    public var symbolName: String {
        switch self {
        case .blinded: return "eye.slash"
        case .charmed: return "heart"
        case .deafened: return "ear.trianglebadge.exclamationmark"
        case .exhausted: return "battery.25"
        case .frightened: return "exclamationmark.triangle"
        case .grappled: return "hand.raised"
        case .incapacitated: return "nosign"
        case .invisible: return "circle.dashed"
        case .paralyzed: return "pause.circle"
        case .petrified: return "mountain.2"
        case .poisoned: return "drop"
        case .prone: return "figure.fall"
        case .restrained: return "link"
        case .stunned: return "sparkles"
        case .unconscious: return "zzz"
        }
    }
}

extension Token {
    /// At 0 hit points.
    public var isDown: Bool { hitPoints == 0 }

    /// Whether `condition` is active.
    public func has(_ condition: Condition) -> Bool { conditions?.contains(condition) ?? false }

    /// Adds `condition` if it isn't active, else removes it. No conditions left is nil.
    public mutating func toggle(_ condition: Condition) {
        var list = conditions ?? []
        if let index = list.firstIndex(of: condition) {
            list.remove(at: index)
        } else {
            list.append(condition)
        }
        conditions = list.isEmpty ? nil : list
    }

    /// Takes `amount` damage, never below 0. Untracked hit points start from the maximum, if any.
    public mutating func applyDamage(_ amount: Int) {
        guard let current = hitPoints ?? maxHitPoints else { return }
        hitPoints = clampedHitPoints(current - max(0, amount))
    }

    /// Heals `amount`, never above the maximum when there is one. Untracked hit points count
    /// as the maximum, as for damage.
    public mutating func heal(_ amount: Int) {
        guard let current = hitPoints ?? maxHitPoints else { return }
        hitPoints = clampedHitPoints(current + max(0, amount))
    }

    /// `value` clamped to 0…`maxHitPoints` (no upper bound without a maximum).
    public func clampedHitPoints(_ value: Int) -> Int {
        let floored = max(0, value)
        guard let maxHitPoints else { return floored }
        return min(floored, max(0, maxHitPoints))
    }
}

public enum DrawingTool: String, Codable, CaseIterable, Sendable {
    case marker, eraser, wall
}

/// What a wall stroke stops (native addition, PARITY §3.5). Not in TS, which ignores the
/// field, so a window there is an ordinary wall.
public enum WallKind: String, Codable, CaseIterable, Sendable {
    /// Blocks sight and movement.
    case wall
    /// Blocks movement; sight passes through.
    case window

    /// A kind written by a newer version reads as a wall, so the file still opens.
    public init(from decoder: Decoder) throws {
        self = WallKind(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .wall
    }
}

/// A stroke (TS `Drawing`, CORE_SPEC §1.5). Eraser strokes are stored too and
/// composited as erase. World point = (px * scale + x, py * scale + y).
public struct Drawing: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var tool: DrawingTool
    /// Flat `[x1, y1, x2, y2, …]` in stroke space.
    public var points: [Double]
    public var color: String
    public var size: Double
    /// One per point, 0…1; present only when pressure sensitivity was on.
    public var pressures: [Double]?
    public var scale: Double?
    public var x: Double?
    public var y: Double?
    /// Walls only; nil is `.wall`.
    public var wallKind: WallKind?
    /// Walls only: sight passes from the left of the stroke as drawn (on screen, facing from
    /// its first point to its last) and is blocked from the right. Nil is two-way.
    public var oneWay: Bool?
    /// Native only, markers only: drawn in the Architect, never on the World View. Written
    /// only when true (decision 014).
    public var isDMOnly: Bool?

    public init(
        id: String = newID(), tool: DrawingTool, points: [Double], color: String, size: Double,
        pressures: [Double]? = nil, scale: Double? = nil, x: Double? = nil, y: Double? = nil,
        wallKind: WallKind? = nil, oneWay: Bool? = nil, isDMOnly: Bool? = nil
    ) {
        self.id = id
        self.tool = tool
        self.points = points
        self.color = color
        self.size = size
        self.pressures = pressures
        self.scale = scale
        self.x = x
        self.y = y
        self.wallKind = wallKind
        self.oneWay = oneWay
        self.isDMOnly = isDMOnly
    }

    /// A marker the players never see.
    public var isHiddenFromPlayers: Bool { tool == .marker && isDMOnly == true }

    /// A wall stroke that stops sight (any wall but a window).
    public var blocksSight: Bool { tool == .wall && (wallKind ?? .wall) == .wall }

    /// Stroke points transformed into world space.
    public var worldPoints: [Point2D] {
        let s = scale ?? 1
        let ox = x ?? 0
        let oy = y ?? 0
        return stride(from: 0, to: points.count - 1, by: 2).map {
            Point2D(x: points[$0] * s + ox, y: points[$0 + 1] * s + oy)
        }
    }
}

public enum DoorOrientation: String, Codable, Sendable {
    case horizontal, vertical
}

public enum DoorSwing: String, Codable, Sendable {
    case left, right, up, down
}

/// A door (TS `Door`, CORE_SPEC §1.7). `x`/`y` is the door's centre.
public struct Door: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var x: Double
    public var y: Double
    /// With `angle` set, the nearest of the two, so the web app still draws the door close by.
    public var orientation: DoorOrientation
    /// Native only: the door's direction in degrees, clockwise from east (map y points down),
    /// in (−90, 90]. Nil is `orientation`'s 0° or 90°.
    public var angle: Double?
    public var isOpen: Bool
    public var isLocked: Bool
    public var size: Double
    public var thickness: Double?
    public var swingDirection: DoorSwing?
    /// Native only: a secret door. Closed, it looks like plain wall on the World View until
    /// the DM reveals it; open, players see it as a door. Nil (left out of the file) is false.
    public var isHidden: Bool?

    public init(
        id: String = newID(), x: Double, y: Double, orientation: DoorOrientation,
        isOpen: Bool = false, isLocked: Bool = false, size: Double,
        thickness: Double? = nil, swingDirection: DoorSwing? = nil, angle: Double? = nil, isHidden: Bool? = nil
    ) {
        self.id = id
        self.x = x
        self.y = y
        self.orientation = orientation
        self.angle = angle
        self.isOpen = isOpen
        self.isLocked = isLocked
        self.size = size
        self.thickness = thickness
        self.swingDirection = swingDirection
        self.isHidden = isHidden
    }

    /// Players see plain wall here: a hidden door that is shut.
    public var looksLikeWall: Bool { isHidden == true && !isOpen }

    /// The direction in radians: `angle`, else 0 (horizontal) or π/2 (vertical).
    public var radians: Double {
        if let angle { return angle * .pi / 180 }
        return orientation == .horizontal ? 0 : .pi / 2
    }

    /// The unit vector from hinge to latch; exact for the axis doors.
    private var direction: (x: Double, y: Double) {
        if angle == nil { return orientation == .horizontal ? (1, 0) : (0, 1) }
        return (cos(radians), sin(radians))
    }

    /// The hinge end (west or north for the axis doors), then the latch end.
    public var ends: (hinge: Point2D, latch: Point2D) {
        let half = size / 2
        let dx = direction.x * half
        let dy = direction.y * half
        return (Point2D(x: x - dx, y: y - dy), Point2D(x: x + dx, y: y + dy))
    }

    /// `p` in the door's own frame: `along` from the centre towards the latch, `across` to
    /// the on-screen right of that.
    public func local(_ p: Point2D) -> (along: Double, across: Double) {
        let (c, s) = direction
        let dx = p.x - x
        let dy = p.y - y
        return (dx * c + dy * s, -dx * s + dy * c)
    }

    /// The bounding box of the door's line, padded by `pad` on every side.
    public func bounds(padding pad: Double) -> Bounds {
        let (a, b) = ends
        return Bounds(
            x: min(a.x, b.x) - pad, y: min(a.y, b.y) - pad,
            width: abs(a.x - b.x) + 2 * pad, height: abs(a.y - b.y) + 2 * pad)
    }
}

public enum CompassDirection: String, Codable, Sendable {
    case north, south, east, west
}

public enum StairsType: String, Codable, Sendable {
    case up, down
}

/// Stairs (TS `Stairs`, CORE_SPEC §1.8). `x`/`y` is the centre. TS only drew them; the
/// native Stairs tool links two ends so a token dropped on one arrives at the other
/// (`StairsEditing.swift`, decision 017).
public struct Stairs: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var x: Double
    public var y: Double
    public var direction: CompassDirection
    public var type: StairsType
    public var width: Double
    public var height: Double
    /// Native only: the sister end's id. Nil (and absent from the file) for stairs that are only
    /// drawn, as in TS; an id with no stairs on the map reads as unlinked.
    public var linkedStairsId: String?

    public init(
        id: String = newID(), x: Double, y: Double, direction: CompassDirection, type: StairsType,
        width: Double, height: Double, linkedStairsId: String? = nil
    ) {
        self.id = id
        self.x = x
        self.y = y
        self.direction = direction
        self.type = type
        self.width = width
        self.height = height
        self.linkedStairsId = linkedStairsId
    }

    public var bounds: Bounds { Bounds(x: x - width / 2, y: y - height / 2, width: width, height: height) }
}

/// A reusable token prototype (TS `TokenLibraryItem`, CORE_SPEC §1.10).
public struct TokenLibraryItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var src: String
    public var thumbnailSrc: String
    /// Free text; "PC" implies creature type PC.
    public var category: String
    public var tags: [String]
    /// Milliseconds since the Unix epoch.
    public var dateAdded: Double
    public var defaultScale: Double?
    public var defaultVisionRadius: Double?
    public var defaultType: CreatureType?
    public var defaultMovementSpeed: Double?
    /// Native only (`Token.darkvision`).
    public var defaultDarkvision: Double?

    public init(
        id: String = newID(), name: String, src: String, thumbnailSrc: String,
        category: String = "Monsters", tags: [String] = [], dateAdded: Double,
        defaultScale: Double? = nil, defaultVisionRadius: Double? = nil,
        defaultType: CreatureType? = nil, defaultMovementSpeed: Double? = nil,
        defaultDarkvision: Double? = nil
    ) {
        self.id = id
        self.name = name
        self.src = src
        self.thumbnailSrc = thumbnailSrc
        self.category = category
        self.tags = tags
        self.dateAdded = dateAdded
        self.defaultScale = defaultScale
        self.defaultVisionRadius = defaultVisionRadius
        self.defaultType = defaultType
        self.defaultMovementSpeed = defaultMovementSpeed
        self.defaultDarkvision = defaultDarkvision
    }
}
