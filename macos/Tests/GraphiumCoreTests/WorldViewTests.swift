import XCTest

@testable import GraphiumCore

final class WorldViewTests: XCTestCase {
    func testPartyBoundsCoverPCsWithTwoCellPadding() {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "pc1", x: 100, y: 100, src: "", type: .pc),
            Token(id: "pc2", x: 300, y: 200, src: "", type: .pc),
            Token(id: "npc", x: 2000, y: 2000, src: "", type: .npc),
        ]
        XCTAssertEqual(map.partyBounds(library: [:]), Bounds(x: 0, y: 0, width: 450, height: 350))
    }

    func testMakePCsGivesUnsetVisionSoPlayersSeeSomething() {
        let scout = TokenLibraryItem(
            id: "scout", name: "Scout", src: "", thumbnailSrc: "", dateAdded: 0, defaultVisionRadius: 120)
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "generic", x: 0, y: 0, src: "", type: .npc),
            Token(id: "blind", x: 0, y: 0, src: "", type: .npc, visionRadius: 0),
            Token(id: "scout", x: 0, y: 0, src: "", libraryItemId: "scout"),
            Token(id: "other", x: 0, y: 0, src: "", type: .npc),
        ]
        let library = ["scout": scout]
        XCTAssertFalse(map.hasSightedPC(library: library))

        map.makePCs(["generic", "blind", "scout"], library: library)
        XCTAssertEqual(map.tokens.map(\.type), [.pc, .pc, .pc, .npc])
        XCTAssertEqual(map.tokens[0].visionRadius, GameMap.newPCVision, "unset vision gets the default")
        XCTAssertEqual(map.tokens[1].visionRadius, 0, "an explicit None is kept")
        XCTAssertNil(map.tokens[2].visionRadius, "library vision is inherited, not overridden")
        XCTAssertTrue(map.hasSightedPC(library: library))
    }

    func testPartyBoundsNilWithoutPCs() {
        var map = GameMap()
        map.tokens = [Token(x: 0, y: 0, src: "", type: .npc)]
        XCTAssertNil(map.partyBounds(library: [:]))
    }

    func testMinimapBoundsFallBackToPartyThenFixedWorld() {
        var map = GameMap(gridSize: 50)
        XCTAssertEqual(map.minimapBounds(library: [:]), Bounds(x: 0, y: 0, width: 2000, height: 2000))

        map.tokens = [
            Token(id: "pc", x: 100, y: 200, src: "", type: .pc),
            Token(id: "npc", x: 5000, y: 5000, src: "", type: .npc),
        ]
        XCTAssertEqual(map.minimapBounds(library: [:]), Bounds(x: -400, y: -300, width: 1050, height: 1050))

        map.background = MapBackground(src: "m", x: 10, y: 20, width: 100, height: 50, scale: 2)
        XCTAssertEqual(map.minimapBounds(library: [:]), Bounds(x: 10, y: 20, width: 200, height: 100))
    }

    func testFitCentresBoundsAndClampsZoom() {
        var viewport = Viewport()
        viewport.fit(Bounds(x: 0, y: 0, width: 400, height: 200), viewWidth: 800, viewHeight: 800)
        XCTAssertEqual(viewport.zoom, 2)
        // Centre (200, 100) sits at the view centre (400, 400).
        let centre = viewport.viewPoint(fromMap: Point2D(x: 200, y: 100))
        XCTAssertEqual(centre.x, 400, accuracy: 1e-9)
        XCTAssertEqual(centre.y, 400, accuracy: 1e-9)

        viewport.fit(Bounds(x: 0, y: 0, width: 10, height: 10), viewWidth: 800, viewHeight: 800)
        XCTAssertEqual(viewport.zoom, Viewport.zoomRange.upperBound)
    }

    /// A PC at the origin that sees 600 px (60 ft at 50 px cells), a visible NPC beside
    /// it and an NPC far outside its vision.
    private func visionMap() -> GameMap {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "pc", x: 0, y: 0, src: "", type: .pc, visionRadius: 60),
            Token(id: "near", x: 100, y: 0, src: "", type: .npc),
            Token(id: "far", x: 2000, y: 2000, src: "", type: .npc),
        ]
        return map
    }

    func testDraggedTokenIDsDropHiddenTokens() {
        let map = visionMap()
        XCTAssertEqual(map.tokensHiddenFromPlayers(library: [:]), ["far"])
        XCTAssertEqual(
            map.draggedTokenIDs(selected: ["far", "pc", "near"], hidden: ["far"]), ["pc", "near"],
            "map order, hidden NPC left behind")
        XCTAssertEqual(map.draggedTokenIDs(selected: ["far", "pc"]), ["pc", "far"])
    }

    func testPlayerMoveNeverMovesHiddenNPCs() {
        var map = visionMap()
        let moved = map.playerMoveTokens(["pc", "near", "far"], primary: "pc", dx: 50, dy: 0, library: [:])
        XCTAssertEqual(moved, ["pc", "near"])
        XCTAssertEqual(map.tokens.first { $0.id == "far" }?.x, 2000)
        XCTAssertEqual(map.tokens.first { $0.id == "pc" }?.x, 50)

        let before = map
        XCTAssertEqual(map.playerMoveTokens(["far"], primary: "far", dx: 50, dy: 0, library: [:]), [])
        XCTAssertEqual(map, before, "a hidden primary moves nothing")
    }

    func testLiveDragPositionsDriveVisibility() {
        let map = visionMap()
        let dragged = map.withTokenPositions(["pc": Point2D(x: 1900, y: 1900)])
        XCTAssertEqual(dragged.tokens.first { $0.id == "pc" }?.x, 1900)
        XCTAssertEqual(dragged.tokensHiddenFromPlayers(library: [:]), ["near"], "vision follows the drag")
        XCTAssertEqual(map.withTokenPositions([:]), map)
    }

    func testPlayerMoveInDaylightHidesNothing() {
        var map = visionMap()
        map.isDaylightMode = true
        XCTAssertEqual(map.playerMoveTokens(["far"], primary: "far", dx: 50, dy: 0, library: [:]), ["far"])
    }

    func testPauseMessagesMatchTSPool() {
        XCTAssertEqual(SystemMessages.pauseOverlay.count, 7)
    }

    func testEveryIntentHasMessagesAndPlaceholdersFill() {
        for intent in SystemMessages.Intent.allCases {
            XCTAssertFalse(SystemMessages.pools[intent, default: []].isEmpty, intent.rawValue)
        }
        let line = SystemMessages.roll(.campaignSaveFailed, ["error": "disk full"])
        XCTAssertTrue(line.contains("disk full"))
        XCTAssertFalse(line.contains("{error}"))
    }
}
