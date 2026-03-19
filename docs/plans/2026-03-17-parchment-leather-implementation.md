# Parchment & Leather Theme — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the monolithic Radix-slate theme system with a modular parchment/leather/brass design system split across single-responsibility token and module CSS files.

**Architecture:** `src/index.css` stays as the Vite root entry point. A new `src/styles/index.css` replaces the current flat import list with a structured cascade: fonts → tokens → brand → textures → primitives → modules → utilities. All token files live in `src/styles/tokens/`, texture files in `src/styles/textures/`, primitive styles in `src/styles/primitives/`, and per-module styles in `src/styles/modules/`.

**Tech Stack:** CSS custom properties, Fontsource npm packages (`@fontsource/dm-sans`, `@fontsource/cormorant-garamond`, `@fontsource/jetbrains-mono`), Radix Colors retained for status only (`@radix-ui/colors/red`, `amber`, `green`), Tailwind CSS v4.

---

## Context for the Implementer

The app uses `[data-theme="light|dark"]` on `<html>` to switch themes (not Tailwind dark mode). Konva canvas renders to `<canvas>` — CSS vars don't work there, so canvas colors use `*_COLORS` const objects in component files. Those are updated in Phase 4 only.

The current import chain is:

```
src/main.tsx
  → src/index.css          ← Vite entry, keep this file
      → @import tailwindcss
      → ./styles/fonts.css       ← DELETE after Task 1
      → ./styles/theme.css       ← DELETE after Task 6
      → ./styles/brand.css       ← MODIFY in Task 6
      → ./styles/primitives.css  ← DELETE after Task 10
      → ./styles/app.css         ← KEEP as utility layer
      → ./styles/home-screen.css ← DELETE after Task 11
```

Verify commands to run after every task:

```bash
npm run build:web     # must pass with 0 errors
npm run type-check    # must pass
npm run lint          # must pass
npm run test:run      # must pass (vision.ts has 100% coverage — don't break it)
```

---

## Phase 1 — Foundation

### Task 1: Install new fonts

**Files:**

- Run: `npm install @fontsource/dm-sans @fontsource/cormorant-garamond @fontsource/jetbrains-mono`
- Create: `src/styles/fonts.css` (replace existing)

**Step 1: Install packages**

```bash
npm install @fontsource/dm-sans @fontsource/cormorant-garamond @fontsource/jetbrains-mono
```

Expected: packages added to node_modules and package.json.

**Step 2: Replace `src/styles/fonts.css`**

Overwrite the existing file entirely:

```css
/**
 * Parchment & Leather Font Stack
 *
 * Display:  Cormorant Garamond — old-world elegance for headers at xl+
 * Body:     DM Sans — neutral, legible UI labels, buttons, body text
 * Mono:     JetBrains Mono — data values: grid size, coordinates, vision
 *
 * Loaded from @fontsource npm packages (offline, no CDN dependency).
 */

/* Cormorant Garamond — display font (regular + italic + bold weights) */
@import '@fontsource/cormorant-garamond/400.css';
@import '@fontsource/cormorant-garamond/400-italic.css';
@import '@fontsource/cormorant-garamond/600.css';
@import '@fontsource/cormorant-garamond/700.css';
@import '@fontsource/cormorant-garamond/800.css';

/* DM Sans — body/UI font */
@import '@fontsource/dm-sans/400.css';
@import '@fontsource/dm-sans/500.css';
@import '@fontsource/dm-sans/600.css';
@import '@fontsource/dm-sans/700.css';

/* JetBrains Mono — data/numeric values */
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/700.css';

/* Apply DM Sans globally */
body {
  font-family:
    'DM Sans',
    'Inter',
    system-ui,
    -apple-system,
    sans-serif;
  font-feature-settings:
    'liga' 1,
    'calt' 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Mono elements */
code,
kbd,
samp,
pre,
.font-mono {
  font-family: 'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace;
}
```

**Step 3: Verify**

```bash
npm run build:web
```

Expected: build succeeds, fonts bundled.

**Step 4: Commit**

```bash
git add src/styles/fonts.css package.json package-lock.json
git commit -m "feat(theme): install DM Sans, Cormorant Garamond, JetBrains Mono via Fontsource"
```

---

### Task 2: Create light and dark color token files

**Files:**

- Create: `src/styles/tokens/color-parchment.css`
- Create: `src/styles/tokens/color-leather.css`

**Step 1: Create the tokens directory**

```bash
mkdir -p src/styles/tokens src/styles/textures src/styles/primitives src/styles/modules
```

**Step 2: Create `src/styles/tokens/color-parchment.css`**

```css
/**
 * Parchment Color Tokens — Light Theme
 *
 * Material reference: aged writing parchment + iron gall ink + antique brass.
 * All --app-* tokens consumed by primitives and modules via var().
 * Never reference these hex values directly in component files.
 */

:root,
[data-theme='light'] {
  color-scheme: light;

  /* ===== Backgrounds (warm cream → aged paper) ===== */
  --app-bg-base: #f7edda; /* freshest parchment, main page */
  --app-bg-subtle: #f0e2c4; /* slightly aged */
  --app-bg-surface: #e8d5aa; /* panel/card surfaces */
  --app-bg-hover: #dfca96; /* hover state */
  --app-bg-active: #d4bc80; /* active/pressed */

  /* ===== Borders (dried ink lines) ===== */
  --app-border-subtle: #c4a96e; /* faint edge */
  --app-border-default: #a8904c; /* standard separator */
  --app-border-hover: #8c7634; /* hover emphasis */

  /* ===== Text (iron gall ink scale) ===== */
  --app-text-primary: #1c1007; /* near-black warm ink */
  --app-text-secondary: #3d2b0f; /* medium ink */
  --app-text-muted: #6b4e28; /* faded ink */
  --app-text-disabled: #a08060; /* intentionally below AA */

  /* ===== Brass Accent ===== */
  --app-accent-solid: #8c6914; /* antique brass, AA on parchment bg */
  --app-accent-solid-hover: #6e5010; /* darker, pressed */
  --app-accent-solid-text: #f7edda; /* parchment on brass */
  --app-accent-bg: rgba(140, 105, 20, 0.1); /* accent tint */
  --app-accent-bg-hover: rgba(140, 105, 20, 0.16);
  --app-accent-bg-active: rgba(140, 105, 20, 0.22);
  --app-accent-text: #6e5010; /* inline links */
  --app-accent-text-contrast: #4a3508; /* high contrast accent text */

  /* ===== Overlays & Shadows ===== */
  --app-overlay: rgba(28, 16, 7, 0.7); /* modal overlay */
  --app-shadow-sm: rgba(28, 16, 7, 0.08);
  --app-shadow-md: rgba(28, 16, 7, 0.15);
  --app-shadow-lg: rgba(28, 16, 7, 0.28);

  /* ===== Dialog ===== */
  --app-dialog-backdrop: rgba(28, 16, 7, 0.72);
  --app-dialog-shadow: rgba(28, 16, 7, 0.45);
  --app-dialog-button-glow: rgba(140, 105, 20, 0.15);

  /* ===== HomeScreen ===== */
  --app-home-logo-glow: rgba(140, 105, 20, 0.3);
  --app-home-hover-overlay: rgba(28, 16, 7, 0.06);
  --app-home-shadow-sm: rgba(28, 16, 7, 0.12);
  --app-home-shadow-lg: rgba(28, 16, 7, 0.2);
  --app-home-modal-backdrop: rgba(28, 16, 7, 0.6);
  --app-home-card-shadow: rgba(28, 16, 7, 0.1);

  /* ===== Logo ===== */
  --app-logo-shadow: rgba(28, 16, 7, 0.3);

  /* ===== Library/Assets ===== */
  --app-drag-shadow: rgba(28, 16, 7, 0.55);
}
```

