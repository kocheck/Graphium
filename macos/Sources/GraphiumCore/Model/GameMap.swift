import Foundation

/// Grid style. LINES/DOTS/HIDDEN share square geometry (visual style only);
/// HEXAGONAL is flat-top hex; ISOMETRIC is diamond. (CORE_SPEC §1.3)
public enum GridType: String, Codable, CaseIterable, Sendable {
    case lines = "LINES"
    case dots = "DOTS"
    case hidden = "HIDDEN"
    case hexagonal = "HEXAGONAL"
    case isometric = "ISOMETRIC"

    public var title: String {
        switch self {
        case .lines: return "Lines"
        case .dots: return "Dots"
        case .hidden: return "Hidden"
        case .hexagonal: return "Hexagonal"
        case .isometric: return "Isometric"
        }
    }

    /// Calibration assumes square cells (TS offers it for these only).
    public var isSquare: Bool { self == .lines || self == .dots || self == .hidden }
}

/// One map: background, grid, tokens, drawings, doors, stairs, explored fog.
/// (TS `MapData`, CORE_SPEC §1.3.) Decoding applies the TS `loadCampaign`
/// fallbacks for every field, so older files load.
public struct GameMap: Codable, Equatable, Identifiable, Sendable {
    public static let defaultGridSize = 50.0
    public static let defaultGridColor = "#222222"
    /// Oldest explored regions are dropped beyond this (TS MAX_EXPLORED_REGIONS).
    public static let maxExploredRegions = 2000

    public var id: String
    public var name: String
    public var tokens: [Token]
    public var drawings: [Drawing]
    public var doors: [Door]
    public var stairs: [Stairs]
    /// Background image; TS key `map`.
    public var background: MapBackground?
    /// Pixels per cell.
    public var gridSize: Double
    public var gridType: GridType
    /// Hex colour string, e.g. `#222222`.
    public var gridColor: String
    public var exploredRegions: [ExploredRegion]
    public var isDaylightMode: Bool
    /// Native only: light sources the DM placed (`Lighting`). Written only when not empty.
    public var lights: [LightSource]
    /// Native only: nil is lighting off, where a PC sees everything in sight out to its vision
    /// radius (TS). Otherwise the light everywhere no light source reaches, and PCs see what is
    /// lit or within their darkvision (5e 2024 Vision and Light).
    public var ambientLight: LightLevel?

    private enum CodingKeys: String, CodingKey {
        case id, name, tokens, drawings, doors, stairs, gridSize, gridType, gridColor
        case exploredRegions, isDaylightMode, lights, ambientLight
        case background = "map"
    }

    public init(
        id: String = newID(),
        name: String = "New Map",
        tokens: [Token] = [],
        drawings: [Drawing] = [],
        doors: [Door] = [],
        stairs: [Stairs] = [],
        background: MapBackground? = nil,
        gridSize: Double = GameMap.defaultGridSize,
        gridType: GridType = .lines,
        gridColor: String = GameMap.defaultGridColor,
        exploredRegions: [ExploredRegion] = [],
        isDaylightMode: Bool = false,
        lights: [LightSource] = [],
        ambientLight: LightLevel? = nil
    ) {
        self.id = id
        self.name = name
        self.tokens = tokens
        self.drawings = drawings
        self.doors = doors
        self.stairs = stairs
        self.background = background
        self.gridSize = gridSize
        self.gridType = gridType
        self.gridColor = gridColor
        self.exploredRegions = exploredRegions
        self.isDaylightMode = isDaylightMode
        self.lights = lights
        self.ambientLight = ambientLight
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "New Map"
        tokens = try c.decodeIfPresent([Token].self, forKey: .tokens) ?? []
        drawings = try c.decodeIfPresent([Drawing].self, forKey: .drawings) ?? []
        doors = try c.decodeIfPresent([Door].self, forKey: .doors) ?? []
        stairs = try c.decodeIfPresent([Stairs].self, forKey: .stairs) ?? []
        background = try c.decodeIfPresent(MapBackground.self, forKey: .background)
        // TS uses `|| 50`: a stored 0 also becomes 50.
        let size = try c.decodeIfPresent(Double.self, forKey: .gridSize) ?? 0
        gridSize = size > 0 ? size : Self.defaultGridSize
        gridType = try c.decodeIfPresent(GridType.self, forKey: .gridType) ?? .lines
        gridColor = try c.decodeIfPresent(String.self, forKey: .gridColor) ?? Self.defaultGridColor
        exploredRegions = try c.decodeIfPresent([ExploredRegion].self, forKey: .exploredRegions) ?? []
        isDaylightMode = try c.decodeIfPresent(Bool.self, forKey: .isDaylightMode) ?? false
        lights = try c.decodeIfPresent([LightSource].self, forKey: .lights) ?? []
        ambientLight = try c.decodeIfPresent(LightLevel.self, forKey: .ambientLight)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(tokens, forKey: .tokens)
        try c.encode(drawings, forKey: .drawings)
        try c.encode(doors, forKey: .doors)
        try c.encode(stairs, forKey: .stairs)
        try c.encode(gridSize, forKey: .gridSize)
        try c.encode(gridType, forKey: .gridType)
        try c.encode(gridColor, forKey: .gridColor)
        try c.encode(exploredRegions, forKey: .exploredRegions)
        try c.encode(isDaylightMode, forKey: .isDaylightMode)
        try c.encodeIfPresent(background, forKey: .background)
        if !lights.isEmpty { try c.encode(lights, forKey: .lights) }
        try c.encodeIfPresent(ambientLight, forKey: .ambientLight)
    }

    /// Appends an explored region, dropping the oldest beyond the cap.
    public mutating func addExploredRegion(_ region: ExploredRegion) {
        exploredRegions.append(region)
        if exploredRegions.count > Self.maxExploredRegions {
            exploredRegions.removeFirst(exploredRegions.count - Self.maxExploredRegions)
        }
    }
}

/// Background image placement (TS `MapConfig`, CORE_SPEC §1.6).
public struct MapBackground: Codable, Equatable, Sendable {
    /// Asset reference (see AssetReference).
    public var src: String
    public var x: Double
    public var y: Double
    /// Natural pixel size of the stored image (≤ 4096 on import).
    public var width: Double
    public var height: Double
    public var scale: Double

    public init(src: String, x: Double = 0, y: Double = 0, width: Double, height: Double, scale: Double = 1) {
        self.src = src
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.scale = scale
    }
}

/// One explored-fog polygon (TS `ExploredRegion`, CORE_SPEC §1.9).
public struct ExploredRegion: Codable, Equatable, Sendable {
    public var points: [Point2D]
    /// Milliseconds since the Unix epoch.
    public var timestamp: Double

    public init(points: [Point2D], timestamp: Double) {
        self.points = points
        self.timestamp = timestamp
    }
}
