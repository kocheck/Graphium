# Plan 001: Make the styling layer have exactly one source of truth

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- src/index.css src/App.css src/styles/ tailwind.config.js postcss.config.js src/App.tsx src/components/ThemeManager.tsx src/components/Toast.tsx package.json`
> (Ignore commits this plan itself made — compare against the state at the step you are on, not blindly against `d3d3642`.)
> If any of these files have changed since `d3d3642`, re-read them and confirm the
> "Current state" excerpts below still match. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/000-repair-verification-infrastructure.md
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
on its own.

**It is not, however, visually neutral, and two changes need calling out up front:**

1. **Step 5 makes ~32 hover states snap instead of fade.** The universal `*` rule is
   the *only* transition source for them: 90 `className` strings in `src/` contain a
   `hover:` utility and only 58 of those also carry a `transition` utility, plus the
   `:hover` rules in `app.css` declare none of their own. Scoping the rule to theme
   switching is correct, but it is a real, user-visible behaviour change across the app.
2. **Step 8 fixes a live bug: the pause button.** It carries `.btn-tool` *and*
   `bg-red-500`/`bg-green-500`, and because `app.css` is imported unlayered it beats
   Tailwind's `@layer utilities` — so the DM's pause control has never shown whether the
   game is paused. It will be red/green after this plan.
3. **Step 2 turns on an animation that has never run.** `animate-slide-down` is also
   used at `DesignSystemPlayground.tsx:357` on a *non-centred* collapsible panel, and
   the keyframe animates `translate(-50%, -100%) → translate(-50%, 0)`. Making the
   utility real will make that panel slide in from 50% to the left. See Step 2's Check.

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
| Install browsers   | `npx playwright install chromium` | exit 0 — `npm install` does not fetch them |
| Lint               | `npm run lint`           | exit 0, zero warnings            |
| Typecheck          | `npm run type-check`     | exit 0                           |
| Unit tests         | `npm run test:run`       | all pass                         |
| Web build          | `npm run build:web`      | exit 0, writes `dist-web/`       |
| A11y E2E           | `npm run test:a11y`      | all pass                         |
| Web E2E        | `npm run build:web && npx playwright test --project=Web-Chromium` | all pass |
| Electron E2E   | `npm run build:electron && npx playwright test --project=Electron-App` | all pass — **never run bare `npm run test:e2e`**; it launches the Electron project without building it |
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
- `src/components/ThemeManager.tsx` — add the `theme-transitioning` class (Step 5)
- `src/styles/theme.css` — **new `--app-*` tokens only** (Steps 6 and 8). You may add
  tokens; you may not change an existing colour value. Palette changes are plan 006's.
- `package-lock.json` — regenerated by the `autoprefixer` removal (Step 3)
- `plans/README.md` — the status row for this plan

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

Branch off `main` as `plan/001-styling-foundation`. Commit each step separately with a
descriptive message so any single step can be reverted independently.

### How this plan lands: one PR per plan, targeting `main`

**This is the program-wide rule; it is identical in every plan.** Each plan is
developed on its own branch off `main` and merged as a **single pull request into
`main`** before the next plan begins.

That choice exists for one reason: **it is the only way CI runs.** Verified in
`.github/workflows/`:

| Workflow | Trigger | What it gates |
|---|---|---|
| `lint.yml` | `pull_request` → `main` | ESLint + `tsc` |
| `test.yml` | `pull_request` → `main` | Vitest |
| `e2e.yml` | `pull_request` → `main` | Playwright, **per project, after the matching build** |
| `accessibility.yml` | `pull_request` → `main` or `NEXT` | axe WCAG AA |
| `documentation-check*.yml` | `pull_request` → `main` | doc-drift comment |

Nothing fires on a long-lived feature branch. Under the original "one branch, don't
open a PR" approach, ~40 commits of work would have been gated only by local
`npm run` on one machine — which is how the unverified-gate problem this program was
revised to fix got in.

**Consequences to know before you start:**

- **`e2e.yml` is the reference for how to run Playwright** — it runs
  `--project=Web-Chromium` after `npm run build:web` and `--project=Electron-App` under
  `xvfb-run` after `npm run build:electron`. Never bare `npm run test:e2e`.
- **Merging to `main` auto-deploys the public web build.** `deploy-web.yml` runs on
  every push to `main`. Intermediate states of the migration will go live on GitHub
  Pages. That is consistent with the strangler-fig principle that every commit is
  releasable, but it is a real consequence — if the web demo must stay pinned, say so
  before starting rather than after.
- **Local gates still come first.** CI is the enforcement, not the discovery. Run the
  full local gate before every push; a red PR costs a cycle and reviewer trust.
- **Keep the PR reviewable.** Push each step as its own commit with a descriptive
  message so a reviewer can read the plan's steps in the commit history. If a plan's PR
  grows past roughly 1,500 changed lines, split it at a step boundary named in the plan
  and land the halves in order.
- **`build-release.yml` fires on `v*.*.*` tags only** — nothing here triggers a release.
  Versioning and `CHANGELOG.md` entries are a separate decision, noted in
  `plans/README.md`.


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

Tailwind v4 configures through CSS, not JS.

> **Do not paste the block below over the whole file.** `src/index.css` also contains
> `html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden }` and
> `#root { width:100%; height:100% }` after the imports. Deleting those breaks the
> full-viewport layout — the exact failure this plan cites as the reason `App.css` is
> dangerous. Keep everything below the imports untouched.