**Step 3: Create `src/styles/tokens/color-leather.css`**

```css
/**
 * Leather Color Tokens — Dark Theme
 *
 * Material reference: oiled leather + tooled seams + polished brass hardware.
 * Text reads as warm cream (aged parchment) on dark leather ground.
 */

[data-theme='dark'] {
  color-scheme: dark;

  /* ===== Backgrounds (oiled leather) ===== */
  --app-bg-base: #1a1008; /* darkest leather, canvas area */
  --app-bg-subtle: #231508; /* page background */
  --app-bg-surface: #2e1e0e; /* panel/card surfaces */
  --app-bg-hover: #3a2718; /* hover state */
  --app-bg-active: #482e1a; /* active/pressed */

  /* ===== Borders (tooled leather seams) ===== */
  --app-border-subtle: #4a3020;
  --app-border-default: #5e3c24;
  --app-border-hover: #724a30;

  /* ===== Text (aged parchment on leather) ===== */
  --app-text-primary: #ede0c4; /* warm cream, high contrast */
  --app-text-secondary: #c8ad88; /* aged, secondary */
  --app-text-muted: #9a7e5c; /* worn, muted */
  --app-text-disabled: #6b5038; /* intentionally below AA */

  /* ===== Brass Accent (brighter — needs contrast against dark leather) ===== */
  --app-accent-solid: #c89a18; /* polished brass */
  --app-accent-solid-hover: #dab030; /* gleaming hover */
  --app-accent-solid-text: #1a1008; /* leather on brass */
  --app-accent-bg: rgba(200, 154, 24, 0.12);
  --app-accent-bg-hover: rgba(200, 154, 24, 0.18);
  --app-accent-bg-active: rgba(200, 154, 24, 0.25);
  --app-accent-text: #dab030; /* inline links */
  --app-accent-text-contrast: #f0c840;

  /* ===== Overlays & Shadows ===== */
  --app-overlay: rgba(0, 0, 0, 0.78);
  --app-shadow-sm: rgba(0, 0, 0, 0.2);
  --app-shadow-md: rgba(0, 0, 0, 0.38);
  --app-shadow-lg: rgba(0, 0, 0, 0.55);

  /* ===== Dialog ===== */
  --app-dialog-backdrop: rgba(0, 0, 0, 0.78);
  --app-dialog-shadow: rgba(0, 0, 0, 0.55);
  --app-dialog-button-glow: rgba(200, 154, 24, 0.15);

  /* ===== HomeScreen ===== */
  --app-home-logo-glow: rgba(200, 154, 24, 0.3);
  --app-home-hover-overlay: rgba(255, 255, 255, 0.04);
  --app-home-shadow-sm: rgba(0, 0, 0, 0.3);
  --app-home-shadow-lg: rgba(0, 0, 0, 0.4);

  /* ===== Logo ===== */
  --app-logo-shadow: rgba(0, 0, 0, 0.5);

  /* ===== Library/Assets ===== */
  --app-drag-shadow: rgba(0, 0, 0, 0.65);
}
```

**Step 4: Commit**

```bash
git add src/styles/tokens/
git commit -m "feat(theme): add color-parchment and color-leather token files"
```

---

### Task 3: Create status and canvas color tokens

**Files:**

- Create: `src/styles/tokens/color-status.css`
- Create: `src/styles/tokens/color-canvas.css`

**Step 1: Create `src/styles/tokens/color-status.css`**

Status colors keep Radix for proven accessibility. The dark-mode values are manually declared using `[data-theme='dark']` because Radix uses `.dark` class but this app uses `data-theme` attribute.

