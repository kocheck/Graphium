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

    func testPartyBoundsNilWithoutPCs() {
        var map = GameMap()
        map.tokens = [Token(x: 0, y: 0, src: "", type: .npc)]
        XCTAssertNil(map.partyBounds(library: [:]))
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
