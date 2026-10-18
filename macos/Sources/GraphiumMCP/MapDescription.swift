import Foundation
import GraphiumCore

/// Converts between the units tools speak (grid cells by default) and the map's pixels.
/// Models place things far more reliably in cells ("a 6×4 room at 2,3") than in pixels.
struct Units {
    let gridSize: Double
    let inPixels: Bool

    init(map: GameMap, name: String?) throws {
        gridSize = map.gridSize
        switch name?.lowercased() {
        case nil, "cells", "cell", "squares": inPixels = false
        case "px", "pixels": inPixels = true
        default: throw ToolError("units must be \"cells\" (default) or \"px\".")
        }
    }

    var name: String { inPixels ? "px" : "cells" }
    var scale: Double { inPixels ? 1 : gridSize }

    func px(_ value: Double) -> Double { value * scale }
    func px(_ p: Point2D) -> Point2D { Point2D(x: p.x * scale, y: p.y * scale) }
    func out(_ value: Double) -> JSONValue { .rounded(value / scale) }
    func out(_ p: Point2D) -> JSONValue { .point(p.x / scale, p.y / scale) }
}

extension GameMap {
    /// The box around everything on the map (background, walls, doors, tokens), in pixels.
    func contentBounds(library: [String: TokenLibraryItem]) -> Bounds? {
        var boxes: [Bounds] = []
        if let bg = background { boxes.append(Bounds(x: bg.x, y: bg.y, width: bg.width * bg.scale, height: bg.height * bg.scale)) }
        boxes += drawings.filter { !$0.points.isEmpty }.map { drawingBounds($0) }
        boxes += doors.map { $0.bounds(padding: 0) }
        boxes += tokens.map { tokenBounds($0, library: library) }
        boxes += lights.map { Bounds(x: $0.x - gridSize / 2, y: $0.y - gridSize / 2, width: gridSize, height: gridSize) }
        boxes += notes.map { Bounds(x: $0.x - gridSize / 2, y: $0.y - gridSize / 2, width: gridSize, height: gridSize) }
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

    var wallStrokes: [Drawing] { drawings.filter { $0.tool == .wall } }
    var markerStrokes: [Drawing] { drawings.filter { $0.tool != .wall } }
}

/// JSON views of the campaign for the model: ids, names and positions in the caller's units.
enum Describe {
    static func campaign(_ campaign: Campaign, path: String, assets: Set<String>) -> JSONValue {
        let library = campaign.libraryIndex
        var out: [String: JSONValue] = [
            "server": GraphiumTools.serverInfo,
            "path": .string(path),
            "id": .string(campaign.id),
            "name": .string(campaign.name),
            "active_map": .string(campaign.activeMapID),
            "maps": .array(campaign.maps.map { mapSummary($0, active: $0.id == campaign.activeMapID, library: library) }),
            "token_library": .number(Double(campaign.tokenLibrary.count)),
            "asset_files": .number(Double(assets.count)),
        ]
        if campaign.maps.contains(where: { !$0.exploredRegions.isEmpty }) {
            out["fog_reset"] =
                "explored_fog_regions counts fog the players have already uncovered; clear_map with layers [\"fog\"] resets it."
        }
        return .object(out)
    }

    static func mapSummary(_ map: GameMap, active: Bool, library: [String: TokenLibraryItem]) -> JSONValue {
        var summary: [String: JSONValue] = [
            "id": .string(map.id),
            "name": .string(map.name),
            "active": .bool(active),
            "grid": grid(map),
            "daylight": .bool(map.isDaylightMode),
            "lighting": lighting(map),
            "counts": [
                "walls": .number(Double(map.wallStrokes.count)),
                "doors": .number(Double(map.doors.count)),
                "tokens": .number(Double(map.tokens.count)),
                "stairs": .number(Double(map.stairs.count)),
                "lights": .number(Double(map.lights.count)),
                "notes": .number(Double(map.notes.count)),
                "markers": .number(Double(map.markerStrokes.count)),
                "explored_fog_regions": .number(Double(map.exploredRegions.count)),
            ],
            "has_background": .bool(map.background != nil),
        ]
        if let b = map.contentBounds(library: library) {
            let g = map.gridSize
            summary["extent_cells"] = [
                "x": .rounded(b.x / g), "y": .rounded(b.y / g), "width": .rounded(b.width / g),
                "height": .rounded(b.height / g),
            ]
        }
        return .object(summary)
    }

    static func lighting(_ map: GameMap) -> JSONValue {
        .string(map.ambientLight?.rawValue ?? "off")
    }

    static func light(_ light: LightSource, units: Units) -> JSONValue {
        var out: [String: JSONValue] = [
            "id": .string(light.id),
            "center": units.out(Point2D(x: light.x, y: light.y)),
            "bright_ft": .rounded(light.bright),
            "dim_ft": .rounded(light.dim),
            "on": .bool(light.isOn),
        ]
        if let name = light.name { out["name"] = .string(name) }
        return .object(out)
    }

