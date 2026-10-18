---
id: one-warm-accent
applies_to: [mac, architect, canvas, toolbar, overlay]
sources:
  [
    'docs/decisions/006-direction.md',
    'archive/web/docs/planning/ui-redesign-brief.md#2-what-fresh-means-for-graphium',
    'brief §9 rows 1 and 4',
  ]
confidence: decided
reviewed: 2026-10-17
---

# One warm amber accent, used sparingly for state

**Rule.** The Architect window and canvas have one accent hue: amber (`accent`, `accent-text`, `canvas-selection`, `canvas-measure`). It marks state (active, selected, broadcasting, paused, measuring), at most three elements at once. No blue and no second accent; `status-*` colours appear only beside a status glyph. Chrome stays low-chroma so it doesn't glow in a dim room.

**Test.** Count amber elements in a screenshot of normal use: three or fewer. No `systemBlue`, `controlAccentColor` or green/red tints outside a status message.

**Good.** The selected token's dashed ring and the paused toolbar button are amber; everything else is ink and grey.
**Bad.** A blue selection ring, a green "live" button, a red tint on a button that isn't destructive, an amber background on a whole panel.

**Also check.**

- `controlAccentColor` follows the user's system accent (often blue); use `Palette.accent` on app-owned surfaces instead.
- Map art, marker ink and token art are content, not accent; leave them as the DM chose.

**Why.** The brief rejects "tech-blue sameness" and asks for a single warm accent that glows on near-black. Spending it on one thing at a time keeps it meaningful during a four-hour session.

Links: [Color](https://developer.apple.com/design/human-interface-guidelines/color) · [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
