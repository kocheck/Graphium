# Parchment & Leather Theme Redesign

**Date:** 2026-03-17
**Status:** Approved — implementation plan pending
**Approach:** Full CSS rewrite with modular token architecture

---

## Overview

Complete visual redesign of Graphium's theme system. The new aesthetic is physical and tactile — parchment and ink as the base material, leather and brass as premium hardware. Light mode is the flagship parchment experience; dark mode shifts to oiled leather with warm cream text and polished brass accents.

The existing monolithic `theme.css` is replaced by a tree of single-responsibility token and module files, aligned with the project's modular architecture philosophy.

---

## Design Direction

- **Base material:** Parchment & ink (warm cream backgrounds, iron gall ink text)
- **Premium layer:** Leather & brass (panels, accents, hardware details)
- **Light mode:** Parchment flagship
- **Dark mode:** Leather variant
- **Typography:** Cormorant Garamond (display) + DM Sans (body) + JetBrains Mono (data)
- **Texture:** Moderate — CSS paper grain on parchment, leather grain in dark mode, panel edge highlights, brass button highlights. No image assets.

---

## File Structure

```
src/styles/
├── index.css                    # Single entry point — imports everything in order
│
├── tokens/
│   ├── color-parchment.css      # Light theme: all --app-* color tokens
│   ├── color-leather.css        # Dark theme: all --app-* color tokens
│   ├── color-status.css         # Status tokens: error, warning, success (both themes, Radix)
│   ├── color-canvas.css         # Canvas tokens: fog, doors, walls, minimap, measurement
│   ├── typography.css           # Font families, size scale, weights, line-heights
│   ├── spacing.css              # Spacing scale (--space-1 … --space-16)
│   ├── radius.css               # Border radius tokens
│   └── motion.css               # Transition durations and easings
│
├── textures/
│   ├── grain.css                # Paper grain (light) + leather grain (dark), panel highlights
│   └── transitions.css          # Theme switching transitions + reduced-motion overrides
│
├── primitives/
│   ├── button.css
│   ├── input.css
│   ├── card.css
│   └── dialog.css
│
├── modules/
│   ├── toolbar.css
│   ├── home-screen.css
│   ├── sidebar.css
│   ├── canvas.css
│   └── monitor.css
│
└── brand.css                    # Font imports, accent overrides, logo paths
```

**Key principles:**

- `tokens/` files contain only CSS custom property declarations — no class selectors
- `primitives/` and `modules/` consume tokens only via `var(--app-*)` — never raw hex
- `index.css` is the only file imported anywhere in the app
- Adding a new module = one file in `modules/` + one import line in `index.css`

---

## Color Tokens

### Light Theme — `tokens/color-parchment.css`

```css
/* Backgrounds (warm cream → aged paper) */
--app-bg-base: #f7edda /* freshest parchment */ --app-bg-subtle: #f0e2c4 /* slightly aged */
  --app-bg-surface: #e8d5aa /* panel/card surfaces */ --app-bg-hover: #dfca96 /* hover state */
  --app-bg-active: #d4bc80 /* active/pressed */ /* Borders (dried ink lines) */
  --app-border-subtle: #c4a96e --app-border-default: #a8904c --app-border-hover: #8c7634
  /* Text (iron gall ink scale) */ --app-text-primary: #1c1007 /* near-black warm ink */
  --app-text-secondary: #3d2b0f /* medium ink */ --app-text-muted: #6b4e28 /* faded ink */
  --app-text-disabled: #a08060 /* intentionally below AA */ /* Brass Accent */
  --app-accent-solid: #8c6914 /* antique brass, AA on parchment */ --app-accent-solid-hover: #6e5010
  --app-accent-solid-text: #f7edda /* parchment on brass */ --app-accent-text: #6e5010
  /* inline links */;
```

### Dark Theme — `tokens/color-leather.css`