```css
/**
 * Status Color Tokens
 *
 * Uses Radix Colors for error (red), warning (amber), success (green).
 * Light mode values come from Radix CSS imports.
 * Dark mode values are manually declared to work with [data-theme="dark"]
 * instead of Radix's .dark class selector.
 */

@import '@radix-ui/colors/red.css';
@import '@radix-ui/colors/amber.css';
@import '@radix-ui/colors/green.css';

/* ===== Light Mode Status Tokens ===== */
:root,
[data-theme='light'] {
  /* Error (Red) */
  --app-error-bg: var(--red-3);
  --app-error-bg-hover: var(--red-4);
  --app-error-border: var(--red-7);
  --app-error-solid: var(--red-9);
  --app-error-solid-hover: var(--red-10);
  --app-error-text: var(--red-11);

  /* Warning (Amber) */
  --app-warning-bg: var(--amber-3);
  --app-warning-bg-hover: var(--amber-4);
  --app-warning-border: var(--amber-7);
  --app-warning-solid: var(--amber-9);
  --app-warning-solid-hover: var(--amber-10);
  --app-warning-text: var(--amber-11);

  /* Success (Green) */
  --app-success-bg: var(--green-3);
  --app-success-bg-hover: var(--green-4);
  --app-success-border: var(--green-7);
  --app-success-solid: var(--green-9);
  --app-success-solid-hover: var(--green-10);
  --app-success-text: var(--green-11);

  /* Error Boundaries */
  --app-error-boundary-bg: #fee2e2;
  --app-error-boundary-border: #dc2626;
  --app-error-boundary-text: #dc2626;
  --app-error-boundary-code-bg: #fff8f0;
  --app-error-boundary-code-border: #d1c5b0;
  --app-error-boundary-dismiss: #4caf50;
  --app-error-boundary-dismiss-hover: #45a049;
  --app-error-boundary-helper: #6b4e28;
}

/* ===== Dark Mode Status Tokens ===== */
[data-theme='dark'] {
  /* Radix dark-mode raw values for red */
  --red-1: #191111;
  --red-2: #201314;
  --red-3: #3b1219;
  --red-4: #500f1c;
  --red-5: #611623;
  --red-6: #72232d;
  --red-7: #8c333a;
  --red-8: #b54548;
  --red-9: #e5484d;
  --red-10: #ec5d5e;
  --red-11: #ff9592;
  --red-12: #ffd1d9;

  /* Radix dark-mode raw values for amber */
  --amber-1: #16120c;
  --amber-2: #1d180f;
  --amber-3: #302008;
  --amber-4: #3f2700;
  --amber-5: #4d3000;
  --amber-6: #5c3d05;
  --amber-7: #714f19;
  --amber-8: #8f6424;
  --amber-9: #ffc53d;
  --amber-10: #ffd60a;
  --amber-11: #ffca16;
  --amber-12: #ffe7b3;

  /* Radix dark-mode raw values for green */
  --green-1: #0d1912;
  --green-2: #0f1e13;
  --green-3: #132d1b;
  --green-4: #113b1f;
  --green-5: #174933;
  --green-6: #20573e;
  --green-7: #28684a;
  --green-8: #2f7c57;
  --green-9: #30a46c;
  --green-10: #33b074;
  --green-11: #3dd68c;
  --green-12: #b1f1cb;

  /* Status tokens reference the overridden raw values */
  --app-error-bg: var(--red-3);
  --app-error-bg-hover: var(--red-4);
  --app-error-border: var(--red-7);
  --app-error-solid: var(--red-9);
  --app-error-solid-hover: var(--red-10);
  --app-error-text: var(--red-11);

  --app-warning-bg: var(--amber-3);
  --app-warning-bg-hover: var(--amber-4);
  --app-warning-border: var(--amber-7);
  --app-warning-solid: var(--amber-9);
  --app-warning-solid-hover: var(--amber-10);
  --app-warning-text: var(--amber-11);

  --app-success-bg: var(--green-3);
  --app-success-bg-hover: var(--green-4);
  --app-success-border: var(--green-7);
  --app-success-solid: var(--green-9);
  --app-success-solid-hover: var(--green-10);
  --app-success-text: var(--green-11);

  /* Error Boundaries — dark */
  --app-error-boundary-bg: var(--red-3);
  --app-error-boundary-border: var(--red-7);
  --app-error-boundary-text: var(--red-11);
  --app-error-boundary-code-bg: #2e1e0e;
  --app-error-boundary-code-border: #5e3c24;
  --app-error-boundary-helper: #9a7e5c;
}
```

**Step 2: Create `src/styles/tokens/color-canvas.css`**

Canvas tokens are functional colors — they define what renders on the map. Keep existing values; parchment tuning of canvas chrome happens in Phase 3. Konva rendering colors are updated in Phase 4.

```css
/**
 * Canvas Color Tokens
 *
 * Colors for canvas-rendered elements that use CSS vars (not Konva).
 * Konva-rendered elements use *_COLORS const objects in component files.
 * Those are updated in Phase 4 of the parchment redesign.
 */

:root,
[data-theme='light'] {
  /* ===== Grid ===== */
  --app-grid-color: #a8904c; /* parchment-toned grid lines */

  /* ===== Fog of War ===== */
  --app-canvas-fog: rgba(0, 0, 0, 0.94);
  --app-canvas-fog-explored: rgba(0, 0, 0, 0.8);

  /* ===== Selection & Interaction ===== */
  --app-canvas-selection-fill: rgba(140, 105, 20, 0.25); /* brass selection */
  --app-canvas-selection-stroke: #8c6914;
  --app-canvas-snap-fill: rgba(140, 105, 20, 0.1);
  --app-canvas-snap-stroke: rgba(140, 105, 20, 0.55);
  --app-canvas-calibration-fill: rgba(229, 72, 77, 0.2);
  --app-canvas-calibration-stroke: #e5484d;

  /* ===== Marker ===== */
  --app-canvas-marker-default: #df4b26;
  --app-canvas-marker-preset-blue: #3b82f6;
  --app-canvas-marker-preset-green: #22c55e;

  /* ===== Doors ===== */
  --app-door-fill: #f7edda;
  --app-door-stroke: #1c1007;
  --app-door-sweep-fill: rgba(247, 237, 218, 0.4);
  --app-door-sweep-stroke: #1c1007;
  --app-door-shadow-dm: rgba(247, 237, 218, 0.8);
  --app-door-shadow-player: rgba(28, 16, 7, 0.3);
  --app-door-opening-fill: rgba(247, 237, 218, 0.6);
  --app-door-lock-handle: rgba(247, 237, 218, 0.9);
  --app-door-locked-icon: #e5484d;
  --app-door-locked-outline: #8c0000;
  --app-door-preview-fill: rgba(247, 237, 218, 0.5);
  --app-door-preview-stroke: #f7edda;
  --app-door-bounding-box: #8c6914;

  /* ===== Stairs ===== */
  --app-stairs-fill-up: #c0c0c0;
  --app-stairs-fill-down: #808080;
  --app-stairs-stroke: #1c1007;
  --app-stairs-arrow-up: #8c6914;
  --app-stairs-arrow-down: #e5484d;

  /* ===== Minimap ===== */
  --app-minimap-bg: rgba(168, 144, 76, 0.2);
  --app-minimap-border: rgba(140, 105, 20, 0.5);
  --app-minimap-viewport-fill: rgba(140, 105, 20, 0.15);
  --app-minimap-viewport-stroke: #8c6914;
  --app-minimap-token-pc: #22c55e;

  /* ===== Measurement ===== */
  --app-measurement-fill: rgba(140, 105, 20, 0.25);
  --app-measurement-stroke: rgba(140, 105, 20, 1);
  --app-measurement-text: #f7edda;
  --app-measurement-text-bg: rgba(28, 16, 7, 0.75);
  --app-movement-range-fill: rgba(140, 105, 20, 0.12);
  --app-movement-range-stroke: rgba(140, 105, 20, 0.4);

  /* ===== Touch Feedback ===== */
  --app-touch-indicator: #8c6914;
  --app-touch-pressure-low: #3b82f6;
  --app-touch-pressure-med: #22c55e;
  --app-touch-pressure-high: #e5484d;
  --app-touch-pan-mode: #8c6914;
  --app-touch-pinch-mode: #22c55e;
  --app-touch-feedback-bg: rgba(28, 16, 7, 0.85);

  /* ===== Token Rendering ===== */
  --app-token-shadow-hover: rgba(28, 16, 7, 0.6);
  --app-token-shadow: rgba(28, 16, 7, 0.4);
  --app-token-error-fill: rgba(229, 72, 77, 0.7);
  --app-token-error-stroke: #e5484d;

  /* ===== Walls ===== */
  --app-wall-stroke: #1c1007;
  --app-wall-color-default: #e5484d;
}

[data-theme='dark'] {
  /* ===== Grid ===== */
  --app-grid-color: #5e3c24;

  /* ===== Doors (leather dark mode) ===== */
  --app-door-fill: #ede0c4;
  --app-door-stroke: #1a1008;
  --app-door-sweep-fill: rgba(237, 224, 196, 0.35);
  --app-door-sweep-stroke: #1a1008;
  --app-door-shadow-dm: rgba(237, 224, 196, 0.7);
  --app-door-shadow-player: rgba(0, 0, 0, 0.4);
  --app-door-opening-fill: rgba(237, 224, 196, 0.55);
  --app-door-lock-handle: rgba(237, 224, 196, 0.85);
  --app-door-bounding-box: #c89a18;

  /* ===== Minimap ===== */
  --app-minimap-bg: rgba(94, 60, 36, 0.3);
  --app-minimap-border: rgba(200, 154, 24, 0.5);
  --app-minimap-viewport-fill: rgba(200, 154, 24, 0.15);
  --app-minimap-viewport-stroke: #c89a18;

  /* ===== Selection ===== */
  --app-canvas-selection-fill: rgba(200, 154, 24, 0.2);
  --app-canvas-selection-stroke: #c89a18;
  --app-canvas-snap-fill: rgba(200, 154, 24, 0.08);
  --app-canvas-snap-stroke: rgba(200, 154, 24, 0.5);

  /* ===== Measurement ===== */
  --app-measurement-fill: rgba(200, 154, 24, 0.2);
  --app-measurement-stroke: rgba(200, 154, 24, 1);
  --app-measurement-text: #1a1008;
  --app-measurement-text-bg: rgba(237, 224, 196, 0.85);
  --app-movement-range-fill: rgba(200, 154, 24, 0.1);
  --app-movement-range-stroke: rgba(200, 154, 24, 0.38);

  /* ===== Token Rendering ===== */
  --app-token-shadow-hover: rgba(0, 0, 0, 0.7);
  --app-token-shadow: rgba(0, 0, 0, 0.5);
}
```

