import XCTest

@testable import GraphiumCore

/// Initiative order (native, issue #356): turn order on the map, and what players see of it.
final class InitiativeTests: XCTestCase {
    private func order(_ values: [(String, Int)]) -> Initiative {
        Initiative(entries: values.map { Initiative.Entry(tokenID: $0.0, value: $0.1) })
    }

    func testSortsHighestFirstAndKeepsTiesInOrder() {
        var initiative = order([("a", 8), ("b", 15), ("c", 8), ("d", 20)])
        initiative.currentTokenID = "c"
        initiative.sort()
        XCTAssertEqual(initiative.entries.map(\.tokenID), ["d", "b", "a", "c"])
        XCTAssertEqual(initiative.currentTokenID, "c", "sorting doesn't change whose turn it is")
    }

    func testNextAndPreviousWrapAndCountRounds() {
        var initiative = order([("a", 20), ("b", 15), ("c", 10)])
        XCTAssertNil(initiative.currentTokenID, "no turn before the first Next Turn")
        initiative.next()
        XCTAssertEqual(initiative.currentTokenID, "a")
        XCTAssertEqual(initiative.round, 1)
        initiative.next()
        initiative.next()
        XCTAssertEqual(initiative.currentTokenID, "c")
        initiative.next()
        XCTAssertEqual(initiative.currentTokenID, "a", "wraps to the top")
        XCTAssertEqual(initiative.round, 2)
        initiative.previous()
        XCTAssertEqual(initiative.currentTokenID, "c", "wraps back to the bottom")
        XCTAssertEqual(initiative.round, 1)
        initiative.previous()
        XCTAssertEqual(initiative.currentTokenID, "b")

        var fresh = order([("a", 1), ("b", 2)])
        fresh.previous()
        XCTAssertEqual(fresh.currentTokenID, "b", "Previous before the first turn starts at the bottom")
        fresh.currentTokenID = "a"
        fresh.previous()
        XCTAssertEqual(fresh.round, 1, "never below round 1")

        var empty = Initiative()
        empty.next()
        empty.previous()
        XCTAssertEqual(empty, Initiative())
    }

    func testFirstNextTurnSortsTheOrder() {
        var initiative = order([("a", 8), ("b", 15), ("c", 20)])
        initiative.next()
        XCTAssertEqual(initiative.entries.map(\.tokenID), ["c", "b", "a"])
        XCTAssertEqual(initiative.currentTokenID, "c", "starts with the highest initiative")
        initiative.setValue(30, for: "a")
        initiative.next()
        XCTAssertEqual(initiative.entries.map(\.tokenID), ["c", "b", "a"], "later turns keep the order")
        XCTAssertEqual(initiative.currentTokenID, "b")
    }

    func testAddingSkipsCombatantsAlreadyInTheOrder() {
        var map = GameMap(id: "m")
        map.tokens = [Token(id: "a", x: 0, y: 0, src: ""), Token(id: "b", x: 0, y: 0, src: ""), Token(id: "c", x: 0, y: 0, src: "")]
        map.addToInitiative(["c", "a", "nope"])
        XCTAssertEqual(map.initiative.entries.map(\.tokenID), ["a", "c"], "map order; ids that aren't tokens are ignored")
        map.initiative.setValue(17, for: "c")
        map.addToInitiative(["b", "c"])
        XCTAssertEqual(map.initiative.entries.map(\.tokenID), ["a", "c", "b"])
        XCTAssertEqual(map.initiative.value(of: "c"), 17, "adding again keeps the typed initiative")
        XCTAssertEqual(map.initiative.value(of: "b"), 0)
    }

    func testRemovingTheCurrentCombatantPassesTheTurnOn() {
        var initiative = order([("a", 20), ("b", 15), ("c", 10)])
        initiative.currentTokenID = "b"
        initiative.remove(["b"])
        XCTAssertEqual(initiative.entries.map(\.tokenID), ["a", "c"])
        XCTAssertEqual(initiative.currentTokenID, "c")

        initiative.remove(["c"])
        XCTAssertEqual(initiative.currentTokenID, "a", "wraps to the top")
        initiative.remove(["a"])
        XCTAssertTrue(initiative.isEmpty)
        XCTAssertNil(initiative.currentTokenID)

        var other = order([("a", 20), ("b", 15)])
        other.currentTokenID = "a"
        other.remove(["b"])
        XCTAssertEqual(other.currentTokenID, "a", "removing someone else keeps the turn")
    }

