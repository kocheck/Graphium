import Foundation

/// Random room-and-corridor dungeons (TS `DungeonGenerator.ts`, CORE_SPEC §3.8).
/// Pieces alternate room, corridor, room, …; each connection gets a door on both rooms.
public struct DungeonOptions: Equatable, Sendable {
    public var numRooms: Int
    /// Room sizes in cells.
    public var minRoomSize = 3
    public var maxRoomSize = 8
    public var gridSize = 50.0
    public var canvasWidth = 1920.0
    public var canvasHeight = 1080.0
    public var wallColor = StrokeDefaults.wallColor
    public var wallSize = StrokeDefaults.wallSize

    public init(numRooms: Int, minRoomSize: Int = 3, maxRoomSize: Int = 8, gridSize: Double = 50) {
        self.numRooms = numRooms
        self.minRoomSize = minRoomSize
        self.maxRoomSize = maxRoomSize
        self.gridSize = gridSize
    }

    /// Dialog limits (TS `DungeonGeneratorDialog`).
    public static let roomCountRange = 3...15
    public static let minRoomSizeRange = 2...6
    public static let maxRoomSizeRange = 4...12
}

public struct DungeonResult: Equatable, Sendable {
    public var drawings: [Drawing]
    public var doors: [Door]
    /// Room bounds in creation order.
    public var rooms: [Bounds]
}

public enum DungeonGenerator {
    static let retriesPerRoom = 10
    static let retryThresholdFraction = 0.5
    static let corridorLengthCells = 4.0
    static let corridorWidthCells = 2.0
    static let minWallSegmentFraction = 0.25

    enum Direction: CaseIterable {
        case north, south, east, west

        var opposite: Direction {
            switch self {
            case .north: return .south
            case .south: return .north
            case .east: return .west
            case .west: return .east
            }
        }

        var isHorizontalWall: Bool { self == .north || self == .south }
    }

    struct Piece {
        var bounds: Bounds
        var isRoom: Bool
        /// Wall points per side: 2 points (one segment) or 4 (split by a doorway).
        var walls: [Direction: [Point2D]]
        var doorways: [Direction: Point2D] = [:]

        init(bounds: Bounds, isRoom: Bool, sides: [Direction]) {
            self.bounds = bounds
            self.isRoom = isRoom
            walls = Dictionary(uniqueKeysWithValues: sides.map { ($0, Piece.wall($0, bounds)) })
        }

        /// TS point order: north (x,y)→(x+w,y), east (x+w,y)→(x+w,y+h),
        /// south (x+w,y+h)→(x,y+h), west (x,y+h)→(x,y).
        static func wall(_ side: Direction, _ b: Bounds) -> [Point2D] {
            switch side {
            case .north: return [Point2D(x: b.x, y: b.y), Point2D(x: b.x + b.width, y: b.y)]
            case .east: return [Point2D(x: b.x + b.width, y: b.y), Point2D(x: b.x + b.width, y: b.y + b.height)]
            case .south: return [Point2D(x: b.x + b.width, y: b.y + b.height), Point2D(x: b.x, y: b.y + b.height)]
            case .west: return [Point2D(x: b.x, y: b.y + b.height), Point2D(x: b.x, y: b.y)]
            }
        }

        /// TS `updateWallSegments`: rebuild only the sides that still exist.
        mutating func rebuildWalls() {
            for side in Array(walls.keys) { walls[side] = Piece.wall(side, bounds) }
        }
    }

    public static func generate(_ options: DungeonOptions) -> DungeonResult {
        var rng = SystemRandomNumberGenerator()
        return generate(options, using: &rng)
    }

