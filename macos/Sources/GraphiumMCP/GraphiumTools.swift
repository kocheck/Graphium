import Foundation
import GraphiumCore

/// The Graphium tools an MCP client can call. Every tool works on a campaign package on
/// disk: it loads the file, makes the change and saves before returning, so the DM can
/// open the campaign in Graphium at any point and see the work.
public final class GraphiumTools {
    public static let version = "1.2.0"

    struct Tool {
        var name: String
        var title: String
        var description: String
        var properties: [String: JSONValue]
        var required: [String]
        var readOnly: Bool
        var destructive = false
        var run: (Arguments) throws -> ToolResult
    }

    let store: CampaignStore
    private(set) var tools: [Tool] = []

    public init(store: CampaignStore) {
        self.store = store
        tools = makeTools()
    }

    public var definitions: [JSONValue] {
        tools.map { tool in
            [
                "name": .string(tool.name),
                "title": .string(tool.title),
                "description": .string(tool.description),
                "inputSchema": [
                    "type": "object",
                    "properties": .object(tool.properties),
                    "required": .array(tool.required.map { JSONValue.string($0) }),
                    "additionalProperties": false,
                ],
                "annotations": [
                    "title": .string(tool.title),
                    "readOnlyHint": .bool(tool.readOnly),
                    "destructiveHint": .bool(tool.destructive),
                    "idempotentHint": .bool(tool.readOnly),
                    "openWorldHint": false,
                ],
            ]
        }
    }

    public func has(_ name: String) -> Bool { tools.contains { $0.name == name } }

    public func call(_ name: String, arguments: JSONValue) -> ToolResult {
        guard let tool = tools.first(where: { $0.name == name }) else { return .error("Unknown tool \(name).") }
        do {
            return try tool.run(Arguments(arguments))
        } catch let error as ToolError {
            return .error(error.message)
        } catch {
            return .error("\(name) failed: \(error)")
        }
    }

    // MARK: Schema helpers

    static func string(_ description: String, enum values: [String]? = nil) -> JSONValue {
        var s: [String: JSONValue] = ["type": "string", "description": .string(description)]
        if let values { s["enum"] = .array(values.map { JSONValue.string($0) }) }
        return .object(s)
    }

    static func number(_ description: String) -> JSONValue { ["type": "number", "description": .string(description)] }
    static func integer(_ description: String) -> JSONValue { ["type": "integer", "description": .string(description)] }
    static func boolean(_ description: String) -> JSONValue { ["type": "boolean", "description": .string(description)] }

    static func point(_ description: String) -> JSONValue {
        ["type": "array", "items": ["type": "number"], "minItems": 2, "maxItems": 2, "description": .string(description)]
    }

    static func points(_ description: String, minItems: Int = 2) -> JSONValue {
        [
            "type": "array", "minItems": .number(Double(minItems)),
            "items": ["type": "array", "items": ["type": "number"], "minItems": 2, "maxItems": 2],
            "description": .string(description),
        ]
    }

    static func objects(_ description: String, _ properties: [String: JSONValue], required: [String]) -> JSONValue {
        [
            "type": "array", "minItems": 1, "description": .string(description),
            "items": [
                "type": "object", "properties": .object(properties),
                "required": .array(required.map { JSONValue.string($0) }),
            ],
        ]
    }

    static let campaignProperty = string(
        "Path to the .graphiumcampaign package (absolute, ~/…, or relative to the server's first folder). "
            + "The extension may be left off.")
    static let mapProperty = string("Map id or name. Leave out to use the campaign's active map.")
    static let lightingProperty = string(
        "Lighting: \"off\" uses the classic fog (PCs see out to vision_ft); \"dark\", \"dim\" or \"bright\" turns "
            + "lighting on with that ambient light, so PCs see what lights reveal plus their darkvision. Dark for "
            + "dungeons and night, dim for twilight or a gloomy cave mouth, bright for daytime with walls.",
        enum: ["off", "dark", "dim", "bright"])
    static let unitsProperty = string(
        "Units for every position and length in this call: \"cells\" (grid squares, the default) or \"px\" "
            + "(map pixels).", enum: ["cells", "px"])

