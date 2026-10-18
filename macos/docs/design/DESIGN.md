---
version: 1
name: "Graphium native — A · Instrument panel"
description: "Direction A (docs/planning/decisions/006-direction.md) carried into the native macOS app: native chrome, ink-on-dark-stock app surfaces, one warm amber accent, map-first glass overlays (decision 007), monospaced readouts, and a separate player-safe World View set."
colors:
  accent: "#FFC53D"
  accent-dark: "#FFC53D"
  accent-text: "#4F3422"
  accent-text-dark: "#FFE7B3"
  canvas-door: "#8C5C33"
  canvas-door-dark: "#8C5C33"
  canvas-grid: "#1C2024"
  canvas-grid-dark: "#1C2024"
  canvas-halo: "#000000A6"
  canvas-halo-dark: "#000000A6"
  canvas-hover: "#FFC53D29"
  canvas-hover-dark: "#FFC53D29"
  canvas-measure: "#FFC53D"
  canvas-measure-dark: "#FFC53D"
  canvas-range: "#FFC53D33"
  canvas-range-dark: "#FFC53D33"
  canvas-selection: "#FFC53D"
  canvas-selection-dark: "#FFC53D"
  ink-on-accent: "#1C2024"
  ink-on-accent-dark: "#111113"
  ink-primary: "#1C2024"
  ink-primary-dark: "#EDEEF0"
  ink-secondary: "#60646C"
  ink-secondary-dark: "#B0B4BA"
  rule-hairline: "#D9D9E0"
  rule-hairline-dark: "#363A3F"
  rule-strong: "#8B8D98"
  rule-strong-dark: "#696E77"
  status-critical: "#CE2C31"
  status-critical-dark: "#FF9592"
  status-ok: "#1D7A4F"
  status-ok-dark: "#3DD68C"
  status-warning: "#9A5A00"
  status-warning-dark: "#FFCA16"
  surface-panel: "#F9F9FB"
  surface-panel-dark: "#18191B"
  surface-sunken: "#F0F0F3"
  surface-sunken-dark: "#212225"
  world-action: "#003362"
  world-frame: "#FFC53D"
  world-ink: "#FFFFFF"
  world-ink-dim: "#B0B4BA"
  world-panel: "#000000B3"
  world-party: "#3DD68C"
  world-rule: "#FFFFFF4D"
  world-scrim: "#000000E6"
rounded:
  control: 4px
  panel: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  hit-min: 44px
---

# Graphium native design system

<!-- Front-matter `colors:` and the generated regions below are owned by macos/scripts/design-tokens.py, which also writes App/Graphium/Design/ColorTokens.swift. Everything else is hand-written. -->

## Contents

Overview · Colors · Typography · Layout · Depth · Shapes · Components · Motion · Do's and Don'ts · Platform mapping · World View · Verification

## Overview

Graphium's look was decided for the web app in plan 006: the [brief](../../../docs/planning/ui-redesign-brief.md) (mood words **Etched · Instrument · Warm ink · Decisive · Quiet**) and [Direction A · Instrument panel](../../../docs/planning/decisions/006-direction.md). This file carries that decision into the native app. [Decision 007](../../../docs/planning/decisions/007-map-first-glass.md) (map-first glass, 2026-10-17) replaces 006's "etched, not floating" for overlays on the map; everything else from 006 stands.

Two owners split every screen:

- **Apple owns native chrome**: window, toolbar, sidebar, inspector, menus, sheets, alerts, popovers, forms, pickers and their selection, focus and hover states. Leave their appearance, metrics and semantics alone. The app's `AccentColor` asset tints them (amber, not blue).
- **Graphium owns its surfaces**: the map canvas and everything drawn on it, canvas overlays (map controls, the scale readout, toasts, banners, HUDs, the performance monitor), readouts, welcome cards and the World View. Tokens below apply only here.

Values come from the web app's Radix scales (`src/styles/theme.css`) so both apps read as one product. Dark is the design lead; light is a faithful inversion (brief §7).

## Colors

Light/dark pairs: `name` / `name-dark`. A token without `-dark` is fixed (World View). In code use `Palette.<camelName>`; never a hex literal or a `system*` colour on an app-owned surface.

- `ink-primary` reads, `ink-secondary` labels and metadata. Neither is used on the canvas, where map art decides the background.
- `accent` fills and glyphs only (active state, selection, broadcasting, paused); `accent-text` for readable amber text; `ink-on-accent` for text on an `accent` fill.
- `canvas-*` draw on the map; `canvas-door` is the wooden door fill, the same in both windows; `canvas-grid` is the default grid's ink, the same in Light and Dark because the map art, not the theme, decides what reads. Anything thin on the map (selection, labels) sits on `canvas-halo` so it reads on light and dark map art.
- `status-*` pair with a glyph: `exclamationmark.triangle` critical/warning, `checkmark.circle` ok. Light `status-ok` and `status-warning` are one shade darker than Radix green-11 / amber-11, which measured 4.49 and 4.38 on `surface-panel`.
- `world-*` are the World View's own set; see [World View](#world-view).