Add a `@theme` block to `src/index.css`, expressing the same animation the JS config
intended. **`@import` rules must come first** — write it in this order:

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

**Do not "try it and see whether the bundler rejects it."** A misplaced `@import` may
be silently dropped rather than erroring, which would make `theme.css` and `app.css`
never load — and no other check in this plan would catch that. Always put all four
`@import` lines first, then the `@theme` and `@keyframes` blocks.

Confirm the imports actually resolved: after `npm run build:web`, the built CSS must
contain `--app-bg-surface` (proving `theme.css` loaded) and `.toolbar` (proving
`app.css` loaded). If either is absent, STOP and report.

Then delete `tailwind.config.js`. Tailwind v4 discovers content by automatic source
detection from the CSS entrypoint, so the `content` array is no longer needed.

**Check**:
```bash
npm run build:web
grep -oE '\.animate-slide-down\{[^}]*\}' dist-web/assets/*.css
grep -c -- '--app-bg-surface' dist-web/assets/*.css
grep -c -- '\.toolbar' dist-web/assets/*.css
```
The first must return an actual CSS rule. A bare substring grep for `slide-down`
would also match the `--animate-slide-down` declaration and prove nothing. The other
two must be non-zero. Then `npm run dev`, trigger any toast (e.g.
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

**Check**: `emptyOutDir: true` destroys the previous build and asset filenames are
content-hashed, so **copy Step 2's CSS aside before rebuilding**:

```bash
cp dist-web/assets/*.css /tmp/before-autoprefixer.css   # BEFORE making the edit
# ...make the edit...
npm run build:web
grep -oE '\.animate-slide-down\{[^}]*\}' dist-web/assets/*.css   # still present
grep -c -- '--app-bg-surface' dist-web/assets/*.css                # still non-zero
```
(`grep -c ""` counts lines; on minified single-line CSS it tells you nothing.)
Then `npm run test:a11y` passes.

### Step 4: Delete the dead `src/App.css`

Confirm it is still unreferenced, then remove it:

```bash
grep -rn "App.css" src/ index.html electron/ && echo "FOUND CONSUMERS — STOP" || git rm src/App.css
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

Then update `src/components/ThemeManager.tsx` (`applyTheme`, around line 36) to add
`theme-transitioning` **to `document.documentElement`** — the same element that
carries `data-theme` at line 37, and the element the CSS comment above names.

> Note the file also puts a `theme-loading` **class** on `document.body` (lines 137,
> 143), as does `index.html:28`. Ignore that precedent: put this class on
> `documentElement` so the class and the attribute travel together, and so the
> Check below is meaningful.

**Ordering matters.** If you add the class and flip `data-theme` in the same tick,
there is no prior computed style carrying `transition-property`, so the browser
snaps rather than transitions. Add the class, then flip the attribute on the next
frame (`requestAnimationFrame`). Clear any pending removal timeout on unmount and on
re-entry so rapid toggling cannot leak a timer or strand the class.

**Two other call sites set `data-theme` directly and will not get the transition:**
`src/components/HomeScreen.tsx:366` and
`src/components/DesignSystemPlayground/playground-registry.tsx:705`. In the web build
`HomeScreen`'s toggle is the *primary* path — it sets the attribute in its own window
and broadcasts via `BroadcastChannel`, which does not deliver to the posting window,
so `ThemeManager.applyTheme` never runs for the user's own click. **Do not fix that
here** — `HomeScreen.tsx` is out of scope. Record it as a known gap; it is resolved
when `HomeScreen` migrates in plan 004.

**Check**:
```bash
npm run lint && npm run type-check && npm run test:run
```
All exit 0. Then `npm run dev` and toggle the theme.

> **`PreferencesDialog.tsx` has no theme control** — it contains zero occurrences of
> "theme". The toggle lives at `src/components/HomeScreen.tsx:673` (a "Click to cycle
> themes" button) and in the Electron **View → Theme** menu (`electron/main.ts:246`).
> Use the View menu, since that path goes through `ThemeManager`.

The transition must still be visibly smooth. Then confirm the class does not
persist — with DevTools open, toggle the theme and verify
`document.documentElement.className` no longer contains `theme-transitioning` one
second later.

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
- `.btn-broadcast.active` — `color: white` → **leave it as `white` for now.** Its
  background is `var(--app-success-solid)`, and there is no `--app-success-solid-text`
  token. Substituting `--app-accent-solid-text` would put the *accent* button's text
  token on a *success* button — same value today, wrong semantics, and exactly the
  drift this plan exists to stop. Adding the missing token is fine (`theme.css` is
  reachable via plan 000's token work); inventing a mapping is not. If you do add
  `--app-success-solid-text`, define it in `theme.css` under both themes and use it.

Then scan the rest of the file and apply the same substitution to any remaining
hex or `rgb()` literal.

> **Scope note:** this makes `app.css` clean, which is 165 lines. It does **not**
> touch the **396 hardcoded Tailwind palette classes** (`text-white`, `bg-neutral-800`,
> `border-neutral-600`, …) across 35 `.tsx` files, none of which have a `dark:`
> variant — there are zero `dark:` variants in the entire codebase. Those are the
> bulk of the real theme-invariance problem and they are resolved per-component in
> plan 004. Do not sweep them here.

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

> **This step is a visual no-op, and that is expected.** Tailwind v4 emits utilities
> inside `@layer utilities`; `src/index.css` imports `app.css` **unlayered**, and
> unlayered CSS beats any cascade layer regardless of specificity. So `.toolbar`
> already wins over `bg-black` / `border-neutral-600` — it did before Step 6 and it
> does after. The visual change to the toolbar is produced entirely by **Step 6**.
> This step removes dead, misleading markup. Do not go looking for a rendering
> difference caused by it; there won't be one.
>
> The same cascade rule has a live consequence: at `src/App.tsx:564-568` the **pause
> button** carries `.btn-tool` *and* `bg-red-500`/`bg-green-500`/`text-white`.
> `.btn-tool` wins, so **the pause button never shows its red/green state today.**
> That is a real, user-facing bug in a shipping app, and **Step 8 fixes it** — it is
> cheap here and plan 004 is XL and far out. Plan 004 is told to expect the button to
> already work.

Remove **only** `bg-black`, `border-2`, and `border-neutral-600`, keeping every
layout and positioning class:

```tsx
<div className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-2xl flex items-center gap-2 z-50">
```

Do not change anything else in `App.tsx`.

**Check**: `npm run lint && npm run type-check && npm run test:run` all exit 0.
Then `npm run dev` and confirm the rendering is **byte-for-byte what it was at the
end of Step 6** — this step changes no pixels (see the note above).

The visual change belongs to Step 6, and it is larger than "essentially the same":
in **dark** theme the toolbar goes from pure black `#000000` to
`var(--app-bg-surface)` = `#212225`, and `.btn-tool` from `rgb(64,64,64)` to
`var(--app-bg-active)` = `#2e3135`. In **light** theme it stops being a black slab
entirely. Confirm the tool buttons remain legible in both themes, and expect a
reviewer to notice the dark-mode shift — it is intended.

### Step 8: Fix the pause button

A live bug, fixed here because the cause is the cascade issue this plan exists to
untangle and the fix is four lines. The DM's pause control has never shown whether the
game is paused.

Add two state classes to `src/styles/app.css`, alongside the other `.btn-tool` rules so
they live in the same unlayered file and therefore win the same way:

```css
.btn-tool.is-paused {
  background: var(--app-error-solid);
  color: var(--app-error-solid-text);
  border-color: var(--app-error-solid);
}
.btn-tool.is-paused:hover {
  background: var(--app-error-solid-hover);
  border-color: var(--app-error-solid-hover);
}
.btn-tool.is-running {
  background: var(--app-success-solid);
  color: var(--app-success-solid-text);
  border-color: var(--app-success-solid);
}
.btn-tool.is-running:hover {
  background: var(--app-success-solid-hover);
  border-color: var(--app-success-solid-hover);
}
```

`--app-error-solid-text` and `--app-success-solid-text` do not exist yet. **Add them to
`src/styles/theme.css` under both themes** (`white` matches today's intent and the
existing `--app-accent-solid-text`). This also supplies the token Step 6 left open for
`.btn-broadcast.active` — go back and use it there rather than leaving a bare `white`.

Then at `src/App.tsx:564-568`, replace the Tailwind colour classes with the state class:

```tsx
className={`btn btn-tool flex items-center justify-center font-semibold ${
  isGamePaused ? 'is-paused' : 'is-running'
}`}
```

**Check**: `npm run dev`, enter the editor, and toggle pause. The button must now be
**red when paused and green when running**, in both themes, with a visible hover
change — it is grey in both states today. Confirm the icon still swaps
(`RiPlayFill`/`RiPauseFill`) and the `aria-label` still flips.

Then `npm run test:a11y`. The icon is a graphical object needing 3:1, not text needing
4.5:1, so white-on-`--app-error-solid` (~3.9:1) is compliant here — but if axe flags it,
report rather than reverting to grey; the palette decision belongs to plan 006.

### Step 9: Full verification and commit

```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web && npx playwright test --project=Web-Chromium
npm run build:electron && npx playwright test --project=Electron-App
npm run test:a11y
```

> **Do not run bare `npm run test:e2e`.** It runs both Playwright projects, and
> `Electron-App` launches the packaged main process (`dist-electron/main.js`), which
> does not exist until `npm run build:electron` has run. `.github/workflows/e2e.yml`
> never invokes it bare for this reason. A failure there is a missing build, not a
> coupling problem — and this plan's STOP conditions would misread it as one.

**Check**: Every command exits 0. If a spec fails, capture which spec and assertion
before doing anything else.

## Validation plan

- **Automated**: the full command sequence in Step 8. The accessibility suite is the
  most important gate for Step 6, because that step substitutes colour values.
  **This only holds if plan 000 has landed.** Before plan 000,
  `tests/accessibility.spec.ts` contains a single `page.goto(baseURL)` and scans the
  **home screen only** — it never enters the editor, so `.toolbar`, `.btn-tool` and
  `.btn-broadcast` (all editor-only, gated behind `viewState === 'EDITOR'` at
  `src/App.tsx:451`) are never in the DOM when axe runs. Every colour Step 6 changes
  would be invisible to it, and the gate would pass no matter what you did. Plan 000
  extends the suite to the editor, a dialog, `/design-system` and the World View;
  confirm that landed before trusting this step's Check.
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
- [ ] `npm run lint`, `npm run type-check`, `npm run test:run`, `npm run build:web`, `npm run test:a11y`, and both Playwright projects (`--project=Web-Chromium` after `build:web`, `--project=Electron-App` after `build:electron`) all exit 0
- [ ] Toolbar is legible in both light and dark theme (confirmed by Kyle or a reviewer)
- [ ] **The pause button shows red when paused and green when running**, in both themes
- [ ] `--app-error-solid-text` and `--app-success-solid-text` exist in `theme.css` under both themes, and `.btn-broadcast.active` uses the success one instead of a bare `white`
- [ ] The plan landed as a PR into `main` with all CI checks green
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
- **Any E2E spec fails after `npm run build:electron` has been run.** (A failure
  *without* that build is a missing artefact, not a finding — see Step 8.)
- **Plan 000 has not landed.** Check `tests/accessibility.spec.ts` for a scan of the
  editor route. If it still only visits `baseURL`, Step 6 has no working gate — STOP
  and report rather than proceeding on a check that cannot fail.
- **The built CSS is missing `--app-bg-surface` or `.toolbar`** after Step 2. The
  `@import`s were silently dropped and `theme.css`/`app.css` are not loading at all.
- **Removing `autoprefixer` churns the lockfile** beyond that one entry — this is
  *expected* (it drops `browserslist`, `caniuse-lite`, `fraction.js`,
  `normalize-range`, `postcss-value-parser`). Only stop if unrelated packages move.
- **Step 5 breaks something other than a hover fade.** The ~32 snapping hover states
  are *expected* and documented in "Why this matters" — do not stop for those. Stop
  if an actual animation (not a hover transition) breaks; report which, and do not
  revert the whole step.
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
