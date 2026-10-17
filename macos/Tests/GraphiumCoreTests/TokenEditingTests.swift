import XCTest

@testable import GraphiumCore

/// Mirrors useTokenData.test.ts, tokenHelpers.test.ts, useTokenDrag snapping and
/// gameStore map operations (CORE_SPEC §3.1, §3.7, §4.1).
final class TokenEditingTests: XCTestCase {
    let goblin = TokenLibraryItem(
        id: "lib-goblin", name: "Goblin", src: "goblin.png", thumbnailSrc: "thumb.png", dateAdded: 0,
        defaultScale: 2, defaultVisionRadius: 30, defaultType: .npc, defaultMovementSpeed: 25)

    var library: [String: TokenLibraryItem] { [goblin.id: goblin] }

    func testResolveUsesInstanceThenLibraryThenDefaults() {
        let inherited = ResolvedToken(Token(x: 0, y: 0, src: "", libraryItemId: goblin.id), library: library)
        XCTAssertEqual(inherited.name, "Goblin")
        XCTAssertEqual(inherited.scale, 2)
        XCTAssertEqual(inherited.type, .npc)
        XCTAssertEqual(inherited.movementSpeed, 25)
        XCTAssertEqual(inherited.inherited, [.name, .scale, .type, .visionRadius, .movementSpeed])

        let overridden = ResolvedToken(
            Token(x: 0, y: 0, src: "", libraryItemId: goblin.id, scale: 1, type: .pc, visionRadius: 0, name: "Grik"),
            library: library)
        XCTAssertEqual(overridden.name, "Grik")
        XCTAssertEqual(overridden.visionRadius, 0, "explicit zero is kept, not treated as missing")
        XCTAssertEqual(overridden.inherited, [.movementSpeed])

        let bare = ResolvedToken(Token(x: 0, y: 0, src: "", libraryItemId: "missing"), library: library)
        XCTAssertEqual(bare.name, "Token")
        XCTAssertEqual(bare.scale, 1)
        XCTAssertEqual(bare.movementSpeed, 30)
        XCTAssertNil(bare.type)
        XCTAssertNil(bare.visionRadius)
    }

    func testPCCategoryInfersTypeWithoutCountingAsInherited() {
        let hero = TokenLibraryItem(id: "h", name: "Hero", src: "", thumbnailSrc: "", category: "PC", dateAdded: 0)
        let resolved = ResolvedToken(Token(x: 0, y: 0, src: "", libraryItemId: "h"), library: ["h": hero])
        XCTAssertEqual(resolved.type, .pc)
        XCTAssertFalse(resolved.inherited.contains(.type))
    }

    func testCentrePlacementAccountsForMapScaleAndDefaultsTo500() {
        var map = GameMap()
        XCTAssertEqual(map.centrePlacementPoint, Point2D(x: 500, y: 500))
        map.background = MapBackground(src: "m.png", x: -100, y: 20, width: 1000, height: 400, scale: 0.5)
        XCTAssertEqual(map.centrePlacementPoint, Point2D(x: 150, y: 120))
    }