**Step 3: Verify**

```bash
npm run build:web && npm run lint
```

**Step 4: Commit**

```bash
git add src/styles/tokens/color-status.css src/styles/tokens/color-canvas.css
git commit -m "feat(theme): add color-status and color-canvas token files"
```

---

### Task 4: Create typography, spacing, radius, motion tokens

**Files:**

- Create: `src/styles/tokens/typography.css`
- Create: `src/styles/tokens/spacing.css`
- Create: `src/styles/tokens/radius.css`
- Create: `src/styles/tokens/motion.css`

**Step 1: Create `src/styles/tokens/typography.css`**

```css
/**
 * Typography Tokens
 *
 * --font-display: Cormorant Garamond — headings at text-xl and above ONLY
 * --font-body:    DM Sans — all UI chrome, buttons, labels, body text
 * --font-mono:    JetBrains Mono — data values (numbers, coordinates, grid size)
 *
 * Section labels: font-body, text-xs, weight-semibold, uppercase, tracking-wide
 * Data values:    font-mono always
 */

:root {
  /* Font Families */
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'DM Sans', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;

  /* Size Scale */
  --text-xs: 0.6875rem; /* 11px — section labels, ALL-CAPS only */
  --text-sm: 0.8125rem; /* 13px — meta, helper text */
  --text-base: 0.875rem; /* 14px — body, labels, buttons */
  --text-md: 1rem; /* 16px — dialog body */
  --text-lg: 1.125rem; /* 18px — dialog titles */
  --text-xl: 1.375rem; /* 22px — screen headers (display font) */
  --text-2xl: 1.875rem; /* 30px — section heroes (display font) */
  --text-hero: 3rem; /* 48px — home screen headline */

  /* Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-black: 800; /* display font only */

  /* Line Heights */
  --leading-tight: 1.2; /* display headings */
  --leading-snug: 1.35; /* card titles */
  --leading-normal: 1.5; /* body text */
  --leading-loose: 1.7; /* long-form descriptions */

  /* Letter Spacing */
  --tracking-tight: -0.02em; /* display/hero headings */
  --tracking-normal: 0;
  --tracking-wide: 0.06em; /* ALL-CAPS section labels only */
}
```

**Step 2: Create `src/styles/tokens/spacing.css`**

```css
/**
 * Spacing Tokens
 *
 * 4px base unit. Use these tokens in module/primitive CSS files instead of
 * arbitrary pixel or rem values. Tailwind utility classes in JSX are fine too.
 */

:root {
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-10: 2.5rem; /* 40px */
  --space-12: 3rem; /* 48px */
  --space-16: 4rem; /* 64px */
}
```

**Step 3: Create `src/styles/tokens/radius.css`**

```css
/**
 * Border Radius Tokens
 *
 * Parchment aesthetic uses very small radius — feels like cut paper edges,
 * not sharp right angles or overly rounded UI.
 */

:root {
  --radius-none: 0;
  --radius-sm: 0.125rem; /* 2px — cut paper edge */
  --radius-md: 0.25rem; /* 4px — standard UI elements */
  --radius-lg: 0.375rem; /* 6px — cards, dialogs */
  --radius-full: 9999px; /* pill shape */
}
```

**Step 4: Create `src/styles/tokens/motion.css`**

```css
/**
 * Motion Tokens
 *
 * Transitions should feel deliberate and physical — not snappy or bouncy.
 * Theme transitions are slower to let the material "settle".
 */

:root {
  --duration-fast: 0.1s; /* micro-interactions: focus rings */
  --duration-base: 0.15s; /* hover states */
  --duration-slow: 0.2s; /* theme transitions, panels */
  --ease-default: ease;
  --ease-out: ease-out;
}
```

**Step 5: Commit**

```bash
git add src/styles/tokens/typography.css src/styles/tokens/spacing.css \
        src/styles/tokens/radius.css src/styles/tokens/motion.css
git commit -m "feat(theme): add typography, spacing, radius, motion token files"
```

---

### Task 5: Create texture files

**Files:**

- Create: `src/styles/textures/grain.css`
- Create: `src/styles/textures/transitions.css`

**Step 1: Create `src/styles/textures/grain.css`**

The grain uses an inline SVG noise filter. The only encoded character is `#` → `%23` inside the SVG's `url()` reference.

