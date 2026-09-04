# Plan 001: Make the styling layer have exactly one source of truth

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- src/index.css src/App.css src/styles/ tailwind.config.js postcss.config.js src/App.tsx`
> If any of these files have changed since `d3d3642`, re-read them and confirm the
> "Current state" excerpts below still match. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Grounded at**: `d3d3642` (2026-09-04) — "Session Console: party plates + YouTube/local ambience (#259)"

## Why this matters

Graphium's UI styling currently runs through four competing systems at once:
semantic CSS variables (`src/styles/theme.css`), hand-rolled utility classes
(`src/styles/app.css`), Tailwind utility classes, and 286 inline `style={{}}`
objects spread across 41 files. They disagree with each other, and one of them is
silently not running at all — Tailwind v4 is installed but is being fed a v3-style
config file it never reads, so the `slide-down` keyframe that `Toast.tsx` depends on
is almost certainly dead in the shipped app.

Nothing else in this program is safe until this is fixed. Every later plan
(the primitive layer, the dialog migration, the visual redesign) assumes that
setting a design token in one place changes the UI everywhere. Right now it
doesn't, and an executor building new components on this foundation would be
building on sand. This plan is deliberately small, self-contained, and shippable
on its own: it changes no component markup and no user-visible layout, it just
makes the styling layer honest.

## Context the executor needs

Graphium is a local-first Electron virtual-tabletop app (React 18 + Vite 6 +
TypeScript + Zustand + Konva). It has a **dual-window architecture**: an
"Architect View" (the DM's full control panel) and a "World View" (a sanitized,
canvas-only window projected to players). Any styling change must not leak DM
chrome into the World View. See `src/App.tsx` for how the two views branch.

The repo enforces strict linting and type checking via ESLint + Husky pre-commit
hooks. `.ai-rules.md` at the repo root defines mandatory code-generation rules
(no `any`, enforced import ordering, complexity limits). Follow them.

### Current state — the four systems

**1. `src/styles/theme.css`** — the good one. Defines semantic CSS variables
(`--app-bg-surface`, `--app-text-primary`, `--app-accent-solid`, …) built on
Radix Colors scales, with `[data-theme='light']` / `[data-theme='dark']` blocks.
Its own header comment states the rule: *"NEVER use raw Radix scale names directly
in components"* and *"Always use these semantic variables. Never hardcode hex values."*
This file is the intended source of truth. Keep it.

**2. `src/styles/app.css`** — hand-rolled utility classes (`.btn`, `.btn-tool`,
`.sidebar`, `.toolbar`) that *mostly* consume the theme variables but violate the
rule in several places. At `src/styles/app.css:15`:

```css
.toolbar {
  background: #000000;
  border: 2px solid rgb(82, 82, 82); /* neutral-600 */
}
```

`.btn-tool` (same file) likewise hardcodes `rgb(64,64,64)`, `rgb(229,229,229)`,
`rgb(82,82,82)`, `rgb(115,115,115)`. These are theme-invariant: the main toolbar
is pure black in light mode.

**3. Tailwind utilities**, applied directly in TSX. At `src/App.tsx:556` the main
toolbar carries *both* systems, saying the same thing twice:

```tsx
<div className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-2xl flex items-center gap-2 z-50 bg-black border-2 border-neutral-600">
```

**4. Inline `style={{}}` objects** — 286 of them across 41 files. Hotspots:
`PreferencesDialog.tsx` (45), `AboutModal.tsx` (40), `ResourceMonitor.tsx` (22),
`UpdateManager.tsx` (21), `TokenInspector.tsx` (19). Most read theme variables
correctly (`backgroundColor: 'var(--app-bg-surface)'`), so they are not *wrong* —
they are just un-reusable and invisible to any future variant system. **This plan
does not migrate them.** They are addressed in plan 004 as each component moves.

### Current state — the Tailwind v4 / v3 config mismatch

`src/index.css:1` is Tailwind v4 syntax:

```css
@import 'tailwindcss';
```

`package.json` has `tailwindcss ^4.1.18` and `@tailwindcss/postcss ^4.1.18`, and
`postcss.config.js` uses the v4 plugin. But `tailwind.config.js` is a **v3-style
JS config**:

```js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { animation: { 'slide-down': 'slideDown 0.3s ease-out' },
    keyframes: { slideDown: { /* … */ } } } },
  plugins: [],
};
```

Tailwind v4 does **not** auto-load `tailwind.config.js`. It requires an explicit
`@config` directive in the CSS entrypoint. There is no `@config`, `@theme`, or
`@plugin` directive anywhere in `src/index.css` or `src/styles/*.css` (verified by
grep at `d3d3642`).

Consequence: the `animate-slide-down` class is consumed at
`src/components/Toast.tsx:82` and
`src/components/DesignSystemPlayground/DesignSystemPlayground.tsx:357`, but the
utility that backs it is very likely never generated. **Step 1 verifies this
empirically before anything is changed** — do not assume it, prove it.

`autoprefixer` is also still in `postcss.config.js`. Tailwind v4 handles vendor
prefixing internally via Lightning CSS; running autoprefixer after it is redundant.

### Current state — the universal transition

`src/styles/theme.css:291`:

```css
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 0.2s;
  transition-timing-function: ease;
}
```

This attaches a five-property transition to **every element in the document**. In a
canvas application with a large DOM (sidebar, token library, session console,
toolbars) this inflates style recalculation on any class or attribute change, not
just theme switches. Its actual purpose is narrow: to make light/dark theme
switching smooth. It should be scoped to that.

Note the guards that already exist immediately below it and must be preserved:
`.theme-loading * { transition: none !important; }` (prevents animation on initial
render) and a `@media (prefers-reduced-motion: reduce)` block that kills all
transitions and animations — the E2E accessibility suite depends on the latter for
stable screenshots.

### Current state — dead file

`src/App.css` is leftover Vite scaffolding (`.logo`, `logo-spin`, `.read-the-docs`,
and a `#root { max-width: 1280px; padding: 2rem; text-align: center; }` rule that
would break the full-viewport layout if it were ever loaded). Verified: it is
imported by nothing in `src/` or `index.html`. It is dead weight and an active
trap for anyone who imports it by autocomplete.

## Inputs & resources

Run `npm install` first — the repo has no `node_modules` checked in.

| Purpose            | Command                  | Expected on success              |
|--------------------|--------------------------|----------------------------------|
| Install deps       | `npm install`            | exit 0                           |
| Lint               | `npm run lint`           | exit 0, zero warnings            |
| Typecheck          | `npm run type-check`     | exit 0                           |
| Unit tests         | `npm run test:run`       | all pass                         |
| Web build          | `npm run build:web`      | exit 0, writes `dist-web/`       |
| A11y E2E           | `npm run test:a11y`      | all pass                         |
| Full E2E           | `npm run test:e2e`       | all pass                         |
| Dev server         | `npm run dev`            | app launches                     |

## Scope

**In scope** (the only things you may change):
- `tailwind.config.js` — delete, after migrating its content to CSS
- `src/index.css` — add v4 `@theme` block
- `postcss.config.js` — drop redundant autoprefixer
- `package.json` — drop the `autoprefixer` devDependency
- `src/App.css` — delete (dead file)
- `src/styles/theme.css` — scope the universal transition
- `src/styles/app.css` — replace hardcoded colors with theme variables
- `src/App.tsx` — remove only the duplicated Tailwind color classes on the toolbar div at line 556

**Out of scope** (do NOT touch, even though they look related):
- **The 286 inline `style={{}}` objects.** They mostly read theme variables and are
  functionally correct. Migrating them is plan 004's job, done per-component as each
  moves to the primitive layer. Touching them here turns a small safe change into a
  huge risky one.
- **Any component's markup, layout, or behavior**, beyond the single className edit
  at `src/App.tsx:556`. This plan must be visually neutral except for the toolbar
  now respecting light theme.
- **`src/components/Canvas/**`** — Konva canvas rendering does not use CSS theming.
  Do not touch it.
- **Adding shadcn, Radix Primitives, CVA, `cn()`, or `components.json`.** That is
  plan 003. Adding it here couples a low-risk cleanup to a high-risk dependency change.
- **The Radix Colors imports** at the top of `theme.css`. They work; leave them.

## Working approach

Branch: `claude/ui-redesign-plan-xnyz33`. Commit each step separately with a
descriptive message so any single step can be reverted independently. Do not open
a pull request unless explicitly asked.

## Steps

### Step 1: Prove or disprove that the Tailwind config is being ignored

Do not change anything yet. Build the app and inspect the generated CSS for the
`animate-slide-down` utility.

```bash
npm install
npm run build:web
grep -r "slide-down\|slideDown" dist-web/assets/*.css
```

**Check**: Record the result verbatim in your report.
- **No match** → the config is being ignored, as this plan predicts. Continue to Step 2.
- **Match found** → the config *is* somehow being loaded. **STOP and report.** The
  premise of Steps 2–3 is wrong and the plan needs revising before you proceed.

### Step 2: Move the Tailwind theme extension into the v4 CSS config

Tailwind v4 configures through CSS, not JS. Add a `@theme` block to `src/index.css`
directly after the `@import 'tailwindcss';` line and before the other `@import`
statements, expressing the same animation the JS config intended:

```css
@import 'tailwindcss';

@theme {
  --animate-slide-down: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  0% {
    transform: translate(-50%, -100%);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

@import './styles/fonts.css';
@import './styles/theme.css';
@import './styles/app.css';
```

Note: in Tailwind v4 a `--animate-*` theme variable generates the corresponding
`animate-*` utility, so `--animate-slide-down` produces `animate-slide-down` — the
exact class name already used at `Toast.tsx:82`. No component change is needed.

CSS requires `@import` rules to precede other rules. If the bundler or Lightning
CSS rejects the ordering above, move all four `@import` lines to the top and place
the `@theme` and `@keyframes` blocks after them.

Then delete `tailwind.config.js`. Tailwind v4 discovers content by automatic source
detection from the CSS entrypoint, so the `content` array is no longer needed.

**Check**:
```bash
npm run build:web
grep -r "slide-down" dist-web/assets/*.css
```
Must now return at least one match. Then `npm run dev`, trigger any toast (e.g.
save a campaign with `Cmd+S`), and confirm the toast visibly slides down from the
top rather than appearing instantly.

### Step 3: Remove the redundant autoprefixer

Tailwind v4 handles vendor prefixing via Lightning CSS. Edit `postcss.config.js` to:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

Then remove `autoprefixer` from `devDependencies` in `package.json` and run
`npm install` to update the lockfile.

**Check**: `npm run build:web` exits 0. Diff the generated CSS against the Step 2
output — it should differ only in vendor-prefix noise, not in any utility class
being absent:
```bash
npm run build:web && grep -c "" dist-web/assets/*.css
```
Then `npm run test:a11y` passes (this catches any prefix regression that would
affect rendered contrast).

### Step 4: Delete the dead `src/App.css`

Confirm it is still unreferenced, then remove it:

```bash
grep -rn "App.css" src/ index.html electron/ ; echo "exit: $?"
git rm src/App.css
```

**Check**: The grep returns no matches (exit 1) before deletion. After deletion,
`npm run build:web` exits 0 and `npm run type-check` exits 0.

### Step 5: Scope the universal transition to theme switching only

In `src/styles/theme.css`, replace the `* { … }` block at line 291 with a
transition that applies only while a theme change is in flight, driven by a class
on the root element.

Replace:

```css
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 0.2s;
  transition-timing-function: ease;
}
```

with:

```css
/* Theme-change transition: applied only while `.theme-transitioning` is present
   on <html>, so the cost is paid during a theme switch rather than on every
   style recalculation in the app. See ThemeManager.tsx. */
