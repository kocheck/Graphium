import Foundation

/// Native only: one map's turn order (issue #356, decision 016). Combatants are tokens on the
/// map, each with the initiative the DM typed; `currentTokenID` is whose turn it is (nil
/// before the first Next Turn). Saved on the map as `initiative`, only when not empty.
public struct Initiative: Codable, Equatable, Sendable {
    public struct Entry: Codable, Equatable, Sendable {
        public var tokenID: String
        public var value: Int

        private enum CodingKeys: String, CodingKey {
            case tokenID = "tokenId"
            case value
        }

        public init(tokenID: String, value: Int = 0) {
            self.tokenID = tokenID
            self.value = value
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            tokenID = try c.decode(String.self, forKey: .tokenID)
            value = try c.decodeIfPresent(Int.self, forKey: .value) ?? 0
        }
    }

    /// In turn order.
    public var entries: [Entry]
    public var currentTokenID: String?
    /// Starts at 1; Next Turn past the last combatant starts the next round.
    public var round: Int

    private enum CodingKeys: String, CodingKey {
        case entries, round
        case currentTokenID = "currentTokenId"
    }

    public init(entries: [Entry] = [], currentTokenID: String? = nil, round: Int = 1) {
        self.entries = entries
        self.currentTokenID = currentTokenID
        self.round = round
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let entries = try c.decodeIfPresent([Entry].self, forKey: .entries) ?? []
        let current = try c.decodeIfPresent(String.self, forKey: .currentTokenID)
        let round = try c.decodeIfPresent(Int.self, forKey: .round) ?? 1
        self.entries = entries
        currentTokenID = entries.contains(where: { $0.tokenID == current }) ? current : nil
        self.round = max(1, round)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(entries, forKey: .entries)
        try c.encodeIfPresent(currentTokenID, forKey: .currentTokenID)
        try c.encode(round, forKey: .round)
    }

    public var isEmpty: Bool { entries.isEmpty }

    public func contains(_ tokenID: String) -> Bool {
        entries.contains { $0.tokenID == tokenID }
    }

    public func value(of tokenID: String) -> Int? {
        entries.first { $0.tokenID == tokenID }?.value
    }

    /// Appends combatants not already in the order, at initiative 0.
    public mutating func add(_ tokenIDs: [String]) {
        for id in tokenIDs where !contains(id) {
            entries.append(Entry(tokenID: id))
        }
    }

    public mutating func setValue(_ value: Int, for tokenID: String) {
        guard let i = entries.firstIndex(where: { $0.tokenID == tokenID }) else { return }
        entries[i].value = value
    }

    /// Highest initiative first; ties keep their current order. Whose turn it is doesn't change.
    public mutating func sort() {
        entries = entries.enumerated()
            .sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }
            .map { $0.element }
    }

    /// The next combatant's turn, wrapping to the first (and the next round) after the last.
    /// Before the first turn, sorts the order and starts with the highest initiative, so
    /// starting combat doesn't depend on remembering Sort.
    public mutating func next() {
        guard !entries.isEmpty else { return }
        guard let index = currentIndex else {
            sort()
            currentTokenID = entries[0].tokenID
            return
        }
        if index + 1 < entries.count {
            currentTokenID = entries[index + 1].tokenID
        } else {
            currentTokenID = entries[0].tokenID
            round += 1
        }
    }

    /// The previous combatant's turn, wrapping to the last (and the previous round) before the
    /// first. Before the first turn, starts with the last combatant.
    public mutating func previous() {
        guard !entries.isEmpty else { return }
        guard let index = currentIndex else {
            currentTokenID = entries[entries.count - 1].tokenID
            return
        }
        if index > 0 {
            currentTokenID = entries[index - 1].tokenID
        } else {
            currentTokenID = entries[entries.count - 1].tokenID
            round = max(1, round - 1)
        }
    }

    /// Drops combatants. When the current one goes, the turn passes to the next one left.
    public mutating func remove(_ tokenIDs: Set<String>) {
        guard entries.contains(where: { tokenIDs.contains($0.tokenID) }) else { return }
        if let index = currentIndex, tokenIDs.contains(entries[index].tokenID) {
            let after = Array(entries[(index + 1)...]) + Array(entries[..<index])
            currentTokenID = after.first { !tokenIDs.contains($0.tokenID) }?.tokenID
        }
        entries.removeAll { tokenIDs.contains($0.tokenID) }
    }

    private var currentIndex: Int? {
        guard let currentTokenID else { return nil }
        return entries.firstIndex { $0.tokenID == currentTokenID }
    }
}

/// One line of the World View's initiative strip: a name players may read.
public struct PlayerInitiativeEntry: Equatable, Sendable {
    /// Shown for a combatant whose name is hidden from players (decision 014).
    public static let unnamed = "Unknown"

    public var tokenID: String
    public var name: String
    public var isCurrent: Bool

    public init(tokenID: String, name: String, isCurrent: Bool) {
        self.tokenID = tokenID
        self.name = name
        self.isCurrent = isCurrent
    }
}

extension GameMap {
    /// Adds the given tokens to the initiative order, in map order. Ids that aren't tokens are ignored.
    public mutating func addToInitiative(_ ids: Set<String>) {
        initiative.add(tokens.map(\.id).filter { ids.contains($0) })
    }

    /// What the World View lists, in turn order: never a token players can't see (`hiddenTokenIDs`,
    /// the hidden NPCs) and only names players may read (`ResolvedToken.playerName`, "Unknown"
    /// when the DM hid it). A combatant whose token is gone is skipped.
    public func initiativeForPlayers(
        library: [String: TokenLibraryItem], hiddenTokenIDs: Set<String>
    ) -> [PlayerInitiativeEntry] {
        let byID = Dictionary(tokens.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return initiative.entries.compactMap { entry -> PlayerInitiativeEntry? in
            guard !hiddenTokenIDs.contains(entry.tokenID), let token = byID[entry.tokenID] else { return nil }
            let name = ResolvedToken(token, library: library).playerName ?? PlayerInitiativeEntry.unnamed
            return PlayerInitiativeEntry(
                tokenID: entry.tokenID, name: name, isCurrent: entry.tokenID == initiative.currentTokenID)
        }
    }
}