```css
/**
 * Texture Layer — Paper Grain & Leather Grain
 *
 * Applied via ::before pseudo-element on .app-root.
 * pointer-events: none — never blocks interaction.
 * z-index: 9999 — sits above all UI, below nothing.
 * Konva <canvas> renders its own pixels; grain layering over it is harmless.
 *
 * Light mode: fine paper grain at 3% opacity, 180px tile
 * Dark mode: coarser leather grain at 5% opacity
 */

:root {
  --texture-grain-opacity: 0.03;
  --texture-grain-size: 180px;
  --texture-panel-highlight: rgba(255, 255, 255, 0.55);
  --texture-brass-highlight: rgba(255, 255, 255, 0.22);
}

[data-theme='dark'] {
  --texture-grain-opacity: 0.05;
  --texture-panel-highlight: rgba(0, 0, 0, 0.4);
}

/* Paper/leather grain overlay */
.app-root::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: var(--texture-grain-opacity);
  background-image: url("data:image/svg+xml,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='noise'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23noise)'/></svg>");
  background-repeat: repeat;
  background-size: var(--texture-grain-size);
}

/* Panel top-edge highlight — light catches paper/leather surface */
.card-primitive,
.dialog-primitive__panel,
.sidebar,
.toolbar {
  box-shadow: inset 0 1px 0 var(--texture-panel-highlight);
}

/* Brass button highlight — polished metal catches light */
.btn-primitive--primary,
.btn-primitive--tool.active {
  box-shadow: inset 0 1px 0 var(--texture-brass-highlight);
}
```

**Step 2: Create `src/styles/textures/transitions.css`**

```css
/**
 * Theme Transitions & Motion Preferences
 *
 * Scoped to UI elements only — never applied to Konva canvas (performance).
 * Add .themed-transition to any element that should animate during theme switch.
 */

.app-root,
.sidebar,
.toolbar,
.btn,
.btn-tool,
.btn-mode,
.btn-broadcast,
.sidebar-input,
.sidebar-token,
.info-box,
.themed-transition,
[data-theme] .themed-transition {
  transition-property: background-color, border-color, color, fill, stroke, box-shadow;
  transition-duration: var(--duration-slow);
  transition-timing-function: var(--ease-default);
}

/* Prevent transitions on initial load (flash of wrong theme) */
.theme-loading .app-root,
.theme-loading .sidebar,
.theme-loading .toolbar,
.theme-loading .btn,
.theme-loading .btn-tool,
.theme-loading .themed-transition {
  transition: none !important;
}

/* High contrast mode */
@media (prefers-contrast: more) {
  :root,
  [data-theme='light'],
  [data-theme='dark'] {
    --app-text-secondary: var(--app-text-primary);
    --app-text-muted: var(--app-text-primary);
    --app-border-subtle: var(--app-border-hover);
    --app-border-default: var(--app-border-hover);
  }

  .btn,
  .btn-tool,
  .btn-mode,
  input,
  select,
  textarea {
    border-width: 2px;
  }

  :focus-visible {
    outline: 3px solid var(--app-accent-solid);
    outline-offset: 2px;
  }

  .toolbar {
    border-width: 3px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

**Step 3: Commit**

```bash
git add src/styles/textures/
git commit -m "feat(theme): add paper/leather grain texture and transition files"
```

---

### Task 6: Wire everything together — index.css, brand.css, src/index.css

**Files:**

- Create: `src/styles/index.css`
- Modify: `src/styles/brand.css`
- Modify: `src/index.css`
- Delete: `src/styles/theme.css` (replaced by token files)

**Step 1: Create `src/styles/index.css`**

```css
/**
 * Graphium Style Entry Point
 *
 * Import order matters:
 * 1. Fonts — loaded first so they're available to everything
 * 2. Tokens — custom properties, no selectors
 * 3. Brand — overrides accent/fonts after tokens are defined
 * 4. Textures — grain and transitions reference token vars
 * 5. Primitives — button, input, card, dialog
 * 6. Modules — toolbar, home-screen, sidebar, canvas, monitor
 * 7. App utilities — global utility classes (last, highest specificity wins)
 *
 * To add a new module: create src/styles/modules/my-module.css,
 * add one @import line here. Nothing else needs to change.
 */

/* 1. Fonts */
@import './fonts.css';

/* 2. Tokens */
@import './tokens/color-parchment.css';
@import './tokens/color-leather.css';
@import './tokens/color-status.css';
@import './tokens/color-canvas.css';
@import './tokens/typography.css';
@import './tokens/spacing.css';
@import './tokens/radius.css';
@import './tokens/motion.css';

/* 3. Brand */
@import './brand.css';

/* 4. Textures */
@import './textures/grain.css';
@import './textures/transitions.css';

/* 5. Primitives */
@import './primitives/button.css';
@import './primitives/input.css';
@import './primitives/card.css';
@import './primitives/dialog.css';

/* 6. Modules */
@import './modules/home-screen.css';
@import './modules/toolbar.css';
@import './modules/sidebar.css';
@import './modules/canvas.css';
@import './modules/monitor.css';

/* 7. App utilities */
@import './app.css';
```

**Step 2: Update `src/styles/brand.css`**

Replace entire file:

```css
/**
 * Brand Configuration Layer
 *
 * Edit ONLY this file to rebrand Graphium.
 * Import order: fonts.css → tokens/ → brand.css → textures/ → primitives/ → modules/
 *
 * WHAT GOES HERE:
 * - Accent color overrides (brass by default)
 * - Font family references
 * - Logo asset paths
 *
 * WHAT DOES NOT GO HERE:
 * - Layout or spacing (those go in modules/ or app.css)
 * - New component styles (those go in primitives/ or modules/)
 * - Raw color overrides (those go in tokens/color-parchment.css or tokens/color-leather.css)
 */

:root {
  /* ===== Brand Identity ===== */
  --brand-name: 'Graphium';
  --brand-tagline: 'Digital Stylus for World Builders';

  /* ===== Font Family =====
     Override here to swap fonts without touching token files. */
  --brand-font-family: 'DM Sans', 'Inter', system-ui, -apple-system, sans-serif;
  --brand-font-display: 'Cormorant Garamond', Georgia, serif;
  --brand-font-mono: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;

  /* ===== Logo Assets ===== */
  --brand-logo-icon: url('/icon.svg');
  --brand-logo-png: url('/icon.png');
}
```

**Step 3: Update `src/index.css`**

Replace the current import block to point to the new styles/index.css:

```css
@import 'tailwindcss';
@import './styles/index.css';

/* Ensure html, body, and root fill viewport */
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden; /* Prevent scrollbars on canvas */
}