```css
/* Backgrounds (oiled leather) */
--app-bg-base: #1a1008 --app-bg-subtle: #231508 --app-bg-surface: #2e1e0e --app-bg-hover: #3a2718
  --app-bg-active: #482e1a /* Borders (tooled leather seams) */ --app-border-subtle: #4a3020
  --app-border-default: #5e3c24 --app-border-hover: #724a30 /* Text (aged parchment on leather) */
  --app-text-primary: #ede0c4 /* warm cream */ --app-text-secondary: #c8ad88 /* aged */
  --app-text-muted: #9a7e5c /* worn */ --app-text-disabled: #6b5038 /* intentionally below AA */
  /* Brass Accent (brighter in dark for contrast) */ --app-accent-solid: #c89a18
  /* polished brass */ --app-accent-solid-hover: #dab030 /* gleaming hover */
  --app-accent-solid-text: #1a1008 /* leather on brass */ --app-accent-text: #dab030
  /* inline links */;
```

### Status Colors — `tokens/color-status.css`

Radix red/amber/green retained — proven accessible. Referenced through existing `--app-error-*`, `--app-warning-*`, `--app-success-*` semantic tokens unchanged.

---

## Typography Tokens — `tokens/typography.css`

```css
/* Font Families */
--font-display:
  'Cormorant Garamond', Georgia, serif --font-body: 'DM Sans', 'Inter', system-ui,
  sans-serif --font-mono: 'JetBrains Mono',
  monospace /* Size Scale */ --text-xs: 0.6875rem /* 11px — section labels, ALL-CAPS only */
    --text-sm: 0.8125rem /* 13px — meta, helper text */ --text-base: 0.875rem
    /* 14px — body, labels, buttons */ --text-md: 1rem /* 16px — dialog body */ --text-lg: 1.125rem
    /* 18px — dialog titles */ --text-xl: 1.375rem /* 22px — screen headers (display font) */
    --text-2xl: 1.875rem /* 30px — section heroes (display font) */ --text-hero: 3rem
    /* 48px — home screen headline */ /* Weights */ --weight-normal: 400 --weight-medium: 500
    --weight-semibold: 600 --weight-bold: 700 --weight-black: 800 /* display font only */
    /* Line Heights */ --leading-tight: 1.2 --leading-snug: 1.35 --leading-normal: 1.5
    --leading-loose: 1.7 /* Letter Spacing */ --tracking-tight: -0.02em /* display/hero headings */
    --tracking-normal: 0 --tracking-wide: 0.06em /* ALL-CAPS section labels only */;
```

**Usage rules:**

- `--font-display` used only at `--text-xl` and above
- Section labels: `--font-body`, `--text-xs`, `--weight-semibold`, uppercase, `--tracking-wide`
- Data/numeric values: always `--font-mono`

---

## Texture Layer — `textures/grain.css`

- **Paper grain (light):** SVG noise filter via `::before` on `.app-root` at 3% opacity, 180px tile. `pointer-events: none`.
- **Leather grain (dark):** Same technique, tighter frequency, 5% opacity.
- **Panel highlight:** 1px inset shadow on top edge of all cards/panels. Light: `rgba(255,255,255,0.6)`. Dark: `rgba(0,0,0,0.4)`.
- **Brass button highlight:** 1px inset top highlight on accent buttons: `rgba(255,255,255,0.25)`.
- Konva `<canvas>` is excluded — grain sits over it visually but is irrelevant (canvas renders its own pixels).

---

## Module Rollout Order

### Phase 1 — Foundation

1. `tokens/color-parchment.css` + `tokens/color-leather.css`
2. `tokens/typography.css` + `tokens/spacing.css` + `tokens/radius.css` + `tokens/motion.css`
3. `tokens/color-status.css` + `tokens/color-canvas.css`
4. `textures/grain.css` + `textures/transitions.css`
5. `brand.css` — font imports, brass accent
6. `styles/index.css` — single entry point

**Exit condition:** App loads. Colors, fonts, grain correct. No visual regressions on `npm run build:web`.

### Phase 2 — Primitives

7. `primitives/button.css`
8. `primitives/input.css`
9. `primitives/card.css`
10. `primitives/dialog.css`

### Phase 3 — Modules

11. `modules/home-screen.css`
12. `modules/toolbar.css`
13. `modules/sidebar.css`
14. `modules/canvas.css`
15. `modules/monitor.css`

### Phase 4 — Konva Canvas Colors

16. Update `*_COLORS` const objects in Canvas component files to match parchment/leather palette.

Each phase = discrete PR. Each session ends with `npm run build:web` + `npm run type-check` + `npm run lint` passing.
