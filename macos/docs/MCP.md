# Building maps with AI tools (MCP)

`graphium-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that lets
AI tools such as Claude (Desktop and Code), Codex and Cursor build maps in Graphium campaigns:
rooms, walls, doors, windows, tokens, stairs and markers, plus a picture of the result so the
model can check its own work.

It follows [PRINCIPLES.md](PRINCIPLES.md):

- **Local and file-based.** The server runs on your Mac, started by your AI app over stdio. It
  edits `.graphiumcampaign` packages on disk, exactly as Graphium writes them. There is no
  Graphium account, no hosted service and no network code in the server.
- **Only the folders you name.** It reads and writes only inside the folders passed with
  `--root`. Paths outside them are refused.
- **Undoable.** Before each change it keeps the previous `campaign.json` in
  `~/Library/Caches/Graphium MCP/undo` (30 steps per campaign, kept across restarts), and the
  `undo` tool puts it back. Undo swaps the whole file, so if the campaign was edited in Graphium
  after the server's last change, it refuses unless the model passes `force` (Graphium's own
  edits have Edit > Undo). That folder is a cache; deleting it never loses a campaign.

What the AI app does with your map descriptions is up to that app and its provider: the server
sends the tool results (map contents and rendered images) to the app that called it, and a
cloud model receives them like anything else you type into it.

## Set up

In Graphium, open **Graphium > Settings > AI Tools** and turn on **Let AI apps build maps**. It's
off until you turn it on.

- **Campaign folder** is the only place the AI apps may read and write (default
  `~/Documents/Graphium`).
- **Claude Desktop** and **Cursor**: click **Add**. Graphium adds itself to that app's MCP settings
  and keeps the rest of them. Restart the app.
- **Claude Code** and **Codex**: click **Copy Command**, paste it in Terminal, then restart the
  app (in Claude Code, `/mcp` reconnects).

The server is built into Graphium.app (`Contents/MacOS/graphium-mcp`). The apps start it
through a link at `~/Library/Application Support/Graphium/bin/graphium-mcp`, which Graphium
points at its own copy each time it opens, so moving or updating Graphium doesn't break them.
Turning AI Tools off removes the link, and the apps can no longer start the server.

### Without the app, or by hand

From a checkout (needs Xcode 16+ or the Swift toolchain):

```sh
cd macos
bash scripts/build-mcp.sh ~/Documents/Graphium
```

That builds the server into the same place and prints the settings for each app. Pass several
`--root` options to allow more than one folder. The settings are:

```sh
# Claude Code
claude mcp add --scope user graphium -- "$HOME/Library/Application Support/Graphium/bin/graphium-mcp" --root ~/Documents/Graphium
# Codex CLI
codex mcp add graphium -- "$HOME/Library/Application Support/Graphium/bin/graphium-mcp" --root ~/Documents/Graphium
```

Codex can also use `~/.codex/config.toml`:

```toml
[mcp_servers.graphium]
command = "/Users/you/Library/Application Support/Graphium/bin/graphium-mcp"
args = ["--root", "/Users/you/Documents/Graphium"]
```

Claude Desktop (Settings > Developer > Edit Config, `claude_desktop_config.json`) and Cursor
(`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "graphium": {
      "command": "/Users/you/Library/Application Support/Graphium/bin/graphium-mcp",
      "args": ["--root", "/Users/you/Documents/Graphium"]
    }
  }
}
```

## Using it

Ask in plain words, for example:

- "Make a new campaign called Sunken Crypt with a 30×20 crypt map: an entry hall, two side
  chapels behind locked doors, and a tomb with a sarcophagus. Put four skeletons in the hall."
- "Use ~/Downloads/tavern.jpg as the background of a new map in Sunken Crypt. It's 24 squares
  wide. Trace its walls and doors."
- "Generate a 10-room goblin warren and stock it for a level 3 party."

The server also offers ready-made prompts (`build_map`, `dungeon_crawl`, `review_map`), which
apps show in their prompt menus (in Claude Code, `/mcp__graphium__build_map`), and two guides as resources
(`graphium://guide/map-building`, `graphium://guide/coordinates`).

### With Graphium open

Every tool call reads the file fresh and saves straight away. Reads and writes are coordinated
with macOS file coordination, so a campaign open in Graphium saves its pending edits before the
server reads it and reloads after the server writes. If you're editing the same map by hand
at the same moment, the last save wins; Graphium's File > Revert To keeps its own versions.

## Updating

When Graphium gains map features, the server gains tools for them. Updating Graphium updates
the server; restart the AI app to pick up new tools (in Claude Code, `/mcp` reconnects). With a
build from `scripts/build-mcp.sh`, `git pull` and run the script again. `graphium-mcp --version` shows
the installed version; the app sees the same number as the server's version.

## Tools

