---
id: world-view-player-safe
applies_to: [mac, world-view, canvas, readout]
sources:
  ['archive/web/docs/planning/ui-redesign-brief.md#8-world-view-rules', 'PARITY §4', 'macos/docs/PRINCIPLES.md']
confidence: decided
reviewed: 2026-10-17
---

# The World View is player-safe and projector-legible

**Rule.** The World View shows only what players may see, drawn for a TV across a room. No DM chrome or DM-only state (hidden NPCs, unexplored fog, local-only measurements, Architect selection). It uses the fixed `world-*` tokens and ignores Light/Dark. Any text a player reads is at least 24 pt at 1080p (about 1/45 of screen height, for reading from across the table; raised from 18 pt on 2026-10-18, #370) with 7:1 contrast on its backing. Strokes are at least 2 pt. No state is colour-only.

**Test.** On a 1920 × 1080 World View screenshot: nothing names a DM tool or setting; every overlay label is at least 24 px text on a `world-*` backing; no 1 px lines in overlays; every coloured mark also differs by shape or label.

**Good.** "Center on Party" at 24 pt semibold on `world-action`. The pause screen: `world-scrim`, large "Please Wait", no map pixels.
**Bad.** An 18 pt caption, a 1 px hairline frame, the Architect's amber selection ring, or a toolbar button that only the DM should press.

**Also check.**

- Nothing new appears in the World View without a decision recorded in `docs/decisions/`. Plates are opaque with 12 pt corners (`Radius.card`, decision 020); never glass.
- While paused, the canvas is not drawn at all (opacity 0 is not enough if it can flash on resume).
- Window toolbar items in the World View window are for whoever moves it to the projector (display placement); keep it to that.

**Why.** Players can't lean in or ask what a colour means, and projectors wash out thin lines and low contrast. Remote play must share only this view (PRINCIPLES.md).

Links: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) · [Color](https://developer.apple.com/design/human-interface-guidelines/color)