#root {
  width: 100%;
  height: 100%;
}
```

**Step 4: Create empty placeholder files for Phase 2/3**

The styles/index.css imports these files — they must exist for the build to succeed. Create empty files now; they will be filled in Phases 2 and 3.

```bash
touch src/styles/primitives/button.css
touch src/styles/primitives/input.css
touch src/styles/primitives/card.css
touch src/styles/primitives/dialog.css
touch src/styles/modules/home-screen.css
touch src/styles/modules/toolbar.css
touch src/styles/modules/sidebar.css
touch src/styles/modules/canvas.css
touch src/styles/modules/monitor.css
```

**Step 5: Delete old theme.css**

```bash
git rm src/styles/theme.css
```

**Step 6: Verify build passes with empty module files**

```bash
npm run build:web && npm run type-check && npm run lint && npm run test:run
```

Expected: all pass. App will look unstyled for primitives/modules until Phase 2/3, but it should build without errors.

**Step 7: Commit**

```bash
git add src/styles/index.css src/styles/brand.css src/index.css \
        src/styles/primitives/ src/styles/modules/
git commit -m "feat(theme): wire modular CSS index, update brand.css, remove old theme.css"
```

---

## Phase 2 — Primitives

**Context:** Each task takes the styles from the deleted `src/styles/primitives.css` and migrates them into a dedicated file, updating colors to use the new parchment/leather tokens. The original `primitives.css` was deleted in Phase 1 via `git rm`. If you need to reference the original styles, check git history: `git show HEAD~1:src/styles/primitives.css`.

**Key token changes:**

- `border-radius: 0.375rem` → `var(--radius-md)` or `var(--radius-lg)`
- `transition: 0.15s ease` → `var(--duration-base) var(--ease-default)`
- All colors → existing `--app-*` tokens (parchment/leather files handle the actual values)

---

### Task 7: primitives/button.css

**Files:**

- Modify: `src/styles/primitives/button.css` (currently empty)

**Step 1: Fill in button styles**

```css
/**
 * Button Primitive Styles
 *
 * Variants: primary (brass fill), secondary (surface), ghost (transparent),
 *           destructive (red), tool (toolbar button).
 * Colors reference --app-* tokens. No hex values here.
 */

.btn-primitive {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background-color var(--duration-base) var(--ease-default),
    border-color var(--duration-base) var(--ease-default),
    color var(--duration-base) var(--ease-default);
  line-height: var(--leading-normal);
  white-space: nowrap;
  user-select: none;
}

.btn-primitive:focus-visible {
  outline: 2px solid var(--app-accent-solid);
  outline-offset: 2px;
}

.btn-primitive--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Primary — brass fill */
.btn-primitive--primary {
  background: var(--app-accent-solid);
  color: var(--app-accent-solid-text);
  border-color: var(--app-accent-solid);
}

.btn-primitive--primary:hover:not(:disabled) {
  background: var(--app-accent-solid-hover);
  border-color: var(--app-accent-solid-hover);
}

.btn-primitive--primary:active:not(:disabled) {
  filter: brightness(0.92);
}

/* Secondary — surface */
.btn-primitive--secondary {
  background: var(--app-bg-active);
  color: var(--app-text-primary);
  border-color: var(--app-border-default);
}

.btn-primitive--secondary:hover:not(:disabled) {
  background: var(--app-bg-hover);
  border-color: var(--app-border-hover);
}

.btn-primitive--secondary:active:not(:disabled) {
  background: var(--app-bg-active);
}

/* Ghost */
.btn-primitive--ghost {
  background: transparent;
  color: var(--app-text-primary);
  border-color: transparent;
}

.btn-primitive--ghost:hover:not(:disabled) {
  background: var(--app-bg-hover);
}

.btn-primitive--ghost:active:not(:disabled) {
  background: var(--app-bg-active);
}

/* Destructive */
.btn-primitive--destructive {
  background: var(--app-error-solid);
  color: white;
  border-color: var(--app-error-solid);
}

.btn-primitive--destructive:hover:not(:disabled) {
  background: var(--app-error-solid-hover, var(--app-error-solid));
  border-color: var(--app-error-solid-hover, var(--app-error-solid));
  filter: brightness(1.08);
}

.btn-primitive--destructive:active:not(:disabled) {
  filter: brightness(0.92);
}

/* Tool — toolbar button */
.btn-primitive--tool {
  background: var(--app-toolbar-button-bg);
  color: var(--app-toolbar-button-text);
  border-color: var(--app-toolbar-button-border);
}

.btn-primitive--tool:hover:not(:disabled) {
  background: var(--app-toolbar-button-hover);
  border-color: var(--app-toolbar-button-border-hover, var(--app-toolbar-button-border));
}

.btn-primitive--tool.active {
  background: var(--app-accent-solid);
  color: var(--app-accent-solid-text);
  border-color: var(--app-accent-solid);
}

.btn-primitive--tool.active:hover:not(:disabled) {
  background: var(--app-accent-solid-hover);
  border-color: var(--app-accent-solid-hover);
}

/* Loading spinner */
.btn-primitive__spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Icon container */
.btn-primitive__icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
```

**Step 2: Verify**

```bash
npm run build:web && npm run lint
```

**Step 3: Commit**

```bash
git add src/styles/primitives/button.css
git commit -m "feat(theme): migrate button primitive to modular CSS with parchment tokens"
```

---

### Task 8: primitives/input.css

**Files:**

- Modify: `src/styles/primitives/input.css`

**Step 1: Fill in input styles**

Migrate from `primitives.css` input section. Key changes: `border-radius: 0.375rem` → `var(--radius-md)`, transition values → motion tokens, all colors → `--app-*` tokens.

```css
/**
 * Input Primitive Styles
 */

.input-primitive {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--app-text-primary);
  background: var(--app-bg-active);
  border: 1px solid var(--app-border-default);
  border-radius: var(--radius-md);
  transition:
    border-color var(--duration-base) var(--ease-default),
    box-shadow var(--duration-base) var(--ease-default);
}

.input-primitive::placeholder {
  color: var(--app-text-muted);
}

.input-primitive:focus {
  outline: none;
  border-color: var(--app-accent-solid);
  box-shadow: 0 0 0 2px var(--app-accent-bg);
}

.input-primitive:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-primitive--error {
  border-color: var(--app-error-solid);
}

.input-primitive--error:focus {
  border-color: var(--app-error-solid);
  box-shadow: 0 0 0 2px var(--app-error-bg);
}

.input-primitive__label {
  display: block;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--app-text-secondary);
  margin-bottom: var(--space-1);
}

.input-primitive__helper {
  font-size: var(--text-sm);
  color: var(--app-text-muted);
  margin-top: var(--space-1);
}

