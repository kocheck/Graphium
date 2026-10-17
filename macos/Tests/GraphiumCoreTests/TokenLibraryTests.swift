import XCTest

@testable import GraphiumCore

/// Mirrors fuzzySearch.test.ts and tokenUtils.test.ts (CORE_SPEC §3.7, §3.14).
final class TokenLibraryTests: XCTestCase {
    func item(_ name: String, _ category: String = "Monsters", tags: [String] = [], date: Double = 0, src: String? = nil, type: CreatureType? = nil) -> TokenLibraryItem {
        TokenLibraryItem(
            id: name, name: name, src: src ?? "\(name).png", thumbnailSrc: "", category: category, tags: tags,
            dateAdded: date, defaultType: type)
    }

    func testEmptyQueryReturnsAllNewestFirst() {
        let items = [item("a", date: 1), item("b", date: 3), item("c", date: 2)]
        XCTAssertEqual(TokenLibrarySearch.search(items, query: "  ").map(\.name), ["b", "c", "a"])
    }

    func testScoring() {
        XCTAssertEqual(TokenLibrarySearch.score("Goblin", "goblin"), 100, "exact, case-insensitive")
        XCTAssertEqual(TokenLibrarySearch.score("Goblin", "xyz"), 0, "not a subsequence")
        XCTAssertGreaterThan(TokenLibrarySearch.score("Goblin Boss", "gob"), TokenLibrarySearch.score("Hobgoblin", "gob"),
            "starts-with beats contains")
        XCTAssertGreaterThan(TokenLibrarySearch.score("Red Dragon", "rd"), 0, "fuzzy subsequence")
    }

    func testNameOutranksTagAndCategoryCounts() {
        let items = [item("Wolf", tags: ["dragon"]), item("Dragon"), item("Kobold", "dragon kin")]
        XCTAssertEqual(TokenLibrarySearch.search(items, query: "dragon").first?.name, "Dragon")
        XCTAssertEqual(Set(TokenLibrarySearch.search(items, query: "dragon").map(\.name)), ["Wolf", "Dragon", "Kobold"])
        XCTAssertTrue(TokenLibrarySearch.search(items, query: "zzz").isEmpty)
    }

    func testAssetsQueryMatchesEverything() {
        let items = [item("a"), item("b")]
        XCTAssertEqual(TokenLibrarySearch.search(items, query: "assets").count, 2)
        XCTAssertEqual(TokenLibrarySearch.search(items, query: "ass").count, 2)
    }

    func testCategories() {
        let items = [item("a", "monsters"), item("b", "PC"), item("c", "Monsters"), item("d", "PC")]
        XCTAssertEqual(TokenLibrarySearch.categories(items), ["Monsters", "PC", "monsters"], "uppercase first, like JS sort")
        XCTAssertEqual(TokenLibrarySearch.filter(items, category: "monsters").count, 2, "case-insensitive")
        XCTAssertEqual(TokenLibrarySearch.filter(items, category: "All").count, 4)
        XCTAssertEqual(TokenLibrarySearch.filter(items, category: "").count, 4)
        XCTAssertTrue(TokenLibrarySearch.filter(items, category: "Props").isEmpty)
    }

    func testTagParsing() {
        XCTAssertEqual(TokenLibrarySearch.parseTags(" dragon, red  large,,"), ["dragon", "red", "large"])
    }

    func testRecentTokensWalkNewestFirstUniqueBySrc() {
        let library = [item("orc"), item("elf"), item("imp")]
        let tokens = ["orc.png", "elf.png", "orc.png", "loose.png", "imp.png"].map { Token(x: 0, y: 0, src: $0) }
        XCTAssertEqual(TokenLibrarySearch.recent(tokens: tokens, library: library).map(\.name), ["imp", "orc", "elf"])
        XCTAssertEqual(TokenLibrarySearch.recent(tokens: tokens, library: library, limit: 1).map(\.name), ["imp"])
    }

    func testPartyTokensArePCsNewestFirstMinusRecents() {
        let library = [
            item("old", "PC", date: 1), item("new", "Heroes", date: 5, type: .pc), item("mid", "PC", date: 3),
            item("monster", date: 9),
        ]
        XCTAssertEqual(TokenLibrarySearch.party(library: library).map(\.name), ["new", "mid", "old"])
        XCTAssertEqual(
            TokenLibrarySearch.party(library: library, excluding: [library[2]]).map(\.name), ["new", "old"])
    }

    func testLibraryIndexToleratesBadFiles() throws {
        XCTAssertEqual(LibraryIndex.decode(Data("nope".utf8)), LibraryIndex())
        XCTAssertEqual(LibraryIndex.decode(nil), LibraryIndex())
        let index = LibraryIndex(items: [item("orc")])
        XCTAssertEqual(LibraryIndex.decode(try index.encoded()), index)
    }

    func testSaveToLibraryAdoptsResolvedValues() {
        var lib = item("Goblin")
        let token = Token(x: 0, y: 0, src: "", libraryItemId: lib.id, type: .pc, visionRadius: 60, name: "Grik")
        lib.adoptDefaults(from: ResolvedToken(token, library: [lib.id: lib]))
        XCTAssertEqual(lib.name, "Grik")
        XCTAssertEqual(lib.defaultType, .pc)
        XCTAssertEqual(lib.defaultVisionRadius, 60)
        XCTAssertEqual(lib.defaultScale, 1)
    }
}
