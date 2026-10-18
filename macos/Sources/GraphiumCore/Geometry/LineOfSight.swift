import Foundation

/// A wall segment for line-of-sight (TS `WallSegment`).
public struct WallSegment: Equatable, Sendable {
    public var start: Point2D
    public var end: Point2D
    /// Sight passes from the left of start → end as seen on screen (`Drawing.oneWay`).
    public var oneWay: Bool

    public init(start: Point2D, end: Point2D, oneWay: Bool = false) {
        self.start = start
        self.end = end
        self.oneWay = oneWay
    }

    /// Whether this segment lets sight from `origin` through. Map y points down, so the
    /// on-screen left of start → end is where the cross product is negative; a viewer
    /// exactly on the line is on the blocked side.
    public func letsSightThrough(from origin: Point2D) -> Bool {
        guard oneWay else { return false }
        let cross = (end.x - start.x) * (origin.y - start.y) - (end.y - start.y) * (origin.x - start.x)
        return cross < 0
    }
}

/// Fog of war / line of sight (CORE_SPEC §3.3). Pure maths; the app renders it.
public enum LineOfSight {
    /// World bounds fogged when no map image exists (TS `NO_MAP_FOG_BOUNDS`).
    public static let noMapFogBounds = Bounds(x: -500, y: -500, width: 3500, height: 3500)

    /// TS `rayCountForVision`: more rays for larger on-screen radii.
    public static func rayCount(radius: Double, zoom: Double = 1) -> Int {
        let onScreen = radius * zoom
        if onScreen < 200 { return 90 }
        if onScreen < 600 { return 180 }
        return 360
    }

    /// Segments that block sight: every wall stroke but windows (transformed to world space)
    /// and every closed door (open doors block nothing; lock state is irrelevant). An open
    /// door also cuts the wall under it (native, PARITY §3.6), so a door dropped on a room's
    /// wall opens a gap in it; in TS that wall went on blocking.
    public static func walls(of map: GameMap) -> [WallSegment] {
        var segments = strokeWalls(of: map)
        let open = map.doors.filter(\.isOpen)
        if !open.isEmpty {
            let tolerance = map.gridSize * WallWeld.toleranceInCells
            segments = segments.flatMap { wall in
                open.reduce([wall]) { pieces, door in pieces.flatMap { cut($0, under: door, tolerance: tolerance) } }
            }
        }
        for door in map.doors where !door.isOpen {
            let (hinge, latch) = door.ends
            segments.append(WallSegment(start: hinge, end: latch))
        }
        return segments
    }

    /// Open doors that cut a wall (`walls(of:)`), so the canvas can leave the same gap.
    public static func wallGaps(of map: GameMap) -> [Door] {
        let open = map.doors.filter(\.isOpen)
        guard !open.isEmpty else { return [] }
        let walls = strokeWalls(of: map)
        let tolerance = map.gridSize * WallWeld.toleranceInCells
        return open.filter { door in walls.contains { cut($0, under: door, tolerance: tolerance) != [$0] } }
    }

    /// The walls the World View hatches rock behind: every sight-blocking wall stroke, less
    /// the stretch under any door (open or closed), so no rock is drawn across a doorway. A
    /// shut hidden door is wall to the players: it cuts nothing and is hatched itself.
    public static func hatchWalls(of map: GameMap) -> [WallSegment] {
        let tolerance = map.gridSize * WallWeld.toleranceInCells
        let doorways = map.doors.filter { !$0.looksLikeWall }
        let secret = map.doors.filter(\.looksLikeWall).map { door -> WallSegment in
            let (hinge, latch) = door.ends
            return WallSegment(start: hinge, end: latch)
        }
        return strokeWalls(of: map).flatMap { wall in
            doorways.reduce([wall]) { pieces, door in pieces.flatMap { cut($0, under: door, tolerance: tolerance) } }
        } + secret
    }

