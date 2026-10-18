import XCTest

@testable import GraphiumCore
@testable import GraphiumMCP

final class JSONValueTests: XCTestCase {
    func testKeepsNumbersAndBooleansApart() throws {
        let value = try JSONValue.parse(#"{"a": 1, "b": true, "c": 0, "d": false, "e": 2.5, "f": null}"#)
        XCTAssertEqual(value["a"], .number(1))
        XCTAssertEqual(value["b"], .bool(true))
        XCTAssertEqual(value["c"], .number(0))
        XCTAssertEqual(value["d"], .bool(false))
        XCTAssertEqual(value["e"], .number(2.5))
        XCTAssertEqual(value["f"], .null)
    }

    func testStringsRoundTrip() throws {
        let text = "Line \"one\"\n\ttab \\ é 🐉 \u{01}"
        let value = JSONValue.object(["s": .string(text), "n": .array([1, 2.5, -3])])
        XCTAssertEqual(try JSONValue.parse(value.serialized()), value)
        XCTAssertEqual(try JSONValue.parse(#""🐉 é""#), .string("🐉 é"))
    }

    func testRejectsBrokenJSON() {
        XCTAssertThrowsError(try JSONValue.parse(#"{"a": }"#))
        XCTAssertThrowsError(try JSONValue.parse(#"[1, 2"#))
        XCTAssertThrowsError(try JSONValue.parse("tru"))
    }

    func testWholeNumbersPrintWithoutFraction() {
        XCTAssertEqual(JSONValue.array([3, 2.5, -0.25]).serialized(), "[3,2.5,-0.25]")
    }
}

final class MCPServerTests: XCTestCase {
    var folder: URL!
    var server: MCPServer!

    override func setUpWithError() throws {
        folder = FileManager.default.temporaryDirectory.appendingPathComponent("graphium-mcp-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let store = CampaignStore(roots: [folder], undoDirectory: folder.appendingPathComponent(".undo"))
        server = MCPServer(tools: GraphiumTools(store: store)) { _ in }
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: folder)
    }

    private func request(_ method: String, _ params: JSONValue = [:], id: Int = 1) throws -> JSONValue {
        let line = JSONValue.object(["jsonrpc": "2.0", "id": .number(Double(id)), "method": .string(method), "params": params])
        let reply = try XCTUnwrap(server.handle(line: line.serialized()))
        return try JSONValue.parse(reply)
    }

    /// Calls a tool and returns its first text block parsed as JSON; fails on tool errors.
    @discardableResult
    private func call(_ tool: String, _ arguments: JSONValue, file: StaticString = #filePath, line: UInt = #line) throws -> JSONValue {
        let reply = try request("tools/call", ["name": .string(tool), "arguments": arguments])
        let result = try XCTUnwrap(reply["result"], "no result: \(reply.serialized())", file: file, line: line)
        let text = try XCTUnwrap(result["content"]?.arrayValue?.first?["text"]?.stringValue, file: file, line: line)
        XCTAssertEqual(result["isError"], .bool(false), text, file: file, line: line)
        return (try? JSONValue.parse(text)) ?? .string(text)
    }

    private func callError(_ tool: String, _ arguments: JSONValue) throws -> String {
        let reply = try request("tools/call", ["name": .string(tool), "arguments": arguments])
        XCTAssertEqual(reply["result"]?["isError"], .bool(true))
        return reply["result"]?["content"]?.arrayValue?.first?["text"]?.stringValue ?? ""
    }

    private func loadCampaign(_ name: String) throws -> Campaign {
        let url = folder.appendingPathComponent(name).appendingPathComponent("campaign.json")
        return try CampaignPackage(manifest: Data(contentsOf: url), assets: [:]).campaign
    }

    func testInitializeAdvertisesToolsResourcesAndPrompts() throws {
        let reply = try request("initialize", ["protocolVersion": "2025-06-18", "capabilities": [:], "clientInfo": ["name": "test"]])
        XCTAssertEqual(reply["result"]?["protocolVersion"], "2025-06-18")
        XCTAssertNotNil(reply["result"]?["capabilities"]?["tools"])
        XCTAssertTrue(reply["result"]?["instructions"]?.stringValue?.contains("1 cell = 5 ft") == true)

        let tools = try XCTUnwrap(try request("tools/list")["result"]?["tools"]?.arrayValue)
        let names = Set(tools.compactMap { $0["name"]?.stringValue })
        for expected in ["create_campaign", "add_rooms", "draw_walls", "add_doors", "add_tokens", "render_map", "check_map", "undo"] {
            XCTAssertTrue(names.contains(expected), expected)
        }
        for tool in tools {
            XCTAssertEqual(tool["inputSchema"]?["type"], "object")
            XCTAssertNotNil(tool["description"]?.stringValue)
        }
        XCTAssertEqual(try request("resources/list")["result"]?["resources"]?.arrayValue?.count, 2)
        let guide = try request("resources/read", ["uri": "graphium://guide/map-building"])
        XCTAssertTrue(guide["result"]?["contents"]?.arrayValue?.first?["text"]?.stringValue?.contains("Plan first") == true)
        let prompt = try request("prompts/get", ["name": "build_map", "arguments": ["description": "a bandit camp"]])
        XCTAssertTrue(
            prompt["result"]?["messages"]?.arrayValue?.first?["content"]?["text"]?.stringValue?.contains("a bandit camp") == true)
    }

    func testUnknownMethodAndNotifications() throws {
        XCTAssertEqual(try request("nope")["error"]?["code"], .number(-32601))
        XCTAssertNil(server.handle(line: #"{"jsonrpc":"2.0","method":"notifications/initialized"}"#))
        XCTAssertEqual(try JSONValue.parse(server.handle(line: "{broken")!)["error"]?["code"], .number(-32700))
    }

    func testBuildsARoomWithDoorTokensAndChecks() throws {
        try call("create_campaign", ["path": "Test", "name": "Test Campaign", "map_name": "Keep"])
        let room = try call(
            "add_rooms",
            [
                "campaign": "Test",
                "rooms": [
                    [
                        "x": 2, "y": 2, "width": 6, "height": 4,
                        "doors": [["side": "south", "at": 3.5]],
                        "openings": [["side": "north", "at": 1.5]],
                    ]
                ],
            ])
        XCTAssertEqual(room["rooms"]?.arrayValue?.first?["door_ids"]?.arrayValue?.count, 1)

        try call(
            "add_tokens",
            [
                "campaign": "Test",
                "tokens": [
                    ["name": "Aria", "type": "PC", "position": [3, 3], "vision_ft": 60],
                    ["name": "Ogre", "type": "NPC", "position": [5, 3], "size": 2],
                ],
            ])

        let campaign = try loadCampaign("Test.graphiumcampaign")
        let map = campaign.activeMap
        XCTAssertEqual(map.name, "Keep")
        let walls = map.drawings.filter { $0.tool == .wall }
        // The north opening splits the outline into one polyline from the gap's east end round to its west end.
        XCTAssertEqual(walls.count, 1)
        let points = try XCTUnwrap(walls.first?.worldPoints)
        XCTAssertEqual(points.first, Point2D(x: 4 * 50, y: 2 * 50))
        XCTAssertEqual(points.last, Point2D(x: 3 * 50, y: 2 * 50))
        XCTAssertEqual(points.count, 6)

        let door = try XCTUnwrap(map.doors.first)
        XCTAssertEqual(door.x, 5.5 * 50)
        XCTAssertEqual(door.y, 6 * 50)
        XCTAssertEqual(door.orientation, .horizontal)
        XCTAssertNil(door.angle)

        XCTAssertEqual(map.tokens.count, 2)
        XCTAssertEqual(map.tokens[1].scale, 2)
        XCTAssertEqual(map.tokens[0].x, 150)
        // Generated token art is written into the package.
        let assets = folder.appendingPathComponent("Test.graphiumcampaign/assets")
        XCTAssertTrue(FileManager.default.fileExists(atPath: assets.appendingPathComponent(map.tokens[0].src).path))

        let check = try call("check_map", ["campaign": "Test"])
        XCTAssertEqual(check["ok"], .bool(true), check.serialized())

        let described = try call("get_map", ["campaign": "Test"])
        XCTAssertEqual(described["walls"]?.arrayValue?.first?["points"]?.arrayValue?.first, [4, 2])
        XCTAssertEqual(described["tokens"]?.arrayValue?.last?["size"], .number(2))
    }

    func testCheckFindsLeaksFloatingDoorsAndBlindPCs() throws {
        try call("create_campaign", ["path": "Leaky", "name": "Leaky"])
        try call(
            "draw_walls",
            ["campaign": "Leaky", "walls": [["points": [[0, 0], [5, 0]]], ["points": [[5.3, 0], [5.3, 5]]]]])
        try call("add_doors", ["campaign": "Leaky", "doors": [["center": [10, 10]]]])
        try call("add_tokens", ["campaign": "Leaky", "tokens": [["name": "Blind", "type": "PC", "position": [1, 1]]]])
        let check = try call("check_map", ["campaign": "Leaky"])
        let kinds = Set(check["issues"]?.arrayValue?.compactMap { $0["kind"]?.stringValue } ?? [])
        XCTAssertTrue(kinds.contains("wall_gap"), check.serialized())
        XCTAssertTrue(kinds.contains("door_not_on_wall"), check.serialized())
        XCTAssertTrue(kinds.contains("pc_without_vision"), check.serialized())
    }

    func testCheckFindsOpenRoomsAndLightsOutsideThem() throws {
        try call("create_campaign", ["path": "Open", "name": "Open"])
        try call("update_map", ["campaign": "Open", "lighting": "dark"])
        // A room with its east side missing, a torch inside it and one out in the rock.
        try call("draw_walls", ["campaign": "Open", "walls": [["points": [[6, 0], [0, 0], [0, 6], [6, 6]]]]])
        try call(
            "add_lights",
            ["campaign": "Open", "lights": [["center": [2, 3], "preset": "torch"], ["center": [-4, 3], "preset": "torch"]]])
        var check = try call("check_map", ["campaign": "Open"])
        var issues = check["issues"]?.arrayValue ?? []
        XCTAssertTrue(issues.contains { $0["kind"] == "open_wall_end" }, check.serialized())
        XCTAssertEqual(issues.filter { $0["kind"] == "light_not_enclosed" }.count, 2, check.serialized())
        XCTAssertEqual(issues.first { $0["kind"] == "light_not_enclosed" }?["severity"], "warning")
        XCTAssertNotNil(check["not_checked"]?.stringValue)

        // Close the room: the inside torch is fine, the one in the rock still isn't.
        let added = try call(
            "draw_walls", ["campaign": "Open", "walls": [["points": [[5.8, 0.1], [5.9, 6.2]]]], "snap_tolerance": 0.5])
        XCTAssertEqual(added["snapped_points"], .number(2))
        let wall = try XCTUnwrap(try loadCampaign("Open.graphiumcampaign").activeMap.drawings.last?.worldPoints)
        XCTAssertEqual(wall, [Point2D(x: 300, y: 0), Point2D(x: 300, y: 300)])
        check = try call("check_map", ["campaign": "Open"])
        issues = check["issues"]?.arrayValue ?? []
        XCTAssertFalse(issues.contains { $0["kind"] == "open_wall_end" }, check.serialized())
        let lights = issues.filter { $0["kind"] == "light_not_enclosed" }
        XCTAssertEqual(lights.count, 1, check.serialized())
        XCTAssertEqual(lights.first?["at"], [-4, 3])
    }

    func testGetMapSummaryKindsAndRegion() throws {
        try call("create_campaign", ["path": "Big", "name": "Big"])
        let cave = (0..<100).map { i -> JSONValue in [.number(Double(i) / 10), .number(Double(i % 2))] }
        try call("draw_walls", ["campaign": "Big", "walls": [["points": .array(cave)], ["points": [[20, 20], [24, 20]]]]])
        try call(
            "add_tokens",
            ["campaign": "Big", "tokens": [["name": "Near", "position": [1, 1]], ["name": "Far", "position": [30, 30]]]])

        let summary = try call("get_map", ["campaign": "Big", "summary": true])
        let walls = try XCTUnwrap(summary["walls"]?.arrayValue)
        XCTAssertNil(walls.first?["points"])
        XCTAssertEqual(walls.first?["point_count"], .number(100))
        XCTAssertEqual(summary["counts"]?["tokens"], .number(2))

        let tokens = try call("get_map", ["campaign": "Big", "kinds": ["tokens"]])
        XCTAssertNil(tokens["walls"])
        XCTAssertEqual(tokens["tokens"]?.arrayValue?.count, 2)

        let area = try call("get_map", ["campaign": "Big", "region": ["x": 18, "y": 18, "width": 8, "height": 4]])
        XCTAssertEqual(area["walls"]?.arrayValue?.count, 1)
        XCTAssertEqual(area["tokens"]?.arrayValue?.count, 0)
        XCTAssertTrue(try callError("get_map", ["campaign": "Big", "kinds": ["rocks"]]).contains("kinds can't include rocks"))
    }

    func testMovesAGroupKeepingItsFormation() throws {
        try call("create_campaign", ["path": "Party", "name": "Party"])
        let tokens = try call(
            "add_tokens",
            ["campaign": "Party", "tokens": [["name": "A", "type": "PC", "position": [2, 2]], ["name": "B", "type": "PC", "position": [3, 4]]]])
        let light = try call("add_lights", ["campaign": "Party", "lights": [["center": [2.5, 2.5], "preset": "torch"]]])
        var ids = tokens["added_tokens"]?.arrayValue?.compactMap { $0["id"] } ?? []
        ids += light["added_lights"]?.arrayValue?.compactMap { $0["id"] } ?? []
        XCTAssertEqual(ids.count, 3)

        try call("move_objects", ["campaign": "Party", "ids": .array(ids), "to": [20, 10]])
        var map = try loadCampaign("Party.graphiumcampaign").activeMap
        XCTAssertEqual(map.tokens.map { Point2D(x: $0.x / 50, y: $0.y / 50) }, [Point2D(x: 20, y: 10), Point2D(x: 21, y: 12)])
        XCTAssertEqual(map.lights.first.map { Point2D(x: $0.x / 50, y: $0.y / 50) }, Point2D(x: 20.5, y: 10.5))

        try call("move_objects", ["campaign": "Party", "ids": .array(ids), "by": [-1, 0]])
        map = try loadCampaign("Party.graphiumcampaign").activeMap
        XCTAssertEqual(map.tokens.first?.x, 19 * 50)
        XCTAssertTrue(try callError("move_objects", ["campaign": "Party", "ids": .array(ids)]).contains("either by"))
        XCTAssertTrue(try callError("move_objects", ["campaign": "Party", "ids": ["nope"], "by": [1, 1]]).contains("get_map"))
    }

    func testUndoKeepsEditsMadeInTheApp() throws {
        try call("create_campaign", ["path": "Shared", "name": "Shared"])
        try call("add_tokens", ["campaign": "Shared", "tokens": [["name": "Goblin", "position": [1, 1]]]])
        // The DM renames the campaign in Graphium after the server's change.
        let url = folder.appendingPathComponent("Shared.graphiumcampaign/campaign.json")
        var package = try CampaignPackage(manifest: Data(contentsOf: url), assets: [:])
        package.campaign.name = "Renamed in Graphium"
        try package.encodeManifest().write(to: url)

        XCTAssertTrue(try callError("undo", ["campaign": "Shared"]).contains("changed after this server's last change"))
        XCTAssertEqual(try loadCampaign("Shared.graphiumcampaign").activeMap.tokens.count, 1)
        try call("undo", ["campaign": "Shared", "force": true])
        XCTAssertEqual(try loadCampaign("Shared.graphiumcampaign").activeMap.tokens.count, 0)
    }

    func testReportsItsVersionAndWhereToStageImages() throws {
        let reply = try request("initialize", ["protocolVersion": "2025-06-18", "capabilities": [:]])
        XCTAssertTrue(reply["result"]?["instructions"]?.stringValue?.contains("graphium-mcp \(GraphiumTools.version)") == true)
        try call("create_campaign", ["path": "Art", "name": "Art"])
        XCTAssertEqual(try call("get_campaign", ["campaign": "Art"])["server"]?["version"], .string(GraphiumTools.version))
        let message = try callError(
            "add_tokens", ["campaign": "Art", "tokens": [["position": [1, 1], "image_path": "/etc/hosts.png"]]])
        XCTAssertTrue(message.contains("Imports/"), message)

        let tools = try XCTUnwrap(try request("tools/list")["result"]?["tools"]?.arrayValue)
        func hint(_ name: String, _ key: String) -> JSONValue? { tools.first { $0["name"] == .string(name) }?["annotations"]?[key] }
        for name in ["get_campaign", "get_map", "list_campaigns", "list_token_library", "render_map", "check_map"] {
            XCTAssertEqual(hint(name, "readOnlyHint"), .bool(true), name)
        }
        for name in ["clear_map", "delete_map", "remove_objects", "undo"] {
            XCTAssertEqual(hint(name, "destructiveHint"), .bool(true), name)
        }
    }

    func testDMOnlyMarkersAndNamesForPlayers() throws {
        try call("create_campaign", ["path": "Secrets", "name": "Secrets"])
        let tokens = try call(
            "add_tokens",
            ["campaign": "Secrets", "tokens": [["name": "Vecna", "player_name": "Hooded figure", "type": "NPC", "position": [2, 2]]]])
        let id = try XCTUnwrap(tokens["added_tokens"]?.arrayValue?.first?["id"])
        XCTAssertEqual(tokens["added_tokens"]?.arrayValue?.first?["player_name"], "Hooded figure")
        let markers = try call(
            "draw_markers", ["campaign": "Secrets", "strokes": [["points": [[1, 1], [4, 1]], "dm_only": true]]])
        let marker = try XCTUnwrap(markers["added_marker_ids"]?.arrayValue?.first)

        var map = try loadCampaign("Secrets.graphiumcampaign").activeMap
        XCTAssertEqual(ResolvedToken(map.tokens[0], library: [:]).playerName, "Hooded figure")
        XCTAssertEqual(ResolvedToken(map.tokens[0], library: [:]).name, "Vecna")
        XCTAssertTrue(map.drawings[0].isHiddenFromPlayers)
        let described = try call("get_map", ["campaign": "Secrets"])
        XCTAssertEqual(described["markers"]?.arrayValue?.first?["dm_only"], .bool(true))
        let players = try request(
            "tools/call", ["name": "render_map", "arguments": ["campaign": "Secrets", "view": "players", "format": "image"]])
        XCTAssertEqual(players["result"]?["isError"], .bool(false))

        try call("update_objects", ["campaign": "Secrets", "changes": [["id": id, "player_name": ""], ["id": marker, "dm_only": false]]])
        map = try loadCampaign("Secrets.graphiumcampaign").activeMap
        XCTAssertNil(ResolvedToken(map.tokens[0], library: [:]).playerName, "an empty name shows players none")
        XCTAssertNil(map.drawings[0].isDMOnly, "showing leaves the flag out of the file")

        let cleared = try call("update_objects", ["campaign": "Secrets", "changes": [["id": id, "player_name": .null]]])
        XCTAssertNil(cleared["updated"]?.arrayValue?.first?["ignored_fields"])
        map = try loadCampaign("Secrets.graphiumcampaign").activeMap
        XCTAssertNil(map.tokens[0].playerName)
        XCTAssertEqual(ResolvedToken(map.tokens[0], library: [:]).playerName, "Vecna")
    }

    func testDoorLinesUpWithADiagonalWall() throws {
        try call("create_campaign", ["path": "Diag", "name": "Diag"])
        try call("draw_walls", ["campaign": "Diag", "walls": [["points": [[0, 0], [4, 4]]]]])
        try call("add_doors", ["campaign": "Diag", "doors": [["center": [2, 2]]]])
        let door = try XCTUnwrap(try loadCampaign("Diag.graphiumcampaign").activeMap.doors.first)
        XCTAssertEqual(try XCTUnwrap(door.angle), 45, accuracy: 0.001)
        XCTAssertEqual(door.orientation, .horizontal)
    }

    func testHiddenDoorsShowAsWallToPlayersUntilRevealed() throws {
        try call("create_campaign", ["path": "Secret", "name": "Secret"])
        try call("draw_walls", ["campaign": "Secret", "walls": [["points": [[0, 2], [6, 2]]]]])
        let added = try call("add_doors", ["campaign": "Secret", "doors": [["center": [3.5, 2], "hidden": true]]])
        let entry = try XCTUnwrap(added["added_doors"]?.arrayValue?.first)
        XCTAssertEqual(entry["hidden"], .bool(true))
        var door = try XCTUnwrap(try loadCampaign("Secret.graphiumcampaign").activeMap.doors.first)
        XCTAssertEqual(door.isHidden, true)
        let text = AsciiMap(map: try loadCampaign("Secret.graphiumcampaign").activeMap, library: [:]).render(region: nil)
        // A grid row (only wall, cell and door characters) carries the S.
        let rows = text.split(separator: "\n").filter { $0.allSatisfy { " .-|+S".contains($0) } }
        XCTAssertTrue(rows.contains { $0.contains("S") }, text)

        try call("update_objects", ["campaign": "Secret", "changes": [["id": .string(door.id), "hidden": false]]])
        door = try XCTUnwrap(try loadCampaign("Secret.graphiumcampaign").activeMap.doors.first)
        XCTAssertNil(door.isHidden, "revealing leaves the flag out of the file")
    }

    func testLightsAndDarkvision() throws {
        try call("create_campaign", ["path": "Lit", "name": "Lit"])
        try call("add_rooms", ["campaign": "Lit", "rooms": [["x": 0, "y": 0, "width": 8, "height": 6]]])
        try call("add_tokens", ["campaign": "Lit", "tokens": [["name": "Aria", "type": "PC", "position": [1, 1]]]])
        let added = try call("add_lights", ["campaign": "Lit", "lights": [["center": [6, 4], "preset": "torch"]]])
        XCTAssertNotNil(added["note"], "lighting is still off, so the tool should say so")

        try call("update_map", ["campaign": "Lit", "lighting": "dark"])
        var map = try loadCampaign("Lit.graphiumcampaign").activeMap
        XCTAssertEqual(map.ambientLight, .dark)
        let light = try XCTUnwrap(map.lights.first)
        XCTAssertEqual(light.bright, 20)
        XCTAssertEqual(light.dim, 40)
        XCTAssertEqual(light.x, 300)

        let lightID = light.id
        try call("update_objects", ["campaign": "Lit", "changes": [["id": .string(lightID), "on": false]]])
        var check = try call("check_map", ["campaign": "Lit"])
        let kinds = Set(check["issues"]?.arrayValue?.compactMap { $0["kind"]?.stringValue } ?? [])
        XCTAssertTrue(kinds.contains("nothing_lit"), check.serialized())
        XCTAssertFalse(kinds.contains("pc_without_vision"), "vision_ft doesn't apply with lighting on")

        let token = try XCTUnwrap(map.tokens.first?.id)
        try call("update_objects", ["campaign": "Lit", "changes": [["id": .string(token), "darkvision_ft": 60]]])
        check = try call("check_map", ["campaign": "Lit"])
        XCTAssertEqual(check["ok"], .bool(true), check.serialized())
        map = try loadCampaign("Lit.graphiumcampaign").activeMap
        XCTAssertEqual(map.tokens.first?.darkvision, 60)

        let described = try call("get_map", ["campaign": "Lit"])
        XCTAssertEqual(described["lighting"], "dark")
        XCTAssertEqual(described["lights"]?.arrayValue?.first?["center"], [6, 4])

        let players = try request(
            "tools/call", ["name": "render_map", "arguments": ["campaign": "Lit", "view": "players", "format": "both"]])
        XCTAssertEqual(players["result"]?["isError"], .bool(false))

        try call("clear_map", ["campaign": "Lit", "layers": ["lights"]])
        XCTAssertTrue(try loadCampaign("Lit.graphiumcampaign").activeMap.lights.isEmpty)
    }

    func testNotes() throws {
        try call("create_campaign", ["path": "Notes", "name": "Notes"])
        let added = try call(
            "add_notes",
            [
                "campaign": "Notes",
                "notes": [
                    ["center": [2.5, 3.5], "title": "1. Guard Room", "dm_notes": "The sergeant has the key."],
                    ["center": [6, 2], "title": "Mural", "shared": true],
                ],
            ])
        let first = try XCTUnwrap(added["added_notes"]?.arrayValue?.first)
        XCTAssertEqual(first["center"], [2.5, 3.5])
        XCTAssertEqual(first["shared"], .bool(false))
        var map = try loadCampaign("Notes.graphiumcampaign").activeMap
        XCTAssertEqual(map.notes.map(\.title), ["1. Guard Room", "Mural"])
        XCTAssertEqual(map.notes[0].x, 125)
        XCTAssertEqual(map.notes[0].dmNotes, "The sergeant has the key.")
        XCTAssertFalse(map.notes[0].isShared)

        let check = try call("check_map", ["campaign": "Notes"])
        let kinds = Set(check["issues"]?.arrayValue?.compactMap { $0["kind"]?.stringValue } ?? [])
        XCTAssertTrue(kinds.contains("shared_note_without_player_notes"), check.serialized())

        let mural = map.notes[1].id
        try call(
            "update_objects",
            ["campaign": "Notes", "changes": [["id": .string(mural), "player_notes": "A dragon over a burning city."]]])
        map = try loadCampaign("Notes.graphiumcampaign").activeMap
        XCTAssertEqual(map.notes[1].playerNotes, "A dragon over a burning city.")

        try call(
            "update_objects",
            ["campaign": "Notes", "changes": [["id": .string(mural), "sounds": [["name": "CHIME", "play_on_show": true], ["name": "Cave"]]]]])
        map = try loadCampaign("Notes.graphiumcampaign").activeMap
        XCTAssertEqual(
            map.notes[1].sounds, [NoteSound(kind: .sfx, ref: "chime", playOnShow: true), NoteSound(kind: .soundscape, ref: "cave")],
            "matched by name")
        let missing = try callError(
            "update_objects", ["campaign": "Notes", "changes": [["id": .string(mural), "sounds": [["name": "Gong"]]]]])
        XCTAssertTrue(missing.contains("no track, effect or soundscape named Gong"), missing)

        let described = try call("get_map", ["campaign": "Notes"])
        XCTAssertEqual(described["notes"]?.arrayValue?.count, 2)
        XCTAssertEqual(described["notes"]?.arrayValue?[1]["sounds"]?.arrayValue?.first?["name"], "Chime")
        let text = try request(
            "tools/call", ["name": "render_map", "arguments": ["campaign": "Notes", "view": "players", "format": "both"]])
        XCTAssertEqual(text["result"]?["isError"], .bool(false))

        try call("remove_objects", ["campaign": "Notes", "ids": [.string(mural)]])
        XCTAssertEqual(try loadCampaign("Notes.graphiumcampaign").activeMap.notes.count, 1)
        try call("clear_map", ["campaign": "Notes", "layers": ["notes"]])
        XCTAssertTrue(try loadCampaign("Notes.graphiumcampaign").activeMap.notes.isEmpty)
    }

    func testUpdateRemoveAndUndo() throws {
        try call("create_campaign", ["path": "Edit", "name": "Edit"])
        let added = try call("add_tokens", ["campaign": "Edit", "tokens": [["name": "Goblin", "type": "NPC", "position": [1, 1]]]])
        let id = try XCTUnwrap(added["added_tokens"]?.arrayValue?.first?["id"]?.stringValue)
        let updated = try call(
            "update_objects", ["campaign": "Edit", "changes": [["id": .string(id), "position": [4, 5], "open": true]]])
        XCTAssertEqual(updated["updated"]?.arrayValue?.first?["ignored_fields"], ["open"])
        XCTAssertEqual(try loadCampaign("Edit.graphiumcampaign").activeMap.tokens.first?.x, 200)

        try call("remove_objects", ["campaign": "Edit", "ids": [.string(id)]])
        XCTAssertEqual(try loadCampaign("Edit.graphiumcampaign").activeMap.tokens.count, 0)
        try call("undo", ["campaign": "Edit"])
        XCTAssertEqual(try loadCampaign("Edit.graphiumcampaign").activeMap.tokens.first?.x, 200)
        try call("undo", ["campaign": "Edit"])
        XCTAssertEqual(try loadCampaign("Edit.graphiumcampaign").activeMap.tokens.first?.x, 50)

        // New art from a file: only the picture changes.
        let art = folder.appendingPathComponent("ogre.png")
        try XCTUnwrap(TokenArt.disc(label: "Ogre", type: .npc, color: "#336699").png()).write(to: art)
        let before = try XCTUnwrap(try loadCampaign("Edit.graphiumcampaign").activeMap.tokens.first)
        try call("update_objects", ["campaign": "Edit", "changes": [["id": .string(id), "image_path": .string(art.path)]]])
        let after = try XCTUnwrap(try loadCampaign("Edit.graphiumcampaign").activeMap.tokens.first)
        XCTAssertNotEqual(after.src, before.src)
        XCTAssertEqual(after.name, "Goblin")
        XCTAssertTrue(
            FileManager.default.fileExists(
                atPath: folder.appendingPathComponent("Edit.graphiumcampaign/assets/\(after.src)").path))
        XCTAssertTrue(
            try callError("update_objects", ["campaign": "Edit", "changes": [["id": .string(id), "image_library_item": "Nobody"]]])
                .contains("no token library item"))
    }

    func testMapsAddUpdateDelete() throws {
        try call("create_campaign", ["path": "Maps", "name": "Maps"])
        try call("add_map", ["campaign": "Maps", "name": "Town", "daylight": true, "grid_type": "hexagonal"])
        var campaign = try loadCampaign("Maps.graphiumcampaign")
        XCTAssertEqual(campaign.activeMap.name, "Town")
        XCTAssertEqual(campaign.activeMap.gridType, .hexagonal)
        XCTAssertTrue(campaign.activeMap.isDaylightMode)

        try call("update_map", ["campaign": "Maps", "map": "Map 1", "name": "Dungeon", "make_active": true])
        campaign = try loadCampaign("Maps.graphiumcampaign")
        XCTAssertEqual(campaign.activeMap.name, "Dungeon")

        try call("delete_map", ["campaign": "Maps", "map": "Dungeon"])
        campaign = try loadCampaign("Maps.graphiumcampaign")
        XCTAssertEqual(campaign.maps.map(\.name), ["Town"])
        XCTAssertEqual(campaign.activeMap.name, "Town")
        XCTAssertTrue(try callError("delete_map", ["campaign": "Maps", "map": "Town"]).contains("at least one map"))
    }

    func testGenerateDungeonIsRepeatableWithASeed() throws {
        try call("create_campaign", ["path": "Gen", "name": "Gen"])
        let first = try call("generate_dungeon", ["campaign": "Gen", "rooms": 5, "seed": 42])
        let second = try call("generate_dungeon", ["campaign": "Gen", "rooms": 5, "seed": 42])
        XCTAssertEqual(first["rooms"], second["rooms"])
        XCTAssertGreaterThanOrEqual(first["rooms"]?.arrayValue?.count ?? 0, 1)
        // replace (the default) swaps the layout rather than stacking a second one.
        let map = try loadCampaign("Gen.graphiumcampaign").activeMap
        XCTAssertEqual(Double(map.doors.count), second["doors_added"]?.doubleValue)
    }

    func testRendersImageAndAscii() throws {
        try call("create_campaign", ["path": "Look", "name": "Look"])
        try call(
            "add_rooms", ["campaign": "Look", "rooms": [["x": 0, "y": 0, "width": 5, "height": 3, "doors": [["side": "east"]]]]])
        try call("add_tokens", ["campaign": "Look", "tokens": [["name": "Aria", "type": "PC", "position": [1, 1], "vision_ft": 30]]])

        let reply = try request("tools/call", ["name": "render_map", "arguments": ["campaign": "Look", "format": "both"]])
        let content = try XCTUnwrap(reply["result"]?["content"]?.arrayValue)
        XCTAssertEqual(reply["result"]?["isError"], .bool(false))
        let image = try XCTUnwrap(content.first { $0["type"] == "image" })
        let png = try XCTUnwrap(Data(base64Encoded: image["data"]?.stringValue ?? ""))
        XCTAssertEqual(Array(png.prefix(4)), [0x89, 0x50, 0x4E, 0x47])
        let ascii = try XCTUnwrap(content.last?["text"]?.stringValue)
        XCTAssertTrue(ascii.contains("+---------+"), ascii)
        XCTAssertTrue(ascii.contains("D"), ascii)
        XCTAssertTrue(ascii.contains("A Aria (PC, vision 30 ft) at [1, 1]"), ascii)

        let players = try request(
            "tools/call", ["name": "render_map", "arguments": ["campaign": "Look", "view": "players", "max_px": 400]])
        XCTAssertEqual(players["result"]?["isError"], .bool(false))
    }

    func testStaysInsideItsFolders() throws {
        let message = try callError("create_campaign", ["path": "/tmp/../etc/Evil", "name": "Evil"])
        XCTAssertTrue(message.contains("outside the folders"), message)
        let escape = try callError("create_campaign", ["path": "../Escape", "name": "Escape"])
        XCTAssertTrue(escape.contains("outside the folders"), escape)
        XCTAssertTrue(try callError("get_campaign", ["campaign": "Missing"]).contains("No campaign"))
    }

    func testListsCampaigns() throws {
        try call("create_campaign", ["path": "Sub/One", "name": "One"])
        let list = try call("list_campaigns", [:])
        XCTAssertEqual(list["campaigns"]?.arrayValue?.first?["name"], "One")
    }

    func testOpensInGraphiumCoreUnchanged() throws {
        try call("create_campaign", ["path": "Round", "name": "Round"])
        try call("add_doors", ["campaign": "Round", "doors": [["center": [1, 1], "angle": 30, "locked": true]]])
        let url = folder.appendingPathComponent("Round.graphiumcampaign/campaign.json")
        let data = try Data(contentsOf: url)
        let package = try CampaignPackage(manifest: data, assets: [:])
        // The server writes exactly what the app would: same encoder, same key order.
        XCTAssertEqual(try package.encodeManifest(), data)
        XCTAssertEqual(package.campaign.activeMap.doors.first?.angle, 30)
    }
}