    func testDeletingATokenDropsItFromInitiative() {
        var map = GameMap(id: "m")
        map.tokens = [Token(id: "a", x: 0, y: 0, src: ""), Token(id: "b", x: 0, y: 0, src: "")]
        map.addToInitiative(["a", "b"])
        map.initiative.currentTokenID = "a"
        map.removeItems(["a"])
        XCTAssertEqual(map.initiative.entries.map(\.tokenID), ["b"])
        XCTAssertEqual(map.initiative.currentTokenID, "b")
        map.removeTokens(["b"])
        XCTAssertTrue(map.initiative.isEmpty)
    }

    func testPlayersSeeOnlyVisibleCombatantsByTheirPlayerNames() {
        var map = GameMap(id: "m", gridSize: 50)
        map.tokens = [
            Token(id: "pc", x: 0, y: 0, src: "", type: .pc, visionRadius: 60, name: "Aria"),
            Token(id: "far", x: 2000, y: 2000, src: "", type: .npc, name: "Vecna"),
            Token(id: "near", x: 50, y: 0, src: "", type: .npc, name: "Vecna", playerName: "Hooded figure"),
            Token(id: "anon", x: 0, y: 50, src: "", type: .npc, name: "Mimic", playerName: ""),
        ]
        map.addToInitiative(["pc", "far", "near", "anon"])
        map.initiative.entries.append(Initiative.Entry(tokenID: "gone", value: 30))
        map.initiative.currentTokenID = "near"

        let hidden = VisibilityCache().visibility(of: map, library: [:]).hiddenNPCIDs
        XCTAssertEqual(hidden, ["far"])
        let shown = map.initiativeForPlayers(library: [:], hiddenTokenIDs: hidden)
        XCTAssertEqual(
            shown,
            [
                PlayerInitiativeEntry(tokenID: "pc", name: "Aria", isCurrent: false),
                PlayerInitiativeEntry(tokenID: "near", name: "Hooded figure", isCurrent: true),
                PlayerInitiativeEntry(tokenID: "anon", name: PlayerInitiativeEntry.unnamed, isCurrent: false),
            ])
        XCTAssertFalse(shown.contains { $0.name == "Vecna" || $0.name == "Mimic" }, "never the DM's names")

        map.initiative.currentTokenID = "far"
        XCTAssertFalse(
            map.initiativeForPlayers(library: [:], hiddenTokenIDs: hidden).contains(where: \.isCurrent),
            "a hidden NPC's turn highlights nobody")
    }

    func testTheFileOnlyGainsTheKeyWhenInitiativeIsUsed() throws {
        let plain = String(decoding: try JSONEncoder().encode(GameMap(id: "m")), as: UTF8.self)
        XCTAssertFalse(plain.contains("initiative"))
        let old = #"{"id":"m","tokens":[],"drawings":[]}"#
        XCTAssertEqual(try JSONDecoder().decode(GameMap.self, from: Data(old.utf8)).initiative, Initiative())

        var map = GameMap(id: "m")
        map.tokens = [Token(id: "a", x: 0, y: 0, src: ""), Token(id: "b", x: 0, y: 0, src: "")]
        map.initiative = Initiative(
            entries: [Initiative.Entry(tokenID: "a", value: 18), Initiative.Entry(tokenID: "b", value: 12)],
            currentTokenID: "b", round: 3)
        let data = try JSONEncoder().encode(map)
        XCTAssertEqual(try JSONDecoder().decode(GameMap.self, from: data), map)
        let json = String(decoding: data, as: UTF8.self)
        XCTAssertTrue(json.contains(#""tokenId":"a""#))
        XCTAssertTrue(json.contains(#""currentTokenId":"b""#))

        map.initiative = Initiative()
        XCTAssertFalse(String(decoding: try JSONEncoder().encode(map), as: UTF8.self).contains("initiative"), "cleared is gone")

        // A pointer at nobody in the order reads as no turn yet; a missing round is round 1.
        let stray = #"{"entries":[{"tokenId":"a"}],"currentTokenId":"zz"}"#
        let read = try JSONDecoder().decode(Initiative.self, from: Data(stray.utf8))
        XCTAssertEqual(read, Initiative(entries: [Initiative.Entry(tokenID: "a", value: 0)], currentTokenID: nil, round: 1))
    }
}
