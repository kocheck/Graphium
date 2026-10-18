import Foundation

/// How much light falls on a spot (5e 2024 Vision and Light, SRD 5.2.1).
public enum LightLevel: String, Codable, CaseIterable, Comparable, Sendable {
    case dark, dim, bright

    private var rank: Int {
        switch self {
        case .dark: return 0
        case .dim: return 1
        case .bright: return 2
        }
    }

    public static func < (a: LightLevel, b: LightLevel) -> Bool { a.rank < b.rank }

    /// Darkvision: "within a specified range, a creature … can see in Dim Light as if it were
    /// Bright Light and in Darkness as if it were Dim Light."
    public var throughDarkvision: LightLevel { self == .dark ? .dim : .bright }
}

/// A light the DM placed on a map (native only; TS has no lights).
public struct LightSource: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    /// Centre, world pixels.
    public var x: Double
    public var y: Double
    /// Feet. Bright light out to `bright`, then dim light out to `dim` (the outer radius).
    public var bright: Double
    public var dim: Double
    /// Absent in the file is on.
    public var isOn: Bool
    /// The preset it came from, shown in menus.
    public var name: String?

    private enum CodingKeys: String, CodingKey {
        case id, x, y, bright, dim, isOn, name
    }

    public init(
        id: String = newID(), x: Double, y: Double, bright: Double, dim: Double, isOn: Bool = true,
        name: String? = nil
    ) {
        self.id = id
        self.x = x
        self.y = y
        self.bright = bright
        self.dim = dim
        self.isOn = isOn
        self.name = name
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        x = try c.decode(Double.self, forKey: .x)
        y = try c.decode(Double.self, forKey: .y)
        let bright = try c.decodeIfPresent(Double.self, forKey: .bright) ?? 0
        let dim = try c.decodeIfPresent(Double.self, forKey: .dim) ?? 0
        self.bright = max(0, bright)
        self.dim = max(self.bright, dim)
        isOn = try c.decodeIfPresent(Bool.self, forKey: .isOn) ?? true
        name = try c.decodeIfPresent(String.self, forKey: .name)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        try c.encode(bright, forKey: .bright)
        try c.encode(dim, forKey: .dim)
        if !isOn { try c.encode(false, forKey: .isOn) }
        try c.encodeIfPresent(name, forKey: .name)
    }
}

/// Light sources from the rules, SRD 5.2.1 ("bright light in an N-foot radius and dim light
/// for an additional M feet"); `dim` here is the outer radius, N + M.
public struct LightPreset: Hashable, Identifiable, Sendable {
    public var name: String
    public var bright: Double
    public var dim: Double

    public var id: String { name }

    public static let candle = LightPreset(name: "Candle", bright: 5, dim: 10)
    public static let lamp = LightPreset(name: "Lamp", bright: 15, dim: 45)
    public static let torch = LightPreset(name: "Torch", bright: 20, dim: 40)
    public static let lantern = LightPreset(name: "Lantern", bright: 30, dim: 60)
    public static let lightCantrip = LightPreset(name: "Light", bright: 20, dim: 40)
    public static let daylight = LightPreset(name: "Daylight", bright: 60, dim: 120)
    public static let all: [LightPreset] = [.candle, .lamp, .torch, .lantern, .lightCantrip, .daylight]

    public static func named(_ name: String?) -> LightPreset? { all.first { $0.name == name } }

    public func light(at point: Point2D) -> LightSource {
        LightSource(x: point.x, y: point.y, bright: bright, dim: dim, name: name)
    }
}

public enum Lighting {
    /// Where one lit light reaches.
    public struct LitArea: Equatable, Sendable {
        public var lightID: String
        public var centre: Point2D
        /// Pixels.
        public var brightRadius: Double
        public var dimRadius: Double
        /// Walls stop light as they stop sight, one-way walls included.
        public var polygon: [Point2D]

        /// The light this area gives `p`.
        public func level(at p: Point2D) -> LightLevel {
            let d = hypot(p.x - centre.x, p.y - centre.y)
            guard d <= dimRadius, LineOfSight.contains(polygon, p) else { return .dark }
            return d <= brightRadius ? .bright : .dim
        }
    }

    public static func litAreas(of map: GameMap, walls: [WallSegment]) -> [LitArea] {
        map.lights.compactMap { light in
            guard light.isOn, light.dim > 0 else { return nil }
            let centre = Point2D(x: light.x, y: light.y)
            let dim = light.dim / 5 * map.gridSize
            return LitArea(
                lightID: light.id, centre: centre, brightRadius: min(light.bright, light.dim) / 5 * map.gridSize,
                dimRadius: dim,
                polygon: LineOfSight.polygon(from: centre, radius: dim, walls: walls, rays: LineOfSight.rayCount(radius: dim)))
        }
    }

    /// The light at `p`: the brightest of the ambient light and every lit area.
    public static func illumination(at p: Point2D, areas: [LitArea], ambient: LightLevel) -> LightLevel {
        areas.reduce(ambient) { max($0, $1.level(at: p)) }
    }

    /// What a viewer saw, as polygons to record as explored: with any ambient light, all of
    /// its sight; in the dark, its darkvision and its sight within each light's reach. The
    /// reach is the light's circle, not its wall-clipped area, so a spot in sight that a
    /// wall shades from the light can be recorded too (only ever inside the viewer's sight).
    public static func seenRegions(
        sight: [Point2D], darkvision: [Point2D]?, areas: [LitArea], ambient: LightLevel
    ) -> [[Point2D]] {
        guard sight.count >= 3 else { return [] }
        if ambient > .dark { return [sight] }
        var regions: [[Point2D]] = []
        if let darkvision, darkvision.count >= 3 { regions.append(darkvision) }
        for area in areas {
            let clipped = clip(sight, toConvex: circle(area.centre, radius: area.dimRadius))
            if clipped.count >= 3 { regions.append(clipped) }
        }
        return regions
    }