.input-primitive__error-text {
  font-size: var(--text-sm);
  color: var(--app-error-solid);
  margin-top: var(--space-1);
}
```

**Step 2: Verify + Commit**

```bash
npm run build:web && npm run lint
git add src/styles/primitives/input.css
git commit -m "feat(theme): migrate input primitive to modular CSS"
```

---

### Task 9: primitives/card.css

**Files:**

- Modify: `src/styles/primitives/card.css`

**Step 1: Fill in card styles**

```css
/**
 * Card Primitive Styles
 */

.card-primitive {
  border-radius: var(--radius-lg);
  color: var(--app-text-primary);
}

.card-primitive--surface {
  background: var(--app-bg-surface);
}

.card-primitive--elevated {
  background: var(--app-bg-surface);
  box-shadow:
    0 1px 3px var(--app-shadow-sm),
    0 2px 8px var(--app-shadow-md);
}

.card-primitive--outlined {
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border-default);
}
```

**Step 2: Verify + Commit**

```bash
npm run build:web && npm run lint
git add src/styles/primitives/card.css
git commit -m "feat(theme): migrate card primitive to modular CSS"
```

---

### Task 10: primitives/dialog.css

**Files:**

- Modify: `src/styles/primitives/dialog.css`
- Delete: `src/styles/primitives.css` (now fully migrated)

**Step 1: Fill in dialog styles**

Migrate from `primitives.css` dialog section. Key changes: `border-radius: 0.5rem` → `var(--radius-lg)`, all spacing → spacing tokens, all colors → `--app-*` tokens.

```css
/**
 * Dialog Primitive Styles
 */

.dialog-primitive__overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-dialog-backdrop, rgba(0, 0, 0, 0.5));
  animation: dialog-fade-in var(--duration-base) var(--ease-out);
}

.dialog-primitive__panel {
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border-default);
  border-radius: var(--radius-lg);
  box-shadow:
    0 20px 40px var(--app-shadow-lg),
    0 8px 16px var(--app-shadow-md);
  margin: var(--space-4);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: dialog-slide-up var(--duration-base) var(--ease-out);
}

.dialog-primitive__panel:focus {
  outline: none;
}

/* Size variants */
.dialog-primitive--sm {
  width: 100%;
  max-width: 24rem;
}
.dialog-primitive--md {
  width: 100%;
  max-width: 32rem;
}
.dialog-primitive--lg {
  width: 100%;
  max-width: 42rem;
}
.dialog-primitive--full {
  width: 100%;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem);
}

.dialog-primitive__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--app-border-subtle);
  flex-shrink: 0;
}

.dialog-primitive__title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-snug);
  letter-spacing: var(--tracking-tight);
  color: var(--app-text-primary);
  margin: 0;
}

.dialog-primitive__description {
  font-size: var(--text-sm);
  color: var(--app-text-muted);
  margin: var(--space-1) 0 0;
}

.dialog-primitive__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--app-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--duration-base) var(--ease-default);
}

.dialog-primitive__close:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-primary);
}

.dialog-primitive__close:focus-visible {
  outline: 2px solid var(--app-accent-solid);
  outline-offset: 2px;
}

.dialog-primitive__body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

.dialog-primitive__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--app-border-subtle);
  flex-shrink: 0;
}

