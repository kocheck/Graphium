import Foundation

/// A campaign: an ordered set of maps plus which one is active.
///
/// Milestone 0 carries only the fields needed to prove the document and
/// two-window architecture; M1 ports the full model from `docs/CORE_SPEC.md`.
public struct Campaign: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    /// Ordered as shown in the map navigator.
    public var maps: [GameMap]
    public var activeMapID: GameMap.ID

    public init(id: UUID = UUID(), name: String, maps: [GameMap], activeMapID: GameMap.ID) {
        precondition(maps.contains { $0.id == activeMapID }, "activeMapID must name one of maps")
        self.id = id
        self.name = name
        self.maps = maps
        self.activeMapID = activeMapID
    }

    /// A new campaign with one empty map, matching the TS app's `createDefaultCampaign`.
    public static func makeDefault(name: String = "New Campaign") -> Campaign {
        let map = GameMap(name: "Map 1")
        return Campaign(name: name, maps: [map], activeMapID: map.id)
    }

    public var activeMap: GameMap {
        get { maps.first { $0.id == activeMapID } ?? maps[0] }
        set {
            guard let index = maps.firstIndex(where: { $0.id == newValue.id }) else { return }
            maps[index] = newValue
        }
    }

    /// Appends a map and makes it active. Returns the new map's id.
    @discardableResult
    public mutating func addMap(named name: String? = nil) -> GameMap.ID {
        let map = GameMap(name: name ?? "Map \(maps.count + 1)")
        maps.append(map)
        activeMapID = map.id
        return map.id
    }
}

public struct GameMap: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var grid: GridSettings

    public init(id: UUID = UUID(), name: String, grid: GridSettings = GridSettings()) {
        self.id = id
        self.name = name
        self.grid = grid
    }
}

public struct GridSettings: Codable, Equatable, Sendable {
    /// Cell size in map units (points at 100% zoom). TS default: 50.
    public var cellSize: Double

    public init(cellSize: Double = 50) {
        self.cellSize = cellSize
    }
}
