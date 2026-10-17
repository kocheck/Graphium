---
id: native-chrome-stays-native
applies_to: [mac, architect, toolbar, inspector, welcome, console]
sources:
  [
    'macos/README.md#architecture',
    'Project Icarus docs/design/DESIGN.md#overview',
    'HIG Toolbars',
    'HIG Sidebars',
  ]
confidence: strong
reviewed: 2026-10-17
---

# Apple owns the chrome; Graphium owns the canvas and its overlays

**Rule.** Toolbar, sidebar, inspector, menus, sheets, alerts, popovers and forms use stock SwiftUI with system type, metrics, materials and selection. Graphium tokens and the etched look apply only to app-owned surfaces: the map canvas, canvas overlays, readouts, Welcome cards and the World View. Native controls get the amber accent through the `AccentColor` asset, not per-view tints.

**Test.** In a screenshot of the Architect window, every control in the toolbar, sidebar and inspector looks like it does in Finder or Xcode at the same size; custom fills, borders or fonts appear only on and over the canvas.

**Good.** A `.segmented` tool picker in the toolbar; `Form(.grouped)` in the inspector; a sidebar `List` with system selection.
**Bad.** A custom-drawn toolbar pill, a coloured sidebar selection, a `.tint(.green)` on a toolbar button, a hand-rolled segmented control.

**Also check.**

- Shortcuts appear in menus (and `.help`) through the system, so every tool and command is discoverable from the menu bar.
- Icon-only controls carry a `Label` title or `accessibilityLabel`.
- View > Customize Toolbar still lists every item with a stable id.

**Why.** Native chrome is what makes the app feel like a Mac app and what VoiceOver, Full Keyboard Access and Increase Contrast already handle. Graphium's point of view lives where the DM looks during play: the map.

Links: [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) · [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
