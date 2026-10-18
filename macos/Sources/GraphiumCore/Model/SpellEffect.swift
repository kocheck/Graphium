import Foundation

/// A spell's area of effect on the map (native only): a 5e template (cone, circle, line or cube)
/// sized in feet, pinned to a map point or carried by a token, in one of a few looks. Players
/// see it on the World View unless the DM hides it (decision 015).
/// Defaults (no token, no colour, no label, not hidden, line width 5 ft) are left out of the file.
public struct SpellEffect: Codable, Equatable, Identifiable, Sendable {
    /// The 5e 2024 area-of-effect shapes. Cone, line and cube spread from their point of origin in
    /// `angle`'s direction; a circle (sphere, cylinder or emanation seen from above) is centred on it.
    public enum Shape: String, Codable, CaseIterable, Identifiable, Sendable {
        case circle, cone, line, cube

        public var id: Self { self }

        public var title: String {
            switch self {
            case .circle: return "Circle"
            case .cone: return "Cone"
            case .line: return "Line"
            case .cube: return "Cube"
            }
        }

        /// What `size` measures.
        public var sizeName: String {
            switch self {
            case .circle: return "radius"
            case .cone, .line: return "length"
            case .cube: return "side"
            }
        }

        /// Whether `angle` matters.
        public var hasDirection: Bool { self != .circle }
    }

    /// How the area is painted. Each look has its own colour and pattern, so two effects never
    /// differ by colour alone (world-view-player-safe).
    public enum Look: String, Codable, CaseIterable, Identifiable, Sendable {
        case fire, acid, water, ice, lightning, poison, necrotic, radiant, arcane

        public var id: Self { self }

        public var title: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }

        /// The main colour, `#rrggbb`.
        public var tint: String {
            switch self {
            case .fire: return "#f05a1a"
            case .acid: return "#7ad61e"
            case .water: return "#1f8fe0"
            case .ice: return "#8fd8ff"
            case .lightning: return "#ffe23d"
            case .poison: return "#3fae5a"
            case .necrotic: return "#6b2d8f"
            case .radiant: return "#ffd27a"
            case .arcane: return "#b05cff"
            }
        }

        /// The inner colour the fill fades from, `#rrggbb`.
        public var core: String {
            switch self {
            case .fire: return "#ffd23a"
            case .acid: return "#d9ff6b"
            case .water: return "#9fe0ff"
            case .ice: return "#ffffff"
            case .lightning: return "#ffffff"
            case .poison: return "#a8e05f"
            case .necrotic: return "#1a0a24"
            case .radiant: return "#fffbe6"
            case .arcane: return "#f0d6ff"
            }
        }

        /// A look written by a newer version reads as arcane, so the effect still shows.
        public init(from decoder: Decoder) throws {
            self = Look(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .arcane
        }
    }

    /// The 5e cone: as wide at any point as it is far from its origin.
    public static let coneAngle = 2 * atan(0.5) * 180 / .pi
    public static let defaultLineWidth = 5.0
    public static let minimumSize = 5.0

    public var id: String
    public var shape: Shape
    /// Feet: the circle's radius, the cone's or line's length, the cube's side.
    public var size: Double
    /// Feet, lines only.
    public var width: Double
    /// Degrees, y-down like `Measure.angleDegrees` (0 points right, 90 down). Fixed on the map,
    /// also when a token carries the effect (tokens have no facing).
    public var angle: Double
    /// The point of origin, world pixels; with `tokenID`, an offset from that token's centre.
    public var x: Double
    public var y: Double
    /// The token that carries the effect, which then moves with it.
    public var tokenID: String?
    public var look: Look
    /// A `#rrggbb` that replaces the look's tint.
    public var color: String?
    /// Shown beside the area, e.g. Fireball.
    public var label: String
    /// The DM's alone: not drawn on the World View.
    public var isHidden: Bool

    private enum CodingKeys: String, CodingKey {
        case id, shape, size, width, angle, x, y, look, color, label, isHidden
        case tokenID = "tokenId"
    }

