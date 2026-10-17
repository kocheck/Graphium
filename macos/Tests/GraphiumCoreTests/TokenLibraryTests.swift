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
        XCTAssertNil(lib.defaultScale)
    }

    func testSaveToLibraryLeavesDefaultScaleAlone() {
        var lib = item("Goblin", tags: ["small"])
        lib.defaultScale = 2
        let resized = Token(x: 0, y: 0, src: "", libraryItemId: lib.id, scale: 3, name: "Big Grik")
        lib.adoptDefaults(from: ResolvedToken(resized, library: [lib.id: lib]))
        XCTAssertEqual(lib.name, "Big Grik")
        XCTAssertEqual(lib.defaultScale, 2, "a resized token must not resize every linked token")
        XCTAssertEqual(lib.category, "Monsters")
        XCTAssertEqual(lib.tags, ["small"])
    }
}

final class LibraryUnionTests: XCTestCase {
    func item(_ id: String, src: String) -> TokenLibraryItem {
        TokenLibraryItem(id: id, name: id, src: src, thumbnailSrc: "", dateAdded: 0)
    }

    func testAppItemsFirstThenCampaignOnlyItemsDedupedByID() {
        let app = [item("goblin", src: "goblin-lib.png"), item("orc", src: "orc-lib.png")]
        let campaign = [
            item("orc", src: "orc-pkg.png"), item("dragon", src: "dragon.png"), item("dragon", src: "dragon-2.png"),
        ]
        let union = TokenLibrarySearch.union(app: app, campaign: campaign)
        XCTAssertEqual(union.items.map(\.id), ["goblin", "orc", "dragon"])
        XCTAssertEqual(union.items[1].src, "orc-lib.png", "the app library's copy wins")
        XCTAssertEqual(union.items[2].src, "dragon.png", "first campaign copy wins")
        XCTAssertEqual(union.campaignOnly, ["dragon"])
    }

    func testEmptyAppLibraryShowsEveryCampaignItem() {
        let union = TokenLibrarySearch.union(app: [], campaign: [item("a", src: "a.png"), item("b", src: "b.png")])
        XCTAssertEqual(union.items.map(\.id), ["a", "b"])
        XCTAssertEqual(union.campaignOnly, ["a", "b"])
    }
}
