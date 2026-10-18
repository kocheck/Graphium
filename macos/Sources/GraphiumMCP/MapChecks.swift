import Foundation
import GraphiumCore

/// Problems on a map that players would hit at the table, phrased so a model can fix them.
struct MapChecks {
    var map: GameMap
    var library: [String: TokenLibraryItem]
    var units: Units

    private var g: Double { map.gridSize }

    func run() -> [JSONValue] {
        var issues: [JSONValue] = []
        issues += wallGaps()
        issues += floatingDoors()
        issues += stackedDoors()
        issues += tokensInWalls()
        issues += overlappingTokens()
        issues += vision()
        issues += lighting()
        issues += outsideBackground()
        return issues
    }

    private func issue(_ severity: String, _ kind: String, _ message: String, ids: [String], at: Point2D? = nil) -> JSONValue {
        var out: [String: JSONValue] = [
            "severity": .string(severity), "kind": .string(kind), "message": .string(message),
            "ids": .array(ids.map { JSONValue.string($0) }),
        ]
        if let at { out["at"] = units.out(at) }
        return .object(out)
    }

    private var wallSegments: [(id: String, a: Point2D, b: Point2D)] {
        map.drawings.filter { $0.tool == .wall }.flatMap { d -> [(id: String, a: Point2D, b: Point2D)] in
            let p = d.worldPoints
            guard p.count >= 2 else { return [] }
            return (1..<p.count).map { (id: d.id, a: p[$0 - 1], b: p[$0]) }
        }
    }

    /// A wall end close to another wall but not on it: sight and light leak through.
    /// Gaps under a tenth of a cell are welded shut by the app, so only wider ones count.
    func wallGaps() -> [JSONValue] {
        let segments = wallSegments
        var issues: [JSONValue] = []
        var reported: Set<String> = []
        for d in map.drawings where d.tool == .wall {
            let p = d.worldPoints
            guard p.count >= 2, let first = p.first, let last = p.last else { continue }
            let closed = hypot(first.x - last.x, first.y - last.y) < 1e-6
            guard !closed else { continue }
            for end in [first, last] {
                let others = segments.filter { $0.id != d.id }
                guard !others.isEmpty else { continue }
                let nearest = others.map { (id: $0.id, distance: segmentDistance(end, $0.a, $0.b)) }
                    .min { $0.distance < $1.distance }!
                let gap = nearest.distance
                guard gap > g * WallWeld.toleranceInCells, gap < g * 0.5 else { continue }
                // A doorway with a door in it is not a leak.
                if map.doors.contains(where: { hypot($0.x - end.x, $0.y - end.y) < $0.size }) { continue }
                let key = "\(d.id)|\(nearest.id)|\(Int(end.x))|\(Int(end.y))"
                guard reported.insert(key).inserted else { continue }
                issues.append(
                    issue(
                        "warning", "wall_gap",
                        "A wall ends \(units.out(gap).serialized()) \(units.name) short of another wall, so sight and light "
                            + "leak through. Move the end onto the other wall (use the same point), or put a door there.",
                        ids: [d.id, nearest.id], at: end))
            }
        }
        return issues
    }

    /// Doors that aren't on any wall: when open there is nothing to walk through, and when
    /// closed they block only themselves.
    func floatingDoors() -> [JSONValue] {
        let segments = wallSegments
        return map.doors.compactMap { door in
            let centre = Point2D(x: door.x, y: door.y)
            let onWall = segments.contains { segmentDistance(centre, $0.a, $0.b) <= g * 0.15 }
            // The generator's doors sit in a gap between two wall ends: ends near both door ends count.
            let (hinge, latch) = door.ends
            let bridged =
                segments.contains { min(segmentDistance(hinge, $0.a, $0.b), segmentDistance(latch, $0.a, $0.b)) <= g * 0.15 }
            guard !onWall, !bridged else { return nil }
            return issue(
                "warning", "door_not_on_wall",
                "This door isn't on a wall. Put its centre on a wall line (e.g. [x.5, y] on a horizontal wall at y).",
                ids: [door.id], at: centre)
        }
    }

    func stackedDoors() -> [JSONValue] {
        var issues: [JSONValue] = []
        for (i, a) in map.doors.enumerated() {
            for b in map.doors[(i + 1)...] where hypot(a.x - b.x, a.y - b.y) < g * 0.25 {
                issues.append(
                    issue("warning", "duplicate_door", "Two doors are on top of each other; remove one.", ids: [a.id, b.id],
                        at: Point2D(x: a.x, y: a.y)))
            }
        }
        return issues
    }

    /// Tokens with a wall through them (the middle 60% of the footprint).
    func tokensInWalls() -> [JSONValue] {
        let segments = wallSegments
        return map.tokens.compactMap { token in
            let b = map.tokenBounds(token, library: library)
            let inset = b.width * 0.2
            let box = Bounds(x: b.x + inset, y: b.y + inset, width: b.width - 2 * inset, height: b.height - 2 * inset)
            guard segments.contains(where: { Self.segment($0.a, $0.b, intersects: box) }) else { return nil }
            let name = ResolvedToken(token, library: library).name
            return issue(
                "warning", "token_in_wall",
                "\(name) is standing in a wall. Remember position is the token's top-left corner; move it into a room.",
                ids: [token.id], at: Point2D(x: token.x, y: token.y))
        }
    }

