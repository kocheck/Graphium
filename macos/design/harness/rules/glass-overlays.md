---
id: glass-overlays
applies_to: [mac, overlay, canvas, readout, motion]
sources:
  [
    'docs/decisions/007-map-first-glass.md',
    'taste/examples/2026-10-17-round2-glass.md',
    'HIG Materials',
    'HIG Accessibility',
  ]
confidence: decided
reviewed: 2026-10-17
---

# Overlays float over the map as glass; content never does

**Rule.** Controls, readouts, toasts and HUDs Graphium draws over the canvas use `.glassPanel()`: system glass (Liquid Glass on macOS 26, `.regularMaterial` before), a 0.5 pt light edge, capsule for one line, 12 pt card for more. Text inside uses system `primary`/`secondary` so it stays vibrant; amber only for state. Map, tokens and marks are content and are never glass.

**Test.** In a screenshot, every app-drawn overlay is a capsule or 12 pt card that shows the map softly through it; none sits on the sidebar, inspector, a sheet or another glass surface.

**Good.** Bottom-trailing zoom capsule and Zoom to Fit circle; bottom-leading zoom and scale readout; a top-centre toast capsule.
**Bad.** Glass inside the inspector (use `GroupBox`), a glass map list replacing the native sidebar, a tinted or gradient glass fill, a 4 pt square overlay with a drop shadow.

**Also check.**

- Reduce Transparency: `.glassPanel()` turns opaque `surface-panel` with a `rule-strong` edge; Increase Contrast thickens the edge.
- Every overlay control has a 32 pt hit area, a `.help` with its shortcut, and the same command in a menu.
- Overlays appear with `Motion.quick`, no spring; Reduce Motion drops the animation.

**Why.** Kyle chose map-first glass (007). Apple's guidance puts glass on the control layer above content and asks apps not to layer it, so the map stays the product and the system chrome stays native.

Links: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) · [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
