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
  `~/Library/Caches/Graphium MCP/undo` (30 steps per campaign), and the `undo` tool puts it
  back. That folder is a cache; deleting it never loses a campaign.

What the AI app does with your map descriptions is up to that app and its provider: the server
sends the tool results (map contents and rendered images) to the app that called it, and a
cloud model receives them like anything else you type into it.

## Set up

Needs macOS 14+ and Xcode 16+ (or the Swift toolchain).

```sh
cd macos
bash scripts/build-mcp.sh ~/Documents/Graphium
```

That builds the server, installs it in `~/Library/Application Support/Graphium/bin/`, and
prints the settings for each app with the paths filled in. The folder argument is where your
campaigns live (default `~/Documents/Graphium`); pass several `--root` options in the app
settings to allow more than one folder.

### Claude Code

```sh
claude mcp add --scope user graphium -- "$HOME/Library/Application Support/Graphium/bin/graphium-mcp" --root ~/Documents/Graphium
```

### Codex CLI

```sh
codex mcp add graphium -- "$HOME/Library/Application Support/Graphium/bin/graphium-mcp" --root ~/Documents/Graphium
```

or in `~/.codex/config.toml`:

```toml
[mcp_servers.graphium]
command = "/Users/you/Library/Application Support/Graphium/bin/graphium-mcp"
args = ["--root", "/Users/you/Documents/Graphium"]
```

### Claude Desktop and Cursor

Claude Desktop: Settings > Developer > Edit Config (`claude_desktop_config.json`). Cursor:
`~/.cursor/mcp.json`. Then restart the app.

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

When Graphium gains map features, the server gains tools for them. To update your copy:

```sh
git pull
cd macos && bash scripts/build-mcp.sh ~/Documents/Graphium
```

Then restart the AI app (in Claude Code, `/mcp` reconnects). `graphium-mcp --version` shows
the installed version; the app sees the same number as the server's version.

## Tools

| Tool                                                | What it does                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `list_campaigns`, `create_campaign`, `get_campaign` | Find, make and summarise campaigns                                                      |
| `add_map`, `update_map`, `delete_map`, `get_map`    | Maps and their grid, daylight and active map; `get_map` lists every object with its id  |
| `set_background`                                    | Import an image as the map, scaled so its squares match the grid                        |
| `add_rooms`                                         | Rectangular rooms with doors and doorless openings                                      |
| `draw_walls`                                        | Walls and windows as polylines, optionally one-way or closed                            |
| `add_doors`                                         | Doors at any angle, lined up with the wall under them; open, closed, locked             |
| `add_tokens`                                        | PCs, NPCs and monsters, from an image, the campaign's token library, or a lettered disc |
| `add_lights`                                        | Torches, lanterns and other lights for maps with lighting on (5e bright and dim radii)  |
| `add_notes`                                         | Note pins: DM-only notes, player notes the DM can share, and Session Console sounds     |
| `add_stairs`, `draw_markers`                        | Stairs and freehand marker lines                                                        |
| `update_objects`, `remove_objects`, `clear_map`     | Edit (including new token art), remove or clear by id or layer                          |
| `generate_dungeon`                                  | Graphium's room-and-corridor generator, repeatable with a seed                          |
| `render_map`                                        | A PNG of the DM's or the players' view, and/or a text grid                              |
| `check_map`                                         | Light leaks between walls, doors off walls, tokens in walls, PCs without vision         |
| `list_token_library`, `undo`                        | The campaign's token library; undo the server's last change                             |

Positions are in grid cells by default (1 cell = 5 ft, x right, y down), which models place far
more reliably than pixels. Every tool also takes `units: "px"`.

## Keeping it up to date

The server must grow with the app, so a change to the map model can't land without a decision
about the MCP tools:

- `Tests/GraphiumMCPTests/ModelCoverageTests.swift` lists every stored property of `Campaign`,
  `GameMap`, `Token`, `Drawing`, `Door`, `Stairs`, `LightSource`, `MapNote`, `MapBackground` and
  `TokenLibraryItem`, and
  every case of `GridType`, `WallKind`, `DrawingTool` and `CreatureType`, as either exposed by a
  tool or left out with a reason. Add a property or case (lights, a new wall kind, a token
  sense) and `swift test` fails, in CI too, until the server is updated.
- To expose a new feature:
  1. Add or extend a tool in `GraphiumTools.swift` (schema and description) and
     `ToolHandlers.swift`, taking positions in cells through `Units`.
  2. Show it to the model: `Describe` in `MapDescription.swift` (get_map), `MapRenderer` and its
     legend in `Rendering.swift`, and `AsciiMap.swift`.
  3. Add a check to `MapChecks.swift` if it can be set up wrong.
  4. Explain it in `AgentGuide.swift` (instructions and guides) and in the Tools table above.
  5. List it in `ModelCoverageTests`, add a test in `GraphiumMCPTests.swift`, and bump
     `GraphiumTools.version`.
- If the feature shouldn't be in the server, add it to `ModelCoverageTests.leftOut` with the
  reason.

## For developers

- Code: `Sources/GraphiumMCP` (protocol, tools, rendering, checks) and `Sources/graphium-mcp`
  (the executable). It uses GraphiumCore's model, file format, geometry and generator, so the
  files it writes are the files the app writes.
- Tests: `swift test --filter GraphiumMCPTests`. CI builds the server and smoke-tests it over stdio.
- Try it by hand:
  `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | swift run graphium-mcp --root /tmp`,
  or with the MCP Inspector: `npx @modelcontextprotocol/inspector .build/debug/graphium-mcp --root /tmp`.
- Known limits: the app-wide token library (outside the campaign) isn't reachable; the server
  shares the app's current behaviour of not keeping JSON keys it doesn't know (PRINCIPLES.md,
  open gaps).
