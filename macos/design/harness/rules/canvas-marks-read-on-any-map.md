---
id: canvas-marks-read-on-any-map
applies_to: [mac, canvas, world-view, architect]
sources: ["brief §8 hairlines", "brief §9 row 6", "DESIGN.md#colors"]
confidence: strong
reviewed: 2026-10-17
---

# Marks drawn on the map read on any map art

**Rule.** Anything Graphium draws over the map that isn't the DM's own ink (selection rings, token names, measurement labels, ghosts, handles) sits on a `canvas-halo` outline or backing so it reads on parchment, grass and black alike. Selection and measurement use `canvas-selection` / `canvas-measure`; hover and movement range use the translucent `canvas-hover` / `canvas-range`.

**Test.** Screenshot the same selection and ruler over a light map, a dark map and a busy one: each ring and label is visible in all three.

**Good.** A dashed amber ring over a darker halo ring; a token name in white with a dark outline.
**Bad.** A blue glow that vanishes on water, label text in `labelColor` that turns white on a parchment map in Dark Mode.

**Also check.**
- Line widths divide by zoom so they keep their on-screen size; World View strokes stay ≥ 2 pt.
- Increase Contrast thickens rings and makes backings opaque.

**Why.** Map art is unknown and varied; chrome colours that depend on Light/Dark don't describe what's under the mark.

Links: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
