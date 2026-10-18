# Graphium for macOS: first build

This guide gets the native Swift app building and running on your Mac for the first time. It
also lists what to check by hand.

> **Heads-up:** everything after commit `e76c2a6` was written while CI was down, so none of it
> has been compiled yet. A Fable review pass found no definite compile errors, but expect a few
> small ones on the first build. Copy any errors from Xcode or the terminal and paste them back
> to Claude to fix.

## 1. What you need

- macOS 14 (Sonoma) or later.
- Xcode 16 or later. Open it once so it installs its components.
- [Homebrew](https://brew.sh), to install XcodeGen.
- Optional: a pen tablet, a second display or projector, and Discord, to test the World View
  and audio.

## 2. Get the code

```sh
git clone https://github.com/kocheck/Graphium.git
cd Graphium/macos
```

## 3. Run the core tests

The core logic (model, file format, geometry, fog, dungeon generator, board packs) is a Swift
package with its own tests:

```sh
swift test
```

All tests should pass. If any fail, copy the whole output and send it to Claude.

## 4. Generate and open the Xcode project

The `.xcodeproj` is generated from `App/project.yml` and isn't committed.

```sh
brew install xcodegen
cd App
xcodegen generate
open Graphium.xcodeproj
```

In Xcode:

1. Choose the **Graphium** scheme and **My Mac** as the destination.
2. If Xcode asks for a signing team, choose **Sign to Run Locally** (or your personal team)
   under _Signing & Capabilities_.
3. Press **⌘R** to build and run.

Run `xcodegen generate` again whenever files are added or `project.yml` changes.

### Building from the terminal instead

```sh
cd macos/App
xcodegen generate
xcodebuild -project Graphium.xcodeproj -scheme Graphium -configuration Debug \
  CODE_SIGN_IDENTITY=- build
```

## 5. If the build fails

- Copy the **first** error (in Xcode, the Issue navigator, ⌘5) with its file and line. Later
  errors are often knock-on effects of the first one.
- Paste it to Claude.
- To start completely fresh: delete `macos/App/Graphium.xcodeproj` and
  `~/Library/Developer/Xcode/DerivedData/Graphium-*`, then run `xcodegen generate` again.

## 6. First-run smoke test

Work through these in order. The first five are the areas most likely to need a fix.

| #   | Do this                                                                                                 | You should see                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Launch the app                                                                                          | The **Welcome** window (logo, "Virtual Tabletop for …", four cards). No blank campaign and no system Open dialog. |
| 2   | Click **New Campaign** (or ⌘N)                                                                          | An Architect window opens and Welcome closes.                                                                     |
| 3   | View > **Customize Toolbar…**                                                                           | You can drag buttons in and out. The sidebar's **+** (Add Map) is still there.                                    |
| 4   | File > **Export as .graphium…** (⇧⌘E), then open the exported file                                      | The campaign reopens with the same maps and images.                                                               |
| 5   | Session > **Session Console Window** (⌥⌘C), rename a set there, then ⌘Z in the Architect window         | The rename is undone, and the campaign shows as edited.                                                           |
| 6   | Map > **Map Settings…**, choose a map image, then **Save**                                              | Calibration starts. Drag a box around one printed grid cell, and the map lines up with the grid.                  |
| 7   | Press **V M E W D R** on the map                                                                        | The tools switch. **I** opens the colour popover. **1–5** change the grid, with a notice.                         |
| 8   | Drag a token while a World View is open (⇧⌘W)                                                           | Players see it move live, and the fog follows it.                                                                 |
| 9   | Session Console: drop an image folder and some audio onto the panel                                     | You get a plate set named after the folder, plus tracks. Drag thumbnails to reorder them.                         |
| 10  | Turn on VoiceOver (⌘F5) over the map                                                                    | Tokens and doors are read out. Pressing a door toggles it.                                                        |
| 11  | System Settings > Accessibility > Display > **Increase Contrast**                                       | The grid and selection outlines get stronger right away.                                                          |
| 12  | Graphium > **Settings…** (⌘,)                                                                           | Theme and pen-pressure options. Changing the theme switches every window.                                         |
| 13  | View > **Performance Monitor** (⇧⌘M)                                                                    | Canvas FPS, draw time, memory and object counts.                                                                  |
| 14  | Open two campaigns whose map images have the same file name (e.g. both `map.jpg`)                       | Each window shows its own map.                                                                                    |
| 15  | Use a PNG map with transparent areas                                                                    | The transparent areas look the same before and after the map finishes loading (no grey haze).                     |
| 16  | Save, add one token image, save again, then check file dates inside the package (Show Package Contents) | Only `campaign.json` and the new image changed. Duplicate and reopen: every asset is intact.                      |

## 7. Profiling

1. In Xcode, choose Product > Scheme > Edit Scheme > Run > Arguments, and add
   `-GraphiumStress YES`. In Debug builds this adds a **Stress Test** map: 200 tokens, 5 PCs,
   50 walls, 200 strokes and 1,500 fog regions (the old app's `?stress=1`).
2. Open a World View (⇧⌘W), turn on the performance monitor (⇧⌘M), and drag a PC around.
   Watch the canvas FPS and draw time.
3. Product > **Profile** (⌘I), then use Time Profiler and Allocations, and the SwiftUI
   instrument for view-body updates.
4. Run the timing tests (`PerformanceTests`) in Xcode's Test navigator and use **Set Baseline**,
   so later slowdowns fail the test. From the terminal: `swift test --filter PerformanceTests`.

## 8. Keyboard reference

The full list is in Help > **Keyboard Shortcuts** (or press `?`). The main ones:

- **Tools (on the map):** V, M, E, W, D, R, I · 1–5 grid · Space-drag pan · ⌥-drag
  duplicate · hold M for movement range.
- **Campaign:** ⌘N, ⌘O, ⌘S, ⇧⌘E export · ⌘K or ⌘P palette · ⇧⌘D generate dungeon.
- **World View:** ⇧⌘W open · ⇧⌘P pause.
- **Map menu:** ⌥⌘, settings · ⌥⌘N new map · ⌘⌫ delete selection.
- **Welcome window:** ⇧⌘D generate dungeon · ⇧⌘T templates.

## 9. Where things are

- `Sources/GraphiumCore` holds platform-independent logic, tested by `swift test`.
- `App/Graphium` holds the app:
  - `Canvas/` is the AppKit map view.
  - `Views/` holds the windows and sheets.
  - `Shell/` holds Welcome, About, Settings and the performance monitor.
  - `SessionConsole/` holds the ambience board and audio.
- `docs/PARITY.md` is the feature checklist against the Electron app (268 of 273 done).
  `docs/CORE_SPEC.md` is the behaviour spec.

## 10. Still open

- **Sparkle updates, Developer ID signing and notarisation.** These need your Apple
  Developer account.
- **CI.** Re-run `.github/workflows/macos-native.yml` once GitHub Actions is back. It runs the
  tests and builds a downloadable `Graphium-macOS.zip`.
- See "Performance and wrap-up" in `README.md` for the remaining polish list.