<!-- generated:start id=modes -->
| token | light | dark |
|---|---|---|
| `accent` | `#FFC53D` | `#FFC53D` |
| `accent-text` | `#4F3422` | `#FFE7B3` |
| `canvas-door` | `#8C5C33` | `#8C5C33` |
| `canvas-grid` | `#1C2024` | `#1C2024` |
| `canvas-halo` | `#000000A6` | `#000000A6` |
| `canvas-hover` | `#FFC53D29` | `#FFC53D29` |
| `canvas-measure` | `#FFC53D` | `#FFC53D` |
| `canvas-range` | `#FFC53D33` | `#FFC53D33` |
| `canvas-selection` | `#FFC53D` | `#FFC53D` |
| `ink-on-accent` | `#1C2024` | `#111113` |
| `ink-primary` | `#1C2024` | `#EDEEF0` |
| `ink-secondary` | `#60646C` | `#B0B4BA` |
| `rule-hairline` | `#D9D9E0` | `#363A3F` |
| `rule-strong` | `#8B8D98` | `#696E77` |
| `status-critical` | `#CE2C31` | `#FF9592` |
| `status-ok` | `#1D7A4F` | `#3DD68C` |
| `status-warning` | `#9A5A00` | `#FFCA16` |
| `surface-panel` | `#F9F9FB` | `#18191B` |
| `surface-sunken` | `#F0F0F3` | `#212225` |
| `world-action` | `#003362` | — |
| `world-frame` | `#FFC53D` | — |
| `world-ink` | `#FFFFFF` | — |
| `world-ink-dim` | `#B0B4BA` | — |
| `world-panel` | `#000000B3` | — |
| `world-party` | `#3DD68C` | — |
| `world-rule` | `#FFFFFF4D` | — |
| `world-scrim` | `#000000E6` | — |
<!-- generated:end id=modes -->

<!-- generated:start id=contrast -->
| mode | foreground | background | ratio | min |
|---|---|---|---|---|
| light | `ink-primary` | `surface-panel` | 15.58 | 4.5 |
| light | `ink-primary` | `surface-sunken` | 14.41 | 4.5 |
| light | `ink-secondary` | `surface-panel` | 5.65 | 4.5 |
| light | `ink-secondary` | `surface-sunken` | 5.22 | 4.5 |
| light | `accent-text` | `surface-panel` | 10.81 | 4.5 |
| light | `status-critical` | `surface-panel` | 4.96 | 4.5 |
| light | `status-ok` | `surface-panel` | 5.06 | 4.5 |
| light | `status-warning` | `surface-panel` | 5.21 | 4.5 |
| light | `ink-on-accent` | `accent` | 10.38 | 4.5 |
| light | `rule-strong` | `surface-panel` | 3.14 | 3.0 |
| dark | `ink-primary` | `surface-panel` | 15.15 | 4.5 |
| dark | `ink-primary` | `surface-sunken` | 13.70 | 4.5 |
| dark | `ink-secondary` | `surface-panel` | 8.45 | 4.5 |
| dark | `ink-secondary` | `surface-sunken` | 7.64 | 4.5 |
| dark | `accent-text` | `surface-panel` | 14.52 | 4.5 |
| dark | `status-critical` | `surface-panel` | 8.35 | 4.5 |
| dark | `status-ok` | `surface-panel` | 9.38 | 4.5 |
| dark | `status-warning` | `surface-panel` | 11.49 | 4.5 |
| dark | `ink-on-accent` | `accent` | 11.95 | 4.5 |
| dark | `rule-strong` | `surface-panel` | 3.43 | 3.0 |
| fixed | `world-ink` | `world-scrim` | 21.00 | 7.0 |
| fixed | `world-ink-dim` | `world-scrim` | 10.08 | 7.0 |
| fixed | `world-ink` | `world-action` | 12.73 | 7.0 |

WCAG 2.x ratios; translucent tokens are composited over black (dark, fixed) or white (light). The script fails when a pair drops below its minimum.
<!-- generated:end id=contrast -->

## Typography

Native chrome keeps system type (SF Pro, Dynamic sizes). App-owned surfaces use four roles:

| Role | SwiftUI | Use |
|---|---|---|
| Title | `.largeTitle` / `.title2`, semibold | Welcome hero, sheet titles |
| Label | `.headline` / `.body` | Card titles, overlay text |
| Meta | `.caption`, `ink-secondary` | Hints, metadata |
| Readout | `.readoutStyle()` (SF Mono, medium, monospaced digits) | Every number a DM reads at a glance: distances, grid size, counts, timers, coordinates, frame rate |

