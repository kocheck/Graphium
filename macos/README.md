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
  later tablet pressure) and draws with Core Graphics.

## File format

A `.graphiumcampaign` document is a package (a folder Finder shows as one file):

```
campaign.json   { "formatVersion": 1, "campaign": { ... } }
assets/         images and audio referenced by the campaign
```

Legacy `.graphium` ZIP campaigns from the Electron app will open through an importer.
