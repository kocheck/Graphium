# Decision 019: Calm canvas, light and dark as equals

Status: DECIDED (2026-10-25); direction chosen: Graphite

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

## Chosen direction: Graphite (2026-10-25)

Kyle picked option 3 of Ember, Paper and Graphite: cool graphite neutrals, tight radii, tool-like calm (Figma/Linear feel), light and dark equal.
- Tokens: `surface-panel` #F5F6F8 / #141518, `surface-raised` #FFFFFF / #1B1C20, `surface-sunken` #ECEEF1 / #202228, `rule-hairline` #DADDE3 / #2E3138. One amber accent unchanged.
- Radii: tiles 8 pt (`Radius.tile`); glass cards 12 pt (was 20, amends 007's card size); capsules unchanged; map marks 4 pt.
- Welcome: bold SF headline (no serif, no glow, no grain), a 5-column wall of borderless map tiles, pills for type, large mono map counts.
- Architect: contextual pill over the selection, icon + shortcut rows in the canvas menu, sectioned inspector with mono values, a library composer card over the canvas. The first two need a menu command, help text and VoiceOver parity.
- Dropped: the Ember glow and grain, and the serif headline. The earlier Welcome options below are kept as history.

## Welcome options (mockups in gitignored design-shots/calm-canvas/)

- **Soft Canvas, flat (welcome-v2 B):** New York serif headline, borderless map-art tiles in a staggered wall, pills for metadata, neutral stock.
- **Soft Canvas, bloom (welcome-v2 A):** the same with a faint amber glow behind the hero.
- **Day/night (welcome-v3):** inspired by Kyle's AFK Brand Inspiration space ("earth by day, space by night"): cream stock in Light, near-black with a grainy ember glow in Dark, large mono map counts. Grain would be a pre-rendered texture; amber stands in for Kyle's orange until an accent change is decided.
- Inspiration kept as reference only; no third-party art ships in the app.

## Not decided yet

The World View's plate styling (decision 020 when that phase starts; it stays opaque, 24 pt text, 7:1 contrast). Welcome recents with campaign thumbnails (needs a thumbnail cache).

## What would change it

Kyle's pick from the mockups, or a screenshot that fails the hell-yes test.
