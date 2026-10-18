import Foundation

/// A wall segment for line-of-sight (TS `WallSegment`).
public struct WallSegment: Equatable, Sendable {
    public var start: Point2D
    public var end: Point2D

    public init(start: Point2D, end: Point2D) {
        self.start = start
        self.end = end
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

    /// Segments that block sight: every wall stroke (transformed to world space) and
    /// every closed door (open doors block nothing; lock state is irrelevant).
    public static func walls(of map: GameMap) -> [WallSegment] {
        var segments: [WallSegment] = []
        for drawing in map.drawings where drawing.tool == .wall {
            let points = drawing.worldPoints
            guard points.count >= 2 else { continue }
            for i in 0..<(points.count - 1) {
                segments.append(WallSegment(start: points[i], end: points[i + 1]))
            }
        }
        for door in map.doors where !door.isOpen {
            let half = door.size / 2
            switch door.orientation {
            case .horizontal:
                segments.append(
                    WallSegment(start: Point2D(x: door.x - half, y: door.y), end: Point2D(x: door.x + half, y: door.y)))
            case .vertical:
                segments.append(
                    WallSegment(start: Point2D(x: door.x, y: door.y - half), end: Point2D(x: door.x, y: door.y + half)))
            }
        }
        return segments
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

    /// A token that emits vision: resolved type PC with vision radius > 0.
    public struct Viewer: Equatable, Sendable {
        public var tokenID: String
        public var centre: Point2D
        /// Pixels.
        public var radius: Double

        /// Changes when the polygon would (TS cache key "x:y:visionRadius:scale").
        public var key: String { "\(tokenID):\(centre.x):\(centre.y):\(radius)" }
    }

    public static func viewers(of map: GameMap, library: [String: TokenLibraryItem]) -> [Viewer] {
        map.tokens.compactMap { token in
            let resolved = ResolvedToken(token, library: library)
            guard resolved.type == .pc, let feet = resolved.visionRadius, feet > 0 else { return nil }
            let size = map.gridSize * resolved.scale
            return Viewer(
                tokenID: token.id, centre: Point2D(x: token.x + size / 2, y: token.y + size / 2),
                radius: feet / 5 * map.gridSize)
        }
    }

    public struct VisionPolygon: Equatable, Sendable {
        public var viewer: Viewer
        public var polygon: [Point2D]
    }

    /// Current vision polygon per viewer.
    public static func polygons(
        of map: GameMap, library: [String: TokenLibraryItem], zoom: Double = 1
    ) -> [VisionPolygon] {
        let segments = sightWalls(of: map)
        return viewers(of: map, library: library).map { viewer in
            VisionPolygon(
                viewer: viewer,
                polygon: polygon(
                    from: viewer.centre, radius: viewer.radius, walls: segments,
                    rays: rayCount(radius: viewer.radius, zoom: zoom)))
        }
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
        if !fogTurnedOn, !wallInputsChanged, tokens == previous.tokens, gridSize == previous.gridSize,
            previousLibrary == nil || oldLibrary == library
        {
            return 0
        }
        let segments = LineOfSight.sightWalls(of: self)
        let current = LineOfSight.viewers(of: self, library: library)
        let pending: [LineOfSight.Viewer]
        if fogTurnedOn || (wallInputsChanged && LineOfSight.sightWalls(of: previous) != segments) {
            pending = current
        } else {
            let before = Set(LineOfSight.viewers(of: previous, library: oldLibrary).map(\.key))
            pending = current.filter { !before.contains($0.key) }
        }
        for viewer in pending {
            let polygon = LineOfSight.polygon(
                from: viewer.centre, radius: viewer.radius, walls: segments,
                rays: LineOfSight.rayCount(radius: viewer.radius))
            if !polygon.isEmpty { addExploredRegion(ExploredRegion(points: polygon, timestamp: timestamp)) }
        }
        return pending.count
    }
}
