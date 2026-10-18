import Foundation

/// What the server tells AI clients about Graphium: short instructions sent at
/// initialisation, longer guides as resources, and ready-made prompts.
public enum AgentGuide {
    public static let instructions = """
        Graphium is a privacy-first virtual tabletop for Mac. This server edits the DM's own campaign files \
        (.graphiumcampaign packages) on their Mac. Nothing is uploaded anywhere.

        How to build a map well:
        1. Find or make the campaign: list_campaigns, or create_campaign. get_campaign shows its maps. Prefer a \
        new map (add_map) over changing one the DM already made, unless they ask.
        2. Plan on the grid before drawing. 1 cell = 5 ft. Coordinates are in cells: x to the right, y down, \
        origin at the top left. Rooms are usually 4–12 cells a side, corridors 1–2 cells wide, doors 1 cell.
        3. Structure first: add_rooms for rectangular rooms (with doors and openings), draw_walls for irregular \
        walls and caves (corners must share the exact same point; use closed: true for loops), add_doors on wall \
        lines, kind "window" for walls you can see through. Or generate_dungeon for a random layout.
        4. Then contents: add_tokens (PCs, NPCs and monsters), add_lights, add_stairs, draw_markers for \
        hazards and notes.
        5. Check your work: render_map to see it, check_map to catch light leaks and misplaced doors and tokens. \
        Fix with update_objects or remove_objects; undo reverts this server's last change.
        6. Tell the DM the file path and what is on each map. They open it in Graphium, which also reloads it \
        if it is already open.

        Conventions: walls of square rooms lie on whole-number grid lines. A door's centre is on its wall, \
        usually at a half cell, e.g. [4.5, 2] on a horizontal wall at y = 2. A token's position is its top-left \
        cell. Maps start with fog of war and lighting off: PCs reveal fog out to vision_ft, and NPCs stay hidden \
        until a PC sees them. For lights and darkvision, set update_map lighting "dark" (or "dim"), place \
        add_lights, and give PCs darkvision_ft. Turn daylight on for scenes with no fog at all.
        Read graphium://guide/map-building for design advice.
        """

    public struct Resource {
        public var uri: String
        public var name: String
        public var title: String
        public var description: String
        public var text: String

        var listing: JSONValue {
            [
                "uri": .string(uri), "name": .string(name), "title": .string(title),
                "description": .string(description), "mimeType": "text/markdown",
            ]
        }
    }

    public struct Prompt {
        public var name: String
        public var title: String
        public var description: String
        public var arguments: [(name: String, description: String, required: Bool)]
        public var template: String

        var listing: JSONValue {
            [
                "name": .string(name), "title": .string(title), "description": .string(description),
                "arguments": .array(
                    arguments.map {
                        ["name": .string($0.name), "description": .string($0.description), "required": .bool($0.required)]
                    }),
            ]
        }

        /// The template with `{name}` replaced by each argument (missing ones by a hint).
        func render(_ values: [String: String]) -> String {
            var text = template
            for argument in arguments {
                let value = values[argument.name].flatMap { $0.isEmpty ? nil : $0 } ?? "(not given: ask the DM or choose)"
                text = text.replacingOccurrences(of: "{\(argument.name)}", with: value)
            }
            return text
        }
    }

    public static let resources: [Resource] = [
        Resource(
            uri: "graphium://guide/map-building", name: "map-building", title: "Building good Graphium maps",
            description: "How to plan, build and check a battle map that plays well at the table.",
            text: mapBuildingGuide),
        Resource(
            uri: "graphium://guide/coordinates", name: "coordinates", title: "Coordinates and shapes",
            description: "Exactly how positions, walls, doors and tokens are measured.",
            text: coordinatesGuide),
    ]

    public static let prompts: [Prompt] = [
        Prompt(
            name: "build_map", title: "Build a map",
            description: "Build a battle map in a Graphium campaign from a description.",
            arguments: [
                ("description", "What the map is: place, size, mood, who is there.", true),
                ("campaign", "Campaign path; leave empty to find or create one.", false),
            ],
            template: """
                Build a Graphium battle map for this: {description}

                Campaign: {campaign}

                Work in this order. Read graphium://guide/map-building first if you haven't. Sketch the layout in \
                cells (rooms, corridors, doors, where creatures stand) and say it in two or three lines. Add a new \
                map for it. Build the walls and doors, then tokens and stairs, then markers. Render it and run \
                check_map, fix every warning, and render again. Finish by telling me the file path, the map's \
                name, and a short tour of what's where.
                """),
        Prompt(
            name: "dungeon_crawl", title: "Generate and stock a dungeon",
            description: "Generate a random dungeon on a new map and fill its rooms.",
            arguments: [
                ("theme", "Theme, e.g. flooded goblin warren, haunted crypt.", true),
                ("party_level", "Party level, for how dangerous to make the rooms.", false),
                ("campaign", "Campaign path; leave empty to find or create one.", false),
            ],
            template: """
                Make a dungeon in Graphium with this theme: {theme}. Party level: {party_level}. Campaign: {campaign}.

                Add a new map, run generate_dungeon (pick a seed and mention it), then give each room a purpose \
                that fits the theme. Place monsters as NPC tokens with sensible sizes, mark traps and features \
                with draw_markers, add stairs for the entrance and exit, and lock a door or two. Render and run \
                check_map, fix problems, then give me a room-by-room key.
                """),
        Prompt(
            name: "review_map", title: "Review a map",
            description: "Look over an existing map for problems and suggest or make fixes.",
            arguments: [
                ("campaign", "Campaign path.", true),
                ("map", "Map name or id; empty for the active map.", false),
            ],
            template: """
                Review the map {map} in the Graphium campaign {campaign}. Use get_map, render_map and check_map. \
                List what would go wrong at the table (light leaks, doors that don't work, tokens in walls, PCs \
                that can't see) and anything that would play better. Ask me before changing anything I made.
                """),
    ]