    public init(
        id: String = newID(), shape: Shape, size: Double, width: Double = SpellEffect.defaultLineWidth,
        angle: Double = 0, x: Double, y: Double, tokenID: String? = nil, look: Look = .arcane, color: String? = nil,
        label: String = "", isHidden: Bool = false
    ) {
        self.id = id
        self.shape = shape
        self.size = size
        self.width = width
        self.angle = angle
        self.x = x
        self.y = y
        self.tokenID = tokenID
        self.look = look
        self.color = color
        self.label = label
        self.isHidden = isHidden
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        shape = try c.decode(Shape.self, forKey: .shape)
        size = max(Self.minimumSize, try c.decodeIfPresent(Double.self, forKey: .size) ?? 20)
        width = max(1, try c.decodeIfPresent(Double.self, forKey: .width) ?? Self.defaultLineWidth)
        angle = try c.decodeIfPresent(Double.self, forKey: .angle) ?? 0
        x = try c.decode(Double.self, forKey: .x)
        y = try c.decode(Double.self, forKey: .y)
        tokenID = try c.decodeIfPresent(String.self, forKey: .tokenID)
        look = try c.decodeIfPresent(Look.self, forKey: .look) ?? .arcane
        color = try c.decodeIfPresent(String.self, forKey: .color)
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? ""
        isHidden = try c.decodeIfPresent(Bool.self, forKey: .isHidden) ?? false
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(shape, forKey: .shape)
        try c.encode(size, forKey: .size)
        if shape == .line, width != Self.defaultLineWidth { try c.encode(width, forKey: .width) }
        if shape.hasDirection, angle != 0 { try c.encode(angle, forKey: .angle) }
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        try c.encodeIfPresent(tokenID, forKey: .tokenID)
        try c.encode(look, forKey: .look)
        try c.encodeIfPresent(color, forKey: .color)
        if !label.isEmpty { try c.encode(label, forKey: .label) }
        if isHidden { try c.encode(isHidden, forKey: .isHidden) }
    }

    /// The tint to paint with: the DM's colour, else the look's.
    public var tint: String { color ?? look.tint }

    /// The label, else what the template is, e.g. "20 ft circle".
    public var displayLabel: String {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? sizeDescription : trimmed
    }

    /// "20 ft radius", "60 ft cone", "100 × 5 ft line", "15 ft cube".
    public var sizeDescription: String {
        switch shape {
        case .circle: return "\(jsNumber(size)) ft radius"
        case .cone: return "\(jsNumber(size)) ft cone"
        case .line: return "\(jsNumber(size)) × \(jsNumber(width)) ft line"
        case .cube: return "\(jsNumber(size)) ft cube"
        }
    }

    /// The area as a polygon, world pixels, with the point of origin at `origin`.
    public func polygon(origin: Point2D, gridSize: Double) -> [Point2D] {
        let length = size / 5 * gridSize
        let theta = angle * .pi / 180
        let along = Point2D(x: cos(theta), y: sin(theta))
        let across = Point2D(x: -along.y, y: along.x)
        func at(_ a: Double, _ b: Double) -> Point2D {
            Point2D(x: origin.x + along.x * a + across.x * b, y: origin.y + along.y * a + across.y * b)
        }
        switch shape {
        case .circle:
            let segments = 48
            return (0..<segments).map { i in
                let t = Double(i) / Double(segments) * 2 * .pi
                return Point2D(x: origin.x + length * cos(t), y: origin.y + length * sin(t))
            }
        case .cone:
            // A round far edge, as the template's area is everything within its length.
            let half = Self.coneAngle / 2 * .pi / 180
            let steps = 12
            return [origin]
                + (0...steps).map { i in
                    let t = theta - half + 2 * half * Double(i) / Double(steps)
                    return Point2D(x: origin.x + length * cos(t), y: origin.y + length * sin(t))
                }
        case .line:
            let half = width / 5 * gridSize / 2
            return [at(0, -half), at(length, -half), at(length, half), at(0, half)]
        case .cube:
            // The point of origin is the middle of one face; the cube spreads away from it.
            let half = length / 2
            return [at(0, -half), at(length, -half), at(length, half), at(0, half)]
        }
    }

    /// The far end of the area along its direction (cone tip, end of a line), world pixels.
    public func tip(origin: Point2D, gridSize: Double) -> Point2D {
        let length = size / 5 * gridSize
        let theta = angle * .pi / 180
        return Point2D(x: origin.x + length * cos(theta), y: origin.y + length * sin(theta))
    }

    /// Where the label sits: the area's middle.
    public func labelPoint(origin: Point2D, gridSize: Double) -> Point2D {
        guard shape.hasDirection else { return origin }
        let tip = tip(origin: origin, gridSize: gridSize)
        let share = shape == .cone ? 0.6 : 0.5
        return Point2D(x: origin.x + (tip.x - origin.x) * share, y: origin.y + (tip.y - origin.y) * share)
    }

    /// Feet rounded to the 5 ft grid, at least 5.
    public static func roundedFeet(_ feet: Double) -> Double {
        max(minimumSize, (feet / 5).rounded() * 5)
    }

    /// Decodes to nil instead of failing, so one effect of a shape this app doesn't know doesn't lose the map.
    struct Lossy: Decodable {
        let effect: SpellEffect?

        init(from decoder: Decoder) throws {
            effect = try? SpellEffect(from: decoder)
        }
    }
}