@keyframes dialog-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialog-slide-up {
  from {
    opacity: 0;
    transform: translateY(0.5rem) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-primitive__overlay,
  .dialog-primitive__panel {
    animation: none;
  }
}
```

**Step 2: Delete the old primitives.css**

At this point all styles from `primitives.css` have been migrated. Delete it.

Note: `primitives.css` was already removed from the import chain in Task 6 (it's no longer in `styles/index.css`). Deleting the file makes the removal permanent.

```bash
git rm src/styles/primitives.css
```

**Step 3: Verify all tests pass**

```bash
npm run build:web && npm run type-check && npm run lint && npm run test:run && npm run test:a11y
```

Expected: all pass. The `test:a11y` run is important here — it checks contrast ratios on rendered components.

**Step 4: Commit**

```bash
git add src/styles/primitives/dialog.css
git commit -m "feat(theme): migrate dialog primitive to modular CSS, delete primitives.css"
```

---

## Phase 3 — Modules

**Context:** Each module file migrates styles from the now-deleted `src/styles/home-screen.css` or the inline styles in `app.css`. Reference git history as needed: `git show HEAD~N:src/styles/home-screen.css`.

The toolbar, sidebar, canvas, and monitor module files are net-new — their styles currently live in `app.css` and in inline styles within components. Check `src/styles/app.css` for toolbar/sidebar classes, and grep for inline `style={}` props in the relevant components.

**Grep commands to find inline styles by module:**

```bash
# Toolbar
grep -n "style={" src/components/Toolbar.tsx

# Sidebar
grep -rn "style={" src/components/Sidebar* 2>/dev/null || echo "no dedicated sidebar component"

# Monitor
grep -n "style={" src/components/Managers/

# Canvas chrome (not Konva — CSS-rendered canvas UI)
grep -rn "className.*canvas\|className.*minimap" src/components/Canvas/
```

---

### Task 11: modules/home-screen.css

**Files:**

- Modify: `src/styles/modules/home-screen.css`
- Delete: `src/styles/home-screen.css` (original)

**Step 1:** Reference the original: `git show HEAD~1:src/styles/home-screen.css` (or whichever commit deleted it — check `git log --oneline -10`).

**Step 2:** Migrate all classes into `src/styles/modules/home-screen.css`. Update:

- Background colors → `var(--app-bg-base)`, `var(--app-bg-surface)`, etc.
- Hero heading → add `font-family: var(--font-display); letter-spacing: var(--tracking-tight);`
- Section labels → `font-family: var(--font-body); font-size: var(--text-xs); font-weight: var(--weight-semibold); text-transform: uppercase; letter-spacing: var(--tracking-wide);`
- Gradient backgrounds → keep SVG/radial gradients but reference `var(--app-accent-bg)` for brass tint

**Step 3:** Delete the original: `git rm src/styles/home-screen.css`

**Step 4:**

```bash
npm run build:web && npm run lint
git add src/styles/modules/home-screen.css
git commit -m "feat(theme): migrate home-screen to modular CSS"
```

---

### Task 12: modules/toolbar.css

**Files:**

- Modify: `src/styles/modules/toolbar.css`

**Step 1:** Find toolbar styles in `app.css` (`.toolbar`, `.btn-tool`, `.btn-mode`, `.btn-broadcast`, `.toolbar-divider`).

**Step 2:** Move them into `modules/toolbar.css`. Add toolbar token declarations to `color-parchment.css` and `color-leather.css` — the toolbar in parchment light mode should use a warm dark leather surface (the toolbar is always dark regardless of app theme):

In `color-parchment.css`, add under the existing tokens:

```css
/* Toolbar — always dark leather even in light mode */
--app-toolbar-bg: #1a1008;
--app-toolbar-border: #4a3020;
--app-toolbar-button-bg: #2e1e0e;
--app-toolbar-button-text: #ede0c4;
--app-toolbar-button-border: #4a3020;
--app-toolbar-button-hover: #3a2718;
--app-toolbar-button-border-hover: #5e3c24;
```

In `color-leather.css`, add (identical — toolbar is always dark):

```css
--app-toolbar-bg: #1a1008;
--app-toolbar-border: #4a3020;
--app-toolbar-button-bg: #2e1e0e;
--app-toolbar-button-text: #ede0c4;
--app-toolbar-button-border: #4a3020;
--app-toolbar-button-hover: #3a2718;
--app-toolbar-button-border-hover: #5e3c24;
```

**Step 3:** Remove the toolbar classes from `app.css` (they now live in `modules/toolbar.css`).

**Step 4:**

```bash
npm run build:web && npm run lint
git add src/styles/modules/toolbar.css src/styles/tokens/color-parchment.css \
        src/styles/tokens/color-leather.css src/styles/app.css
git commit -m "feat(theme): migrate toolbar to modular CSS, add leather toolbar tokens"
```

---

### Task 13: modules/sidebar.css

**Files:**

- Modify: `src/styles/modules/sidebar.css`

**Step 1:** Find sidebar classes — grep `app.css` for `.sidebar`, `.sidebar-input`, `.sidebar-token`, `.info-box`.

**Step 2:** Move them into `modules/sidebar.css`, updating spacing to `var(--space-*)` tokens and colors to `var(--app-*)` tokens.

**Step 3:** Remove migrated classes from `app.css`.

**Step 4:**

```bash
npm run build:web && npm run lint
git add src/styles/modules/sidebar.css src/styles/app.css
git commit -m "feat(theme): migrate sidebar to modular CSS"
```

---

### Task 14: modules/canvas.css

**Files:**

- Modify: `src/styles/modules/canvas.css`

**Step 1:** Find canvas-related CSS classes (non-Konva) — the CSS wrapper around the Konva stage, minimap container, measurement overlay.

```bash
grep -rn "className" src/components/Canvas/CanvasManager.tsx | grep -v "//\|Konva" | head -40
```

**Step 2:** Create CSS classes in `modules/canvas.css` for any canvas wrapper elements that need themed styling. These are the HTML containers, not the Konva canvas itself.

**Step 3:**

```bash
npm run build:web && npm run lint
git add src/styles/modules/canvas.css
git commit -m "feat(theme): add canvas module CSS for themed HTML wrappers"
```

---

### Task 15: modules/monitor.css

**Files:**

- Modify: `src/styles/modules/monitor.css`

**Step 1:** Find monitor token declarations in `color-parchment.css` (the `--app-monitor-*` tokens were defined in old theme.css, not yet in new token files). Add them:

In `color-parchment.css`:

```css
/* Resource Monitor (dev tool — always dark panel) */
--app-monitor-bg: rgba(26, 16, 8, 0.9);
--app-monitor-text: #ede0c4;
--app-monitor-border: rgba(237, 224, 196, 0.12);
--app-monitor-divider: rgba(237, 224, 196, 0.2);
--app-monitor-bar-bg: rgba(237, 224, 196, 0.15);
--app-monitor-fps-good: #30a46c;
--app-monitor-fps-medium: #ffc53d;
--app-monitor-fps-low: #e5484d;
--app-monitor-memory-ok: #30a46c;
--app-monitor-memory-high: #e5484d;
--app-monitor-warning-bg: rgba(255, 197, 61, 0.15);
--app-monitor-warning-accent: #ffc53d;
--app-monitor-muted: #9a7e5c;
```

**Step 2:** Find monitor styles in app.css or component files, migrate to `modules/monitor.css`.

**Step 3:**

```bash
npm run build:web && npm run type-check && npm run lint && npm run test:run && npm run test:a11y
git add src/styles/modules/monitor.css src/styles/tokens/color-parchment.css
git commit -m "feat(theme): migrate monitor to modular CSS, add monitor tokens"
```

---

## Phase 4 — Konva Canvas Colors

**Context:** Konva renders to `<canvas>` — CSS custom properties don't work. Colors in Konva components are hardcoded as `*_COLORS` const objects at the top of each file, with JSDoc comments referencing the CSS token they mirror. These need to be updated to match the new parchment/leather palette.

### Task 16: Update \*\_COLORS consts in Canvas component files

**Files:** All Canvas component files that define `*_COLORS` consts.

**Step 1: Find all \*\_COLORS consts**

```bash
grep -rn "_COLORS\s*=" src/components/Canvas/ --include="*.tsx" --include="*.ts"
```

**Step 2:** For each const found, update the color values to match the new parchment theme. Reference the token values from `color-parchment.css` for the light-mode defaults.

Key mappings:

- Fog of war: `rgba(0,0,0,0.94)` — unchanged, functional
- Selection stroke: change from `#2563eb` (blue) → `#8c6914` (brass)
- Snap stroke: `rgba(37,99,235,0.6)` → `rgba(140,105,20,0.55)`
- Minimap viewport stroke: `#3b82f6` → `#8c6914`
- Wall stroke: `#000000` → `#1c1007` (warm dark ink)
- Door fill: `#ffffff` → `#f7edda` (parchment)
- Door stroke: `#000000` → `#1c1007`
- Stairs arrow up: `#4a90e2` → `#8c6914` (brass)
- Token PC on minimap: `#22c55e` — keep (functional identity color)

**Step 3:** For each file modified:

```bash
npm run test:run   # vision.ts tests must stay green
npm run build:web
```

**Step 4: Commit**

```bash
git add src/components/Canvas/
git commit -m "feat(theme): update Konva *_COLORS consts to parchment/brass palette"
```

---

## Final Verification

After all phases:

```bash
npm run build:web     # zero errors
npm run type-check    # zero errors
npm run lint          # zero warnings
npm run test:run      # all pass (vision.ts 100% coverage preserved)
npm run test:a11y     # all contrast ratios AA compliant
npm run dev           # visual inspection: light mode parchment, dark mode leather
```

Check visually:

- Light mode: warm cream backgrounds, dark ink text, brass accent buttons
- Dark mode: oiled leather backgrounds, warm cream text, polished brass accents
- Paper grain visible but not distracting
- Panel top-edge highlights visible on cards and dialogs
- Toolbar always shows leather dark surface regardless of mode
- Cormorant Garamond appears on dialog titles and home screen hero
- DM Sans on all UI labels, buttons, body text
- JetBrains Mono on grid size, coordinate values, vision radius numbers
