import Foundation

/// Library search, filters and quick-token picks (TS `fuzzySearch.ts`, `tokenUtils.ts`;
/// CORE_SPEC §3.7, §3.14). String comparisons use UTF-16 code units like JS (rule R6).
public enum TokenLibrarySearch {
    /// TS `scoreMatch`.
    public static func score(_ text: String, _ query: String) -> Int {
        guard !query.isEmpty else { return 0 }
        let t = Array(text.lowercased().utf16)
        let q = Array(query.lowercased().utf16)
        if t == q { return 100 }
        guard isSubsequence(q, of: t) else { return 0 }
        var score = 10
        if t.starts(with: q) { score += 40 }
        if contains(t, q) { score += 20 }
        score += structuralBonus(t, q)
        return max(score, 0)
    }

    private static func isSubsequence(_ q: [UInt16], of t: [UInt16]) -> Bool {
        var i = 0
        for c in t where i < q.count && c == q[i] { i += 1 }
        return i == q.count
    }

    private static func contains(_ t: [UInt16], _ q: [UInt16]) -> Bool {
        guard q.count <= t.count else { return false }
        for start in 0...(t.count - q.count) where t[start..<(start + q.count)].elementsEqual(q) {
            return true
        }
        return false
    }

    /// TS `scoreStructuralBonuses`: word-start and adjacency bonuses, gap penalty (max 20).
    private static func structuralBonus(_ t: [UInt16], _ q: [UInt16]) -> Int {
        let separators: Set<UInt16> = [32, 45, 95]  // space, '-', '_'
        var bonus = 0
        var compactness = 0
        var last = -1
        for ch in q {
            guard let idx = t[(last + 1)...].firstIndex(of: ch) else { break }
            if idx == 0 || separators.contains(t[idx - 1]) { bonus += 15 }
            if idx == last + 1 {
                bonus += 10
            } else if last != -1 {
                compactness += idx - last
            }
            last = idx
        }
        return bonus - min(compactness, 20)
    }

    /// TS `fuzzySearch`: name ×3, category ×1, each tag ×2; "assets" prefixes boost all.
    /// Empty query → all items, newest first. Ties keep input order.
    public static func search(_ items: [TokenLibraryItem], query: String) -> [TokenLibraryItem] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return items.enumerated().sorted { a, b in
            a.element.dateAdded != b.element.dateAdded ? a.element.dateAdded > b.element.dateAdded : a.offset < b.offset
        }.map { $0.element } }
        let lq = q.lowercased()
        let isSection = "assets".hasPrefix(lq)
        let scored: [(item: TokenLibraryItem, score: Int, index: Int)] = items.enumerated().map { index, item in
            if isSection && lq == "assets" { return (item, 100, index) }
            var s = isSection ? 50 : 0
            s += 3 * score(item.name, q) + score(item.category, q)
            for tag in item.tags { s += 2 * score(tag, q) }
            return (item, s, index)
        }
        return scored.filter { $0.score > 0 }
            .sorted { $0.score != $1.score ? $0.score > $1.score : $0.index < $1.index }
            .map { $0.item }
    }

    /// TS `filterByCategory`: "" or "All" → everything; else case-insensitive equality.
    public static func filter(_ items: [TokenLibraryItem], category: String) -> [TokenLibraryItem] {
        guard !category.isEmpty, category != "All" else { return items }
        return items.filter { $0.category.lowercased() == category.lowercased() }
    }

    /// TS `getCategories`: unique, sorted by UTF-16 code units (uppercase first).
    public static func categories(_ items: [TokenLibraryItem]) -> [String] {
        Array(Set(items.map(\.category))).sorted { Array($0.utf16).lexicographicallyPrecedes(Array($1.utf16)) }
    }

    /// TS tag parsing: split on commas and whitespace, drop empties.
    public static func parseTags(_ text: String) -> [String] {
        text.split(whereSeparator: { $0 == "," || $0.isWhitespace }).map(String.init)
    }

    /// TS `getRecentTokens`: walk the map's tokens newest first; the first time each
    /// `src` appears, take the library item with that `src` (if any), up to `limit`.
    public static func recent(tokens: [Token], library: [TokenLibraryItem], limit: Int = 3) -> [TokenLibraryItem] {
        var seen = Set<String>()
        var result: [TokenLibraryItem] = []
        for token in tokens.reversed() where !seen.contains(token.src) {
            seen.insert(token.src)
            if let item = library.first(where: { $0.src == token.src }) {
                result.append(item)
                if result.count == limit { break }
            }
        }
        return result
    }

    /// TS `getPlayerTokens` + `deduplicatePlayerTokens`: PC library items, newest
    /// first, minus any already in `excluding`.
    public static func party(
        library: [TokenLibraryItem], limit: Int = 5, excluding recent: [TokenLibraryItem] = []
    ) -> [TokenLibraryItem] {
        let recentSrcs = Set(recent.map(\.src))
        return library.filter { $0.defaultType == .pc || $0.category == "PC" }
            .enumerated().sorted { a, b in
                a.element.dateAdded != b.element.dateAdded ? a.element.dateAdded > b.element.dateAdded : a.offset < b.offset
            }
            .map { $0.element }
            .prefix(limit)
            .filter { !recentSrcs.contains($0.src) }
    }

    /// Library categories offered when adding (TS `AddToLibraryDialog`).
    public static let standardCategories = ["PC", "Monsters", "NPCs", "Props", "Items", "Custom"]
}

/// The app-wide library index (`Application Support/Graphium/Library/index.json`),
/// same shape as TS `userData/library/index.json`: `{ "items": [...] }`.
public struct LibraryIndex: Codable, Equatable, Sendable {
    public var items: [TokenLibraryItem]

    public init(items: [TokenLibraryItem] = []) {
        self.items = items
    }

    /// Invalid files reset to an empty library (TS behaviour) instead of failing launch.
    public static func decode(_ data: Data?) -> LibraryIndex {
        guard let data, let index = try? JSONDecoder().decode(LibraryIndex.self, from: data) else {
            return LibraryIndex()
        }
        return index
    }

    public func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(self)
    }
}

extension TokenLibraryItem {
    /// Writes a token's resolved name/type/vision back as library defaults (TS Token
    /// Inspector "Save to library"). Scale, category and tags are left alone, so a
    /// resized token doesn't resize every other token linked to the item. All three
    /// fields persist natively; TS only persisted name/category/tags to the global
    /// index (CORE_SPEC §1.10).
    public mutating func adoptDefaults(from token: ResolvedToken) {
        name = token.name
        defaultType = token.type
        defaultVisionRadius = token.visionRadius
    }
}