.theme-transitioning * {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 0.2s;
  transition-timing-function: ease;
}
```

Leave the `.theme-loading * { transition: none !important; }` rule and the
`@media (prefers-reduced-motion: reduce)` block exactly as they are.

Then update `src/components/ThemeManager.tsx` to add `theme-transitioning` to
`document.documentElement` when the resolved theme changes and remove it after
250ms (a little longer than the 200ms transition). Read the existing file first
and match its established patterns — it already manipulates `data-theme` on the
root element, so add to that mechanism rather than inventing a parallel one. Clear
any pending timeout on unmount and on re-entry so rapid theme toggling cannot leak
a timer or strand the class.

**Check**:
```bash
npm run lint && npm run type-check && npm run test:run
```
All exit 0. Then `npm run dev` and toggle the theme (light ↔ dark) in
Preferences: the transition must still be visibly smooth. Then confirm the class
does not persist — with DevTools open, toggle the theme and verify
`document.documentElement.className` no longer contains `theme-transitioning`
one second later.

### Step 6: Replace the hardcoded colors in `app.css` with theme variables

In `src/styles/app.css`, replace every literal color with the semantic variable
that matches its role. Specifically:

- `.toolbar` — `background: #000000` → `var(--app-bg-surface)`;
  `border: 2px solid rgb(82, 82, 82)` → `2px solid var(--app-border-default)`