    // MARK: Shared plumbing

    /// Loads the campaign, finds the map, runs `body`, saves when `write` is set, and
    /// returns `body`'s JSON.
    func withMap(
        _ args: Arguments, write: Bool,
        _ body: (inout CampaignStore.Loaded, Int, Units) throws -> JSONValue
    ) throws -> ToolResult {
        var loaded = try store.load(try args.requiredString("campaign"))
        let index = try Self.mapIndex(in: loaded.campaign, try args.string("map"))
        let units = try Units(map: loaded.campaign.maps[index], name: try args.string("units"))
        let result = try body(&loaded, index, units)
        if write { try store.save(&loaded) }
        return .json(result)
    }

    static func mapIndex(in campaign: Campaign, _ reference: String?) throws -> Int {
        guard let reference, !reference.isEmpty else {
            return campaign.maps.firstIndex { $0.id == campaign.activeMapID } ?? 0
        }
        if let i = campaign.maps.firstIndex(where: { $0.id == reference }) { return i }
        let matches = campaign.maps.indices.filter {
            campaign.maps[$0].name.caseInsensitiveCompare(reference) == .orderedSame
        }
        if matches.count == 1 { return matches[0] }
        let names = campaign.maps.map { "\($0.name) (\($0.id))" }.joined(separator: ", ")
        if matches.count > 1 { throw ToolError("Several maps are called \(reference); use an id. Maps: \(names)") }
        throw ToolError("No map \(reference). Maps: \(names)")
    }

    // MARK: Tools