    /// The doors the players know are there, so the World View can draw them over the fog: a
    /// point just off either face of the door, at its middle or towards either end, is explored
    /// or in sight now. A shut hidden door is never known; it shows as wall.
    public static func knownDoors(
        _ doors: [Door], explored: [ExploredRegion], sight: PartySight, gridSize: Double
    ) -> Set<String> {
        let candidates = doors.filter { !$0.looksLikeWall }
        guard !candidates.isEmpty else { return [] }
        let regions = explored.compactMap { region -> (Bounds, [Point2D])? in
            guard region.points.count >= 3 else { return nil }
            var minX = Double.infinity, minY = Double.infinity, maxX = -Double.infinity, maxY = -Double.infinity
            for p in region.points {
                minX = min(minX, p.x)
                minY = min(minY, p.y)
                maxX = max(maxX, p.x)
                maxY = max(maxY, p.y)
            }
            return (Bounds(x: minX, y: minY, width: maxX - minX, height: maxY - minY), region.points)
        }
        func isExplored(_ p: Point2D) -> Bool {
            regions.contains { bounds, points in
                p.x >= bounds.x && p.x <= bounds.x + bounds.width && p.y >= bounds.y && p.y <= bounds.y + bounds.height
                    && contains(points, p)
            }
        }
        var known: Set<String> = []
        for door in candidates {
            let off = (door.thickness ?? max(6, door.size * 0.16)) / 2 + gridSize * 0.15
            let (c, s) = (cos(door.radians), sin(door.radians))
            let samples = [-0.3, 0, 0.3].flatMap { t -> [Point2D] in
                let along = t * door.size
                return [-off, off].map { across in
                    Point2D(x: door.x + along * c - across * s, y: door.y + along * s + across * c)
                }
            }
            if samples.contains(where: { sight.sees($0) || isExplored($0) }) { known.insert(door.id) }
        }
        return known
    }

    /// The segments of every wall stroke that blocks sight, in world space.
    public static func strokeWalls(of map: GameMap) -> [WallSegment] {
        var segments: [WallSegment] = []
        for drawing in map.drawings where drawing.blocksSight {
            let points = drawing.worldPoints
            guard points.count >= 2 else { continue }
            let oneWay = drawing.oneWay ?? false
            for i in 0..<(points.count - 1) {
                segments.append(WallSegment(start: points[i], end: points[i + 1], oneWay: oneWay))
            }
        }
        return segments
    }

    /// `wall` less the stretch an open door covers. The door is on the wall when both its
    /// ends are within `tolerance` of the wall's line; otherwise the wall is unchanged.
    static func cut(_ wall: WallSegment, under door: Door, tolerance: Double) -> [WallSegment] {
        let dx = wall.end.x - wall.start.x
        let dy = wall.end.y - wall.start.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 1e-12 else { return [wall] }
        let length = lengthSquared.squareRoot()
        func onWall(_ p: Point2D) -> (t: Double, off: Double) {
            let px = p.x - wall.start.x
            let py = p.y - wall.start.y
            return ((px * dx + py * dy) / lengthSquared, (px * dy - py * dx) / length)
        }
        let (hinge, latch) = door.ends
        let a = onWall(hinge)
        let b = onWall(latch)
        guard abs(a.off) <= tolerance, abs(b.off) <= tolerance else { return [wall] }
        let from = min(a.t, b.t)
        let to = max(a.t, b.t)
        guard to > 0, from < 1 else { return [wall] }
        func point(_ t: Double) -> Point2D { Point2D(x: wall.start.x + t * dx, y: wall.start.y + t * dy) }
        var pieces: [WallSegment] = []
        if from > 0 { pieces.append(WallSegment(start: wall.start, end: point(from), oneWay: wall.oneWay)) }
        if to < 1 { pieces.append(WallSegment(start: point(to), end: wall.end, oneWay: wall.oneWay)) }
        return pieces
    }

