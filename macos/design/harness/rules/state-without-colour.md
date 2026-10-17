---
id: state-without-colour
applies_to: [mac, architect, world-view, toolbar, canvas]
sources: ['brief §9 row 5', 'HIG Accessibility', 'PARITY §1.12']
confidence: decided
reviewed: 2026-10-17
---

# Every state has a non-colour cue

**Rule.** Paused, broadcasting, active tool, selected, locked, hidden and error states each change shape, symbol, fill or wording, not only colour. Toggle controls show their state with a filled symbol or an on/off appearance and say it in their label.

**Test.** View the screenshot in greyscale: each state is still identifiable.

**Good.** Pause shows `pause.fill` "Pause" and becomes `play.fill` "Resume" when paused. Broadcasting measurement says "Broadcasting" with a filled radio symbol. Locked doors show a lock glyph.
**Bad.** A button that only turns red. A selection that differs from hover only by hue.

**Also check.**

- VoiceOver reads the state ("Resume", "Broadcasting", "selected").
- Increase Contrast keeps the cue visible (thicker selection ring, opaque backings).

**Why.** Colour-blind DMs and players across the room both need the cue, and the accent must stay rare to stay meaningful.

Links: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