    public static func generate<R: RandomNumberGenerator>(_ options: DungeonOptions, using rng: inout R) -> DungeonResult {
        let g = options.gridSize
        func random() -> Double { Double.random(in: 0..<1, using: &rng) }
        func createRoom(at origin: Point2D) -> Piece {
            _ = random()  // TS picks a room template (always the single rectangular one)
            let span = options.maxRoomSize - options.minRoomSize + 1
            let w = Double(Int(random() * Double(span)) + options.minRoomSize) * g
            let h = Double(Int(random() * Double(span)) + options.minRoomSize) * g
            return Piece(
                bounds: Bounds(x: origin.x, y: origin.y, width: w, height: h), isRoom: true,
                sides: [.north, .south, .east, .west])
        }

        let start = Point2D(
            x: jsRound(options.canvasWidth / 2 / g) * g, y: jsRound(options.canvasHeight / 2 / g) * g)
        var pieces = [createRoom(at: start)]
        var used: [Int: Set<Direction>] = [0: []]

        let maxRetries = options.numRooms * retriesPerRoom
        var retries = 0
        var roomsAdded = 1
        while roomsAdded < options.numRooms && retries < maxRetries {
            retries += 1
            let roomIndices = pieces.indices.filter { $0 % 2 == 0 }
            let source = roomIndices[Int(random() * Double(roomIndices.count))]
            var candidates = Direction.allCases.filter { !(used[source] ?? []).contains($0) }
            // Fisher–Yates with the injected RNG (TS used a biased sort-based shuffle).
            if candidates.count > 1 {
                for i in stride(from: candidates.count - 1, to: 0, by: -1) {
                    candidates.swapAt(i, Int(random() * Double(i + 1)))
                }
            }
            var added = false
            for direction in candidates {
                guard let pair = tryAdd(from: source, direction, pieces: &pieces, g: g, createRoom: createRoom)
                else { continue }
                pieces.append(pair.0)
                pieces.append(pair.1)
                used[source, default: []].insert(direction)
                used[pieces.count - 1] = [direction.opposite]
                roomsAdded += 1
                retries = 0
                added = true
                break
            }
            if !added && Double(retries) >= Double(maxRetries) * retryThresholdFraction { break }
        }

        var drawings: [Drawing] = []
        var doors: [Door] = []
        for piece in pieces {
            for side in Direction.allCases {
                guard let points = piece.walls[side] else { continue }
                for pair in stride(from: 0, to: points.count - 1, by: 2) {
                    drawings.append(
                        Drawing(
                            tool: .wall,
                            points: [points[pair].x, points[pair].y, points[pair + 1].x, points[pair + 1].y],
                            color: options.wallColor, size: options.wallSize))
                }
            }
            for side in Direction.allCases {
                if let position = piece.doorways[side] { doors.append(door(at: position, side, g: g)) }
            }
        }
        return DungeonResult(drawings: drawings, doors: doors, rooms: pieces.filter(\.isRoom).map(\.bounds))
    }

    /// TS `tryAddPieceInDirection`: corridor + room off `source`, or nil on collision.
    /// Mutates the source's walls/doorways only on success.
    static func tryAdd(
        from source: Int, _ dir: Direction, pieces: inout [Piece], g: Double, createRoom: (Point2D) -> Piece
    ) -> (Piece, Piece)? {
        let b = pieces[source].bounds
        let snap = { (v: Double) in jsRound(v / g) * g }
        let connection: Point2D
        switch dir {
        case .north: connection = Point2D(x: snap(b.x + b.width / 2), y: b.y)
        case .south: connection = Point2D(x: snap(b.x + b.width / 2), y: b.y + b.height)
        case .east: connection = Point2D(x: b.x + b.width, y: snap(b.y + b.height / 2))
        case .west: connection = Point2D(x: b.x, y: snap(b.y + b.height / 2))
        }
        let cw = corridorWidthCells * g
        let cl = corridorLengthCells * g
        var corridor: Piece
        switch dir {
        case .north:
            corridor = Piece(bounds: Bounds(x: snap(connection.x) - cw / 2, y: connection.y - cl, width: cw, height: cl), isRoom: false, sides: [.east, .west])
        case .south:
            corridor = Piece(bounds: Bounds(x: snap(connection.x) - cw / 2, y: connection.y, width: cw, height: cl), isRoom: false, sides: [.east, .west])
        case .east:
            corridor = Piece(bounds: Bounds(x: connection.x, y: snap(connection.y) - cw / 2, width: cl, height: cw), isRoom: false, sides: [.north, .south])
        case .west:
            corridor = Piece(bounds: Bounds(x: connection.x - cl, y: snap(connection.y) - cw / 2, width: cl, height: cw), isRoom: false, sides: [.north, .south])
        }

        var room = createRoom(.zero)
        let c = corridor.bounds
        let w = room.bounds.width
        let h = room.bounds.height
        switch dir {
        case .north: room.bounds.x = connection.x - w / 2; room.bounds.y = c.y - h
        case .south: room.bounds.x = connection.x - w / 2; room.bounds.y = c.y + c.height
        case .east: room.bounds.x = c.x + c.width; room.bounds.y = connection.y - h / 2
        case .west: room.bounds.x = c.x - w; room.bounds.y = connection.y - h / 2
        }
        room.bounds.x = snap(room.bounds.x)
        room.bounds.y = snap(room.bounds.y)
        room.rebuildWalls()

        // Re-centre the corridor on the snapped room.
        let r = room.bounds
        if dir.isHorizontalWall {
            corridor.bounds.x += snap(r.x + r.width / 2) - connection.x
        } else {
            corridor.bounds.y += snap(r.y + r.height / 2) - connection.y
        }
        corridor.rebuildWalls()

        for (index, piece) in pieces.enumerated() where index != source {
            if overlaps(corridor.bounds, piece.bounds, pad: g) || overlaps(room.bounds, piece.bounds, pad: g) {
                return nil
            }
        }

        let cc = Point2D(x: corridor.bounds.x + corridor.bounds.width / 2, y: corridor.bounds.y + corridor.bounds.height / 2)
        let sourceDoor: Point2D
        let roomDoor: Point2D
        switch dir {
        case .north:
            sourceDoor = Point2D(x: snap(cc.x), y: b.y)
            roomDoor = Point2D(x: snap(cc.x), y: r.y + r.height)
        case .south:
            sourceDoor = Point2D(x: snap(cc.x), y: b.y + b.height)
            roomDoor = Point2D(x: snap(cc.x), y: r.y)
        case .east:
            sourceDoor = Point2D(x: b.x + b.width, y: snap(cc.y))
            roomDoor = Point2D(x: r.x, y: snap(cc.y))
        case .west:
            sourceDoor = Point2D(x: b.x, y: snap(cc.y))
            roomDoor = Point2D(x: r.x + r.width, y: snap(cc.y))
        }
        removeConnectingWalls(&pieces[source], dir, at: sourceDoor, g: g)
        removeConnectingWalls(&room, dir.opposite, at: roomDoor, g: g)
        return (corridor, room)
    }