    /// TS `lineSegmentIntersection`: the hit point of p1→p2 with p3→p4, or nil.
    public static func intersection(_ p1: Point2D, _ p2: Point2D, _ p3: Point2D, _ p4: Point2D) -> Point2D? {
        let den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x)
        guard abs(den) >= 1e-10 else { return nil }
        let t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den
        let u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den
        guard (0...1).contains(t), (0...1).contains(u) else { return nil }
        return Point2D(x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y))
    }

    /// TS `castRay`: nearest wall hit along the ray, else the ray's end.
    public static func castRay(from origin: Point2D, angle: Double, radius: Double, walls: [WallSegment]) -> Point2D {
        let end = Point2D(x: origin.x + radius * cos(angle), y: origin.y + radius * sin(angle))
        var closest = end
        var closestDistance = Double.infinity
        for wall in walls {
            guard let hit = intersection(origin, end, wall.start, wall.end) else { continue }
            let distance = hypot(hit.x - origin.x, hit.y - origin.y)
            if distance < closestDistance {
                closestDistance = distance
                closest = hit
            }
        }
        return closest
    }

    /// The walls sight is cast against: `walls(of:)` with near-miss seams welded shut.
    public static func sightWalls(of map: GameMap) -> [WallSegment] {
        WallWeld.weld(walls(of: map), tolerance: map.gridSize * WallWeld.toleranceInCells)
    }

    /// Visibility polygon from `origin`. TS `calculateVisibilityPolygon` cast only `rays` evenly
    /// spaced rays; here they draw the arc, and `VisibilitySweep` adds the rays that make
    /// the polygon exact at walls.
    public static func polygon(from origin: Point2D, radius: Double, walls: [WallSegment], rays: Int) -> [Point2D] {
        VisibilitySweep.polygon(from: origin, radius: radius, walls: walls, arcRays: rays)
    }

    /// A token that emits vision. Lighting off: resolved type PC with vision radius > 0 (TS).
    /// Lighting on: every PC, seeing as far as the map reaches, plus its darkvision.
    public struct Viewer: Equatable, Sendable {
        public var tokenID: String
        public var centre: Point2D
        /// Pixels.
        public var radius: Double
        /// Pixels; 0 is none. Only used with lighting on.
        public var darkvision: Double = 0

        /// Changes when the polygon would (TS cache key "x:y:visionRadius:scale").
        public var key: String { "\(tokenID):\(centre.x):\(centre.y):\(radius):\(darkvision)" }
    }

    public static func viewers(of map: GameMap, library: [String: TokenLibraryItem]) -> [Viewer] {
        map.tokens.compactMap { token in
            let resolved = ResolvedToken(token, library: library)
            guard resolved.type == .pc else { return nil }
            let size = map.gridSize * resolved.scale
            let centre = Point2D(x: token.x + size / 2, y: token.y + size / 2)
            if map.ambientLight != nil {
                return Viewer(
                    tokenID: token.id, centre: centre, radius: sightLimit(from: centre, in: map),
                    darkvision: max(0, resolved.darkvision ?? 0) / 5 * map.gridSize)
            }
            guard let feet = resolved.visionRadius, feet > 0 else { return nil }
            return Viewer(tokenID: token.id, centre: centre, radius: feet / 5 * map.gridSize)
        }
    }

    /// With lighting on, sight has no range of its own: it reaches the far corner of the map.
    static func sightLimit(from centre: Point2D, in map: GameMap) -> Double {
        let b = fogBounds(of: map)
        let corners = [(b.x, b.y), (b.x + b.width, b.y), (b.x, b.y + b.height), (b.x + b.width, b.y + b.height)]
        return corners.map { hypot($0.0 - centre.x, $0.1 - centre.y) }.max().map { $0 + map.gridSize } ?? map.gridSize
    }

    public struct VisionPolygon: Equatable, Sendable {
        public var viewer: Viewer
        public var polygon: [Point2D]
        /// Sight within darkvision range (lighting on, darkvision > 0).
        public var darkvisionPolygon: [Point2D]? = nil
    }

    /// Current vision polygon per viewer.
    public static func polygons(
        of map: GameMap, library: [String: TokenLibraryItem], zoom: Double = 1
    ) -> [VisionPolygon] {
        polygons(of: map, library: library, walls: sightWalls(of: map), zoom: zoom)
    }

    static func polygons(
        of map: GameMap, library: [String: TokenLibraryItem], walls segments: [WallSegment], zoom: Double = 1
    ) -> [VisionPolygon] {
        viewers(of: map, library: library).map { viewer in
            VisionPolygon(
                viewer: viewer,
                polygon: polygon(
                    from: viewer.centre, radius: viewer.radius, walls: segments,
                    rays: rayCount(radius: viewer.radius, zoom: zoom)),
                darkvisionPolygon: viewer.darkvision > 0
                    ? polygon(
                        from: viewer.centre, radius: viewer.darkvision, walls: segments,
                        rays: rayCount(radius: viewer.darkvision, zoom: zoom))
                    : nil)
        }
    }

    /// What the party sees: vision polygons plus, with lighting on, the lit areas.
    public static func partySight(of map: GameMap, library: [String: TokenLibraryItem]) -> PartySight {
        guard !map.isDaylightMode else { return .none }
        let segments = sightWalls(of: map)
        let vision = polygons(of: map, library: library, walls: segments)
        guard let ambient = map.ambientLight else { return PartySight(vision: vision) }
        return PartySight(vision: vision, lit: Lighting.litAreas(of: map, walls: segments), ambient: ambient)
    }

    /// TS `isPointInPolygon` (even-odd ray cast; fewer than 3 vertices → false).
    public static func contains(_ polygon: [Point2D], _ p: Point2D) -> Bool {
        guard polygon.count >= 3 else { return false }
        var inside = false
        var j = polygon.count - 1
        for i in 0..<polygon.count {
            let a = polygon[i]
            let b = polygon[j]
            if (a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    public static func containsInAny(_ polygons: [[Point2D]], _ p: Point2D) -> Bool {
        polygons.contains { contains($0, p) }
    }

    /// TS `isRectInAnyPolygon`: the centre first, then the four corners.
    public static func rectIntersectsAny(_ rect: Bounds, _ polygons: [[Point2D]]) -> Bool {
        let points = [
            Point2D(x: rect.x + rect.width / 2, y: rect.y + rect.height / 2),
            Point2D(x: rect.x, y: rect.y), Point2D(x: rect.x + rect.width, y: rect.y),
            Point2D(x: rect.x, y: rect.y + rect.height), Point2D(x: rect.x + rect.width, y: rect.y + rect.height),
        ]
        return points.contains { containsInAny(polygons, $0) }
    }

    /// TS `computeHiddenNpcIds`: NPCs (exactly type NPC; untyped never hide) with no
    /// part inside any vision polygon.
    public static func hiddenNPCIDs(
        of map: GameMap, library: [String: TokenLibraryItem], polygons: [[Point2D]]
    ) -> Set<String> {
        Set(
            map.tokens.filter { token in
                ResolvedToken(token, library: library).type == .npc
                    && !rectIntersectsAny(map.tokenBounds(token, library: library), polygons)
            }.map(\.id))
    }

    /// NPCs the party can't see: the TS test with lighting applied (a PC must see the
    /// centre or a corner, and it must be lit or within the PC's darkvision).
    /// Lighting off, this is the TS test above.
    public static func hiddenNPCIDs(of map: GameMap, library: [String: TokenLibraryItem], sight: PartySight) -> Set<String> {
        guard sight.ambient != nil else {
            return hiddenNPCIDs(of: map, library: library, polygons: sight.vision.map(\.polygon))
        }
        return hiddenNPCIDs(of: map, library: library) { sight.sees($0) }
    }

    private static func hiddenNPCIDs(
        of map: GameMap, library: [String: TokenLibraryItem], seen: (Point2D) -> Bool
    ) -> Set<String> {
        Set(
            map.tokens.filter { token in
                guard ResolvedToken(token, library: library).type == .npc else { return false }
                let r = map.tokenBounds(token, library: library)
                let points = [
                    Point2D(x: r.x + r.width / 2, y: r.y + r.height / 2),
                    Point2D(x: r.x, y: r.y), Point2D(x: r.x + r.width, y: r.y),
                    Point2D(x: r.x, y: r.y + r.height), Point2D(x: r.x + r.width, y: r.y + r.height),
                ]
                return !points.contains(where: seen)
            }.map(\.id))
    }

    /// TS `getFogBounds`: the map image's extent, or a fixed area without one.
    public static func fogBounds(of map: GameMap) -> Bounds {
        guard let bg = map.background else { return noMapFogBounds }
        return Bounds(x: bg.x, y: bg.y, width: bg.width * bg.scale, height: bg.height * bg.scale)
    }
}

extension GameMap {
    /// Records what PCs can see now as explored (CORE_SPEC §3.3 step 5), comparing with
    /// `previous` (the map before an edit; `previousLibrary` defaults to `library`):
    /// - nothing vision depends on changed (e.g. a Session Console edit): no raycast;
    /// - walls or closed doors changed, or fog just came on: every viewer is stamped,
    ///   so a glimpse through a door opened next to a standing PC is kept;
    /// - otherwise only viewers whose position or vision changed are raycast and stamped.
    /// Deliberate fix vs TS, where exploration was only ever held by the World View and
    /// never saved: here it lives in the campaign, persists, and undoes together with the
    /// edit that caused it. Returns how many viewers were raycast.
    @discardableResult
    public mutating func recordExploration(
        since previous: GameMap, library: [String: TokenLibraryItem],
        previousLibrary: [String: TokenLibraryItem]? = nil, timestamp: Double
    ) -> Int {
        guard !isDaylightMode else { return 0 }
        let oldLibrary = previousLibrary ?? library
        let fogTurnedOn = previous.isDaylightMode
        let wallInputsChanged = drawings != previous.drawings || doors != previous.doors
        let lightingChanged = lights != previous.lights || ambientLight != previous.ambientLight
        if !fogTurnedOn, !wallInputsChanged, !lightingChanged, tokens == previous.tokens, gridSize == previous.gridSize,
            previousLibrary == nil || oldLibrary == library
        {
            return 0
        }
        let segments = LineOfSight.sightWalls(of: self)
        let current = LineOfSight.viewers(of: self, library: library)
        let pending: [LineOfSight.Viewer]
        if fogTurnedOn || lightingChanged || (wallInputsChanged && LineOfSight.sightWalls(of: previous) != segments) {
            pending = current
        } else {
            let before = Set(LineOfSight.viewers(of: previous, library: oldLibrary).map(\.key))
            pending = current.filter { !before.contains($0.key) }
        }
        let lit = ambientLight.map { _ in Lighting.litAreas(of: self, walls: segments) } ?? []
        for viewer in pending {
            let polygon = LineOfSight.polygon(
                from: viewer.centre, radius: viewer.radius, walls: segments,
                rays: LineOfSight.rayCount(radius: viewer.radius))
            guard let ambientLight else {
                if !polygon.isEmpty { addExploredRegion(ExploredRegion(points: polygon, timestamp: timestamp)) }
                continue
            }
            // Lighting on: only what the PC could make out is explored.
            let darkvision =
                viewer.darkvision > 0
                ? LineOfSight.polygon(
                    from: viewer.centre, radius: viewer.darkvision, walls: segments,
                    rays: LineOfSight.rayCount(radius: viewer.darkvision)) : nil
            for region in Lighting.seenRegions(sight: polygon, darkvision: darkvision, areas: lit, ambient: ambientLight) {
                addExploredRegion(ExploredRegion(points: region, timestamp: timestamp))
            }
        }
        return pending.count
    }

    /// Forgets everything the party has explored on this map (the DM's reset), keeping only
    /// what PCs can see right now, as when fog first comes on. Without that, the ground a
    /// standing PC sees would drop to unexplored as soon as they walked away.
    /// Returns how many viewers were raycast.
    @discardableResult
    public mutating func resetExploration(library: [String: TokenLibraryItem], timestamp: Double) -> Int {
        exploredRegions = []
        var fogOff = self
        fogOff.isDaylightMode = true
        return recordExploration(since: fogOff, library: library, timestamp: timestamp)
    }
}
