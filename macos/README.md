# Graphium for macOS (native Swift)

A native rewrite of Graphium in Swift, aiming for full parity with the Electron app in the
rest of this repository.

- `Sources/GraphiumCore`: platform-independent model, `.graphiumcampaign` file format, and
  game logic (no AppKit/SwiftUI). Tested with `swift test`.
- `App/`: the SwiftUI + AppKit app. `App/project.yml` is an [XcodeGen](https://github.com/yonaskolb/XcodeGen)
  spec; the `.xcodeproj` is generated, not committed.
- `docs/`: porting spec (`CORE_SPEC.md`) and the feature-parity checklist (`PARITY.md`).

## Build

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

Status: 267 of 273 items are ticked. Each deliberate difference from the Electron app is noted
inline with **Native:**. Open items:

- Sparkle updates (PARITY §1.9). These need a Developer ID-signed, notarised build and an
  update feed, so they wait on Apple Developer credentials.
- Image import off the main thread (§3.15).
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

## File format

A `.graphiumcampaign` document is a package (a folder Finder shows as one file):

```
campaign.json   { "formatVersion": 1, "campaign": { ... } }
assets/         images and audio referenced by the campaign
```

Legacy `.graphium` ZIP campaigns from the Electron app open through an importer (the first
save asks for a new `.graphiumcampaign` location). File > Export as .graphium (⇧⌘E) writes a
ZIP the Electron and web apps can open.