The brief names IBM Plex; the native app uses SF and SF Mono instead so it bundles no fonts and follows the system's text rendering. Readouts are the brief's "Plex Mono for every number" in native form. Labels are sentence case except the tool and menu names macOS already title-cases.

## Layout

App-owned spacing: 4 / 8 / 12 / 16 / 24 pt (`Spacing.xs…xl`). Custom pointer and pen targets at least 28 pt; anything a DM taps with a pen or on a touch display at least 44 pt (`Spacing.hitMin`). Native controls keep their own metrics. Canvas overlays sit 12 pt from the canvas edge, top-centre for messages, bottom-trailing for HUDs.

## Depth

Map first (decision 007). The map runs under the whole detail area and is the only content layer. Overlays Graphium draws over it float as system glass (`.glassPanel()`): Liquid Glass on macOS 26, `.regularMaterial` with a soft shadow on macOS 14 and 15, a 0.5 pt light edge, opaque `surface-panel` under Reduce Transparency. Glass is never stacked: nothing app-drawn sits on the sidebar, inspector, toolbar, sheets or another overlay, and inside the inspector a grouped block is a native `GroupBox`. The World View keeps its etched `world-*` plates until its own decision. On the canvas, depth for tokens (hover lift, drag shadow) is part of the map and stays.

## Shapes

Glass overlays are capsules when they hold one line or a column of buttons, and 20 pt continuous cards (`Radius.card`) when they hold more. Small marks on the map and badges keep 4 pt (`Radius.control`); hairlines are 1 pt. Native controls own their shapes.

## Components

- **Canvas message** (toast, calibration banner): glass capsule, status glyph left, one line, close button; top-centre; replaces the previous message; 5 s.
- **HUD** (performance monitor top-trailing, import progress centred): glass card, readout rows (label in `ink-secondary`, value in readout style).
- **Map controls**: bottom-trailing, as in Maps: a glass capsule with Zoom In and Zoom Out over a round Zoom to Fit button; 32 pt hit areas; each also in the View menu (⌘=, ⌘-, ⌘0).
- **Scale readout**: bottom-leading glass capsule: zoom percent and a one-cell scale bar labelled 5 ft, in readout style.
- **Welcome card**: bordered native button with a 4 pt etched panel look, SF Symbol, title, shortcut shown in Meta.
- **Selection on the canvas**: `canvas-selection` dashed ring over a `canvas-halo` ring; no glow.
- **Measurement**: `canvas-measure` stroke and fill, label as a readout on `canvas-halo`.
- **Pause control**: label and symbol change (`Pause` / `Resume`); only the paused state carries the accent.

## Motion

Fast, decisive, no bounce or overshoot (brief §2.5): 0.15 s ease-out for overlays (`Motion.quick`), 0.2 s for panels. Under Reduce Motion the same changes happen with no animation (`Motion.animation(_:reduceMotion:)`), not a different design.

## Do's and Don'ts

- Do pair every state colour with a glyph or word (rubric 5). Don't use colour alone for paused, broadcasting, active tool, locked or selected.
- Do keep the accent on three elements or fewer at once (rubric 4). Don't add a second accent hue, and never blue in the Architect window.
- Don't restyle native toolbars, sidebars, segmented pickers or list selection.
- Don't hand-edit hex values or the generated regions; edit the front matter and run `python3 macos/scripts/design-tokens.py`.

## Platform mapping

| Need | API |
|---|---|
| App-owned colours | `Palette.<token>` (`.color` for SwiftUI, `.nsColor` for AppKit / Core Graphics) |
| Overlay | `.glassPanel(.capsule)` / `.glassPanel(.card)` |
| Readout | `.readoutStyle()`; AppKit: `NSFont.monospacedDigitSystemFont` / `monospacedSystemFont` |
| Spacing, radius | `Spacing`, `Radius` |
| Motion | `Motion.quick`, `.animation(Motion.animation(.quick, reduceMotion:), value:)` |
| Native chrome | `NavigationSplitView`, `.inspector`, `.toolbar`, `Form(.grouped)`, `.segmented` pickers |

Deployment target is macOS 14. Liquid Glass APIs (macOS 26) are used only behind `#if compiler(>=6.2)` and `#available(macOS 26, *)`, with a system-material fallback, so older SDKs and systems build and run the same layout.

## World View

The player-facing window has its own fixed `world-*` set (brief §8, answering its Step 3 question for the native app): the Architect's warm accent doesn't bleed onto the projection, and the World View ignores Light/Dark. Rules are in the [world-view-player-safe](../../design/harness/rules/world-view-player-safe.md) card.

## Verification

Pending app checks, not evidence of completion: light and dark; Increase Contrast and Reduce Motion; a 1920 × 1080 World View screenshot against the World View card; VoiceOver labels on every icon-only control; narrow (1000 pt) and wide Architect windows.