    static func note(_ note: MapNote, console: SessionConsoleCatalog, units: Units) -> JSONValue {
        var out: [String: JSONValue] = [
            "id": .string(note.id),
            "center": units.out(Point2D(x: note.x, y: note.y)),
            "title": .string(note.title),
            "dm_notes": .string(note.dmNotes),
            "player_notes": .string(note.playerNotes),
            "shared": .bool(note.isShared),
        ]
        if !note.sounds.isEmpty { out["sounds"] = .array(note.sounds.map { sound($0, console: console) }) }
        return .object(out)
    }

    static func sound(_ sound: NoteSound, console: SessionConsoleCatalog) -> JSONValue {
        var out: [String: JSONValue] = [
            "kind": .string(sound.kind == .sfx ? "effect" : sound.kind.rawValue),
            "play_on_show": .bool(sound.playOnShow),
        ]
        if let title = console.title(of: sound) { out["name"] = .string(title) } else { out["missing"] = .bool(true) }
        return .object(out)
    }

    static func grid(_ map: GameMap) -> JSONValue {
        ["type": .string(map.gridType.rawValue), "cell_px": .rounded(map.gridSize), "color": .string(map.gridColor)]
    }

    /// What get_map returns: every kind, or only some; the whole map, or what touches `region`
    /// (pixels); walls with every point, or (summary) only their ids, size and ends.
    struct MapFilter {
        static let kinds = ["walls", "doors", "tokens", "lights", "notes", "stairs", "markers", "background"]
        var kinds = Set(MapFilter.kinds)
        var region: Bounds?
        var summary = false
        var includeMarkerPoints = false

        func keeps(_ bounds: Bounds) -> Bool { region.map { $0.intersects(bounds) } ?? true }
    }

    static func map(_ map: GameMap, campaign: Campaign, units: Units, filter: MapFilter = MapFilter()) -> JSONValue {
        let library = campaign.libraryIndex
        let g = map.gridSize
        func point(_ x: Double, _ y: Double) -> Bounds { Bounds(x: x - g / 2, y: y - g / 2, width: g, height: g) }
        var out: [String: JSONValue] = [
            "id": .string(map.id),
            "name": .string(map.name),
            "active": .bool(map.id == campaign.activeMapID),
            "units": .string(units.name),
            "grid": grid(map),
            "daylight": .bool(map.isDaylightMode),
            "lighting": lighting(map),
            "explored_fog_regions": .number(Double(map.exploredRegions.count)),
        ]
        let k = filter.kinds
        if k.contains("lights") {
            out["lights"] = .array(map.lights.filter { filter.keeps(point($0.x, $0.y)) }.map { light($0, units: units) })
        }
        if k.contains("notes") {
            out["notes"] = .array(
                map.notes.filter { filter.keeps(point($0.x, $0.y)) }.map {
                    note($0, console: campaign.sessionConsole, units: units)
                })
        }
        if k.contains("walls") {
            out["walls"] = .array(
                map.wallStrokes.filter { d in
                    guard let region = filter.region else { return true }
                    let p = d.worldPoints
                    guard p.count >= 2 else { return p.first.map { region.intersects(point($0.x, $0.y)) } ?? false }
                    return (1..<p.count).contains { MapChecks.segment(p[$0 - 1], p[$0], intersects: region) }
                }.map { filter.summary ? wallSummary($0, map: map, units: units) : wall($0, units: units) })
        }
        if k.contains("doors") {
            out["doors"] = .array(map.doors.filter { filter.keeps($0.bounds(padding: 0)) }.map { door($0, units: units) })
        }
        if k.contains("tokens") {
            out["tokens"] = .array(
                map.tokens.filter { filter.keeps(map.tokenBounds($0, library: library)) }.map {
                    token($0, map: map, library: library, units: units)
                })
        }
        if k.contains("stairs") {
            out["stairs"] = .array(map.stairs.filter { filter.keeps(point($0.x, $0.y)) }.map { stairs($0, units: units) })
        }
        if k.contains("markers") {
            out["markers"] = .array(
                map.markerStrokes.filter { filter.keeps(map.drawingBounds($0)) }.map {
                    marker($0, units: units, includePoints: filter.includeMarkerPoints && !filter.summary)
                })
        }
        if filter.summary || filter.region != nil || k.count < MapFilter.kinds.count {
            out["counts"] = [
                "walls": .number(Double(map.wallStrokes.count)),
                "doors": .number(Double(map.doors.count)),
                "tokens": .number(Double(map.tokens.count)),
                "stairs": .number(Double(map.stairs.count)),
                "lights": .number(Double(map.lights.count)),
                "notes": .number(Double(map.notes.count)),
                "markers": .number(Double(map.markerStrokes.count)),
            ]
            out["filtered"] = .string(
                "Only part of the map is listed (summary, kinds or region); counts are for the whole map.")
        }
        if k.contains("background"), let bg = map.background {
            out["background"] = [
                "asset": .string(bg.src),
                "position": units.out(Point2D(x: bg.x, y: bg.y)),
                "width": units.out(bg.width * bg.scale),
                "height": units.out(bg.height * bg.scale),
                "image_px": .point(bg.width, bg.height),
                "scale": .rounded(bg.scale),
            ]
        } else if k.contains("background") {
            out["background"] = .null
        }
        if let b = map.contentBounds(library: library) {
            out["extent"] = [
                "x": units.out(b.x), "y": units.out(b.y), "width": units.out(b.width), "height": units.out(b.height),
            ]
        }
        return .object(out)
    }

