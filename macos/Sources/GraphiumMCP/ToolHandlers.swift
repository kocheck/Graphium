import Foundation
import GraphiumCore

extension GraphiumTools {
    // MARK: Campaigns

    func listCampaigns(_ args: Arguments) throws -> ToolResult {
        let found = try store.findCampaigns(in: try args.string("folder"))
        var items: [JSONValue] = []
        for url in found {
            var item: [String: JSONValue] = ["path": .string(url.path)]
            if let loaded = try? CampaignStore.read(url) {
                item["name"] = .string(loaded.campaign.name)
                item["maps"] = .array(loaded.campaign.maps.map { JSONValue.string($0.name) })
            } else {
                item["error"] = "couldn't be read"
            }
            items.append(.object(item))
        }
        return .json([
            "server": Self.serverInfo,
            "folders": .array(store.roots.map { JSONValue.string($0.path) }),
            "campaigns": .array(items),
        ])
    }

    func createCampaign(_ args: Arguments) throws -> ToolResult {
        var campaign = Campaign.makeDefault(name: try args.requiredString("name"))
        if let name = try args.string("map_name") { campaign.maps[0].name = name }
        if let grid = try args.enumValue("grid_type", GridType.self, allowed: GridType.allCases.map(\.rawValue)) {
            campaign.maps[0].gridType = grid
        }
        if let size = try args.double("cell_px") { campaign.maps[0].gridSize = try Self.cellSize(size) }
        let loaded = try store.create(try args.requiredString("path"), campaign: campaign)
        return .json(Describe.campaign(loaded.campaign, path: loaded.url.path, assets: loaded.allAssetNames))
    }

    /// `lighting` as the map's ambient light: nil is lighting off.
    static func lighting(_ args: Arguments) throws -> LightLevel? {
        let value = try args.string("lighting")?.lowercased() ?? "off"
        if value == "off" { return nil }
        guard let level = LightLevel(rawValue: value) else { throw ToolError("lighting must be off, dark, dim or bright.") }
        return level
    }

    static func cellSize(_ value: Double) throws -> Double {
        guard (10...500).contains(value) else { throw ToolError("cell_px must be between 10 and 500.") }
        return value
    }

    func getCampaign(_ args: Arguments) throws -> ToolResult {
        let loaded = try store.load(try args.requiredString("campaign"))
        return .json(Describe.campaign(loaded.campaign, path: loaded.url.path, assets: loaded.allAssetNames))
    }

    /// Which server this is, so a model (or the DM) can tell a stale install from a missing feature.
    static var serverInfo: JSONValue {
        ["name": "graphium-mcp", "version": .string(GraphiumTools.version)]
    }

    // MARK: Maps