    static let mapBuildingGuide = """
        # Building good Graphium maps

        Graphium is a virtual tabletop for in-person games: the DM runs the map on a Mac and shows the \
        players a World View on a TV or projector. Players see only what their characters see, so walls, \
        doors and vision are gameplay, not decoration.

        ## Plan first

        - Decide the footprint in cells before drawing (1 cell = 5 ft). A small encounter fits in about \
        20×15 cells, a dungeon level in 40×30. Keep everything at x, y ≥ 0.
        - Rooms: closets 2×2, ordinary rooms 4×4 to 8×8, halls 10×6 and up, caverns irregular 10–20 across.
        - Corridors 1 cell wide feel tight, 2 cells let a fight happen in them.
        - Leave whole cells between rooms that don't share a wall; two rooms that touch share one wall line.

        ## Make it play well

        - Give every fight two or more ways in or around: loops beat dead ends.
        - Break up long sightlines with pillars (small closed walls) or corners, so ranged attackers and \
        stealth both matter.
        - Use doors to control what players see and when: closed doors block sight; locked doors make a \
        decision. Windows (kind "window") show the next room without letting anyone walk through.
        - One-way walls are for secrets: a mirror, a hidden spy hole, a cliff edge you can see down from.
        - Put stairs where the map connects to other maps, and say which map they lead to in a marker.
        - Place monsters where they would really be, not in a line: guards at doors, a leader at the back.

        ## Build in this order

        1. add_map (grid LINES unless the DM asks for hex) with a clear name.
        2. Background, if the DM gave an image: set_background with width_cells or image_cell_px so the \
        art's squares line up with the grid. Then trace its walls with draw_walls.
        3. Structure: add_rooms, draw_walls, add_doors. Corners must share exact points; otherwise light \
        leaks through the seam.
        4. Contents: add_tokens, add_stairs, draw_markers.
        5. Look: render_map (image) and check_map. Fix every warning. Render the players' view to see what \
        the party sees from where they start.

        ## Tokens

        - position is the top-left cell. size is in cells: Tiny 0.5, Small and Medium 1, Large 2, Huge 3, \
        Gargantuan 4.
        - PCs: type PC. With lighting off, give vision_ft (e.g. 60); without it a PC reveals nothing. With \
        lighting on, give darkvision_ft to races that have it (60 for most, 120 for some).
        - Monsters and NPCs: type NPC. They are hidden from players until a PC can see them.
        - Name tokens so the DM can tell them apart: "Goblin 1", "Goblin 2", "Bugbear Chief".

        ## Light and fog

        Each map has one of three modes:

        - **Daylight**: no fog at all. Towns, open fields at noon.
        - **Lighting off** (the default): classic fog. Each PC sees out to its vision_ft, through no walls.
        - **Lighting on** (update_map lighting "dark", "dim" or "bright", the ambient light): the 5e rules. \
        A PC sees what is lit (bright or dim) in its line of sight, and darkness within its darkvision as dim. \
        Lights (add_lights) give bright light out to bright_ft and dim light out to dim_ft, and walls stop \
        them. Presets: Candle 5/10 ft, Lamp 15/45, Torch 20/40, Lantern 30/60, Light 20/40, Daylight 60/120.

        For dungeons use lighting "dark" and place lights where the story puts them: torches in sconces by \
        doors (half a cell off the wall, not on it), a brazier in the throne room, glowing fungus in a cave. \
        Leave some rooms dark so darkvision and carried light matter. Put a light where the party starts, or \
        check that the PCs have darkvision, so the players see something on the first turn. Render the \
        players' view to check.

        Explored areas stay dimly visible either way.

        ## Respect the DM's work

        The campaign file is the DM's. Don't remove or rearrange things you didn't add unless asked; make a new \
        map instead. undo reverts this server's last change if something goes wrong.
        """

    static let coordinatesGuide = """
        # Coordinates and shapes

        - Units: grid cells by default (pass units "px" for map pixels). A map's cell size in pixels is \
        grid.cell_px in get_map (default 50). 1 cell = 5 ft.
        - Axes: x grows to the right, y grows down, [0, 0] is the top-left of the first cell.
        - Grid lines are at whole numbers; cell centres at .5. The cell in column 3, row 4 spans x 3–4, y 4–5.
        - Walls: polylines through points [[x, y], …]. Put them on grid lines for square rooms. A closed \
        room is one polyline that returns to its first point (or closed: true). Walls block movement; \
        kind "wall" also blocks sight, kind "window" doesn't. one_way: sight passes only from the left of the \
        line as drawn (walking from its first point to its last, with y pointing down).
        - Doors: a centre point, a width (default 1 cell) and an angle in degrees (0 horizontal, 90 vertical, \
        anything else diagonal). A closed door blocks sight and movement; an open door also cuts the wall \
        underneath it, so a door can sit on top of a continuous wall. Locked doors can't be opened by clicking.
        - Tokens: position is the top-left corner; size is the footprint in cells (1 = one square).
        - Stairs: centre, width and height, which way they face, up or down.
        - Lights: a centre point and two radii in feet (bright_ft, then dim_ft as the outer edge). They only \
        matter on maps with lighting on.
        - Markers: freehand lines with a colour and width in pixels; they block nothing.
        - add_rooms door and opening positions (at) are measured along the side from its top or left end to \
        the door's centre.
        - Hex and isometric maps use the same coordinates (cells = multiples of cell_px), but cells aren't \
        squares, so render_map to check placement.
        """
}
