import XCTest

@testable import GraphiumCore

/// Linked stairs (decision 017): placing, linking, and taking them with a token drop.
final class StairsTests: XCTestCase {
    /// 50 px cells. Linked stairs A on cell (2, 2) and B on cell (10, 2), 400 px to the east, and
    /// lone stairs on cell (2, 6). A token one cell west of A.
    private func floors() -> GameMap {
        var map = GameMap(gridSize: 50)
        map.stairs = [
            Stairs(id: "a", x: 125, y: 125, direction: .north, type: .down, width: 50, height: 50, linkedStairsId: "b"),
            Stairs(id: "b", x: 525, y: 125, direction: .north, type: .up, width: 50, height: 50, linkedStairsId: "a"),
            Stairs(id: "lone", x: 125, y: 325, direction: .east, type: .down, width: 50, height: 50),
        ]
        map.tokens = [Token(id: "t", x: 50, y: 100, src: "")]
        return map
    }

    private func position(_ map: GameMap, _ id: String) -> Point2D? {
        map.tokens.first { $0.id == id }.map { Point2D(x: $0.x, y: $0.y) }
    }

    func testDropOnLinkedStairsArrivesAtSister() {
        var map = floors()
        XCTAssertEqual(map.stairsTravel(forDropOf: "t", dx: 50, dy: 0, library: [:])?.to.id, "b")
        map.dropTokens(["t"], primary: "t", dx: 55, dy: 3, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "t"), Point2D(x: 500, y: 100), "snapped onto B's cell")
    }

    func testUnlinkedStairsAreOnlyDrawn() {
        var map = floors()
        map.dropTokens(["t"], primary: "t", dx: 50, dy: 200, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "t"), Point2D(x: 100, y: 300))
    }

    func testStandingNudgingAndArrivingNeverTravel() {
        var map = floors()
        map.dropTokens(["t"], primary: "t", dx: 50, dy: 0, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "t"), Point2D(x: 500, y: 100))
        // A nudge that stays on B, as when the DM straightens a token, stays upstairs.
        map.dropTokens(["t"], primary: "t", dx: 10, dy: -10, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "t"), Point2D(x: 500, y: 100))
        // Stepping off and back on B goes back down.
        map.dropTokens(["t"], primary: "t", dx: 50, dy: 0, duplicate: false, library: [:])
        map.dropTokens(["t"], primary: "t", dx: -50, dy: 0, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "t"), Point2D(x: 100, y: 100))
    }

    func testGroupKeepsFormation() {
        var map = floors()
        map.tokens = [
            Token(id: "lead", x: 50, y: 100, src: ""),
            Token(id: "left", x: 0, y: 100, src: ""),
            Token(id: "behind", x: 0, y: 150, src: ""),
        ]
        map.dropTokens(["lead", "left", "behind"], primary: "lead", dx: 50, dy: 0, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "lead"), Point2D(x: 500, y: 100))
        XCTAssertEqual(position(map, "left"), Point2D(x: 450, y: 100))
        XCTAssertEqual(position(map, "behind"), Point2D(x: 450, y: 150))
    }

    func testOnlyThePrimaryDecides() {
        var map = floors()
        map.tokens = [Token(id: "lead", x: 0, y: 0, src: ""), Token(id: "other", x: 50, y: 100, src: "")]
        // "other" lands on A, but the token the DM grabbed doesn't, so nobody travels.
        map.dropTokens(["lead", "other"], primary: "lead", dx: 50, dy: 0, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "other"), Point2D(x: 100, y: 100))
    }

    func testOptionDuplicateSendsCopiesAndLeavesOriginals() {
        var map = floors()
        let placed = map.dropTokens(["t"], primary: "t", dx: 50, dy: 0, duplicate: true, library: [:])
        XCTAssertEqual(position(map, "t"), Point2D(x: 50, y: 100))
        XCTAssertEqual(placed.count, 1)
        XCTAssertEqual(position(map, placed[0]), Point2D(x: 500, y: 100))
    }

    func testTravelOffParksOnTheStairs() {
        var map = floors()
        map.dropTokens(["t"], primary: "t", dx: 50, dy: 0, duplicate: false, library: [:], travel: false)
        XCTAssertEqual(position(map, "t"), Point2D(x: 100, y: 100))
    }

    func testLargeTokenTravelsByItsCentre() {
        var map = floors()
        // A 2×2 token whose centre lands on A: its top-left is half a cell up and left of A's cell.
        map.tokens = [Token(id: "ogre", x: 0, y: 50, src: "", scale: 2)]
        map.dropTokens(["ogre"], primary: "ogre", dx: 50, dy: 50, duplicate: false, library: [:])
        let ogre = map.tokens[0]
        XCTAssertTrue(map.stairs[1].bounds.contains(Point2D(x: ogre.x + 50, y: ogre.y + 50)), "\(ogre.x), \(ogre.y)")
    }

    func testHexGridArrivalLandsOnTheSister() {
        var map = GameMap(gridSize: 50, gridType: .hexagonal)
        let a = map.placeStairs(at: Point2D(x: 200, y: 200), direction: .north)
        let b = map.placeStairs(at: Point2D(x: 800, y: 500), direction: .north, linkingTo: a.id)
        let grid = makeGridGeometry(.hexagonal, cellSize: 50)
        let start = grid.snapPoint(Point2D(x: a.x - 120, y: a.y - 25), width: 50, height: 50)
        map.tokens = [Token(id: "t", x: start.x, y: start.y, src: "")]
        map.dropTokens(["t"], primary: "t", dx: a.x - 25 - start.x, dy: a.y - 25 - start.y, duplicate: false, library: [:])
        let t = map.tokens[0]
        XCTAssertTrue(b.bounds.contains(Point2D(x: t.x + 25, y: t.y + 25)), "\(t.x), \(t.y) vs \(b.x), \(b.y)")
    }

    func testPlayersTakeStairsButNeverCarryHiddenNPCs() {
        var map = GameMap(gridSize: 50)
        map.stairs = [
            Stairs(id: "a", x: 75, y: 75, direction: .north, type: .down, width: 50, height: 50, linkedStairsId: "b"),
            Stairs(id: "b", x: 1075, y: 75, direction: .north, type: .up, width: 50, height: 50, linkedStairsId: "a"),
        ]
        map.tokens = [
            Token(id: "pc", x: 0, y: 0, src: "", type: .pc, visionRadius: 60),
            Token(id: "far", x: 2000, y: 2000, src: "", type: .npc),
        ]
        XCTAssertEqual(map.playerMoveTokens(["pc", "far"], primary: "pc", dx: 50, dy: 50, library: [:]), ["pc"])
        XCTAssertEqual(position(map, "pc"), Point2D(x: 1050, y: 50))
        XCTAssertEqual(position(map, "far"), Point2D(x: 2000, y: 2000))
    }

    func testTwoClicksPlaceALinkedPair() {
        var map = GameMap(gridSize: 50)
        let first = map.placeStairs(at: Point2D(x: 130, y: 140), direction: .west)
        XCTAssertEqual(Point2D(x: first.x, y: first.y), Point2D(x: 125, y: 125), "centred on the clicked cell")
        XCTAssertEqual(first.type, .down)
        XCTAssertNil(first.linkedStairsId)
        let second = map.placeStairs(at: Point2D(x: 610, y: 20), direction: .west, linkingTo: first.id)
        XCTAssertEqual(second.type, .up)
        XCTAssertEqual(second.linkedStairsId, first.id)
        XCTAssertEqual(map.stairs.first { $0.id == first.id }?.linkedStairsId, second.id)
        XCTAssertEqual(map.stairsLabels, [first.id: "A", second.id: "A"])

        // A sister that was deleted in between leaves the new end waiting for its own sister.
        let third = map.placeStairs(at: .init(x: 0, y: 0), direction: .north, linkingTo: "gone")
        XCTAssertEqual(third.type, .down)
        XCTAssertNil(third.linkedStairsId)
    }

    func testLinkingAgainReplacesTheOldPair() {
        var map = floors()
        map.linkStairs("a", "lone")
        XCTAssertNil(map.stairs[1].linkedStairsId, "B lost its sister")
        XCTAssertEqual(map.sister(of: map.stairs[0])?.id, "lone")
        XCTAssertEqual(map.stairsLabels, ["a": "A", "lone": "A"])
    }

    func testRemovingOneEndUnlinksTheOther() {
        var map = floors()
        map.removeStairs(["a"])
        XCTAssertEqual(map.stairs.map(\.id), ["b", "lone"])
        XCTAssertNil(map.stairs[0].linkedStairsId)
        XCTAssertTrue(map.stairsLabels.isEmpty)
    }

    func testDanglingLinkReadsAsUnlinked() {
        var map = floors()
        map.stairs.remove(at: 1)  // as an older app or a hand edit might
        XCTAssertNil(map.sister(of: map.stairs[0]))
        map.dropTokens(["t"], primary: "t", dx: 50, dy: 0, duplicate: false, library: [:])
        XCTAssertEqual(position(map, "t"), Point2D(x: 100, y: 100))
    }

    func testLabelsRunPastZ() {
        XCTAssertEqual(GameMap.pairLabel(0), "A")
        XCTAssertEqual(GameMap.pairLabel(25), "Z")
        XCTAssertEqual(GameMap.pairLabel(26), "AA")
        XCTAssertEqual(GameMap.pairLabel(27), "AB")
    }

    func testRotateAndMoveKeepStairsOnTheGrid() {
        var map = floors()
        map.rotateStairs(["a"])
        XCTAssertEqual(map.stairs[0].direction, .east)
        let copies = map.moveStairs(["a"], dx: 60, dy: -40, duplicate: true)
        XCTAssertEqual(map.stairs[0].x, 125, "original stays")
        let copy = map.stairs.first { $0.id == copies[0] }
        XCTAssertEqual(copy.map { Point2D(x: $0.x, y: $0.y) }, Point2D(x: 175, y: 75))
        XCTAssertNil(copy?.linkedStairsId, "a pair is always two ends")
        map.moveStairs(["a"], dx: 50, dy: 0, duplicate: false)
        XCTAssertEqual(map.stairs[0].x, 175)
        XCTAssertEqual(map.stairs[0].linkedStairsId, "b", "moving keeps the link")
    }

    func testOldFilesRoundTripWithoutTheLink() throws {
        let old = #"{"id":"s","x":10,"y":20,"direction":"north","type":"up","width":50,"height":50}"#
        let decoded = try JSONDecoder().decode(Stairs.self, from: Data(old.utf8))
        XCTAssertNil(decoded.linkedStairsId)
        let encoded = String(decoding: try JSONEncoder().encode(decoded), as: UTF8.self)
        XCTAssertFalse(encoded.contains("linkedStairsId"))

        let linked = Stairs(id: "s", x: 0, y: 0, direction: .north, type: .up, width: 1, height: 1, linkedStairsId: "t")
        let back = try JSONDecoder().decode(Stairs.self, from: JSONEncoder().encode(linked))
        XCTAssertEqual(back, linked)
    }
}
