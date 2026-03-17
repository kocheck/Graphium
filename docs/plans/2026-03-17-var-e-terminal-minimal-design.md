# Var E — Terminal Minimal Design Exploration

**Date:** 2026-03-17
**Status:** Exploration complete — 4 frames in `graphium-redesign.pen`
**Style guide:** `webapp-02-terminalminimal_light`

---

## Overview

Var E explores applying the `webapp-02-terminalminimal_light` style guide to Graphium's Home Screen and Editor views. Two creative axes were explored:

- **Accent color:** Emerald `#10B981` (pure CLI) vs Amber `#FFC53D` (torchlit)
- **TTRPG integration depth:** Pure terminal (ASCII-only, no icons) vs TTRPG-infused (icons + vocabulary preserved)

This yields 4 frames:

| Frame | Screen      | Accent  | TTRPG Depth   | Node ID |
| ----- | ----------- | ------- | ------------- | ------- |
| E1    | Home Screen | Emerald | Pure terminal | `lV4pG` |
| E2    | Home Screen | Amber   | TTRPG-infused | `GISjn` |
| E3    | Editor      | Emerald | Pure terminal | `mr0F5` |
| E4    | Editor      | Amber   | TTRPG-infused | `XEZLJ` |

All frames placed at x:6200–7800, y:5400–6400 in the Pencil file.

---

## Style System (Var E)

### Colors

- `#0A0A0A` — unified background (sidebar, canvas, inspector — no contrast separation)
- `#0F0F0F` — subtle surface elevation (section headers)
- `#1F1F1F` — active row background
- `#FAFAFA` — primary text
- `#6B7280` — secondary text, labels, meta
- `#10B981` — emerald accent (E1, E3)
- `#FFC53D` — amber accent (E2, E4) — consistent with existing Var C/D torchlit identity
- `#2a2a2a` — all borders (1px, no exceptions)

### Typography

- **JetBrains Mono** — all UI chrome (navbar, toolbar, section labels, inspector keys)
- **IBM Plex Mono** — content, descriptions, campaign names (E2/E4 only)
- Sizes: 20px logo, 14px section, 13px rows, 12px meta
- All lowercase; snake_case for data (`new_campaign`, `dungeon_01`); TTRPG proper nouns preserved in infused variants

### Design Rules

- 0px corner radius everywhere
- No shadows, no gradients
- Pure ASCII symbols for structural UI: `>` `$` `//` `[ ]` `[enter]` `>>`
- Section headers: `// maps`, `// tokens`, `// grid`, `// inspector`

---

## Variant Findings

### E1 — Emerald, Pure Terminal

Maximum CLI immersion. Emerald prompt logo + action rows with `$ command` + `[enter]` badge. Recent campaigns as file paths (`/campaigns/dragon_heist`). No icons anywhere. Feels closest to a developer tool — most distinctive departure from Var A/B/C/D.

### E2 — Amber, TTRPG-infused

Best balance of terminal structure and TTRPG identity. Amber matches the existing Var C torchlit palette so it feels like a natural evolution. TTRPG proper nouns + `[4 players]` metadata badges signal the domain clearly. Remix icons alongside `$` prefixes create a readable hybrid. **Strongest candidate for further development.**

### E3 — Editor, Emerald, Pure Terminal

Text-only toolbar (`cursor | pen | eraser | wall | door | ruler`) is surprisingly readable. Token labels in `[fighter]` `[goblin]` bracket syntax fit the TTRPG context well. The unified dark canvas makes the emerald-bordered selected room very legible. Inspector with `name:` / `type:` / `vision:` key-value pairs reads like a config file.

### E4 — Editor, Amber, TTRPG-infused

Colored token circles (fighter blue, wizard purple, goblin red) survive the terminal retheme well because they serve as spatial identity markers on the canvas, not decoration. The amber `[live]` play button is the strongest CTA moment across all 4 variants. Icon toolbar with amber active state reads more naturally for the tool-switching interaction than pure text.

---

## Key Observations

1. **The terminal syntax works for TTRPG** — `// maps`, `[pc]`, `$ generate_dungeon` feel like a DM running a session from a terminal. The CLI metaphor maps naturally to game master tooling.

2. **Amber over emerald for Graphium** — emerald is more "developer tool", amber connects to the existing Var C torchlit identity. A Var E production variant should use amber as primary.

3. **Hybrid depth (E2/E4) is more viable than pure terminal (E1/E3)** — preserving TTRPG icons gives spatial/semantic anchors that help discoverability, especially in the Editor where tools need to be quickly recognized.

4. **Token colors on `#0A0A0A` canvas** — class-identity colors (blue/purple/red) are legible even with muted fills against the near-black bg. They don't need to be dropped for terminal aesthetic.

---

## Recommended Next Step

If pursuing Var E further: build a **Var E2-style Home Screen + Var E4-style Editor** as a cohesive pair — amber accent, JetBrains Mono terminal structure, TTRPG vocabulary and icons preserved. This is the strongest synthesis from this exploration.
