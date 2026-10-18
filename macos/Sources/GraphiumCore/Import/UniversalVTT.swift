import Foundation

/// Universal VTT maps (`.dd2vtt` from Dungeondraft, `.uvtt`, `.df2vtt`): a map image with
/// its walls, doors and lights, all in grid units. Read on the Mac, nothing fetched (native
/// only; the web app has no importer).
public struct UniversalVTT: Equatable, Sendable {
    public enum ImportError: Error, Equatable {
        case notUniversalVTT
    }

    public struct Portal: Equatable, Sendable {
        /// Grid units.
        public var start: Point2D
        public var end: Point2D
        public var isClosed: Bool
    }

    public struct Light: Equatable, Sendable {
        /// Grid units.
        public var position: Point2D
        /// Grid units; where its light ends.
        public var range: Double
    }

    /// Grid units: the image's top-left corner and its size.
    public var origin: Point2D
    public var width: Double
    public var height: Double
    /// Walls, and the outlines of objects that block sight, as polylines in grid units.
    public var walls: [[Point2D]]
    public var portals: [Portal]
    public var lights: [Light]
    /// The light where no light reaches, from the file's ambient colour; nil when it has none.
    public var ambient: LightLevel?
    /// The map image as stored in the file (PNG or WebP), if any.
    public var image: Data?

    public static func decode(_ data: Data) throws -> UniversalVTT {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let resolution = object["resolution"] as? [String: Any],
            let size = point(resolution["map_size"]), size.x > 0, size.y > 0
        else { throw ImportError.notUniversalVTT }
        let walls = ((object["line_of_sight"] as? [Any] ?? []) + (object["objects_line_of_sight"] as? [Any] ?? []))
            .compactMap { line -> [Point2D]? in
                var points: [Point2D] = []
                let all = (line as? [Any] ?? []).compactMap { point($0) }
                for p in all where points.last != p { points.append(p) }
                return points.count >= 2 ? points : nil
            }
        let portals = (object["portals"] as? [[String: Any]] ?? []).compactMap { portal -> Portal? in
            let bounds = (portal["bounds"] as? [Any] ?? []).compactMap { point($0) }
            let isClosed = portal["closed"] as? Bool ?? true
            if bounds.count >= 2, bounds[0] != bounds[1] {
                return Portal(start: bounds[0], end: bounds[1], isClosed: isClosed)
            }
            // No bounds: a one-cell door through `position` at `rotation` (radians).
            guard let centre = point(portal["position"]) else { return nil }
            let rotation = number(portal["rotation"]) ?? 0
            let half = Point2D(x: cos(rotation) / 2, y: sin(rotation) / 2)
            return Portal(
                start: Point2D(x: centre.x - half.x, y: centre.y - half.y),
                end: Point2D(x: centre.x + half.x, y: centre.y + half.y), isClosed: isClosed)
        }
        let lights = (object["lights"] as? [[String: Any]] ?? []).compactMap { light -> Light? in
            guard let position = point(light["position"]), let range = number(light["range"]), range > 0 else {
                return nil
            }
            return Light(position: position, range: range)
        }
        let environment = object["environment"] as? [String: Any]
        var image: Data?
        if var encoded = object["image"] as? String, !encoded.isEmpty {
            if encoded.hasPrefix("data:"), let comma = encoded.firstIndex(of: ",") {
                encoded = String(encoded[encoded.index(after: comma)...])
            }
            image = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters)
        }
        return UniversalVTT(
            origin: point(resolution["map_origin"]) ?? Point2D(x: 0, y: 0), width: size.x, height: size.y,
            walls: walls, portals: portals, lights: lights,
            ambient: (environment?["ambient_light"] as? String).flatMap(level(ofARGB:)), image: image)
    }

    /// `map` with this file's walls, doors and lights in place of its own (marker strokes stay),
    /// at `map.gridSize` pixels a cell. `background` is the stored image's asset name and its
    /// pixel size (the app may have scaled it down), stretched over the file's grid.
    public func apply(to map: inout GameMap, background: (src: String, width: Double, height: Double)?) {
        let cell = map.gridSize
        func world(_ p: Point2D) -> Point2D {
            Point2D(x: (p.x - origin.x) * cell, y: (p.y - origin.y) * cell)
        }
        if let background, background.width > 0 {
            map.background = MapBackground(
                src: background.src, width: background.width, height: background.height,
                scale: width * cell / background.width)
        }
        map.drawings.removeAll { $0.tool == .wall }
        map.drawings += walls.map { line in
            Drawing(
                tool: .wall, points: line.map(world).flatMap { [$0.x, $0.y] }, color: StrokeDefaults.wallColor,
                size: StrokeDefaults.wallSize)
        }
        map.doors = portals.map { Door(between: world($0.start), and: world($0.end), isOpen: !$0.isClosed) }
        map.lights = lights.map { light in
            // A Dungeondraft light's range is where it fades out: dim light, with bright to half way.
            let dim = light.range * 5
            let centre = world(light.position)
            return LightSource(x: centre.x, y: centre.y, bright: dim / 2, dim: dim)
        }
        map.ambientLight = lights.isEmpty ? nil : (ambient ?? .dark)
        map.exploredRegions = []
    }

    /// Hex `AARRGGBB` (or `RRGGBB`) by its luminance.
    static func level(ofARGB hex: String) -> LightLevel? {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 8 || digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return luminance >= 0.75 ? .bright : luminance >= 0.3 ? .dim : .dark
    }

    private static func number(_ value: Any?) -> Double? {
        (value as? NSNumber).map(\.doubleValue)
    }

    private static func point(_ value: Any?) -> Point2D? {
        guard let object = value as? [String: Any], let x = number(object["x"]), let y = number(object["y"]) else {
            return nil
        }
        return Point2D(x: x, y: y)
    }
}

extension Door {
    /// A door from `a` to `b`: on an axis when it lies on one, else at its angle.
    public init(between a: Point2D, and b: Point2D, isOpen: Bool = false) {
        var degrees = atan2(b.y - a.y, b.x - a.x) * 180 / .pi
        if degrees > 90 { degrees -= 180 } else if degrees <= -90 { degrees += 180 }
        let isAxis = abs(degrees) < 0.5 || abs(abs(degrees) - 90) < 0.5
        self.init(
            x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, orientation: abs(degrees) <= 45 ? .horizontal : .vertical,
            isOpen: isOpen, size: hypot(b.x - a.x, b.y - a.y), angle: isAxis ? nil : degrees)
    }
}