| Tool                                                | What it does                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_campaigns`, `create_campaign`, `get_campaign` | Find, make and summarise campaigns                                                                                                                                          |
| `add_map`, `update_map`, `delete_map`, `get_map`    | Maps and their grid, daylight and active map; `get_map` lists objects with ids (`summary`, `kinds`, `region` keep it short)                                                 |
| `set_background`                                    | Import an image as the map, scaled so its squares match the grid                                                                                                            |
| `add_rooms`                                         | Rectangular rooms with doors and doorless openings                                                                                                                          |
| `draw_walls`                                        | Walls and windows as polylines, optionally one-way, closed, or snapped onto existing walls                                                                                  |
| `add_doors`                                         | Doors at any angle, lined up with the wall under them; open, closed, locked, hidden                                                                                         |
| `add_tokens`                                        | PCs, NPCs and monsters, from an image, the campaign's token library, or a lettered disc                                                                                     |
| `add_lights`                                        | Torches, lanterns and other lights for maps with lighting on (5e bright and dim radii)                                                                                      |
| `add_notes`                                         | Note pins: DM-only notes, player notes the DM can share (both Markdown), and sounds                                                                                         |
| `add_effects`                                       | Spell areas (circle, cone, line, cube) in a look, pinned or carried by a token                                                                                              |
| `add_stairs`, `draw_markers`                        | Stairs and freehand marker lines                                                                                                                                            |
| `update_objects`, `remove_objects`, `clear_map`     | Edit (including new token art), remove or clear by id or layer (`fog` resets explored fog)                                                                                  |
| `move_objects`                                      | Move tokens, lights, notes and effects together, keeping their formation                                                                                                    |
| `generate_dungeon`                                  | Graphium's room-and-corridor generator, repeatable with a seed                                                                                                              |
| `render_map`                                        | A PNG of the DM's or the players' view, and/or a text grid                                                                                                                  |
| `check_map`                                         | Light leaks, open wall ends, lights outside rooms, doors off walls, tokens in walls, PCs without vision. It checks walls against each other, not against the background art |
| `list_token_library`, `undo`                        | The campaign's token library; undo the server's last change                                                                                                                 |

Positions are in grid cells by default (1 cell = 5 ft, x right, y down), which models place far
more reliably than pixels. Every tool also takes `units: "px"`.

Images for `set_background` and token art are copied into the campaign package, but the server
can only read them from inside its folders; the error for a file elsewhere names an `Imports`
folder to copy it into first. `get_campaign` and the server's instructions report its version.

### What players see

On the World View, players see walls, doors, stairs and markers wherever the fog is explored or a
PC sees, PC tokens always and NPC tokens only while a PC sees them, each labelled with its
`player_name` (by default its name; `""` shows none), and lights only as the light they give.
DM-only: `dm_notes`, pins that aren't `shared`, and markers with `dm_only`. Hidden doors look
like wall while shut. The server's instructions tell the model this, and that lights carried by
tokens aren't in Graphium yet (#349).

## Keeping it up to date

The server must grow with the app, so a change to the map model can't land without a decision
about the MCP tools:

- `Tests/GraphiumMCPTests/ModelCoverageTests.swift` lists every stored property of `Campaign`,
  `GameMap`, `Token`, `Drawing`, `Door`, `Stairs`, `LightSource`, `MapNote`, `SpellEffect`, `MapBackground` and
  `TokenLibraryItem`, and
  every case of `GridType`, `WallKind`, `DrawingTool` and `CreatureType`, as either exposed by a
  tool or left out with a reason. Add a property or case (lights, a new wall kind, a token
  sense) and `swift test` fails, in CI too, until the server is updated.
- To expose a new feature:
  1. Add or extend a tool in `GraphiumTools.swift` (schema and description) and
     `ToolHandlers.swift`, taking positions in cells through `Units`.
  2. Show it to the model: `Describe` in `MapDescription.swift` (get_map), `MapRenderer`
     (`Sources/GraphiumRender/MapRenderer.swift`, also drawn by the Quick Look extensions) and its
     legend in `Rendering.swift`, and `AsciiMap.swift`.
  3. Add a check to `MapChecks.swift` if it can be set up wrong.
  4. Explain it in `AgentGuide.swift` (instructions and guides) and in the Tools table above.
  5. List it in `ModelCoverageTests`, add a test in `GraphiumMCPTests.swift`, and bump
     `GraphiumTools.version`.
- If the feature shouldn't be in the server, add it to `ModelCoverageTests.leftOut` with the
  reason.

## For developers

- Code: `Sources/GraphiumMCP` (protocol, tools, rendering, checks, and `ClientSetup` for the
  AI Tools settings) and `Sources/graphium-mcp` (the executable). The app's `MCPServer` target
  in `App/project.yml` builds the same executable into the bundle; the settings pane is
  `App/Graphium/Shell/AIToolsSettings.swift`. It uses GraphiumCore's model, file format, geometry and generator, so the
  files it writes are the files the app writes.
- Tests: `swift test --filter GraphiumMCPTests`. CI builds the server and smoke-tests it over stdio,
  both on its own and inside the built app.
- Try it by hand:
  `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | swift run graphium-mcp --root /tmp`,
  or with the MCP Inspector: `npx @modelcontextprotocol/inspector .build/debug/graphium-mcp --root /tmp`.
- Known limits: the app-wide token library (outside the campaign) isn't reachable; the server
  shares the app's current behaviour of not keeping JSON keys it doesn't know (PRINCIPLES.md,
  open gaps).
