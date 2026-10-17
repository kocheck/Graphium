---
id: etched-overlays
applies_to: [mac, overlay, canvas, welcome, motion]
sources:
  [
    'brief §2.3 Etched, not floating',
    'brief §2.5 motion',
    'brief §5 anti-references',
    'DESIGN.md#depth',
  ]
confidence: decided
reviewed: 2026-10-17
superseded_by: glass-overlays
---

> Retired 2026-10-17 by decision 007 (map-first glass). Kept for history; follow [glass-overlays](glass-overlays.md).

# App-owned overlays are etched panels, not floating glass

**Rule.** Toasts, banners, HUDs and cards Graphium draws itself use `.etchedPanel()`: flat `surface-panel`, 1 pt `rule-hairline` border, 4 pt radius, no blur, no drop shadow, no capsule. Pressed or active is a recessed inset ring. They appear with `Motion.quick` (no bounce, no overshoot) and without animation under Reduce Motion.

**Test.** Zoom a screenshot of an overlay: square-ish corners, a hairline edge, opaque fill, no shadow halo; the map doesn't show through it.

**Good.** A top-centre toast: status glyph, one line of text, close button, on an etched panel.
**Bad.** A `.regularMaterial` capsule, a soft drop shadow, a spring-in from the top, a gradient fill.

**Also check.**

- Native popovers and sheets keep their system material; this card is only for surfaces Graphium draws.
- Overlay text uses `ink-primary`/`ink-secondary`, so it passes contrast in both appearances regardless of the map under it.

**Why.** The brief's depth model is engraved plate and letterpress; floating glass and rounded-everything are its listed anti-references. An opaque panel also stays legible over any map art.

Links: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) · [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