    static func wall(_ d: Drawing, units: Units) -> JSONValue {
        [
            "id": .string(d.id),
            "points": .array(d.worldPoints.map { units.out($0) }),
            "kind": .string((d.wallKind ?? .wall).rawValue),
            "one_way": .bool(d.oneWay ?? false),
        ]
    }

    /// A wall without its points: enough to find it and decide whether to read it in full.
    static func wallSummary(_ d: Drawing, map: GameMap, units: Units) -> JSONValue {
        let points = d.worldPoints
        let b = map.drawingBounds(d)
        var out: [String: JSONValue] = [
            "id": .string(d.id),
            "kind": .string((d.wallKind ?? .wall).rawValue),
            "one_way": .bool(d.oneWay ?? false),
            "point_count": .number(Double(points.count)),
            "bounds": ["x": units.out(b.x), "y": units.out(b.y), "width": units.out(b.width), "height": units.out(b.height)],
        ]
        if let first = points.first, let last = points.last {
            out["from"] = units.out(first)
            out["to"] = units.out(last)
            out["closed"] = .bool(points.count > 2 && hypot(first.x - last.x, first.y - last.y) < 1e-6)
        }
        return .object(out)
    }

    static func door(_ door: Door, units: Units) -> JSONValue {
        var out: [String: JSONValue] = [
            "id": .string(door.id),
            "center": units.out(Point2D(x: door.x, y: door.y)),
            "width": units.out(door.size),
            "angle": .rounded(door.radians * 180 / .pi),
            "open": .bool(door.isOpen),
            "locked": .bool(door.isLocked),
        ]
        if door.isHidden == true { out["hidden"] = .bool(true) }
        if let swing = door.swingDirection { out["swing"] = .string(swing.rawValue) }
        return .object(out)
    }

    static func token(_ token: Token, map: GameMap, library: [String: TokenLibraryItem], units: Units) -> JSONValue {
        let resolved = ResolvedToken(token, library: library)
        var out: [String: JSONValue] = [
            "id": .string(token.id),
            "name": .string(resolved.name),
            "position": units.out(Point2D(x: token.x, y: token.y)),
            "size": units.out(map.gridSize * resolved.scale),
            "type": resolved.type.map { JSONValue.string($0.rawValue) } ?? .null,
            "speed_ft": .rounded(resolved.movementSpeed),
            "image": .string(token.src),
        ]
        out["vision_ft"] = resolved.visionRadius.map { JSONValue.rounded($0) } ?? .null
        out["darkvision_ft"] = resolved.darkvision.map { JSONValue.rounded($0) } ?? .null
        if let item = token.libraryItemId { out["library_item"] = .string(item) }
        if let playerName = token.playerName { out["player_name"] = .string(playerName) }
        return .object(out)
    }

    static func stairs(_ s: Stairs, units: Units) -> JSONValue {
        [
            "id": .string(s.id),
            "center": units.out(Point2D(x: s.x, y: s.y)),
            "width": units.out(s.width),
            "height": units.out(s.height),
            "direction": .string(s.direction.rawValue),
            "type": .string(s.type.rawValue),
        ]
    }

    static func marker(_ d: Drawing, units: Units, includePoints: Bool) -> JSONValue {
        let points = d.worldPoints
        var out: [String: JSONValue] = [
            "id": .string(d.id),
            "tool": .string(d.tool.rawValue),
            "color": .string(d.color),
            "point_count": .number(Double(points.count)),
        ]
        if d.isHiddenFromPlayers { out["dm_only"] = true }
        if includePoints || points.count <= 12 {
            out["points"] = .array(points.map { units.out($0) })
        } else if let first = points.first, let last = points.last {
            out["from"] = units.out(first)
            out["to"] = units.out(last)
        }
        return .object(out)
    }

    static func libraryItem(_ item: TokenLibraryItem) -> JSONValue {
        var out: [String: JSONValue] = [
            "id": .string(item.id),
            "name": .string(item.name),
            "category": .string(item.category),
            "tags": .array(item.tags.map { JSONValue.string($0) }),
        ]
        if let t = item.defaultType { out["type"] = .string(t.rawValue) }
        if let s = item.defaultScale { out["size_cells"] = .rounded(s) }
        if let v = item.defaultVisionRadius { out["vision_ft"] = .rounded(v) }
        if let d = item.defaultDarkvision { out["darkvision_ft"] = .rounded(d) }
        if let m = item.defaultMovementSpeed { out["speed_ft"] = .rounded(m) }
        return .object(out)
    }
}