- `.btn-tool` — `background: rgb(64,64,64)` → `var(--app-bg-active)`;
  `color: rgb(229,229,229)` → `var(--app-text-primary)`;
  `border: 1px solid rgb(82,82,82)` → `1px solid var(--app-border-default)`
- `.btn-tool:hover` — `background: rgb(82,82,82)` → `var(--app-bg-hover)`;
  `border-color: rgb(115,115,115)` → `var(--app-border-hover)`
- `.btn-broadcast.active` — `color: white` → `var(--app-accent-solid-text)`

Then scan the rest of the file and apply the same substitution to any remaining
hex or `rgb()` literal. After this, `src/styles/app.css` must contain zero literal
color values.

**Check**:
```bash
grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|\bwhite\b|\bblack\b" src/styles/app.css
```
Must return no matches. Then `npm run test:a11y` passes in **both** themes — this
is the gate that proves the substituted variables still meet WCAG AA contrast.
The suite covers light and dark separately (`tests/accessibility.spec.ts:47` and
`:81`); both must pass.

### Step 7: Remove the duplicated Tailwind classes from the toolbar

At `src/App.tsx:556`, the toolbar div declares its background and border twice.
Now that `.toolbar` is theme-aware, the Tailwind color classes actively fight it.
Remove **only** `bg-black`, `border-2`, and `border-neutral-600`, keeping every
layout and positioning class:

```tsx
<div className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-2xl flex items-center gap-2 z-50">
```

Do not change anything else in `App.tsx`.

**Check**: `npm run lint && npm run type-check && npm run test:run` all exit 0.
Then `npm run dev`: in **dark** theme the toolbar looks essentially as it did
before; in **light** theme the toolbar now uses a light surface with a visible
border instead of being a black slab. Confirm the tool buttons inside it remain
legible in both themes (this is the one intentional visual change in this plan).

### Step 8: Full verification and commit

```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web
npm run test:a11y
npm run test:e2e
```

**Check**: Every command exits 0. If `test:e2e` fails, capture which spec and
assertion failed before doing anything else — E2E selectors here are
`data-testid`-based and this plan changes no testids, so an E2E failure means
something unexpected happened and is worth reporting rather than patching around.

## Validation plan

- **Automated**: the full command sequence in Step 8. The accessibility suite
  (`tests/accessibility.spec.ts`) is the most important gate, because Step 6
  substitutes color values and that suite runs axe-core with
  `['wcag2a','wcag2aa','wcag21a','wcag21aa']` against both themes.
- **Manual, in `npm run dev`**, confirming this plan is visually neutral apart from
  the intended toolbar fix:
  1. Toast slides down (Step 2 regression fix).
  2. Theme toggle is still smooth (Step 5).
  3. Toolbar is legible in light *and* dark (Steps 6–7).
  4. Open the World View (player window) and confirm it is unchanged and still
     contains no DM chrome.
  5. Visit `/design-system` and confirm the playground still renders.
- **No new tests are required.** This plan changes styling infrastructure, not
  behavior; the existing suites are the correct gate.

## Done criteria

- [ ] `grep -r "slide-down" dist-web/assets/*.css` returns a match after `npm run build:web`
- [ ] `tailwind.config.js` no longer exists; `src/index.css` carries a `@theme` block
- [ ] `src/App.css` no longer exists
- [ ] `autoprefixer` is absent from `package.json` and `postcss.config.js`
- [ ] `grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|\bwhite\b|\bblack\b" src/styles/app.css` returns nothing
- [ ] `src/styles/theme.css` has no bare `* { transition… }` rule; it is scoped to `.theme-transitioning`
- [ ] `npm run lint`, `npm run type-check`, `npm run test:run`, `npm run build:web`, `npm run test:a11y`, `npm run test:e2e` all exit 0
- [ ] Toolbar is legible in both light and dark theme (confirmed by Kyle or a reviewer)
- [ ] No files outside the in-scope list were changed (`git diff --stat` confirms)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Step 1 finds `slide-down` already in the built CSS.** The plan's core premise
  is wrong; Steps 2–3 need rethinking before you touch anything.
- **`npm run test:a11y` fails after Step 6.** A semantic variable substitution has
  broken WCAG AA contrast. Report the exact axe violation and the element. Do not
  "fix" it by reintroducing a hardcoded color — that recreates the problem this
  plan exists to solve.
- **Any E2E spec fails.** This plan changes no `data-testid` values and no component
  behavior, so an E2E failure means an unmodelled coupling exists. Report it.
- **Removing the universal transition in Step 5 visibly breaks an animation
  somewhere other than theme switching.** That means some component was relying on
  the global rule. Report which one; do not revert the whole step.
- **You find yourself needing to edit a component's inline `style={{}}` objects**
  to complete any step. That is out of scope and signals the step has grown.
- **`npm install` fails or the lockfile churns beyond the autoprefixer removal.**

## Handoff / after it lands

- **Plan 003 depends on this.** The primitive layer's `@theme` tokens and CVA
  variants both assume the v4 CSS config from Step 2 exists and works.
- **What a reviewer should scrutinize most**: Step 6. Substituting a semantic
  variable for a hardcoded color is where an accessibility regression would hide,
  and the `.toolbar` change is the one place users will notice a difference.
- **Deliberately deferred**: the 286 inline `style={{}}` objects. They are not
  wrong, just un-reusable, and they get resolved for free as each component moves
  to the primitive layer in plan 004. Attacking them as a standalone sweep would be
  a large, risky, low-value diff.
- **Watch for**: `.theme-transitioning` becoming a dumping ground. It exists for
  theme switching only. If a future component wants a transition, it should declare
  its own, not rely on the global.
