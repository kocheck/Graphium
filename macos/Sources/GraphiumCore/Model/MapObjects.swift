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

    public init(
        id: String = newID(), x: Double, y: Double, src: String, libraryItemId: String? = nil,
        scale: Double? = nil, type: CreatureType? = nil, visionRadius: Double? = nil,
        name: String? = nil, movementSpeed: Double? = nil
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

    public init(
        id: String = newID(), tool: DrawingTool, points: [Double], color: String, size: Double,
        pressures: [Double]? = nil, scale: Double? = nil, x: Double? = nil, y: Double? = nil,
        wallKind: WallKind? = nil, oneWay: Bool? = nil
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
    }

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
    public var orientation: DoorOrientation
    public var isOpen: Bool
    public var isLocked: Bool
    public var size: Double
    public var thickness: Double?
    public var swingDirection: DoorSwing?

    public init(
        id: String = newID(), x: Double, y: Double, orientation: DoorOrientation,
        isOpen: Bool = false, isLocked: Bool = false, size: Double,
        thickness: Double? = nil, swingDirection: DoorSwing? = nil
    ) {
        self.id = id
        self.x = x
        self.y = y
        self.orientation = orientation
        self.isOpen = isOpen
        self.isLocked = isLocked
        self.size = size
        self.thickness = thickness
        self.swingDirection = swingDirection
    }
}

public enum CompassDirection: String, Codable, Sendable {
    case north, south, east, west
}

public enum StairsType: String, Codable, Sendable {
    case up, down
}

/// Stairs (TS `Stairs`, CORE_SPEC §1.8). `x`/`y` is the centre. No TS UI creates
/// these today; kept for file compatibility and the dungeon generator.
public struct Stairs: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var x: Double
    public var y: Double
    public var direction: CompassDirection
    public var type: StairsType
    public var width: Double
    public var height: Double

    public init(
        id: String = newID(), x: Double, y: Double, direction: CompassDirection, type: StairsType,
        width: Double, height: Double
    ) {
        self.id = id
        self.x = x
        self.y = y
        self.direction = direction
        self.type = type
        self.width = width
        self.height = height
    }
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

    public init(
        id: String = newID(), name: String, src: String, thumbnailSrc: String,
        category: String = "Monsters", tags: [String] = [], dateAdded: Double,
        defaultScale: Double? = nil, defaultVisionRadius: Double? = nil,
        defaultType: CreatureType? = nil, defaultMovementSpeed: Double? = nil
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
    }
}