    func getMap(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: false) { loaded, index, units in
            var filter = Describe.MapFilter()
            filter.includeMarkerPoints = try args.bool("include_marker_points") ?? false
            filter.summary = try args.bool("summary") ?? false
            if let kinds = try args.strings("kinds") {
                let unknown = kinds.filter { !Describe.MapFilter.kinds.contains($0) }
                guard unknown.isEmpty else {
                    throw ToolError(
                        "kinds can't include \(unknown.joined(separator: ", ")). Use \(Describe.MapFilter.kinds.joined(separator: ", ")).")
                }
                filter.kinds = Set(kinds)
            }
            filter.region = try Self.region(args, units: units)
            return Describe.map(loaded.campaign.maps[index], campaign: loaded.campaign, units: units, filter: filter)
        }
    }

    /// An optional `region` {x, y, width, height} in the call's units, as map pixels.
    static func region(_ args: Arguments, units: Units) throws -> Bounds? {
        guard let r = args.values["region"], !r.isNull else { return nil }
        let ra = Arguments(r, context: "region")
        return Bounds(
            x: units.px(try ra.requiredDouble("x")), y: units.px(try ra.requiredDouble("y")),
            width: units.px(try ra.requiredDouble("width")), height: units.px(try ra.requiredDouble("height")))
    }

    func addMap(_ args: Arguments) throws -> ToolResult {
        var loaded = try store.load(try args.requiredString("campaign"))
        var map = GameMap(name: try args.requiredString("name"))
        if let grid = try args.enumValue("grid_type", GridType.self, allowed: GridType.allCases.map(\.rawValue)) {
            map.gridType = grid
        }
        if let size = try args.double("cell_px") { map.gridSize = try Self.cellSize(size) }
        if let color = try args.string("grid_color") { map.gridColor = try Self.color(color, "grid_color") }
        if let daylight = try args.bool("daylight") { map.isDaylightMode = daylight }
        if args.has("lighting") { map.ambientLight = try Self.lighting(args) }
        loaded.campaign.maps.append(map)
        if try args.bool("make_active") ?? true { loaded.campaign.activeMapID = map.id }
        try store.save(&loaded)
        return .json(Describe.mapSummary(map, active: loaded.campaign.activeMapID == map.id, library: [:]))
    }

    func updateMap(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, _ in
            if let name = try args.string("name") { loaded.campaign.maps[index].name = name }
            if let grid = try args.enumValue("grid_type", GridType.self, allowed: GridType.allCases.map(\.rawValue)) {
                loaded.campaign.maps[index].gridType = grid
            }
            if let color = try args.string("grid_color") {
                loaded.campaign.maps[index].gridColor = try Self.color(color, "grid_color")
            }
            if let daylight = try args.bool("daylight") { loaded.campaign.maps[index].isDaylightMode = daylight }
            if args.has("lighting") { loaded.campaign.maps[index].ambientLight = try Self.lighting(args) }
            if try args.bool("make_active") == true { loaded.campaign.activeMapID = loaded.campaign.maps[index].id }
            let map = loaded.campaign.maps[index]
            return Describe.mapSummary(map, active: loaded.campaign.activeMapID == map.id, library: loaded.campaign.libraryIndex)
        }
    }

    func deleteMap(_ args: Arguments) throws -> ToolResult {
        var loaded = try store.load(try args.requiredString("campaign"))
        let index = try Self.mapIndex(in: loaded.campaign, try args.requiredString("map"))
        guard loaded.campaign.maps.count > 1 else {
            throw ToolError("A campaign keeps at least one map. Add another map first, or use clear_map.")
        }
        let removed = loaded.campaign.maps.remove(at: index)
        if loaded.campaign.activeMapID == removed.id {
            // As the app does: the next map by order becomes active.
            loaded.campaign.activeMapID = loaded.campaign.maps[min(index, loaded.campaign.maps.count - 1)].id
        }
        try store.save(&loaded)
        return .json(["deleted": .string(removed.name), "active_map": .string(loaded.campaign.activeMapID)])
    }

    func setBackground(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            if try args.bool("remove") == true {
                loaded.campaign.maps[index].background = nil
                return ["background": .null]
            }
            let path = try args.requiredString("image_path")
            let image = try ImageImport.load(try store.resolveImage(path), kind: .map)
            let name = loaded.addAsset(image.data, preferredName: image.preferredName)
            let position = units.px(try args.point("position") ?? .zero)
            let gridSize = loaded.campaign.maps[index].gridSize
            var scale = 1.0
            if let cells = try args.double("width_cells") {
                guard cells > 0 else { throw ToolError("width_cells must be more than 0.") }
                scale = cells * gridSize / Double(image.width)
            } else if let cellPx = try args.double("image_cell_px") {
                guard cellPx > 0 else { throw ToolError("image_cell_px must be more than 0.") }
                // The image may have been downscaled on import; image_cell_px is in original pixels.
                let shrink = Double(image.width) / Double(image.originalWidth)
                scale = gridSize / (cellPx * shrink)
            } else if let explicit = try args.double("scale") {
                guard explicit > 0 else { throw ToolError("scale must be more than 0.") }
                scale = explicit
            }
            loaded.campaign.maps[index].background = MapBackground(
                src: name, x: position.x, y: position.y, width: Double(image.width), height: Double(image.height),
                scale: scale)
            let w = Double(image.width) * scale
            let h = Double(image.height) * scale
            var out: [String: JSONValue] = [
                "asset": .string(name),
                "position": units.out(position),
                "width": units.out(w),
                "height": units.out(h),
                "size_cells": .point(w / gridSize, h / gridSize),
            ]
            if image.width != image.originalWidth {
                out["note"] = .string(
                    "Downscaled from \(image.originalWidth)×\(image.originalHeight) to \(image.width)×\(image.height) px.")
            }
            return .object(out)
        }
    }

    // MARK: Walls, rooms, doors

    func drawWalls(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            let tolerance = units.px(try args.double("snap_tolerance") ?? 0)
            guard tolerance >= 0 else { throw ToolError("snap_tolerance must be 0 or more.") }
            var added: [JSONValue] = []
            var snapped = 0
            for wall in try args.objects("walls") {
                var points = try wall.points("points", minimum: 2).map { units.px($0) }
                if tolerance > 0 {
                    let result = Self.snap(points, to: loaded.campaign.maps[index], tolerance: tolerance)
                    points = result.points
                    snapped += result.moved
                }
                if try wall.bool("closed") == true, let first = points.first, points.last != first { points.append(first) }
                let kind = try wall.enumValue("kind", WallKind.self, allowed: ["wall", "window"]) ?? .wall
                let drawing = Self.wallStroke(points, kind: kind, oneWay: try wall.bool("one_way") ?? false)
                loaded.campaign.maps[index].drawings.append(drawing)
                added.append(.string(drawing.id))
            }
            var out: [String: JSONValue] = ["added_wall_ids": .array(added)]
            if tolerance > 0 { out["snapped_points"] = .number(Double(snapped)) }
            return .object(out)
        }
    }

    /// Moves points onto the corners of walls already on the map (and, for a polyline's two
    /// ends, onto the nearest point of a wall) when within `tolerance` pixels, so rooms close
    /// without hand-matching coordinates.
    static func snap(_ points: [Point2D], to map: GameMap, tolerance: Double) -> (points: [Point2D], moved: Int) {
        let walls = map.wallStrokes.map(\.worldPoints)
        let corners = walls.flatMap { $0 }
        let segments = walls.flatMap { p in p.count < 2 ? [] : (1..<p.count).map { (p[$0 - 1], p[$0]) } }
        var moved = 0
        let result = points.enumerated().map { i, point -> Point2D in
            if let corner = corners.min(by: { hypot($0.x - point.x, $0.y - point.y) < hypot($1.x - point.x, $1.y - point.y) }),
                hypot(corner.x - point.x, corner.y - point.y) <= tolerance
            {
                if corner != point { moved += 1 }
                return corner
            }
            guard i == 0 || i == points.count - 1 else { return point }
            let nearest = segments.map { closestPoint(point, $0.0, $0.1) }
                .min { hypot($0.x - point.x, $0.y - point.y) < hypot($1.x - point.x, $1.y - point.y) }
            guard let nearest, hypot(nearest.x - point.x, nearest.y - point.y) <= tolerance else { return point }
            if nearest != point { moved += 1 }
            return nearest
        }
        return (result, moved)
    }

    static func wallStroke(_ points: [Point2D], kind: WallKind = .wall, oneWay: Bool = false) -> Drawing {
        Drawing(
            tool: .wall, points: points.flatMap { [$0.x, $0.y] }, color: StrokeDefaults.wallColor,
            size: StrokeDefaults.wallSize, wallKind: kind == .wall ? nil : kind, oneWay: oneWay ? true : nil)
    }

    enum Side: String, CaseIterable {
        case north, east, south, west
    }

    func addRooms(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            let cell = loaded.campaign.maps[index].gridSize
            var rooms: [JSONValue] = []
            for room in try args.objects("rooms") {
                let x = units.px(try room.requiredDouble("x"))
                let y = units.px(try room.requiredDouble("y"))
                let w = units.px(try room.requiredDouble("width"))
                let h = units.px(try room.requiredDouble("height"))
                guard w > 0, h > 0 else { throw ToolError("\(room.context): width and height must be more than 0.") }
                func sideLength(_ side: Side) -> Double { side == .north || side == .south ? w : h }
                func pointOn(_ side: Side, _ t: Double) -> Point2D {
                    switch side {
                    case .north: return Point2D(x: x + t, y: y)
                    case .south: return Point2D(x: x + t, y: y + h)
                    case .west: return Point2D(x: x, y: y + t)
                    case .east: return Point2D(x: x + w, y: y + t)
                    }
                }

                var gaps: [Side: [(Double, Double)]] = [:]
                for opening in try (room.has("openings") ? room.objects("openings") : []) {
                    let side = try Self.side(opening)
                    let width = try opening.double("width").map(units.px) ?? cell
                    let at = try opening.double("at").map(units.px) ?? sideLength(side) / 2
                    gaps[side, default: []].append((at - width / 2, at + width / 2))
                }

                // Walk the outline clockwise from the top-left corner, leaving out the gaps.
                // Clockwise order: north left→right, east top→bottom, south right→left, west bottom→top.
                var pieces: [[Point2D]] = []
                var current: [Point2D] = []
                for side in Side.allCases {
                    let length = sideLength(side)
                    let reversed = side == .south || side == .west
                    // Gap intervals in walking order, clipped to the side.
                    var intervals = (gaps[side] ?? []).map { (max(0, $0.0), min(length, $0.1)) }.filter { $0.0 < $0.1 }
                    if reversed { intervals = intervals.map { (length - $0.1, length - $0.0) } }
                    intervals.sort { $0.0 < $1.0 }
                    func point(_ walked: Double) -> Point2D { pointOn(side, reversed ? length - walked : walked) }
                    var cursor = 0.0
                    if current.isEmpty { current = [point(0)] }
                    for (from, to) in intervals where to > cursor {
                        if from > cursor { current.append(point(from)) }
                        if current.count >= 2 { pieces.append(current) }
                        current = [point(to)]
                        cursor = to
                    }
                    if cursor < length { current.append(point(length)) } else { current = [point(length)] }
                }
                if current.count >= 2 {
                    // The last run ends at the top-left corner: join it to the first run.
                    if let first = pieces.first, first.first == current.last {
                        pieces[0] = current + first.dropFirst()
                    } else {
                        pieces.append(current)
                    }
                }
                if gaps.isEmpty, let outline = pieces.first, outline.first != outline.last {
                    pieces[0].append(outline[0])
                }

                var wallIDs: [JSONValue] = []
                for piece in pieces where piece.count >= 2 {
                    let drawing = Self.wallStroke(Self.removingCollinear(piece))
                    loaded.campaign.maps[index].drawings.append(drawing)
                    wallIDs.append(.string(drawing.id))
                }

                var doorIDs: [JSONValue] = []
                for spec in try (room.has("doors") ? room.objects("doors") : []) {
                    let side = try Self.side(spec)
                    let width = try spec.double("width").map(units.px) ?? cell
                    let at = try spec.double("at").map(units.px) ?? sideLength(side) / 2
                    let centre = pointOn(side, min(max(at, 0), sideLength(side)))
                    var door = Self.makeDoor(
                        centre: centre, width: width, degrees: side == .north || side == .south ? 0 : 90,
                        open: try spec.bool("open") ?? false, locked: try spec.bool("locked") ?? false)
                    if try spec.bool("hidden") == true { door.isHidden = true }
                    loaded.campaign.maps[index].doors.append(door)
                    doorIDs.append(.string(door.id))
                }

                var out: [String: JSONValue] = [
                    "wall_ids": .array(wallIDs), "door_ids": .array(doorIDs),
                    "bounds": ["x": units.out(x), "y": units.out(y), "width": units.out(w), "height": units.out(h)],
                ]
                if let name = try room.string("name") { out["name"] = .string(name) }
                rooms.append(.object(out))
            }
            return ["rooms": .array(rooms)]
        }
    }

    static func side(_ args: Arguments) throws -> Side {
        guard let side = try args.enumValue("side", Side.self, allowed: Side.allCases.map(\.rawValue)) else {
            throw ToolError("\(args.context).side is required (north, south, east or west).")
        }
        return side
    }

    /// Drops points that sit on a straight line between their neighbours, so a side split
    /// into runs stays one segment where it can.
    static func removingCollinear(_ points: [Point2D]) -> [Point2D] {
        guard points.count > 2 else { return points }
        var out = [points[0]]
        for i in 1..<(points.count - 1) {
            let a = out[out.count - 1]
            let b = points[i]
            let c = points[i + 1]
            let cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
            let sameDirection = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) > 0
            if abs(cross) > 1e-6 || !sameDirection || b == a { out.append(b) }
        }
        out.append(points[points.count - 1])
        return out.enumerated().filter { $0.offset == 0 || $0.element != out[$0.offset - 1] }.map(\.element)
    }

    /// A door centred on `centre` at `degrees` (normalised to (−90, 90]). `angle` is stored
    /// only off the axes; `orientation` is always the nearest axis, as the app writes it.
    static func makeDoor(centre: Point2D, width: Double, degrees: Double, open: Bool, locked: Bool) -> Door {
        var d = degrees.truncatingRemainder(dividingBy: 180)
        if d > 90 { d -= 180 } else if d <= -90 { d += 180 }
        let isAxis = abs(d) < 0.01 || abs(abs(d) - 90) < 0.01
        let orientation: DoorOrientation = abs(d) <= 45 ? .horizontal : .vertical
        return Door(
            x: centre.x, y: centre.y, orientation: orientation, isOpen: open, isLocked: locked, size: width,
            angle: isAxis ? nil : d)
    }

    /// The angle of the wall nearest `point` within `reach`, in degrees, or nil.
    static func nearestWallAngle(_ map: GameMap, to point: Point2D, reach: Double) -> Double? {
        let nearby = LineOfSight.strokeWalls(of: map)
            + map.drawings.filter { $0.tool == .wall && !$0.blocksSight }.flatMap { d -> [WallSegment] in
                let p = d.worldPoints
                return p.count < 2 ? [] : (1..<p.count).map { WallSegment(start: p[$0 - 1], end: p[$0]) }
            }
        guard
            let wall = nearby.map({ (wall: $0, distance: segmentDistance(point, $0.start, $0.end)) })
                .filter({ $0.distance <= reach }).min(by: { $0.distance < $1.distance })?.wall
        else { return nil }
        return atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180 / .pi
    }

    func addDoors(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            var added: [JSONValue] = []
            for spec in try args.objects("doors") {
                guard let centre = try spec.point("center").map(units.px) else {
                    throw ToolError("\(spec.context).center is required.")
                }
                let map = loaded.campaign.maps[index]
                let width = try spec.double("width").map(units.px) ?? map.gridSize
                guard width > 0 else { throw ToolError("\(spec.context).width must be more than 0.") }
                let degrees =
                    try spec.double("angle") ?? Self.nearestWallAngle(map, to: centre, reach: map.gridSize * 0.25) ?? 0
                var door = Self.makeDoor(
                    centre: centre, width: width, degrees: degrees, open: try spec.bool("open") ?? false,
                    locked: try spec.bool("locked") ?? false)
                if try spec.bool("hidden") == true { door.isHidden = true }
                loaded.campaign.maps[index].doors.append(door)
                added.append(Describe.door(door, units: units))
            }
            return ["added_doors": .array(added)]
        }
    }

    // MARK: Tokens, stairs, markers

    func addTokens(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            let library = loaded.campaign.libraryIndex
            var added: [JSONValue] = []
            for spec in try args.objects("tokens") {
                guard let position = try spec.point("position").map(units.px) else {
                    throw ToolError("\(spec.context).position is required.")
                }
                let type = try spec.enumValue("type", CreatureType.self, allowed: ["PC", "NPC"])
                var token = Token(x: position.x, y: position.y, src: "", type: type, name: try spec.string("name"))
                if let size = try spec.double("size") {
                    guard size > 0, size <= 20 else { throw ToolError("\(spec.context).size must be between 0 and 20 cells.") }
                    let cells = units.inPixels ? size / loaded.campaign.maps[index].gridSize : size
                    token.scale = cells == 1 ? nil : cells
                }
                token.visionRadius = try spec.double("vision_ft")
                token.darkvision = try spec.double("darkvision_ft")
                token.movementSpeed = try spec.double("speed_ft")
                token.playerName = try spec.string("player_name")

                if let reference = try spec.string("library_item") {
                    guard let item = Self.libraryItem(reference, in: loaded.campaign.tokenLibrary) else {
                        throw ToolError("\(spec.context): no token library item \(reference). See list_token_library.")
                    }
                    token.libraryItemId = item.id
                    token.src = item.src
                } else if let path = try spec.string("image_path") {
                    let image = try ImageImport.load(try store.resolveImage(path), kind: .token)
                    token.src = loaded.addAsset(image.data, preferredName: image.preferredName)
                } else {
                    let label = token.name ?? (type == .pc ? "PC" : "NPC")
                    let colour = try spec.string("color").map { try Self.color($0, "\(spec.context).color") }
                    let art = TokenArt.disc(label: label, type: type, color: colour)
                    if loaded.allAssetNames.contains(art.name) {
                        token.src = art.name
                    } else if let png = art.png() {
                        token.src = loaded.addAsset(png, preferredName: art.name)
                    }
                }
                if token.name == nil, token.libraryItemId == nil { token.name = type == .pc ? "PC" : "Token" }
                loaded.campaign.maps[index].tokens.append(token)
                added.append(Describe.token(token, map: loaded.campaign.maps[index], library: library, units: units))
            }
            return ["added_tokens": .array(added)]
        }
    }

    static func libraryItem(_ reference: String, in items: [TokenLibraryItem]) -> TokenLibraryItem? {
        items.last { $0.id == reference }
            ?? items.last { $0.name.caseInsensitiveCompare(reference) == .orderedSame }
    }

    func addStairs(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            let cell = loaded.campaign.maps[index].gridSize
            var added: [JSONValue] = []
            for spec in try args.objects("stairs") {
                guard let centre = try spec.point("center").map(units.px) else {
                    throw ToolError("\(spec.context).center is required.")
                }
                let stairs = Stairs(
                    x: centre.x, y: centre.y,
                    direction: try spec.enumValue("direction", CompassDirection.self, allowed: ["north", "south", "east", "west"])
                        ?? .north,
                    type: try spec.enumValue("type", StairsType.self, allowed: ["up", "down"]) ?? .down,
                    width: try spec.double("width").map(units.px) ?? cell,
                    height: try spec.double("height").map(units.px) ?? cell)
                loaded.campaign.maps[index].stairs.append(stairs)
                added.append(Describe.stairs(stairs, units: units))
            }
            return ["added_stairs": .array(added)]
        }
    }

    func addLights(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            var added: [JSONValue] = []
            for spec in try args.objects("lights") {
                guard let centre = try spec.point("center").map(units.px) else {
                    throw ToolError("\(spec.context).center is required.")
                }
                var light: LightSource
                if let name = try spec.string("preset") {
                    guard let preset = LightPreset.all.first(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame })
                    else {
                        let names = LightPreset.all.map(\.name).joined(separator: ", ")
                        throw ToolError("\(spec.context).preset must be one of \(names).")
                    }
                    light = preset.light(at: centre)
                } else {
                    let bright = try spec.double("bright_ft")
                    guard let dim = try spec.double("dim_ft") ?? bright.map({ $0 * 2 }) else {
                        throw ToolError("\(spec.context) needs a preset, or bright_ft and dim_ft.")
                    }
                    light = LightSource(x: centre.x, y: centre.y, bright: bright ?? dim / 2, dim: dim)
                }
                if let bright = try spec.double("bright_ft") { light.bright = bright }
                if let dim = try spec.double("dim_ft") { light.dim = dim }
                light.bright = max(0, light.bright)
                light.dim = max(light.dim, light.bright)
                if let on = try spec.bool("on") { light.isOn = on }
                if let name = try spec.string("name") { light.name = name }
                loaded.campaign.maps[index].lights.append(light)
                added.append(Describe.light(light, units: units))
            }
            var out: [String: JSONValue] = ["added_lights": .array(added)]
            if loaded.campaign.maps[index].ambientLight == nil {
                out["note"] = .string(
                    "Lighting is off on this map, so lights have no effect yet. Turn it on with update_map lighting "
                        + "\"dark\" (or \"dim\").")
            }
            return .object(out)
        }
    }

    /// A note's `sounds`: Session Console tracks, effects and soundscapes, by name (or id). Nil when absent.
    static func noteSounds(_ args: Arguments, console: SessionConsoleCatalog) throws -> [NoteSound]? {
        guard let items = try args.array("sounds") else { return nil }
        let choices = console.noteSoundChoices
        var sounds: [NoteSound] = []
        for (offset, item) in items.enumerated() {
            let spec = Arguments(item, context: "\(args.context.isEmpty ? "" : args.context + ".")sounds[\(offset)]")
            guard item.objectValue != nil else { throw ToolError("\(spec.context) must be an object.") }
            let name = try spec.requiredString("name")
            let byID = choices.filter { $0.sound.ref == name }
            let matches = byID.isEmpty ? choices.filter { $0.title.caseInsensitiveCompare(name) == .orderedSame } : byID
            guard matches.count == 1, var sound = matches.first?.sound else {
                let available = choices.map(\.title).joined(separator: ", ")
                throw ToolError(
                    matches.isEmpty
                        ? "\(spec.context): the Session Console has no track, effect or soundscape named \(name). It has: \(available)."
                        : "\(spec.context): more than one track, effect or soundscape is named \(name); rename one in the Session Console.")
            }
            sound.playOnShow = try spec.bool("play_on_show") ?? false
            if !sounds.contains(where: { $0.ref == sound.ref }) { sounds.append(sound) }
        }
        return sounds
    }

    func addNotes(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            var added: [JSONValue] = []
            for spec in try args.objects("notes") {
                guard let centre = try spec.point("center").map(units.px) else {
                    throw ToolError("\(spec.context).center is required.")
                }
                let console = loaded.campaign.sessionConsole
                let note = MapNote(
                    x: centre.x, y: centre.y, title: try spec.string("title") ?? "", dmNotes: try spec.string("dm_notes") ?? "",
                    playerNotes: try spec.string("player_notes") ?? "", isShared: try spec.bool("shared") ?? false,
                    sounds: try Self.noteSounds(spec, console: console) ?? [])
                loaded.campaign.maps[index].notes.append(note)
                added.append(Describe.note(note, console: console, units: units))
            }
            return ["added_notes": .array(added)]
        }
    }

    /// A token on `map` by id, else by name (the last one placed wins), for an effect to ride on.
    static func token(_ reference: String, in map: GameMap, library: [String: TokenLibraryItem]) -> Token? {
        map.tokens.last { $0.id == reference }
            ?? map.tokens.last { ResolvedToken($0, library: library).name.caseInsensitiveCompare(reference) == .orderedSame }
    }

    static let effectShapes = SpellEffect.Shape.allCases.map(\.rawValue)
    static let effectLooks = SpellEffect.Look.allCases.map(\.rawValue)

    /// Degrees in [0, 360).
    static func degrees(_ value: Double) -> Double {
        let d = value.truncatingRemainder(dividingBy: 360)
        return d < 0 ? d + 360 : d
    }

    /// The direction from `origin` toward `target`, or `direction_deg`, when either is given.
    static func effectDirection(_ spec: Arguments, origin: Point2D, units: Units) throws -> Double? {
        if let target = try spec.point("toward").map(units.px) {
            return degrees(Measure.angleDegrees(from: origin, to: target))
        }
        return try spec.double("direction_deg").map(degrees)
    }

    func addEffects(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            let library = loaded.campaign.libraryIndex
            var map = loaded.campaign.maps[index]
            var added: [JSONValue] = []
            for spec in try args.objects("effects") {
                guard let shape = try spec.enumValue("shape", SpellEffect.Shape.self, allowed: Self.effectShapes) else {
                    throw ToolError("\(spec.context).shape is required: \(Self.effectShapes.joined(separator: ", ")).")
                }
                guard let size = try spec.double("size_ft"), size >= SpellEffect.minimumSize, size <= 1000 else {
                    throw ToolError("\(spec.context).size_ft is required, from 5 to 1000.")
                }
                var origin = try spec.point("origin").map(units.px)
                var carrier: Token?
                if let reference = try spec.string("carried_by") {
                    guard let token = Self.token(reference, in: map, library: library) else {
                        throw ToolError("\(spec.context): no token \(reference) on \(map.name). Use get_map for token ids.")
                    }
                    carrier = token
                    if origin == nil {
                        let box = map.tokenBounds(token, library: library)
                        origin = Point2D(x: box.x + box.width / 2, y: box.y + box.height / 2)
                    }
                }
                guard let origin else { throw ToolError("\(spec.context) needs an origin, or carried_by.") }
                var effect = SpellEffect(
                    shape: shape, size: size, x: origin.x, y: origin.y, tokenID: carrier?.id,
                    look: try spec.enumValue("look", SpellEffect.Look.self, allowed: Self.effectLooks) ?? .arcane,
                    color: try spec.string("color").map { try Self.color($0, "\(spec.context).color") },
                    label: try spec.string("label") ?? "", isHidden: try spec.bool("hidden") ?? false)
                if let width = try spec.double("width_ft") { effect.width = max(1, width) }
                if shape.hasDirection { effect.angle = try Self.effectDirection(spec, origin: origin, units: units) ?? 0 }
                let placed = map.placeEffect(effect, library: library)
                added.append(Describe.effect(placed, map: map, library: library, units: units))
            }
            loaded.campaign.maps[index] = map
            return ["added_effects": .array(added)]
        }
    }

    func drawMarkers(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            var added: [JSONValue] = []
            for spec in try args.objects("strokes") {
                let points = try spec.points("points", minimum: 2).map { units.px($0) }
                let color = try spec.string("color").map { try Self.color($0, "\(spec.context).color") }
                let drawing = Drawing(
                    tool: .marker, points: points.flatMap { [$0.x, $0.y] }, color: color ?? StrokeDefaults.markerColor,
                    size: try spec.double("width_px") ?? StrokeDefaults.markerSize,
                    isDMOnly: try spec.bool("dm_only") == true ? true : nil)
                loaded.campaign.maps[index].drawings.append(drawing)
                added.append(.string(drawing.id))
            }
            return ["added_marker_ids": .array(added)]
        }
    }

    // MARK: Editing

    func updateObjects(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            var map = loaded.campaign.maps[index]
            var results: [JSONValue] = []
            for change in try args.objects("changes") {
                let id = try change.requiredString("id")
                var used: Set<String> = ["id"]
                func take(_ key: String) -> Bool {
                    guard change.has(key) else { return false }
                    used.insert(key)
                    return true
                }
                var kind = "unknown"
                if let i = map.tokens.firstIndex(where: { $0.id == id }) {
                    kind = "token"
                    if take("position"), let p = try change.point("position").map(units.px) {
                        map.tokens[i].x = p.x
                        map.tokens[i].y = p.y
                    }
                    if take("name") { map.tokens[i].name = try change.string("name") }
                    if take("type") {
                        map.tokens[i].type = try change.enumValue("type", CreatureType.self, allowed: ["PC", "NPC"])
                    }
                    if take("size"), let size = try change.double("size") {
                        let cells = units.inPixels ? size / map.gridSize : size
                        map.tokens[i].scale = cells
                    }
                    if take("vision_ft") { map.tokens[i].visionRadius = try change.double("vision_ft") }
                    if take("darkvision_ft") { map.tokens[i].darkvision = try change.double("darkvision_ft") }
                    if take("speed_ft") { map.tokens[i].movementSpeed = try change.double("speed_ft") }
                    // null goes back to the token's name; "" shows players no name.
                    if take("player_name") || change.values["player_name"]?.isNull == true {
                        used.insert("player_name")
                        map.tokens[i].playerName = try change.string("player_name")
                    }
                    // New art only; name, stats and any library link stay (as Change Image in the app).
                    if take("image_library_item"), let reference = try change.string("image_library_item") {
                        guard let item = Self.libraryItem(reference, in: loaded.campaign.tokenLibrary) else {
                            throw ToolError("\(change.context): no token library item \(reference). See list_token_library.")
                        }
                        map.tokens[i].src = item.src
                    }
                    if take("image_path"), let path = try change.string("image_path") {
                        let image = try ImageImport.load(try store.resolveImage(path), kind: .token)
                        map.tokens[i].src = loaded.addAsset(image.data, preferredName: image.preferredName)
                    }
                } else if let i = map.doors.firstIndex(where: { $0.id == id }) {
                    kind = "door"
                    if take("open"), let open = try change.bool("open") { map.doors[i].isOpen = open }
                    if take("locked"), let locked = try change.bool("locked") { map.doors[i].isLocked = locked }
                    if take("hidden"), let hidden = try change.bool("hidden") { map.doors[i].isHidden = hidden ? true : nil }
                    if take("center"), let p = try change.point("center").map(units.px) {
                        map.doors[i].x = p.x
                        map.doors[i].y = p.y
                    }
                    if take("width"), let w = try change.double("width") { map.doors[i].size = units.px(w) }
                    if take("angle"), let degrees = try change.double("angle") {
                        let door = map.doors[i]
                        let rebuilt = Self.makeDoor(
                            centre: Point2D(x: door.x, y: door.y), width: door.size, degrees: degrees, open: door.isOpen,
                            locked: door.isLocked)
                        map.doors[i].angle = rebuilt.angle
                        map.doors[i].orientation = rebuilt.orientation
                    }
                } else if let i = map.drawings.firstIndex(where: { $0.id == id }) {
                    let isWall = map.drawings[i].tool == .wall
                    kind = isWall ? "wall" : "marker"
                    if isWall, take("kind"), let k = try change.enumValue("kind", WallKind.self, allowed: ["wall", "window"]) {
                        map.setWallKind(k, ids: [id])
                    }
                    if isWall, take("one_way"), let oneWay = try change.bool("one_way") { map.setOneWay(oneWay, ids: [id]) }
                    if isWall, take("flip"), try change.bool("flip") == true { map.flipWalls([id]) }
                    if take("points") {
                        let points = try change.points("points", minimum: 2).map { units.px($0) }
                        map.drawings[i].points = points.flatMap { [$0.x, $0.y] }
                        map.drawings[i].x = nil
                        map.drawings[i].y = nil
                        map.drawings[i].scale = nil
                        map.drawings[i].pressures = nil
                    }
                    if !isWall, take("color"), let color = try change.string("color") {
                        map.drawings[i].color = try Self.color(color, "\(change.context).color")
                    }
                    if !isWall, take("dm_only"), let dmOnly = try change.bool("dm_only") {
                        map.setMarkersDMOnly(dmOnly, ids: [id])
                    }
                } else if let i = map.lights.firstIndex(where: { $0.id == id }) {
                    kind = "light"
                    if take("center"), let p = try change.point("center").map(units.px) {
                        map.lights[i].x = p.x
                        map.lights[i].y = p.y
                    }
                    if take("bright_ft"), let bright = try change.double("bright_ft") { map.lights[i].bright = max(0, bright) }
                    if take("dim_ft"), let dim = try change.double("dim_ft") { map.lights[i].dim = max(0, dim) }
                    map.lights[i].dim = max(map.lights[i].dim, map.lights[i].bright)
                    if take("on"), let on = try change.bool("on") { map.lights[i].isOn = on }
                    if take("name") { map.lights[i].name = try change.string("name") }
                } else if let i = map.notes.firstIndex(where: { $0.id == id }) {
                    kind = "note"
                    if take("center"), let p = try change.point("center").map(units.px) {
                        map.notes[i].x = p.x
                        map.notes[i].y = p.y
                    }
                    if take("title") { map.notes[i].title = try change.string("title") ?? "" }
                    if take("dm_notes") { map.notes[i].dmNotes = try change.string("dm_notes") ?? "" }
                    if take("player_notes") { map.notes[i].playerNotes = try change.string("player_notes") ?? "" }
                    if take("shared"), let shared = try change.bool("shared") { map.notes[i].isShared = shared }
                    if take("sounds"), let sounds = try Self.noteSounds(change, console: loaded.campaign.sessionConsole) {
                        map.notes[i].sounds = sounds
                    }
                } else if let i = map.effects.firstIndex(where: { $0.id == id }) {
                    kind = "effect"
                    let library = loaded.campaign.libraryIndex
                    if take("carried_by"), let reference = try change.string("carried_by") {
                        if reference.isEmpty {
                            map.attachEffects([id], to: nil, library: library)
                        } else {
                            guard let token = Self.token(reference, in: map, library: library) else {
                                throw ToolError("\(change.context): no token \(reference) on \(map.name).")
                            }
                            map.attachEffects([id], to: token.id, library: library)
                        }
                    }
                    if take("origin"), let p = try change.point("origin").map(units.px) {
                        // A carried effect keeps riding its token, from this point.
                        let now = map.effectOrigin(map.effects[i], library: library)
                        map.effects[i].x += p.x - now.x
                        map.effects[i].y += p.y - now.y
                    }
                    if take("shape"),
                        let shape = try change.enumValue("shape", SpellEffect.Shape.self, allowed: Self.effectShapes)
                    {
                        map.effects[i].shape = shape
                    }
                    if take("size_ft"), let size = try change.double("size_ft") {
                        map.effects[i].size = min(1000, max(SpellEffect.minimumSize, size))
                    }
                    if take("width_ft"), let width = try change.double("width_ft") { map.effects[i].width = max(1, width) }
                    if change.has("toward") || change.has("direction_deg") {
                        used.formUnion(["toward", "direction_deg"].filter(change.has))
                        let origin = map.effectOrigin(map.effects[i], library: library)
                        if let angle = try Self.effectDirection(change, origin: origin, units: units) { map.effects[i].angle = angle }
                    }
                    if take("look"), let look = try change.enumValue("look", SpellEffect.Look.self, allowed: Self.effectLooks) {
                        map.effects[i].look = look
                    }
                    if take("color") {
                        let color = try change.string("color") ?? ""
                        map.effects[i].color = color.isEmpty ? nil : try Self.color(color, "\(change.context).color")
                    }
                    if take("label") { map.effects[i].label = try change.string("label") ?? "" }
                    if take("hidden"), let hidden = try change.bool("hidden") { map.effects[i].isHidden = hidden }
                } else if let i = map.stairs.firstIndex(where: { $0.id == id }) {
                    kind = "stairs"
                    if take("center"), let p = try change.point("center").map(units.px) {
                        map.stairs[i].x = p.x
                        map.stairs[i].y = p.y
                    }
                    if take("direction"),
                        let d = try change.enumValue("direction", CompassDirection.self, allowed: ["north", "south", "east", "west"])
                    {
                        map.stairs[i].direction = d
                    }
                    if take("type"), let t = try change.enumValue("type", StairsType.self, allowed: ["up", "down"]) {
                        map.stairs[i].type = t
                    }
                } else {
                    throw ToolError("\(change.context): no object \(id) on \(map.name). Use get_map for ids.")
                }
                var result: [String: JSONValue] = ["id": .string(id), "kind": .string(kind)]
                let ignored = change.values.keys.filter { !used.contains($0) }.sorted()
                if !ignored.isEmpty { result["ignored_fields"] = .array(ignored.map { JSONValue.string($0) }) }
                results.append(.object(result))
            }
            loaded.campaign.maps[index] = map
            return ["updated": .array(results)]
        }
    }

    func removeObjects(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, _ in
            let ids = Set(try args.strings("ids") ?? [])
            var map = loaded.campaign.maps[index]
            func count(_ m: GameMap) -> Int {
                m.tokens.count + m.drawings.count + m.doors.count + m.stairs.count + m.lights.count + m.notes.count
                    + m.effects.count
            }
            let effectsBefore = map.effects.filter { !ids.contains($0.id) }.count
            let before = count(map)
            map.removeItems(ids)
            map.stairs.removeAll { ids.contains($0.id) }
            // Effects the removed tokens carried go with them.
            let carried = effectsBefore - map.effects.count
            let removed = before - count(map) - carried
            loaded.campaign.maps[index] = map
            var out: [String: JSONValue] = ["removed": .number(Double(removed))]
            if carried > 0 { out["carried_effects_removed"] = .number(Double(carried)) }
            if removed < ids.count { out["not_found"] = .number(Double(ids.count - removed)) }
            return .object(out)
        }
    }

    func moveObjects(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            let ids = try args.strings("ids") ?? []
            guard !ids.isEmpty else { throw ToolError("ids needs at least one id.") }
            var map = loaded.campaign.maps[index]
            var positions: [String: Point2D] = [:]
            for id in ids {
                if let t = map.tokens.first(where: { $0.id == id }) {
                    positions[id] = Point2D(x: t.x, y: t.y)
                } else if let l = map.lights.first(where: { $0.id == id }) {
                    positions[id] = Point2D(x: l.x, y: l.y)
                } else if let n = map.notes.first(where: { $0.id == id }) {
                    positions[id] = Point2D(x: n.x, y: n.y)
                } else if let e = map.effects.first(where: { $0.id == id }) {
                    positions[id] = map.effectOrigin(e, library: loaded.campaign.libraryIndex)
                } else {
                    throw ToolError(
                        "No token, light, note or effect \(id) on \(map.name). Use get_map for ids; move walls and doors with "
                            + "update_objects.")
                }
            }
            let by = try args.point("by").map(units.px)
            let to = try args.point("to").map(units.px)
            guard (by == nil) != (to == nil) else {
                throw ToolError("Give either by [dx, dy] (how far to move) or to [x, y] (where the group's top-left goes).")
            }
            var offset = by ?? .zero
            if let to {
                let minX = positions.values.map(\.x).min() ?? 0
                let minY = positions.values.map(\.y).min() ?? 0
                offset = Point2D(x: to.x - minX, y: to.y - minY)
            }
            var moved: [JSONValue] = []
            for id in ids {
                if let i = map.tokens.firstIndex(where: { $0.id == id }) {
                    map.tokens[i].x += offset.x
                    map.tokens[i].y += offset.y
                    moved.append(["id": .string(id), "kind": "token", "position": units.out(Point2D(x: map.tokens[i].x, y: map.tokens[i].y))])
                } else if let i = map.lights.firstIndex(where: { $0.id == id }) {
                    map.lights[i].x += offset.x
                    map.lights[i].y += offset.y
                    moved.append(["id": .string(id), "kind": "light", "center": units.out(Point2D(x: map.lights[i].x, y: map.lights[i].y))])
                } else if let i = map.notes.firstIndex(where: { $0.id == id }) {
                    map.notes[i].x += offset.x
                    map.notes[i].y += offset.y
                    moved.append(["id": .string(id), "kind": "note", "center": units.out(Point2D(x: map.notes[i].x, y: map.notes[i].y))])
                } else if let i = map.effects.firstIndex(where: { $0.id == id }) {
                    // An effect whose carrier moves in this group already went along with it.
                    if !(map.effects[i].tokenID.map(ids.contains) ?? false) {
                        map.effects[i].x += offset.x
                        map.effects[i].y += offset.y
                    }
                    let origin = map.effectOrigin(map.effects[i], library: loaded.campaign.libraryIndex)
                    moved.append(["id": .string(id), "kind": "effect", "origin": units.out(origin)])
                }
            }
            loaded.campaign.maps[index] = map
            return ["moved": .array(moved), "by": units.out(offset)]
        }
    }

    func clearMap(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, _ in
            let layers = try args.strings("layers") ?? []
            var map = loaded.campaign.maps[index]
            for layer in layers {
                switch layer {
                case "walls": map.drawings.removeAll { $0.tool == .wall }
                case "markers": map.drawings.removeAll { $0.tool != .wall }
                case "doors": map.doors.removeAll()
                case "tokens":
                    map.effects.removeAll { $0.tokenID != nil }  // carried effects go with their tokens
                    map.tokens.removeAll()
                case "stairs": map.stairs.removeAll()
                case "lights": map.lights.removeAll()
                case "notes": map.notes.removeAll()
                case "effects": map.effects.removeAll()
                case "fog": map.exploredRegions.removeAll()
                case "background": map.background = nil
                default:
                    throw ToolError("Unknown layer \(layer). Use walls, doors, tokens, markers, stairs, lights, notes, effects, fog or background.")
                }
            }
            loaded.campaign.maps[index] = map
            return ["cleared": .array(layers.map { JSONValue.string($0) })]
        }
    }

    // MARK: Generation

    func generateDungeon(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: true) { loaded, index, units in
            let gridSize = loaded.campaign.maps[index].gridSize
            func clamp(_ value: Int?, _ range: ClosedRange<Int>, _ fallback: Int) -> Int {
                min(max(value ?? fallback, range.lowerBound), range.upperBound)
            }
            let minSize = clamp(try args.int("min_room_size"), DungeonOptions.minRoomSizeRange, 3)
            var options = DungeonOptions(
                numRooms: clamp(try args.int("rooms"), DungeonOptions.roomCountRange, 6), minRoomSize: minSize,
                maxRoomSize: max(clamp(try args.int("max_room_size"), DungeonOptions.maxRoomSizeRange, 8), minSize),
                gridSize: gridSize)
            options.canvasWidth = (try args.double("width_cells") ?? 38.4) * gridSize
            options.canvasHeight = (try args.double("height_cells") ?? 21.6) * gridSize
            let result: DungeonResult
            if let seed = try args.int("seed") {
                var rng = SeededRandom(seed: UInt64(bitPattern: Int64(seed)))
                result = DungeonGenerator.generate(options, using: &rng)
            } else {
                result = DungeonGenerator.generate(options)
            }
            if try args.bool("replace") ?? true {
                loaded.campaign.maps[index].drawings.removeAll { $0.tool == .wall }
                loaded.campaign.maps[index].doors.removeAll()
            }
            loaded.campaign.maps[index].drawings += result.drawings
            loaded.campaign.maps[index].doors += result.doors
            return [
                "rooms": .array(
                    result.rooms.enumerated().map { i, b in
                        [
                            "number": .number(Double(i + 1)),
                            "x": units.out(b.x), "y": units.out(b.y), "width": units.out(b.width),
                            "height": units.out(b.height),
                        ]
                    }),
                "walls_added": .number(Double(result.drawings.count)),
                "doors_added": .number(Double(result.doors.count)),
            ]
        }
    }

    // MARK: Looking

    func renderMap(_ args: Arguments) throws -> ToolResult {
        let loaded = try store.load(try args.requiredString("campaign"))
        let index = try Self.mapIndex(in: loaded.campaign, try args.string("map"))
        let map = loaded.campaign.maps[index]
        let units = try Units(map: map, name: try args.string("units"))
        let format = try args.string("format") ?? "image"
        guard ["image", "ascii", "both"].contains(format) else { throw ToolError("format must be image, ascii or both.") }
        let players = (try args.string("view") ?? "dm") == "players"
        let region = try Self.region(args, units: units)
        let maxPx = min(max(try args.int("max_px") ?? 1200, 200), 2400)
        var content: [ToolResult.Content] = []
        if format != "ascii" {
            let renderer = MapRenderer(map: map, campaign: loaded.campaign, packageURL: loaded.url)
            guard let png = renderer.png(region: region, maxPixels: maxPx, playersView: players) else {
                throw ToolError("Couldn't draw the map image; try format \"ascii\".")
            }
            content.append(.png(png))
            content.append(.text(renderer.caption(region: region, units: units, playersView: players)))
        }
        if format != "image" {
            content.append(.text(AsciiMap(map: map, library: loaded.campaign.libraryIndex).render(region: region)))
        }
        return ToolResult(content: content)
    }

    func checkMap(_ args: Arguments) throws -> ToolResult {
        try withMap(args, write: false) { loaded, index, units in
            let issues = MapChecks(
                map: loaded.campaign.maps[index], library: loaded.campaign.libraryIndex, units: units,
                console: loaded.campaign.sessionConsole
            ).run()
            return [
                "map": .string(loaded.campaign.maps[index].name),
                "ok": .bool(issues.isEmpty),
                "issues": .array(issues),
                "not_checked": .string(MapChecks.notChecked),
            ]
        }
    }

    func listLibrary(_ args: Arguments) throws -> ToolResult {
        let loaded = try store.load(try args.requiredString("campaign"))
        let search = try args.string("search")?.lowercased()
        let items = loaded.campaign.tokenLibrary.filter { item in
            guard let search, !search.isEmpty else { return true }
            return ([item.name, item.category] + item.tags).contains { $0.lowercased().contains(search) }
        }
        return .json(["items": .array(items.map(Describe.libraryItem))])
    }

    func undo(_ args: Arguments) throws -> ToolResult {
        let remaining = try store.undo(try args.requiredString("campaign"), force: try args.bool("force") ?? false)
        return .json(["undone": true, "steps_left": .number(Double(remaining))])
    }

    // MARK: Helpers

    static func color(_ value: String, _ field: String) throws -> String {
        let hex = value.hasPrefix("#") ? String(value.dropFirst()) : value
        guard hex.count == 6 || hex.count == 3, hex.allSatisfy(\.isHexDigit) else {
            throw ToolError("\(field) must be a colour like #aa3322.")
        }
        return "#" + hex.lowercased()
    }
}

/// Distance from `p` to the segment a–b.
func segmentDistance(_ p: Point2D, _ a: Point2D, _ b: Point2D) -> Double {
    let c = closestPoint(p, a, b)
    return hypot(c.x - p.x, c.y - p.y)
}

/// The point of segment a–b nearest `p`.
func closestPoint(_ p: Point2D, _ a: Point2D, _ b: Point2D) -> Point2D {
    let dx = b.x - a.x
    let dy = b.y - a.y
    let lengthSquared = dx * dx + dy * dy
    var t = lengthSquared > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared : 0
    t = min(max(t, 0), 1)
    return Point2D(x: a.x + t * dx, y: a.y + t * dy)
}

/// SplitMix64, so a seed gives the same dungeon every time.
struct SeededRandom: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}