    func overlappingTokens() -> [JSONValue] {
        var issues: [JSONValue] = []
        let boxes = map.tokens.map { ($0, map.tokenBounds($0, library: library)) }
        for i in boxes.indices {
            for j in boxes.indices where j > i {
                let a = boxes[i].1
                let b = boxes[j].1
                let w = min(a.x + a.width, b.x + b.width) - max(a.x, b.x)
                let h = min(a.y + a.height, b.y + b.height) - max(a.y, b.y)
                guard w > 0, h > 0, w * h > 0.5 * min(a.width * a.height, b.width * b.height) else { continue }
                let names = [boxes[i].0, boxes[j].0].map { ResolvedToken($0, library: library).name }
                issues.append(
                    issue(
                        "info", "tokens_overlap", "\(names[0]) and \(names[1]) share a square.",
                        ids: [boxes[i].0.id, boxes[j].0.id], at: Point2D(x: a.x, y: a.y)))
            }
        }
        return issues
    }

    func vision() -> [JSONValue] {
        // With lighting on, vision_ft isn't used; lighting() checks that map instead.
        guard !map.isDaylightMode, map.ambientLight == nil else { return [] }
        let resolved = map.tokens.map { ($0, ResolvedToken($0, library: library)) }
        let pcs = resolved.filter { $0.1.type == .pc }
        if pcs.isEmpty {
            return map.tokens.isEmpty && map.drawings.isEmpty
                ? []
                : [
                    issue(
                        "info", "no_pcs",
                        "Fog of war is on (daylight off) but there are no PC tokens, so players will see nothing until "
                            + "PCs with vision are placed. Add PCs, or set daylight on with update_map.", ids: [])
                ]
        }
        return pcs.filter { ($0.1.visionRadius ?? 0) <= 0 }.map { token, r in
            issue(
                "warning", "pc_without_vision",
                "\(r.name) is a PC with no vision, so it reveals no fog. Give it vision_ft (e.g. 60) with update_objects.",
                ids: [token.id], at: Point2D(x: token.x, y: token.y))
        }
    }

    /// Lighting on: someone must be able to see. Lights on a lighting-off map do nothing.
    func lighting() -> [JSONValue] {
        guard !map.isDaylightMode else { return [] }
        var issues: [JSONValue] = []
        guard let ambient = map.ambientLight else {
            if !map.lights.isEmpty {
                issues.append(
                    issue(
                        "info", "lights_without_lighting",
                        "This map has lights but lighting is off, so they do nothing. Turn it on with update_map "
                            + "lighting \"dark\" if the lights should matter.", ids: map.lights.map(\.id)))
            }
            return issues
        }
        let pcs = map.tokens.filter { ResolvedToken($0, library: library).type == .pc }
        let anyLight = map.lights.contains { $0.isOn && $0.dim > 0 }
        let anyDarkvision = pcs.contains { (ResolvedToken($0, library: library).darkvision ?? 0) > 0 }
        if ambient == .dark, !pcs.isEmpty, !anyLight, !anyDarkvision {
            issues.append(
                issue(
                    "warning", "nothing_lit",
                    "Lighting is dark, no light is on and no PC has darkvision, so the players will see nothing. Add "
                        + "lights (add_lights, e.g. a torch where the party starts), give PCs darkvision_ft, or use "
                        + "lighting \"dim\".", ids: pcs.map(\.id)))
        }
        let sightWalls = wallSegments.filter { segment in
            map.drawings.first { $0.id == segment.id }?.blocksSight ?? false
        }
        for light in map.lights {
            let centre = Point2D(x: light.x, y: light.y)
            if sightWalls.contains(where: { segmentDistance(centre, $0.a, $0.b) < g * 0.1 }) {
                issues.append(
                    issue(
                        "warning", "light_in_wall",
                        "\(light.name ?? "A light") sits on a wall, so it may light only one side. Move it half a "
                            + "cell into the room.", ids: [light.id], at: centre))
            }
        }
        return issues
    }

    func outsideBackground() -> [JSONValue] {
        guard let bg = map.background else { return [] }
        let area = Bounds(x: bg.x, y: bg.y, width: bg.width * bg.scale, height: bg.height * bg.scale)
        func inside(_ p: Point2D) -> Bool {
            p.x >= area.x - 1 && p.y >= area.y - 1 && p.x <= area.x + area.width + 1 && p.y <= area.y + area.height + 1
        }
        var ids: [String] = []
        for t in map.tokens {
            let b = map.tokenBounds(t, library: library)
            if !inside(Point2D(x: b.x + b.width / 2, y: b.y + b.height / 2)) { ids.append(t.id) }
        }
        for d in map.drawings where d.tool == .wall && !d.worldPoints.allSatisfy(inside) { ids.append(d.id) }
        for d in map.doors where !inside(Point2D(x: d.x, y: d.y)) { ids.append(d.id) }
        guard !ids.isEmpty else { return [] }
        return [
            issue(
                "info", "outside_background",
                "\(ids.count) object(s) lie outside the background image. Fine if intended; otherwise check the "
                    + "background's position and scale against your coordinates.", ids: ids)
        ]
    }

    /// Whether segment a–b crosses or lies inside `box`.
    static func segment(_ a: Point2D, _ b: Point2D, intersects box: Bounds) -> Bool {
        func inside(_ p: Point2D) -> Bool {
            p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height
        }
        if inside(a) || inside(b) { return true }
        let corners = [
            Point2D(x: box.x, y: box.y), Point2D(x: box.x + box.width, y: box.y),
            Point2D(x: box.x + box.width, y: box.y + box.height), Point2D(x: box.x, y: box.y + box.height),
        ]
        for i in 0..<4 where LineOfSight.intersection(a, b, corners[i], corners[(i + 1) % 4]) != nil {
            return true
        }
        return false
    }
}
