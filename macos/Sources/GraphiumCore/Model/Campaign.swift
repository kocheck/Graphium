import Foundation

/// A campaign: ordered maps, the active map, the campaign's token library, and
/// the Session Console catalog. Field names and JSON keys follow the TS
/// `Campaign` (docs/CORE_SPEC.md §1.2), except `maps`, which the native format
/// stores as an ordered array instead of an id-keyed object.
public struct Campaign: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    /// Ordered as shown in the map navigator. Order matters: deleting the active
    /// map activates the next one by this order.
    public var maps: [GameMap]
    public var activeMapID: String
    public var tokenLibrary: [TokenLibraryItem]
    public var sessionConsole: SessionConsoleCatalog

    private enum CodingKeys: String, CodingKey {
        case id, name, maps, tokenLibrary, sessionConsole
        case activeMapID = "activeMapId"
    }

    public init(
        id: String = newID(),
        name: String,
        maps: [GameMap],
        activeMapID: String,
        tokenLibrary: [TokenLibraryItem] = [],
        sessionConsole: SessionConsoleCatalog? = nil
    ) {
        self.id = id
        self.name = name
        self.maps = maps
        self.activeMapID = activeMapID
        self.tokenLibrary = tokenLibrary
        self.sessionConsole = sessionConsole ?? .empty(campaignName: name)
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        maps = try c.decode([GameMap].self, forKey: .maps)
        activeMapID = try c.decode(String.self, forKey: .activeMapID)
        tokenLibrary = try c.decodeIfPresent([TokenLibraryItem].self, forKey: .tokenLibrary) ?? []
        // Older files have no Session Console (TS ensureSessionConsole).
        sessionConsole =
            try c.decodeIfPresent(SessionConsoleCatalog.self, forKey: .sessionConsole)
            ?? .empty(campaignName: name)
        guard maps.contains(where: { $0.id == activeMapID }) else {
            // TS loadCampaign rejects these files outright.
            throw DecodingError.dataCorruptedError(
                forKey: .activeMapID, in: c, debugDescription: "activeMapId does not name a map")
        }
    }

    /// A new campaign with one empty map, matching the TS store's `createDefaultCampaign`.
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
    public mutating func addMap(named name: String? = nil) -> String {
        let map = GameMap(name: name ?? "Map \(maps.count + 1)")
        maps.append(map)
        activeMapID = map.id
        return map.id
    }
}

/// Lowercase v4 UUID string, like `crypto.randomUUID()` (CORE_SPEC rule R4).
public func newID() -> String {
    UUID().uuidString.lowercased()
}
