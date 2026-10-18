# Graphium for macOS (native Swift)

A native rewrite of Graphium in Swift, aiming for full parity with the Electron app in the
rest of this repository.

- `Sources/GraphiumCore`: platform-independent model, `.graphiumcampaign` file format, and
  game logic (no AppKit/SwiftUI). Tested with `swift test`.
- `Sources/GraphiumMCP`, `Sources/graphium-mcp`: an MCP server that lets AI tools (Claude,
  Codex, Cursor) build maps in campaign files on your Mac. It ships inside the app; turn it on in Settings > AI Tools.
  Details in [docs/MCP.md](docs/MCP.md).
- `App/`: the SwiftUI + AppKit app. `App/project.yml` is an [XcodeGen](https://github.com/yonaskolb/XcodeGen)
  spec; the `.xcodeproj` is generated, not committed.
- `docs/`: porting spec (`CORE_SPEC.md`) and the feature-parity checklist (`PARITY.md`).

Every change follows [docs/PRINCIPLES.md](docs/PRINCIPLES.md): privacy first and file over app.
Campaigns live in open files the DM owns, and nothing leaves the Mac unless the DM asks.
[docs/SESSION_TIMING.md](docs/SESSION_TIMING.md) is how in-session friction is measured.
UI work starts at the [design harness](design/harness/INDEX.md) and [DESIGN.md](docs/design/DESIGN.md);
agents start at [AGENTS.md](AGENTS.md).

## Build

First time? See [GETTING_STARTED.md](GETTING_STARTED.md) for setup, troubleshooting and a smoke test.

Requires macOS 14+ and Xcode 16+.

```sh
cd macos
swift test                      # core logic tests
brew install xcodegen
cd App && xcodegen generate && open Graphium.xcodeproj
```

CI (`.github/workflows/macos-native.yml`) runs the tests, builds an ad-hoc-signed app, and
uploads `Graphium-macOS.zip` as a workflow artifact.

## Architecture

- **Document-based.** `CampaignDocument` is a `ReferenceFileDocument` in a `DocumentGroup`,
  so New/Open/Open Recent/Save/Revert, autosave, Versions and the title-bar proxy icon come
  from the system. Every edit goes through `CampaignDocument.edit`, which registers undo; that
  is also what marks the document edited.
- **One process, two windows.** The World View (projector) window observes the same
  `CampaignDocument` as the DM's Architect window, so there is no state-sync layer.
- **AppKit canvas.** `MapCanvasNSView` takes raw `NSEvent` input (trackpad pinch and scroll,
  tablet pressure) and draws with Core Graphics. Tokens and doors are exposed to VoiceOver.
- **App shell** (`App/Graphium/Shell`). A Welcome window opens at launch (recents, templates,
  Generate Dungeon). It also holds the About/Tutorial/Shortcuts window, Settings (theme and
  pen pressure), View > Theme and the ⇧⌘M performance monitor.
- **SwiftUI first.** All chrome is SwiftUI: file pickers (`fileImporter`/`fileExporter`),
  alerts, popovers, a customisable toolbar (View > Customize Toolbar), the Tools, Map and
  Session menus, and collapsible inspector and console sections. The Session Console can also
  run in its own window. AppKit is kept only where SwiftUI can't do the job:
  - the map canvas, for raw tablet, trackpad and key input and for draw performance;
  - the canvas's hit-tested right-click menu;
  - the World View's display placement;
  - the hidden YouTube web view;
  - the pasteboard.

## Roadmap to full parity

`docs/PARITY.md` is the checklist (273 items, ticked as they ship); `docs/CORE_SPEC.md` is the
behaviour spec for data and logic. Items tagged **(gap)** in PARITY.md are behaviours the
Electron app gets wrong or never finished; the native app implements the intended behaviour.

Status: 268 of 273 items are ticked. Each deliberate difference from the Electron app is noted
inline with **Native:**. Open items:

- Sparkle updates (PARITY §1.9). These need a Developer ID-signed, notarised build and an
  update feed, so they wait on Apple Developer credentials.
- An automated World View legibility test (§4.1, §7).

M9 work since CI last ran (M7b fix onwards) was written without a compiler. CI was down, so
the first local `xcodebuild` is its first build.

| Milestone | Scope                                                                                                                                                                           | Status |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| M0        | Package, document-based app shell, World View window on the same document, canvas pan/zoom, macOS CI                                                                            | Done   |
| M1        | Full persisted model (CORE_SPEC §1), `.graphiumcampaign` format, legacy `.graphium` importer                                                                                    | Done   |
| M2        | Grid geometry for square/hex/iso + snapping (§3.1), map background import, tokens (place, move, resize, select, multi-select), token inspector, map add/rename/delete           | Done   |
| M3        | World View parity: player-safe rendering, display picker and full screen on the projector, pause screen, token dragging limited as in TS (§3.12), Center on Party               | Done   |
| M4        | Fog of war (§3.3): visibility raycasting against walls and closed doors, explored regions saved and resettable, daylight mode, NPC hiding                                       | Done   |
| M5        | Drawing: pressure-sensitive marker, eraser, walls with smoothing (§3.5); doors (place, open, lock); stairs; measurement ruler/blast/cone (§3.2); movement range (§3.4)          | Done   |
| M6        | Asset library (persistent, thumbnails, categories, tags, search), image cropper, token library prototypes and overrides, drag and drop                                          | Done   |
| M7        | Session Console: catalog editor, stage plates, local audio with AVAudioEngine fades/ducking, synth SFX, YouTube via WKWebView, board packs (§3.9-3.11)                          | Done   |
| M8        | Dungeon generator (§3.8), command palette (§3.15), minimap, paper texture, home screen and recent campaigns                                                                     | Done   |
| M9        | Polish and release: full menus and shortcuts, Settings, accessibility audit, performance on Apple Silicon (Instruments), Sparkle updates, Developer ID signing and notarization | Partly |

## Performance and wrap-up

Done:

- **Live drags don't refresh every window.** Drag positions live in `LiveDragModel`, which
  only the World View observes. The Architect window no longer re-renders on each drag event.
- **Fog of war is memoised.** `VisibilityCache` reruns raycasting only when tokens, walls,
  doors, daylight or the library change. Camera moves, selection and console changes reuse it.
- **One image per frame for the map.** The paper texture is baked into the map image off the
  main thread and shared by every canvas. Images resample at medium quality while you drag,
  pan or zoom, and at high quality when idle. The grid and tokens were already culled to the
  visible area.
- **Image import off the main thread**, with a spinner. This covers map images, tokens and
  Session Console drops.
- **Cheap saves.** Saves and autosaves reuse unchanged asset files from the existing package,
  so only `campaign.json` and new assets are written. The decoded-image cache has a 768 MB cost
  limit and evicts under memory pressure.
- **Profiling tools.** `StressFixture` (the TS stress map), XCTest `measure` tests
  (`PerformanceTests`), and the `-GraphiumStress YES` launch flag in Debug builds. See
  GETTING_STARTED.md.

Open:

1. First Mac build and smoke test (GETTING_STARTED.md).
2. Instruments pass on Apple Silicon with the stress map, then set `measure` baselines.
3. If profiling shows the canvas is still the bottleneck, move the map image into its own
   GPU-composited `CALayer`, so pan and zoom cost nothing on the CPU.
4. Release: Developer ID signing, notarisation, Sparkle updates, CI green again, and a UI test
   target for the smoke test.

## File format

A `.graphiumcampaign` document is a package (a folder Finder shows as one file):

```
campaign.json   { "formatVersion": 1, "campaign": { ... } }
assets/         images and audio referenced by the campaign
```

Keys in `campaign.json` that a build doesn't know (from a newer Graphium, another tool or a
hand edit) are kept and written back on save, by the app and by `graphium-mcp`. Files in
`assets/` are pruned on open only when the app itself stopped using them; it lists those in
`orphanedAssets` when it saves. A file you put in `assets/` yourself stays.

Legacy `.graphium` ZIP campaigns from the Electron app open through an importer (the first
save asks for a new `.graphiumcampaign` location). File > Export as .graphium (⇧⌘E) writes a
ZIP the Electron and web apps can open.

### Campaigns in Finder

Graphium.app carries three sandboxed extensions in `Contents/PlugIns` (sources in `App/`), so a
campaign is useful as a plain file, even one never opened in Graphium:

- **Thumbnail** (`QuickLookThumbnail`): Finder's icon is the active map, drawn by
  `MapRenderer` (`Sources/GraphiumRender`, the same picture graphium-mcp's `render_map` draws).
- **Preview** (`QuickLookPreview`): the space bar shows the campaign name, a larger picture of
  the active map and the list of maps.
- **Spotlight** (`SpotlightImporter`): indexes the campaign, map, token and library names and
  the note pins' titles and text (`CampaignSearchText`), so `mdfind "Brother Aldric"` finds the
  campaign that mentions him.

They read only the package they are handed, and the index stays on this Mac. macOS picks them
up once Graphium.app has been launched; `qlmanage -r` and `mdimport <campaign>` refresh them.