    /// A regular polygon around the circle (circumscribed, so it covers all of it).
    static func circle(_ centre: Point2D, radius: Double, sides: Int = 48) -> [Point2D] {
        let r = radius / cos(.pi / Double(sides))
        return (0..<sides).map {
            let a = Double($0) * 2 * .pi / Double(sides)
            return Point2D(x: centre.x + r * cos(a), y: centre.y + r * sin(a))
        }
    }

    /// Sutherland–Hodgman: `subject` (any simple polygon) clipped to the convex `clip`.
    static func clip(_ subject: [Point2D], toConvex clip: [Point2D]) -> [Point2D] {
        guard clip.count >= 3 else { return [] }
        var area = 0.0
        for i in clip.indices {
            let a = clip[i]
            let b = clip[(i + 1) % clip.count]
            area += a.x * b.y - b.x * a.y
        }
        let sign: Double = area >= 0 ? 1 : -1
        var output = subject
        for i in clip.indices where !output.isEmpty {
            let a = clip[i]
            let b = clip[(i + 1) % clip.count]
            func side(_ p: Point2D) -> Double { sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) }
            func crossing(_ p: Point2D, _ q: Point2D) -> Point2D {
                let sp = side(p)
                let t = sp / (sp - side(q))
                return Point2D(x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y))
            }
            let input = output
            output = []
            for j in input.indices {
                let current = input[j]
                let previous = input[(j + input.count - 1) % input.count]
                if side(current) >= 0 {
                    if side(previous) < 0 { output.append(crossing(previous, current)) }
                    output.append(current)
                } else if side(previous) >= 0 {
                    output.append(crossing(previous, current))
                }
            }
        }
        return output
    }
}

/// What the party sees right now: each PC's sight and darkvision, the lit areas and the
/// ambient light. With lighting off (`ambient` nil) everything in a PC's sight is seen.
public struct PartySight: Equatable, Sendable {
    public var vision: [LineOfSight.VisionPolygon]
    public var lit: [Lighting.LitArea]
    public var ambient: LightLevel?

    public static let none = PartySight(vision: [], lit: [], ambient: nil)

    public init(vision: [LineOfSight.VisionPolygon], lit: [Lighting.LitArea] = [], ambient: LightLevel? = nil) {
        self.vision = vision
        self.lit = lit
        self.ambient = ambient
    }

    /// How bright `p` looks to the PC who sees it best, or nil when no PC sees it.
    public func perceived(at p: Point2D) -> LightLevel? {
        guard let ambient else { return vision.contains { LineOfSight.contains($0.polygon, p) } ? .bright : nil }
        let light = Lighting.illumination(at: p, areas: lit, ambient: ambient)
        var best: LightLevel?
        for entry in vision where LineOfSight.contains(entry.polygon, p) {
            let inDarkvision = entry.darkvisionPolygon.map { LineOfSight.contains($0, p) } ?? false
            let level = inDarkvision ? light.throughDarkvision : light
            if level > .dark { best = max(best ?? level, level) }
        }
        return best
    }

    public func sees(_ p: Point2D) -> Bool { perceived(at: p) != nil }
}

extension LightSource {
    /// A burning light (candle, lamp, torch, lantern, or one with no preset name): it
    /// flickers and glows warm on the World View. Magical and daylight light is steady.
    public var isFlame: Bool {
        guard let name else { return true }
        return [LightPreset.candle, .lamp, .torch, .lantern].contains { $0.name == name }
    }
}

/// How a flame flickers, for the World View only: what the players see breathes, while who
/// sees what (exploration, hidden tokens) keeps the steady radii from the rules.
public enum TorchFlicker {
    public struct Sample: Equatable, Sendable {
        /// Multiplies the light's radii, 0.93…1, so a flame never reaches past its walls.
        public var radius: Double
        /// Multiplies the warm glow, about 0.8…1.1.
        public var glow: Double

        public init(radius: Double, glow: Double) {
            self.radius = radius
            self.glow = glow
        }
    }

    public static let steady = Sample(radius: 1, glow: 1)

    /// Redraws a second while flames flicker: fire reads as fire at this rate.
    public static let framesPerSecond = 15.0

    /// The flame `seed` (a light id) at `time` seconds: sums of slow sines, each light out of
    /// step with the others. Every frequency is under 6 Hz and the swing is small, so it is
    /// a shimmer, not the flashing that troubles photosensitive players (WCAG 2.3.1).
    public static func sample(seed: String, time: Double) -> Sample {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in seed.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100_0000_01b3
        }
        func phase(_ i: UInt64) -> Double { Double((hash >> (i * 8)) & 0xff) / 255 * 2 * .pi }
        let wobble =
            (sin(time * 2 * .pi * 1.7 + phase(0)) * 0.5 + sin(time * 2 * .pi * 3.1 + phase(1)) * 0.3
                + sin(time * 2 * .pi * 5.3 + phase(2)) * 0.2)
        let breath = sin(time * 2 * .pi * 0.9 + phase(3)) * 0.6 + sin(time * 2 * .pi * 2.3 + phase(4)) * 0.4
        return Sample(radius: 0.965 + 0.035 * breath, glow: 0.95 + 0.15 * wobble)
    }
}