    private func makeTools() -> [Tool] {
        let c = Self.campaignProperty
        let m = Self.mapProperty
        let u = Self.unitsProperty
        return [
            Tool(
                name: "list_campaigns", title: "List campaigns",
                description:
                    "Find Graphium campaigns (.graphiumcampaign packages) in the folders this server may use. "
                    + "Start here when the user doesn't give a path.",
                properties: ["folder": Self.string("Only look in this folder (must be inside an allowed folder).")],
                required: [], readOnly: true, run: listCampaigns),
            Tool(
                name: "create_campaign", title: "Create campaign",
                description:
                    "Create a new campaign package with one empty map. Fails if the path exists. The DM can open it "
                    + "in Graphium with File > Open, or by double-clicking it in Finder.",
                properties: [
                    "path": Self.string("Where to create it, e.g. ~/Documents/Campaigns/Sunken Crypt.graphiumcampaign"),
                    "name": Self.string("Campaign name."),
                    "map_name": Self.string("Name of the first map (default \"Map 1\")."),
                    "grid_type": Self.string("Grid of the first map (default LINES).", enum: GridType.allCases.map(\.rawValue)),
                    "cell_px": Self.number("Pixels per grid cell (default 50). One cell is 5 feet."),
                ],
                required: ["path", "name"], readOnly: false, run: createCampaign),
            Tool(
                name: "get_campaign", title: "Get campaign",
                description:
                    "Summarise a campaign: its maps (ids, names, grid, counts, extent in cells), which map is active, "
                    + "and the size of its token library.",
                properties: ["campaign": c], required: ["campaign"], readOnly: true, run: getCampaign),
            Tool(
                name: "get_map", title: "Get map",
                description:
                    "Everything on one map with ids: walls (polyline points), doors (centre, width, angle, open, "
                    + "locked), tokens (top-left position, size, type, vision), stairs, markers and the background. "
                    + "Positions are in grid cells unless units is \"px\". Read this before editing a map you didn't "
                    + "just build.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "include_marker_points": Self.boolean("Include every point of long marker strokes (default false)."),
                ],
                required: ["campaign"], readOnly: true, run: getMap),
            Tool(
                name: "add_map", title: "Add map",
                description: "Add a new empty map to a campaign. It becomes the active map unless make_active is false.",
                properties: [
                    "campaign": c, "name": Self.string("Map name."),
                    "grid_type": Self.string("Grid (default LINES).", enum: GridType.allCases.map(\.rawValue)),
                    "cell_px": Self.number("Pixels per grid cell (default 50)."),
                    "grid_color": Self.string("Grid line colour as #rrggbb (default #222222)."),
                    "daylight": Self.boolean("Daylight turns fog of war off for this map (default false)."),
                    "lighting": Self.lightingProperty,
                    "make_active": Self.boolean("Make it the active map (default true)."),
                ],
                required: ["campaign", "name"], readOnly: false, run: addMap),
            Tool(
                name: "update_map", title: "Update map settings",
                description:
                    "Rename a map, change its grid style or colour, daylight or lighting, or make it the active map.",
                properties: [
                    "campaign": c, "map": m, "name": Self.string("New name."),
                    "grid_type": Self.string("Grid style.", enum: GridType.allCases.map(\.rawValue)),
                    "grid_color": Self.string("#rrggbb"),
                    "daylight": Self.boolean("true turns fog of war off; false turns it on."),
                    "lighting": Self.lightingProperty,
                    "make_active": Self.boolean("Make this the map Graphium opens on."),
                ],
                required: ["campaign"], readOnly: false, run: updateMap),
            Tool(
                name: "delete_map", title: "Delete map",
                description: "Delete a map and everything on it. A campaign always keeps at least one map. Undo restores it.",
                properties: ["campaign": c, "map": Self.string("Map id or name.")],
                required: ["campaign", "map"], readOnly: false, destructive: true, run: deleteMap),
            Tool(
                name: "set_background", title: "Set map background",
                description:
                    "Use an image file on this Mac (PNG, JPEG, WebP, HEIC…) as the map's background. It is copied "
                    + "into the campaign package (downscaled to 4096 px at most). Line the image's grid up with "
                    + "Graphium's by giving width_cells (how many squares wide the battlemap is) or image_cell_px "
                    + "(pixels per square in the image file). Pass remove: true to clear the background.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "image_path": Self.string("Image file to import."),
                    "position": Self.point("Top-left corner of the image (default [0, 0])."),
                    "width_cells": Self.number("Scale the image so it is this many grid cells wide."),
                    "image_cell_px": Self.number("Pixels per grid square in the original image file (e.g. 70, 100, 140)."),
                    "scale": Self.number("Explicit scale (1 = one image pixel per map pixel)."),
                    "remove": Self.boolean("Remove the background instead."),
                ],
                required: ["campaign"], readOnly: false, run: setBackground),
            Tool(
                name: "draw_walls", title: "Draw walls",
                description:
                    "Add walls as polylines. Walls block movement; a \"wall\" also blocks sight, a \"window\" lets sight "
                    + "through. one_way walls let sight pass from the left of the line as drawn (facing from its "
                    + "first point to its last; y points down) and block it from the right. Make corners share the "
                    + "exact same point so light can't leak; set closed to join the last point back to the first. "
                    + "For rectangular rooms prefer add_rooms.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "walls": Self.objects(
                        "Walls to add.",
                        [
                            "points": Self.points("Polyline points [[x, y], …], at least 2."),
                            "kind": Self.string("wall (default) or window.", enum: ["wall", "window"]),
                            "one_way": Self.boolean("Sight passes only from the left side (default false)."),
                            "closed": Self.boolean("Join the last point back to the first (default false)."),
                        ], required: ["points"]),
                ],
                required: ["campaign", "walls"], readOnly: false, run: drawWalls),
            Tool(
                name: "add_rooms", title: "Add rooms",
                description:
                    "Add rectangular rooms: four walls with optional doors and doorless openings on any side. "
                    + "x, y is the room's top-left corner on the grid lines; width and height are in cells. "
                    + "Door and opening positions are measured along the side from its top or left end to the "
                    + "door's centre (default: the middle). Rooms that share a wall line work: put a door on one "
                    + "of them only.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "rooms": Self.objects(
                        "Rooms to add.",
                        [
                            "name": Self.string("Optional label, only echoed back."),
                            "x": Self.number("Left edge."), "y": Self.number("Top edge."),
                            "width": Self.number("Width."), "height": Self.number("Height."),
                            "doors": Self.objects(
                                "Doors on the room's sides.",
                                [
                                    "side": Self.string("Which wall.", enum: ["north", "south", "east", "west"]),
                                    "at": Self.number("Distance from the side's top/left end to the door centre."),
                                    "width": Self.number("Door width (default 1 cell)."),
                                    "open": Self.boolean("Start open (default false)."),
                                    "locked": Self.boolean("Locked (default false)."),
                                ], required: ["side"]),
                            "openings": Self.objects(
                                "Gaps with no door (archways, corridor mouths).",
                                [
                                    "side": Self.string("Which wall.", enum: ["north", "south", "east", "west"]),
                                    "at": Self.number("Distance from the side's top/left end to the gap centre."),
                                    "width": Self.number("Gap width (default 1 cell)."),
                                ], required: ["side"]),
                        ], required: ["x", "y", "width", "height"]),
                ],
                required: ["campaign", "rooms"], readOnly: false, run: addRooms),
            Tool(
                name: "add_doors", title: "Add doors",
                description:
                    "Add doors. A door is a line centred on center; closed doors block sight and movement, and an open "
                    + "door cuts a gap in the wall under it. Without angle the door lines up with the nearest wall "
                    + "(within a quarter cell), else it is horizontal. Put the centre on the wall line, e.g. "
                    + "[4.5, 2] for a door in a horizontal wall at y = 2 covering x 4 to 5.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "doors": Self.objects(
                        "Doors to add.",
                        [
                            "center": Self.point("Centre of the door."),
                            "width": Self.number("Length of the door (default 1 cell)."),
                            "angle": Self.number("Degrees clockwise from east: 0 horizontal, 90 vertical."),
                            "open": Self.boolean("Start open (default false)."),
                            "locked": Self.boolean("Locked doors can't be opened by clicking (default false)."),
                        ], required: ["center"]),
                ],
                required: ["campaign", "doors"], readOnly: false, run: addDoors),
            Tool(
                name: "add_tokens", title: "Add tokens",
                description:
                    "Place creature tokens. position is the token's top-left corner, so a 1-cell token at [3, 4] "
                    + "fills the square from x 3–4, y 4–5. On maps with lighting off, PCs reveal fog out to vision_ft "
                    + "(e.g. 60). On maps with lighting on, PCs see what is lit, plus darkness out to darkvision_ft. "
                    + "NPCs are hidden from players until a PC can see them. Art comes from image_path, a token "
                    + "library item, or a generated lettered disc.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "tokens": Self.objects(
                        "Tokens to add.",
                        [
                            "name": Self.string("Name shown in Graphium."),
                            "position": Self.point("Top-left corner."),
                            "type": Self.string("PC or NPC.", enum: ["PC", "NPC"]),
                            "size": Self.number("Footprint in cells: 1 Medium, 2 Large, 3 Huge, 4 Gargantuan, 0.5 Tiny."),
                            "vision_ft": Self.number("Sight radius in feet (PCs; reveals fog on maps with lighting off)."),
                            "darkvision_ft": Self.number("Darkvision range in feet (used on maps with lighting on)."),
                            "speed_ft": Self.number("Walking speed in feet (default 30)."),
                            "image_path": Self.string("Image file for the token art."),
                            "library_item": Self.string("Token library item id or name (see list_token_library)."),
                            "color": Self.string("Disc colour #rrggbb for generated art."),
                        ], required: ["position"]),
                ],
                required: ["campaign", "tokens"], readOnly: false, run: addTokens),
            Tool(
                name: "add_stairs", title: "Add stairs",
                description: "Add stairs markers (centre, size, which way they lead).",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "stairs": Self.objects(
                        "Stairs to add.",
                        [
                            "center": Self.point("Centre."),
                            "width": Self.number("Width (default 1 cell)."), "height": Self.number("Height (default 1 cell)."),
                            "direction": Self.string("Which way the steps face.", enum: ["north", "south", "east", "west"]),
                            "type": Self.string("up or down.", enum: ["up", "down"]),
                        ], required: ["center"]),
                ],
                required: ["campaign", "stairs"], readOnly: false, run: addStairs),
            Tool(
                name: "add_lights", title: "Add lights",
                description:
                    "Place light sources (torches, lanterns, braziers, glowing crystals). Lights only matter on maps with "
                    + "lighting on (update_map lighting dark or dim): bright light out to bright_ft, dim light out to "
                    + "dim_ft, stopped by walls like sight. Use a preset (Candle 5/10 ft, Lamp 15/45, Torch 20/40, "
                    + "Lantern 30/60, Light 20/40, Daylight 60/120) or give radii.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "lights": Self.objects(
                        "Lights to add.",
                        [
                            "center": Self.point("Where the light is."),
                            "preset": Self.string("Rules preset.", enum: LightPreset.all.map(\.name)),
                            "bright_ft": Self.number("Bright light radius in feet."),
                            "dim_ft": Self.number("Outer radius of dim light in feet (at least bright_ft)."),
                            "on": Self.boolean("Lit (default true)."),
                            "name": Self.string("Label, e.g. Brazier."),
                        ], required: ["center"]),
                ],
                required: ["campaign", "lights"], readOnly: false, run: addLights),
            Tool(
                name: "add_notes", title: "Add note pins",
                description:
                    "Pin notes to the map: room keys, read-aloud text, clues, handouts. dm_notes are for the DM alone "
                    + "and never reach players. player_notes are what players may read: with shared true the pin shows "
                    + "on the World View and players can click it to read them. Notes are DM-only (shared false) unless "
                    + "the DM asks otherwise.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "notes": Self.objects(
                        "Notes to add.",
                        [
                            "center": Self.point("Where the pin goes, e.g. a room's centre."),
                            "title": Self.string("Short title shown under the pin, e.g. 1. Guard Room."),
                            "dm_notes": Self.string("Secrets, monster tactics, treasure: DM only."),
                            "player_notes": Self.string("Read-aloud or handout text players may see."),
                            "shared": Self.boolean("Show the pin to players on the World View (default false)."),
                        ], required: ["center"]),
                ],
                required: ["campaign", "notes"], readOnly: false, run: addNotes),
            Tool(
                name: "draw_markers", title: "Draw markers",
                description:
                    "Draw freehand marker lines (annotations, terrain outlines, paths). Markers don't block anything; "
                    + "players see them on the World View.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "strokes": Self.objects(
                        "Strokes to add.",
                        [
                            "points": Self.points("Points [[x, y], …].", minItems: 2),
                            "color": Self.string("#rrggbb (default #df4b26)."),
                            "width_px": Self.number("Line width in pixels (default 5)."),
                        ], required: ["points"]),
                ],
                required: ["campaign", "strokes"], readOnly: false, run: drawMarkers),
            Tool(
                name: "update_objects", title: "Update objects",
                description:
                    "Change existing objects by id (from get_map). Tokens: position, name, type, size, vision_ft, "
                    + "darkvision_ft, speed_ft, and new art from image_path (an image file) or image_library_item "
                    + "(a token library item id or name; only its picture is used). Doors: open, locked, center, width, angle. Walls: kind, one_way, flip "
                    + "(reverse the direction of a one-way wall), points. Lights: center, bright_ft, dim_ft, on, name. "
                    + "Notes: center, title, dm_notes, player_notes, shared. Stairs: center, direction, type. Fields that don't apply are reported back.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "changes": [
                        "type": "array", "minItems": 1,
                        "description": "One object per change: { id, …fields to set }.",
                        "items": ["type": "object", "properties": ["id": ["type": "string"]], "required": ["id"]],
                    ],
                ],
                required: ["campaign", "changes"], readOnly: false, run: updateObjects),
            Tool(
                name: "remove_objects", title: "Remove objects",
                description: "Remove tokens, walls, markers, doors, lights, notes or stairs by id. Undo puts them back.",
                properties: [
                    "campaign": c, "map": m,
                    "ids": ["type": "array", "items": ["type": "string"], "minItems": 1, "description": "Ids from get_map."],
                ],
                required: ["campaign", "ids"], readOnly: false, destructive: true, run: removeObjects),
            Tool(
                name: "clear_map", title: "Clear map layers",
                description:
                    "Remove whole layers from a map: walls, doors, tokens, markers, stairs, lights, notes, fog (explored areas), "
                    + "background.",
                properties: [
                    "campaign": c, "map": m,
                    "layers": [
                        "type": "array", "minItems": 1,
                        "items": ["type": "string", "enum": ["walls", "doors", "tokens", "markers", "stairs", "lights", "notes", "fog", "background"]],
                    ],
                ],
                required: ["campaign", "layers"], readOnly: false, destructive: true, run: clearMap),
            Tool(
                name: "generate_dungeon", title: "Generate dungeon",
                description:
                    "Fill a map with Graphium's random room-and-corridor dungeon (the same generator as the app's "
                    + "Generate Dungeon). Replaces the map's walls and doors unless replace is false. Returns the rooms "
                    + "so you can furnish them with tokens and markers. Use seed to get the same layout again.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "rooms": Self.integer("Number of rooms, 3–15 (default 6)."),
                    "min_room_size": Self.integer("Smallest room side in cells, 2–6 (default 3)."),
                    "max_room_size": Self.integer("Largest room side in cells, 4–12 (default 8)."),
                    "width_cells": Self.number("Area to fit the dungeon in, cells wide (default 38)."),
                    "height_cells": Self.number("Area height in cells (default 21)."),
                    "seed": Self.integer("Random seed for a repeatable layout."),
                    "replace": Self.boolean("Remove existing walls and doors first (default true)."),
                ],
                required: ["campaign"], readOnly: false, run: generateDungeon),
            Tool(
                name: "render_map", title: "Render map",
                description:
                    "Look at a map. image returns a PNG of the DM's view (background, grid, walls in red, windows in "
                    + "blue, doors, lights, tokens with names) or, with view \"players\", what the PCs can currently see. "
                    + "ascii returns a character grid, one cell per character, with a legend. Render after building "
                    + "to check your work.",
                properties: [
                    "campaign": c, "map": m, "units": u,
                    "format": Self.string("image (default), ascii, or both.", enum: ["image", "ascii", "both"]),
                    "view": Self.string("dm (default) or players (fog from PC vision).", enum: ["dm", "players"]),
                    "region": [
                        "type": "object", "description": "Only this area {x, y, width, height}; default is the whole map.",
                        "properties": [
                            "x": ["type": "number"], "y": ["type": "number"], "width": ["type": "number"],
                            "height": ["type": "number"],
                        ],
                    ],
                    "max_px": Self.integer("Longest side of the image in pixels (default 1200, at most 2400)."),
                ],
                required: ["campaign"], readOnly: true, run: renderMap),
            Tool(
                name: "check_map", title: "Check map",
                description:
                    "Look for problems players would hit: gaps between walls that leak light, doors not on a wall, "
                    + "tokens inside walls or on top of each other, PCs who can't see anything on a dark map, lights "
                    + "inside walls, things outside the background. Run it after building and fix what it reports.",
                properties: ["campaign": c, "map": m, "units": u],
                required: ["campaign"], readOnly: true, run: checkMap),
            Tool(
                name: "list_token_library", title: "List token library",
                description: "The campaign's token library: reusable creatures with art and defaults, usable from add_tokens.",
                properties: ["campaign": c, "search": Self.string("Only items whose name, category or tags contain this.")],
                required: ["campaign"], readOnly: true, run: listLibrary),
            Tool(
                name: "undo", title: "Undo last change",
                description:
                    "Put back the campaign as it was before this server's last change. Repeat to go further back "
                    + "(up to 30 steps). Doesn't undo edits made in the Graphium app.",
                properties: ["campaign": c], required: ["campaign"], readOnly: false, destructive: true, run: undo),
        ]
    }
}
