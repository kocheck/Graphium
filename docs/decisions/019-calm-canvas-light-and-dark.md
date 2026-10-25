# Decision 019: Calm canvas, light and dark as equals

Status: DECIDED (2026-10-25), mockups pending Kyle's pick

## Question

Kyle wants a cleaner, mymind-inspired canvas UI (calm, content-first, soft surfaces, whitespace, visual tiles) that still follows the HIG, with no feature removed. How far does that go given 006 (dark-led instrument panel) and 007 (native chrome, glass over the map)?

## Kyle's answer (2026-10-25)

- Light and dark are equal citizens: calm and airy, one warm accent.
- Toolbar, sidebar, inspector, menus and sheets stay stock native. Redesign the layouts inside them and everything floating over the canvas.
- In scope: Welcome, Architect, Session Console and token library, World View (lightly).

## What changes

- Amends taste rules 1 (a quiet instrument, not dense), 2 (calm stock in both appearances) and 6 (the largest app-owned surface is neutral; the 12 % luminance test is Dark only).
- DESIGN.md: new `surface-raised` token, 12 pt `Radius.tile`, `Spacing.xxl` 32 pt, light and dark equal.
- The tool options stay in the customizable toolbar (`tool-options`); 007's reasons (Customize Toolbar, VoiceOver, menu parity) still hold. No floating tool palette.
- No hover-only controls: tiles may lift on hover, never reveal a control.
- `AccentColor` in the asset catalog stays darker than `Palette.accent` on purpose: native controls need the contrast. Do not "fix" it.
- Native chrome keeps system shapes; the large radii apply only to app-owned surfaces.

## Not decided yet

The World View's plate styling (decision 020 when that phase starts; it stays opaque, 24 pt text, 7:1 contrast). Welcome recents with campaign thumbnails (needs a thumbnail cache).

## What would change it

Kyle's pick from the mockups, or a screenshot that fails the hell-yes test.
