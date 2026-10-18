import Foundation

/// Memoises fog of war for one window (PARITY §3.15). Vision raycasting only
/// depends on tokens, walls, doors, lights, grid size, daylight and the library, so camera moves,
/// selection, measurement and Session Console changes reuse the last result.
public final class VisibilityCache {
    public struct Result: Equatable {
        public var sight: PartySight
        public var hiddenNPCIDs: Set<String>
        public var vision: [LineOfSight.VisionPolygon] { sight.vision }
    }

    private struct Key: Equatable {
        var mapID: String
        var tokens: [Token]
        var drawings: [Drawing]
        var doors: [Door]
        var lights: [LightSource]
        var ambientLight: LightLevel?
        /// Vision radii, viewer centres and NPC hit boxes all scale with the grid
        /// (TS `FogOfWarLayer` invalidates on `lastGridRef !== gridSize`).
        var gridSize: Double
        var daylight: Bool
        var library: [String: TokenLibraryItem]
    }

    private var key: Key?
    private var result = Result(sight: .none, hiddenNPCIDs: [])
    /// How many times the cache recomputed; for tests and the performance monitor.
    public private(set) var computeCount = 0

    public init() {}

    public func visibility(of map: GameMap, library: [String: TokenLibraryItem]) -> Result {
        let next = Key(
            mapID: map.id, tokens: map.tokens, drawings: map.drawings, doors: map.doors,
            lights: map.lights, ambientLight: map.ambientLight,
            gridSize: map.gridSize, daylight: map.isDaylightMode, library: library)
        if next == key { return result }
        key = next
        computeCount += 1
        if map.isDaylightMode {
            result = Result(sight: .none, hiddenNPCIDs: [])
        } else {
            let sight = LineOfSight.partySight(of: map, library: library)
            result = Result(sight: sight, hiddenNPCIDs: LineOfSight.hiddenNPCIDs(of: map, library: library, sight: sight))
        }
        return result
    }
}