    /// TS `boundsOverlap`: touching or within `pad` counts as overlapping.
    static func overlaps(_ a: Bounds, _ b: Bounds, pad: Double) -> Bool {
        !(a.x + a.width + pad < b.x || a.x > b.x + b.width + pad || a.y + a.height + pad < b.y || a.y > b.y + b.height + pad)
    }

    /// TS `removeConnectingWalls`: cut a one-cell doorway into that side's wall,
    /// keeping a remaining part only if it's longer than a quarter cell.
    static func removeConnectingWalls(_ piece: inout Piece, _ dir: Direction, at door: Point2D, g: Double) {
        piece.doorways[dir] = door
        guard let wall = piece.walls[dir], wall.count >= 2 else { return }
        let minSegment = g * minWallSegmentFraction
        let horizontal = dir.isHorizontalWall
        let a = horizontal ? min(wall[0].x, wall[1].x) : min(wall[0].y, wall[1].y)
        let z = horizontal ? max(wall[0].x, wall[1].x) : max(wall[0].y, wall[1].y)
        guard z - a > g + minSegment else {
            piece.walls[dir] = nil
            return
        }
        let centre = horizontal ? door.x : door.y
        let fixed = horizontal ? wall[0].y : wall[0].x
        func point(_ along: Double) -> Point2D {
            horizontal ? Point2D(x: along, y: fixed) : Point2D(x: fixed, y: along)
        }
        var kept: [Point2D] = []
        let gapStart = centre - g / 2
        let gapEnd = centre + g / 2
        if gapStart > a && gapStart - a > minSegment { kept += [point(a), point(gapStart)] }
        if z > gapEnd && z - gapEnd > minSegment { kept += [point(gapEnd), point(z)] }
        piece.walls[dir] = kept.isEmpty ? nil : kept
    }

    /// TS `createDoorFromPosition`.
    static func door(at position: Point2D, _ dir: Direction, g: Double) -> Door {
        let swing: DoorSwing
        switch dir {
        case .north: swing = .left
        case .south: swing = .right
        case .east: swing = .down
        case .west: swing = .up
        }
        return Door(
            x: position.x, y: position.y, orientation: dir.isHorizontalWall ? .horizontal : .vertical,
            size: g, thickness: 12, swingDirection: swing)
    }
}

extension GameMap {
    /// The dialog's apply: optionally clear every drawing and door, then add the dungeon.
    public mutating func apply(_ dungeon: DungeonResult, clearFirst: Bool) {
        if clearFirst {
            drawings.removeAll()
            doors.removeAll()
        }
        drawings += dungeon.drawings
        doors += dungeon.doors
    }
}
