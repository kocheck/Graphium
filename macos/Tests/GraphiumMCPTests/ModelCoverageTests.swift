import XCTest

@testable import GraphiumCore
@testable import GraphiumMCP

/// Keeps the MCP server in step with the app. Every stored property and enum case of the
/// map model is listed here as either exposed by a tool or deliberately left out. When the
/// model gains something (lights, a new wall kind, a token sense…) this test fails until
/// the server handles it or it is added to `leftOut` with a reason.
/// Steps: docs/MCP.md, "Keeping it up to date".
final class ModelCoverageTests: XCTestCase {
    /// Properties the tools read or write.
    static let exposed: [String: Set<String>] = [
        "Campaign": ["id", "name", "maps", "activeMapID", "tokenLibrary"],
        "GameMap": [
            "id", "name", "tokens", "drawings", "doors", "stairs", "background", "gridSize", "gridType", "gridColor",
            "exploredRegions", "isDaylightMode", "lights", "ambientLight", "notes", "effects",
        ],
        "Token": [
            "id", "x", "y", "src", "libraryItemId", "scale", "type", "visionRadius", "name", "movementSpeed", "darkvision",
            "playerName",
        ],
        "LightSource": ["id", "x", "y", "bright", "dim", "isOn", "name"],
        "MapNote": ["id", "x", "y", "title", "dmNotes", "playerNotes", "isShared", "sounds"],
        "NoteSound": ["kind", "ref", "playOnShow"],
        "SpellEffect": ["id", "shape", "size", "width", "angle", "x", "y", "tokenID", "look", "color", "label", "isHidden"],
        "Drawing": ["id", "tool", "points", "color", "size", "scale", "x", "y", "wallKind", "oneWay", "isDMOnly"],
        "Door": ["id", "x", "y", "orientation", "angle", "isOpen", "isLocked", "size", "swingDirection", "isHidden"],
        "Stairs": ["id", "x", "y", "direction", "type", "width", "height", "linkedStairsId"],
        "MapBackground": ["src", "x", "y", "width", "height", "scale"],
        "TokenLibraryItem": [
            "id", "name", "src", "thumbnailSrc", "category", "tags", "dateAdded", "defaultScale", "defaultVisionRadius",
            "defaultType", "defaultMovementSpeed", "defaultDarkvision",
        ],
    ]

    /// Properties the server deliberately doesn't expose, and why.
    static let leftOut: [String: [String: String]] = [
        "Campaign": ["sessionConsole": "Session Console (music, plates) is table-time, not map building."],
        "GameMap": [
            "revealedAreas": "Revealing fog by hand is table-time, for parties played with miniatures.",
            "initiative": "Initiative is table-time, not map building.",
        ],
        "Token": [
            "hitPoints": "session state (hit points, conditions), not map building",
            "maxHitPoints": "session state (hit points, conditions), not map building",
            "conditions": "session state (hit points, conditions), not map building",
        ],
        "Drawing": ["pressures": "Pen pressure only matters for hand-drawn strokes."],
        "Door": ["thickness": "Drawing detail; the app's default is right for built maps."],
    ]

    /// Enum cases the tools accept, by type.
    static let cases: [String: Set<String>] = [
        "GridType": ["LINES", "DOTS", "HIDDEN", "HEXAGONAL", "ISOMETRIC"],
        "WallKind": ["wall", "window"],
        "DrawingTool": ["marker", "eraser", "wall"],
        "CreatureType": ["PC", "NPC"],
        "LightLevel": ["dark", "dim", "bright"],
        // NoteSound.Kind: tools say "track", "effect" and "soundscape" and match by Session Console name.
        "Kind": ["track", "sfx", "soundscape"],
        "Shape": ["circle", "cone", "line", "cube"],
        "Look": ["fire", "acid", "water", "ice", "lightning", "poison", "necrotic", "radiant", "arcane"],
    ]

    private func check(_ value: Any, file: StaticString = #filePath, line: UInt = #line) {
        let type = String(describing: Swift.type(of: value))
        let properties = Set(Mirror(reflecting: value).children.compactMap(\.label))
        let known = (Self.exposed[type] ?? []).union((Self.leftOut[type] ?? [:]).keys)
        let new = properties.subtracting(known).sorted()
        XCTAssertTrue(
            new.isEmpty,
            "\(type) has new properties the MCP server doesn't know: \(new.joined(separator: ", ")). Expose them in a "
                + "tool (and AgentGuide, render_map, check_map), then list them in ModelCoverageTests.exposed, or add "
                + "them to leftOut with a reason. See docs/MCP.md, \"Keeping it up to date\".",
            file: file, line: line)
        let gone = known.subtracting(properties).sorted()
        XCTAssertTrue(gone.isEmpty, "\(type) no longer has \(gone.joined(separator: ", ")); update the MCP server.", file: file, line: line)
    }

    private func checkCases<T: CaseIterable & RawRepresentable>(_ type: T.Type, file: StaticString = #filePath, line: UInt = #line)
    where T.RawValue == String {
        let name = String(describing: type)
        let all = Set(T.allCases.map(\.rawValue))
        XCTAssertEqual(
            all, Self.cases[name] ?? [],
            "\(name) cases changed. Teach the MCP tools the new ones (schemas in GraphiumTools.swift, AgentGuide, "
                + "render_map's legend, AsciiMap), then update ModelCoverageTests.cases.",
            file: file, line: line)
    }

    func testEveryModelPropertyIsExposedOrLeftOutOnPurpose() {
        let campaign = Campaign.makeDefault()
        check(campaign)
        check(campaign.maps[0])
        check(Token(x: 0, y: 0, src: ""))
        check(Drawing(tool: .wall, points: [], color: "", size: 1))
        check(Door(x: 0, y: 0, orientation: .horizontal, size: 1))
        check(Stairs(x: 0, y: 0, direction: .north, type: .up, width: 1, height: 1))
        check(MapBackground(src: "", width: 1, height: 1))
        check(TokenLibraryItem(name: "", src: "", thumbnailSrc: "", dateAdded: 0))
        check(LightSource(x: 0, y: 0, bright: 1, dim: 2))
        check(MapNote(x: 0, y: 0))
        check(NoteSound(kind: .track, ref: ""))
        check(SpellEffect(shape: .circle, size: 20, x: 0, y: 0))
    }

    func testEveryEnumCaseIsKnown() {
        checkCases(GridType.self)
        checkCases(WallKind.self)
        checkCases(DrawingTool.self)
        checkCases(CreatureType.self)
        checkCases(LightLevel.self)
        checkCases(NoteSound.Kind.self)
        checkCases(SpellEffect.Shape.self)
        checkCases(SpellEffect.Look.self)
    }

    func testToolSchemasOfferTheKnownCases() {
        let schemas = GraphiumTools(store: CampaignStore(roots: [])).definitions.map { $0.serialized() }.joined()
        for kind in Self.cases["WallKind"]! { XCTAssertTrue(schemas.contains("\"\(kind)\""), kind) }
        for grid in Self.cases["GridType"]! { XCTAssertTrue(schemas.contains("\"\(grid)\""), grid) }
        for shape in Self.cases["Shape"]! { XCTAssertTrue(schemas.contains("\"\(shape)\""), shape) }
        for look in Self.cases["Look"]! { XCTAssertTrue(schemas.contains("\"\(look)\""), look) }
    }
}
