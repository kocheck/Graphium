import XCTest

@testable import GraphiumCore

/// Universal VTT (`.dd2vtt`) import (native only).
final class UniversalVTTTests: XCTestCase {
    /// A 4 × 3 cell room as Dungeondraft writes it (format 0.3, trimmed): walls with a gap for
    /// the door, a closed door, an open diagonal door, a pillar outline and a torch.
    private let file = #"""
        {
          "format": 0.3,
          "resolution": { "map_origin": { "x": 1, "y": 1 }, "map_size": { "x": 4, "y": 3 }, "pixels_per_grid": 100 },
          "line_of_sight": [
            [{ "x": 1, "y": 1 }, { "x": 3, "y": 1 }],
            [{ "x": 4, "y": 1 }, { "x": 5, "y": 1 }, { "x": 5, "y": 1 }, { "x": 5, "y": 4 }],
            [{ "x": 2, "y": 2 }]
          ],
          "objects_line_of_sight": [[{ "x": 2, "y": 3 }, { "x": 2.5, "y": 3 }, { "x": 2.5, "y": 3.5 }, { "x": 2, "y": 3 }]],
          "portals": [
            { "position": { "x": 3.5, "y": 1 }, "bounds": [{ "x": 3, "y": 1 }, { "x": 4, "y": 1 }],
              "rotation": 0, "closed": true, "freestanding": false },
            { "position": { "x": 1.5, "y": 3.5 }, "bounds": [{ "x": 1, "y": 3 }, { "x": 2, "y": 4 }],
              "rotation": 0.785, "closed": false, "freestanding": false }
          ],
          "environment": { "baked_lighting": true, "ambient_light": "ff1a1a2e" },
          "lights": [
            { "position": { "x": 2, "y": 2 }, "range": 8, "intensity": 1, "color": "ffffc477", "shadows": true },
            { "position": { "x": 4, "y": 2 }, "range": 0, "intensity": 1, "color": "ffffffff", "shadows": true }
          ],
          "image": "iVBORw0KGgo="
        }
        """#

    private func imported(background: (src: String, width: Double, height: Double)? = nil) throws -> GameMap {
        var map = GameMap(gridSize: 50)
        try UniversalVTT.decode(Data(file.utf8)).apply(to: &map, background: background)
        return map
    }

    func testReadsTheFile() throws {
        let vtt = try UniversalVTT.decode(Data(file.utf8))
        XCTAssertEqual(vtt.width, 4)
        XCTAssertEqual(vtt.walls.count, 3, "two walls and the pillar; a one-point line is dropped")
        XCTAssertEqual(vtt.walls[1].count, 3, "repeated points are dropped")
        XCTAssertEqual(vtt.portals.map(\.isClosed), [true, false])
        XCTAssertEqual(vtt.lights.count, 1, "a light with no range is dropped")
        XCTAssertEqual(vtt.ambient, .dark)
        XCTAssertEqual(vtt.image, Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    }

    func testRejectsOtherFiles() {
        for text in ["not json", #"{"format": 0.3}"#, #"{"resolution": {"map_size": {"x": 0, "y": 3}}}"#] {
            XCTAssertThrowsError(try UniversalVTT.decode(Data(text.utf8))) {
                XCTAssertEqual($0 as? UniversalVTT.ImportError, .notUniversalVTT)
            }
        }
    }

    func testPlacesEverythingOnTheMapsGrid() throws {
        let map = try imported(background: (src: "room.png", width: 200, height: 150))
        XCTAssertEqual(map.background?.scale, 1, "4 cells × 50 px over a 200 px image")
        XCTAssertEqual(map.drawings.filter { $0.tool == .wall }.count, 3)
        XCTAssertEqual(map.drawings[0].points, [0, 0, 100, 0], "the origin cell is the map's top-left")

        let door = map.doors[0]
        XCTAssertEqual(Point2D(x: door.x, y: door.y), Point2D(x: 125, y: 0))
        XCTAssertEqual(door.size, 50)
        XCTAssertEqual(door.orientation, .horizontal)
        XCTAssertNil(door.angle)
        XCTAssertFalse(door.isOpen)
        XCTAssertEqual(map.doors[1].angle ?? 0, 45, accuracy: 1e-9)
        XCTAssertTrue(map.doors[1].isOpen)

        let torch = map.lights[0]
        XCTAssertEqual(Point2D(x: torch.x, y: torch.y), Point2D(x: 50, y: 50))
        XCTAssertEqual(torch.dim, 40, "8 cells is 40 ft")
        XCTAssertEqual(torch.bright, 20)
        XCTAssertEqual(map.ambientLight, .dark)
    }

    func testTheImportedWallsAndDoorsBlockSight() throws {
        var map = try imported()
        map.tokens = [Token(id: "pc", x: 75, y: 25, src: "", type: .pc, darkvision: 60)]  // centre (100, 50)
        let sight = LineOfSight.partySight(of: map, library: [:])
        XCTAssertNil(sight.perceived(at: Point2D(x: 125, y: -50)), "the closed door")
        map.toggleDoor(id: map.doors[0].id)
        XCTAssertNotNil(LineOfSight.partySight(of: map, library: [:]).perceived(at: Point2D(x: 125, y: -50)))
    }

    func testReplacesWallsDoorsAndLightsButKeepsMarkerStrokes() throws {
        var map = GameMap(gridSize: 50)
        map.drawings = [
            Drawing(id: "ink", tool: .marker, points: [0, 0, 10, 10], color: "#000", size: 4),
            Drawing(id: "old", tool: .wall, points: [0, 0, 10, 0], color: "#f00", size: 8),
        ]
        map.doors = [Door(x: 0, y: 0, orientation: .horizontal, size: 50)]
        map.exploredRegions = [ExploredRegion(points: [], timestamp: 1)]
        try UniversalVTT.decode(Data(file.utf8)).apply(to: &map, background: nil)
        XCTAssertTrue(map.drawings.contains { $0.id == "ink" })
        XCTAssertFalse(map.drawings.contains { $0.id == "old" })
        XCTAssertEqual(map.doors.count, 2)
        XCTAssertTrue(map.exploredRegions.isEmpty)
    }

    func testAmbientColour() {
        XCTAssertEqual(UniversalVTT.level(ofARGB: "ffffffff"), .bright)
        XCTAssertEqual(UniversalVTT.level(ofARGB: "ff808080"), .dim)
        XCTAssertEqual(UniversalVTT.level(ofARGB: "#000000"), .dark)
        XCTAssertNil(UniversalVTT.level(ofARGB: "white"))
    }

    func testAMapWithoutLightsLeavesLightingOff() throws {
        let text = #"{"resolution": {"map_size": {"x": 2, "y": 2}}, "environment": {"ambient_light": "ff000000"}}"#
        var map = GameMap(gridSize: 50)
        try UniversalVTT.decode(Data(text.utf8)).apply(to: &map, background: nil)
        XCTAssertNil(map.ambientLight)
        XCTAssertTrue(map.lights.isEmpty)
    }
}
