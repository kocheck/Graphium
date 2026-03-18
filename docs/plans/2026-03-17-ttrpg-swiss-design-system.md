# TTRPG Swiss Design System — Var C & D

**Date:** 2026-03-17
**Status:** Approved — Pencil implementation in progress
**File:** `/Users/kylekochanek/Desktop/graphium-redesign.pen`

---

## Context

Extends the Terminal Swiss redesign (Var A "Terminal" + Var B "Brutalist") with two new variations that blend Swiss brutalist structure with TTRPG atmosphere, legibility at table distance, and a Remix icon system. All built on **Radix color tokens** so any neutral scale (Sand → Mauve → Slate → Olive) can be swapped without redesign.

---

## Color System

### Neutral Foundation — Radix Sand (dark)

| Token     | Hex       | Role                      |
| --------- | --------- | ------------------------- |
| `sand-1`  | `#111110` | Deepest bg (canvas area)  |
| `sand-2`  | `#191918` | Page background           |
| `sand-3`  | `#222221` | Panel / card surface      |
| `sand-4`  | `#2A2A28` | Hover state               |
| `sand-6`  | `#3B3A37` | Subtle border             |
| `sand-7`  | `#494844` | Strong border             |
| `sand-11` | `#D4CFC6` | Secondary text            |
| `sand-12` | `#EEEDE9` | Primary text (warm white) |

### TTRPG Accent Palette — All Radix, All Swappable

| Token      | Hex       | Role                                   |
| ---------- | --------- | -------------------------------------- |
| `amber-9`  | `#FFC53D` | Primary CTA — torchlight gold (Var C)  |
| `amber-11` | `#AB6400` | Amber on light surfaces                |
| `red-9`    | `#E5484D` | Danger / delete (both vars)            |
| `teal-9`   | `#12A594` | World View / player states (both vars) |
| `violet-9` | `#6E56CF` | Primary CTA — arcane (Var D)           |

---

## Typography

All sizes bumped +2px vs Var A/B for at-range legibility (DM glancing mid-session).

| Role           | Font       | Size    | Weight | Notes                               |
| -------------- | ---------- | ------- | ------ | ----------------------------------- |
| Display hero   | Inter      | 48–64px | 800    | Landing page, -2px tracking         |
| Screen header  | Inter      | 30px    | 800    | -0.5px tracking, `sand-12`          |
| Card title     | Inter      | 17px    | 600    | `sand-12`                           |
| Body / labels  | Inter      | 14px    | 400    | `sand-11`                           |
| Section label  | Inter      | 11px    | 600    | ALL-CAPS, +2px tracking, `sand-11`  |
| Data / metrics | Space Mono | 14px    | 700    | All stat values, timestamps, badges |

---

## Icon System — Remix Icons (`@remixicon/react`)

Icons appear at 18px in toolbars, 14px in list rows, 22px in empty states. Never decorative — every icon carries meaning.

| Icon       | Remix name         | Usage                               |
| ---------- | ------------------ | ----------------------------------- |
| Dice       | `RiDiceLine`       | New Campaign, Generate Dungeon      |
| Shield     | `RiShieldLine`     | PC token type                       |
| Skull      | `RiSkullLine`      | NPC / enemy token type              |
| Eye off    | `RiEyeOffLine`     | Fog of war, pause state             |
| Door       | `RiDoorOpenLine`   | Door tool                           |
| Sword      | `RiSwordLine`      | Wall / combat tool                  |
| Scroll     | `RiFileList3Line`  | Campaign / about                    |
| Map pin    | `RiMapPinLine`     | Map selector section label          |
| Flashlight | `RiFlashlightLine` | Vision radius                       |
| Compass    | `RiCompass3Line`   | World View / projected display      |
| Goblet     | `RiGobletLine`     | Tavern template                     |
| Sparkling  | `RiSparklingLine`  | Magic / wizard tokens (Var D motif) |

---

## Responsive Strategy

| Breakpoint | Width  | Layout Pattern                                         |
| ---------- | ------ | ------------------------------------------------------ |
| Desktop    | 1440px | Sidebar fixed left (260px) + canvas + floating panels  |
| Tablet     | 768px  | Sidebar → icon rail (56px wide) + tap-to-expand drawer |
| Mobile     | 390px  | No sidebar — bottom sheet nav, canvas full bleed       |
| Projected  | 1920px | World View only — canvas max-width, no chrome          |

### Collapsing Rules

- **Token Inspector:** right panel → bottom sheet on tablet/mobile
- **Toolbar:** floating center → pinned full-width bottom bar on mobile
- **Modals:** fixed px width on desktop → `90vw` on tablet → full-screen on mobile
- **Sidebar sections:** stacked vertical on desktop → tabbed on tablet icon rail → omitted on mobile (command palette `⌘P` as entry point)

---

## Variation C — "Torchlit" (DM's Command Center)

**Primary accent:** `amber-9` (`#FFC53D`)
**Character:** War table lit by torchlight — warm, functional, fast decisions

### Key Rules

- Primary CTA: `amber-9` border + text; black label on filled buttons
- Active states: 2px amber left-border on list rows, amber underline on active tabs
- Tool buttons always show icon + label — never text alone
- Section labels: Remix icon prefix + ALL-CAPS Inter text
- Canvas tokens: colored circle + role icon inside (`RiShieldLine` PC / `RiSkullLine` NPC)
- Pause overlay: `RiEyeOffLine` at 48px + "DM IS PREPARING" Inter 28px bold

---

## Variation D — "Arcane Codex" (Spellbook Interface)

**Primary accent:** `violet-9` (`#6E56CF`)
**Character:** Enchanted software from a wizard's tower — arcane, mysterious

### Key Rules

- Primary CTA: `violet-9` fill, `sand-12` text
- Amber used **exclusively for data** (vision radius, grid size, timestamps) — never for actions
- `RiSparklingLine` appears in empty states + section headers as recurring motif
- Hero sections use `RiCompass3Line` at 48px as large decorative anchor
- Canvas tokens: violet ring for magic-users, amber indicator for high-vision tokens
- Pause overlay: `violet-9` at 15% opacity tint over canvas + `RiCompass3Line` animation placeholder

---

## Structural Rules (Both Variations)

- **Corner radius:** 0px on all elements (Swiss hard rule)
- **Borders:** 1px using Radix border tokens — no fills define space, borders do
- **Spacing:** 24px horizontal padding, 32px section gaps, 16px component gaps
- **No pure black:** Darkest surface is `sand-1` (`#111110`)
- **No pure white:** Lightest text is `sand-12` (`#EEEDE9`) — warm, not harsh