    func testDropSnapsPrimaryThenAppliesOffsetAndResnapsOthers() {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "a", x: 0, y: 0, src: ""),
            Token(id: "b", x: 100, y: 0, src: "", libraryItemId: goblin.id),  // 2×2 via library scale
        ]
        // Drag by (+60, +10): a (1×1) lands at 50,0; b gets the same +50,0 offset → 150,0,
        // then re-snapped as 2×2 (even): centre 200,50 → intersection → stays 150,0.
        map.dropTokens(["a", "b"], primary: "a", dx: 60, dy: 10, duplicate: false, library: library)
        XCTAssertEqual(map.tokens.map { Point2D(x: $0.x, y: $0.y) }, [Point2D(x: 50, y: 0), Point2D(x: 150, y: 0)])
    }

    func testOptionDragDuplicatesAtDestination() {
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "a", x: 0, y: 0, src: "s.png", name: "Orc")]
        let copies = map.dropTokens(["a"], primary: "a", dx: 100, dy: 0, duplicate: true, library: [:])
        XCTAssertEqual(map.tokens.count, 2)
        XCTAssertEqual(map.tokens[0].x, 0, "original stays")
        XCTAssertEqual(copies.count, 1)
        XCTAssertNotEqual(copies[0], "a")
        XCTAssertEqual(map.tokens[1].x, 100)
        XCTAssertEqual(map.tokens[1].name, "Orc")
    }

    func testMarqueeAndHitTesting() {
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "a", x: 0, y: 0, src: ""), Token(id: "b", x: 40, y: 40, src: "")]
        XCTAssertEqual(map.tokenIDs(intersecting: Bounds(corner: Point2D(x: 60, y: 60), corner: Point2D(x: 70, y: 70)), library: [:]), ["b"])
        XCTAssertEqual(map.token(at: Point2D(x: 45, y: 45), library: [:])?.id, "b", "topmost wins")
        XCTAssertNil(map.token(at: Point2D(x: 200, y: 200), library: [:]))
    }

    func testIsometricTokensAreDrawnAndHitHalfTheirHeightHigher() {
        var map = GameMap(gridSize: 50, gridType: .isometric)
        map.tokens = [Token(id: "a", x: 75, y: 75, src: "", scale: 2)]
        XCTAssertEqual(map.tokenDisplayYOffset(size: 100), -50)
        XCTAssertEqual(map.tokenBounds(map.tokens[0], library: [:]), Bounds(x: 75, y: 75, width: 100, height: 100))
        XCTAssertEqual(map.tokenDisplayBounds(map.tokens[0], library: [:]), Bounds(x: 75, y: 25, width: 100, height: 100))
        XCTAssertEqual(map.token(at: Point2D(x: 100, y: 30), library: [:])?.id, "a", "the lifted art is hit")
        XCTAssertNil(map.token(at: Point2D(x: 100, y: 160), library: [:]), "the uncovered lower half is not")
        XCTAssertEqual(
            map.tokenIDs(intersecting: Bounds(corner: Point2D(x: 0, y: 0), corner: Point2D(x: 80, y: 30)), library: [:]), ["a"])

        map.gridType = .hexagonal
        XCTAssertEqual(map.tokenDisplayYOffset(size: 100), 0, "only iso lifts")
        XCTAssertEqual(map.tokenDisplayBounds(map.tokens[0], library: [:]), map.tokenBounds(map.tokens[0], library: [:]))
    }

    func testDeleteMapRules() throws {
        var campaign = Campaign.makeDefault()
        XCTAssertThrowsError(try campaign.deleteMap(id: campaign.activeMapID)) {
            XCTAssertEqual($0 as? Campaign.MapEditError, .cannotDeleteOnlyMap)
        }
        let first = campaign.maps[0].id
        let second = campaign.addMap()
        let third = campaign.addMap()
        campaign.activeMapID = second
        try campaign.deleteMap(id: second)
        XCTAssertEqual(campaign.activeMapID, third, "next map in order")
        try campaign.deleteMap(id: third)
        XCTAssertEqual(campaign.activeMapID, first, "previous when deleting the last")
        XCTAssertEqual(campaign.maps.count, 1)
    }

    func testImageFitNeverUpscalesAndUsesPortraitBranchForSquares() {
        XCTAssertTrue(ImageKind.map.fittedSize(width: 800, height: 600) == (800, 600))
        XCTAssertTrue(ImageKind.map.fittedSize(width: 8192, height: 4096) == (4096, 2048))
        XCTAssertTrue(ImageKind.token.fittedSize(width: 1000, height: 2000) == (256, 512))
        XCTAssertTrue(ImageKind.thumbnail.fittedSize(width: 1000, height: 1000) == (256, 256))
    }
}
