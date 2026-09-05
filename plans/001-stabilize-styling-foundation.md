# Plan 001: Make the styling layer have exactly one source of truth

> **Executor instructions**: Read `plans/CONVENTIONS.md` first. Run the pre-flight (§3), then
> the Drift check below. Follow the steps in order; each step's **Check** must hold before the
> next. If any **If it fails** or STOP condition fires, follow CONVENTIONS §10. Finish with the
> report in §11.

### Drift check

```bash
git fetch origin main
git diff --stat <grounded-at>..origin/main -- src/index.css src/App.css src/styles/ \
  tailwind.config.js postcss.config.js vite.config.ts package.json src/App.tsx \
  src/components/ThemeManager.tsx src/components/HomeScreen.tsx src/components/Toast.tsx \
  tests/ docs/features/theming.md docs/guides/CONVENTIONS.md \
  docs/architecture/ARCHITECTURE.md                                  # Expected: empty
```

**Citation re-check** (run each; the hit count must match):

| Anchor (grep)                                                       | File                              | Expected hits                      |
| ------------------------------------------------------------------- | --------------------------------- | ---------------------------------- |
| `grep -c "^@import 'tailwindcss';" src/index.css`                   | `src/index.css`                   | 1                                  |
| `grep -c '^@theme' src/index.css`                                   | `src/index.css`                   | 1 (0 at d3d3642; plan 000 adds it) |
| `grep -c 'rgb(' src/styles/app.css`                                 | `src/styles/app.css`              | 6                                  |
| `grep -c '#000000' src/styles/app.css`                              | `src/styles/app.css`              | 1                                  |
| `grep -c '^\* {' src/styles/theme.css`                              | `src/styles/theme.css`            | 1                                  |
| `grep -c '^  transition:$' src/styles/theme.css` (the `body` rule)  | `src/styles/theme.css`            | 1                                  |
| `grep -c 'bg-red-500' src/App.tsx`                                  | `src/App.tsx`                     | 1                                  |
| `grep -c 'bg-black' src/App.tsx`                                    | `src/App.tsx`                     | 1                                  |
| `grep -c "setAttribute('data-theme'" src/components/HomeScreen.tsx` | `src/components/HomeScreen.tsx`   | 1                                  |
| `grep -c '^function applyTheme' src/components/ThemeManager.tsx`    | `src/components/ThemeManager.tsx` | 1                                  |
| `grep -c 'animate-slide-down' src/components/Toast.tsx`             | `src/components/Toast.tsx`        | 1                                  |
| `test -f tailwind.config.js && test -f src/App.css; echo $?`        | repo root                         | prints `0`                         |
| `grep -rn 'App.css' src/ index.html electron/; echo $?`             | repo                              | prints `1` (no consumers)          |

If any row differs: STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/000-repair-verification-infrastructure.md
- **Category**: tech-debt
- **Requires**: `scripts/preflight.sh`; the `verify:static`, `verify:web`, `verify:electron`,
  `verify` and `shots` scripts in `package.json`; one `@theme` block in `src/index.css`
  (all from plan 000); `plans/002-shadcn-compatibility-spike.md`.
- **Grounded at**: ‹merge SHA of plan 000, written there by its final step› (citations verified
  at d3d3642)

## Why this matters

Graphium styles through four systems at once: semantic tokens (`src/styles/theme.css`),
hand-rolled classes (`src/styles/app.css`), Tailwind utilities in TSX, and 286 inline
`style={{}}` objects in 41 files. They disagree, and one of them is not running: Tailwind v4
is installed but `tailwind.config.js` is a v3 config that v4 never reads, so the
`animate-slide-down` utility `Toast.tsx` relies on is not generated. Every later plan assumes
that setting a token in one place changes the UI everywhere; today it does not. This plan is
small and ships on its own. It is not pixel-neutral: 32 `hover:` utilities lose their fade
(Step 5), the toolbar becomes theme-aware (Step 6), the toast animation starts working
(Step 2), and the pause button shows red/green for the first time (Step 8).

## Context the executor needs

Graphium is a local-first Electron virtual-tabletop app (React 18 + Vite 6 + TypeScript +
Zustand + Konva) with an Architect View and a World View (CONVENTIONS §1). `.ai-rules.md` is
mandatory reading before any `src/` change.

**The four systems, as they are today**

1. `src/styles/theme.css` defines `--app-*` tokens under `[data-theme='light']`
   (`grep -n "^\[data-theme='light'\]" src/styles/theme.css`, line 142) and
   `[data-theme='dark']` (line 211). A third `[data-theme='dark']` block at line 58 only
   copies the raw Radix dark scale; never edit that one. Its header says: never hardcode hex
   values. Keep this file as the source of truth.
2. `src/styles/app.css` (165 lines: `wc -l src/styles/app.css`) mostly consumes tokens but
   has 8 literal colours (`grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b"
src/styles/app.css`): `.toolbar` is `#000000` on `rgb(82, 82, 82)`, `.btn-tool` and its
   `:hover` use four `rgb()` greys, and `.btn-broadcast.active` uses `white`. The toolbar is
   pure black in light mode.
3. Tailwind utilities in TSX. The toolbar div (`grep -n 'className="toolbar' src/App.tsx`,
   line 556) also says `bg-black border-2 border-neutral-600`, duplicating `.toolbar`.
   `src/index.css` imports `app.css` unlayered and Tailwind v4 emits utilities in
   `@layer utilities`, so unlayered `app.css` always wins. That is why the pause button
   (`grep -n 'bg-red-500' src/App.tsx`, line 566) has never shown its red/green state.
4. Inline styles: `grep -rhoE 'style=\{\{' src --include=*.tsx | wc -l` → 286, in
   `grep -rlE 'style=\{\{' src --include=*.tsx | wc -l` → 41 files. Out of scope (plan 004).

**The universal transition.** `src/styles/theme.css` (`grep -n '^\* {' src/styles/theme.css`,
line 291) puts a five-property transition on every element, and `body` (line 280) carries
its own. Both exist to smooth theme switches; they cost a style recalculation on every class
change in a large DOM. `.theme-loading * { transition: none !important; }` and the
`@media (prefers-reduced-motion: reduce)` block below them must stay untouched. `.btn` has its
own `transition: background-color 0.2s ease` (`grep -n transition src/styles/app.css`), so
`.btn*` hovers keep fading; only TSX `hover:` utilities without a `transition` utility snap:
`grep -rhoE 'className=(\{`|")[^`"]_' src --include=_.tsx | grep -cE 'hover:'`→ 90, of which`… | grep -E 'hover:' | grep -vcE 'transition'` → 32 have no transition.

**Theme switching paths.** `ThemeManager.tsx` `applyTheme` (`grep -n 'function applyTheme'
src/components/ThemeManager.tsx`, line 36) sets `data-theme` on `<html>`. In the web build the
home-screen toggle (`grep -n "setAttribute('data-theme'" src/components/HomeScreen.tsx`,
line 366) sets the attribute itself and broadcasts over `BroadcastChannel`, which never
delivers to the posting tab, so `ThemeManager` does not run for the user's own click. The
`setAttribute('data-theme'` in `playground-registry.tsx` (line 705) is inside a `code:`
template string shown as sample text; it never executes and is not touched.

**Dead file.** `src/App.css` is Vite scaffolding with a `#root { max-width: 1280px; … }` rule
that would break the full-viewport layout if imported. Nothing imports it.

## Inputs & resources

Gates: `plans/CONVENTIONS.md` §4. Commands specific to this plan:

| Purpose                       | Command                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| Inspect built CSS             | `npm run build:web` then `grep … dist-web/assets/*.css`           |
| Run one new Playwright spec   | `npx playwright test tests/<name>.spec.ts --project=Web-Chromium` |
| Run the two new vitest guards | `npx vitest run src/styles`                                       |

`grep -c` prints `0` with exit status 1. Wherever **Expected** says `0` for a `grep -c`, that
exit status is the pass, not a failure.

## Scope

**In scope** (the only paths you may change):

- `tailwind.config.js` — delete (Step 2)
- `src/index.css` — one `--animate-*` line in the existing `@theme` block, one `@keyframes`
- `postcss.config.js`, `package.json`, `package-lock.json` — drop `autoprefixer` (Step 3)
- `src/App.css` — delete (Step 4)
- `src/styles/theme.css` — scope the transition (Step 5); add new tokens only (Step 6). Never
  change an existing `--app-*` value.
- `src/components/ThemeManager.tsx`, `src/components/HomeScreen.tsx` — Step 5 only
- `src/styles/app.css` — tokens for literals (Step 6); pause state classes (Step 8)
- `src/App.tsx` — two `className` edits (Steps 7, 8)
- `tests/toast-animation.spec.ts`, `tests/theme-transition.spec.ts`,
  `tests/pause-button.spec.ts`, `src/styles/app-css-purity.test.ts`,
  `src/styles/palette-classes.test.ts` — new
- `docs/features/theming.md`, `docs/guides/CONVENTIONS.md`,
  `docs/architecture/ARCHITECTURE.md`, `vite.config.ts` — `tailwind.config.js` references
- `docs/planning/screenshots/001-final/`, `plans/reports/001.md`, `CHANGELOG.md`,
  `plans/README.md`, `plans/002-shadcn-compatibility-spike.md` — Steps 9–10

**Out of scope** (do NOT touch, even though they look related): the 286 inline styles; the
hardcoded Tailwind palette classes in TSX (400 at d3d3642, command in Step 6); any component
markup beyond the edits named above; `src/components/Canvas/**`; `Toast.tsx` colours;
`PauseManager.tsx`; shadcn, Radix Primitives, CVA, `cn()`, `components.json` (plan 003); the
Radix Colors `@import`s in `theme.css`.

## Landing

Branch, commits, PR, CI and rollback: `plans/CONVENTIONS.md` §7. Branch name:
`plan/001-styling-foundation`.

## Steps

### Step 1: Prove the JS Tailwind config is ignored

**Files**: none.
**Do**: Change nothing. Build the web bundle and look for the `animate-slide-down` utility.
**Do NOT**: edit any file; grep for the bare substring `slide-down` (it would also match a
declaration and prove nothing).
**Commands**:

```bash
npm run build:web
grep -oE '\.animate-slide-down\{[^}]*\}' dist-web/assets/*.css; echo "exit=$?"
grep -c -- '--app-bg-surface' dist-web/assets/*.css
```

**Expected**: build exits 0; the second command prints nothing then `exit=1`; the third prints
a non-zero count (proves you grepped the real bundle).
**Check**: the line `exit=1`.
**If it fails**: a rule is printed → STOP: "the v3 config is being loaded; Steps 2–3 premise is
wrong".
**Commit**: none (no files change).

### Step 2: Move the toast animation into the v4 CSS config and guard it with a spec

**Files**: `src/index.css`, `tailwind.config.js` (delete), `tests/toast-animation.spec.ts` (new).
**Do**: Plan 000 already put one `@theme` block in `src/index.css`. Add exactly one declaration
to it, as its last line, and add the `@keyframes` after the block. Do not create a second
`@theme`. After the edit the head of the file reads as follows, where the comment line stands
for plan 000's declarations, which stay byte-for-byte (do not type the comment):

```css
@import 'tailwindcss';
@import './styles/fonts.css';
@import './styles/theme.css';
@import './styles/app.css';

@theme inline {
  /* …plan 000's declarations, unchanged… */
  --animate-slide-down: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Ensure html, body, and root fill viewport */
html,
body {
```

The old config animated `translate(-50%, …)`. Tailwind v4's `-translate-x-1/2` sets the
`translate` property, so that would double-shift X for 300 ms; `translateY` only is correct
for both `Toast.tsx` and the Playground panel. A `--animate-*` theme variable generates the
`animate-slide-down` utility, so no component changes. Then `git rm tailwind.config.js`.

Create `tests/toast-animation.spec.ts` (the permanent guard against the config silently
dropping again):

```ts
import { expect, test } from '@playwright/test';

/**
 * Guards the Tailwind v4 CSS config: `animate-slide-down` exists only because
 * `--animate-slide-down` and `@keyframes slideDown` are declared in src/index.css.
 */
test('toast animates with the slideDown keyframes', async ({ page }) => {
  await page.goto('/design-system');
  await page.waitForSelector('#root:visible', { timeout: 60000 });

  await page.getByRole('button', { name: 'Show Success' }).click();

  const toast = page.locator('.animate-slide-down');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Operation completed successfully');

  const animationName = await toast.evaluate((el) => getComputedStyle(el).animationName);
  expect(animationName).toBe('slideDown');
});
```

**Do NOT**: touch `Toast.tsx` (its `bg-blue-600`/`bg-red-600`/`bg-green-600` are plan 004's);
move or reorder the four `@import` lines; delete the `html, body` / `#root` rules; emulate
`reducedMotion` in the spec (the reduced-motion block would set `animationName` to `none`).
**Commands**:

```bash
grep -c '^@theme' src/index.css
npm run build:web
grep -oE '\.animate-slide-down\{[^}]*\}' dist-web/assets/*.css
grep -c -- '--app-bg-surface' dist-web/assets/*.css
grep -c -- '\.toolbar' dist-web/assets/*.css
npx playwright test tests/toast-animation.spec.ts --project=Web-Chromium
npm run verify:static
```

**Expected**: `1`; exit 0; one rule such as
`.animate-slide-down{animation:var(--animate-slide-down)}`; non-zero; non-zero; `1 passed`;
exit 0.
**Check**: the spec passes.
**If it fails**: if either count is `0`, STOP: "`@import`s were dropped; theme.css/app.css not
loading". Otherwise re-read the head of `src/index.css` against the block above, fix once,
rerun; then STOP.
**Commit**: `plan-001 step-2: move slide-down animation into the Tailwind v4 CSS config`

### Step 3: Remove the redundant autoprefixer

**Files**: `postcss.config.js`, `package.json`, `package-lock.json`.
**Do**: Tailwind v4 prefixes through Lightning CSS. First save the current built CSS (asset
names are content-hashed and `emptyOutDir` wipes them; `cat` because there may be more than one
file). Then make `postcss.config.js` exactly:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

Delete the line `"autoprefixer": "^10.4.22",` from `devDependencies` in `package.json`
(`grep -n '"autoprefixer"' package.json`, line 69). Run `npm install` to update the lockfile.
**Do NOT**: remove any other devDependency; touch `vite.config.ts`; run `npm update`.
**Commands**:

```bash
cat dist-web/assets/*.css > /tmp/plan-001-before.css        # BEFORE editing
# …make the two edits…
npm install
git diff package-lock.json | grep -cE '^\+\s+"node_modules/'
npm run build:web
cat dist-web/assets/*.css > /tmp/plan-001-after.css
diff <(tr ';{}' '\n\n\n' < /tmp/plan-001-before.css | sort -u) \
     <(tr ';{}' '\n\n\n' < /tmp/plan-001-after.css | sort -u) \
  | grep -E '^[<>]' | grep -vcE -- '-(webkit|moz|ms|o)-'
grep -oE '\.animate-slide-down\{[^}]*\}' dist-web/assets/*.css
npm run verify:static
```

**Expected**: `0` (the lockfile only removes packages, never adds one); exit 0; `0` — every
declaration that differs carries a vendor prefix (this `grep -c` prints `0` and exits 1; that
is the pass); the rule is still printed; exit 0.
**Check**: both `0` lines.
**If it fails**: a lockfile `+` line → STOP: "autoprefixer removal pulled in a new package".
A non-prefix declaration differs → STOP with the diff excerpt.
**Commit**: `plan-001 step-3: remove autoprefixer (Tailwind v4 prefixes via Lightning CSS)`

### Step 4: Delete the dead `src/App.css`

**Files**: `src/App.css` (delete).
**Do**: Confirm nothing imports it, then remove it.
**Do NOT**: delete or edit `src/index.css`; touch `src/styles/`.
**Commands**:

```bash
grep -rn "App.css" src/ index.html electron/; echo "exit=$?"
git rm src/App.css
npm run verify:static
npm run build:web
```

**Expected**: nothing then `exit=1`; file removed; exit 0; exit 0.
**Check**: `test -f src/App.css; echo $?` prints `1`.
**If it fails**: the first grep prints a consumer → STOP: "App.css has an importer".
**Commit**: `plan-001 step-4: delete dead src/App.css`

### Step 5: Scope the universal transition to theme switches

**Files**: `src/styles/theme.css`, `src/components/ThemeManager.tsx`,
`src/components/HomeScreen.tsx`, `tests/theme-transition.spec.ts` (new).
**Do**:

1. In `src/styles/theme.css`, the `body` rule (`grep -n '^body {' src/styles/theme.css`,
   line 280) becomes:

   ```css
   body {
     background-color: var(--app-bg-base);
     color: var(--app-text-primary);
   }
   ```

   and the `* { … }` rule with its comment (lines 290–295) becomes:

   ```css
   /* Theme-change transition: applied only while `.theme-transitioning` is on <html>
      (ThemeManager.applyTheme), so the cost is paid during a theme switch instead of on
      every style recalculation in the app. Covers <body> too. */
   .theme-transitioning * {
     transition-property: background-color, border-color, color, fill, stroke;
     transition-duration: 0.2s;
     transition-timing-function: ease;
   }
   ```

2. In `src/components/ThemeManager.tsx`, replace lines 28–38 (the `applyTheme` docblock and
   function) with:

   ```ts
   /** How long `.theme-transitioning` stays on <html>: the 0.2 s transition plus margin. */
   const THEME_TRANSITION_MS = 300;

   let transitionTimer: number | undefined;

   /**
    * Apply theme to DOM
    *
    * Sets data-theme on <html> inside the `theme-transitioning` class, so theme.css
    * transitions only the switch. No-op when the theme is already applied. While <body>
    * still carries `theme-loading` (first paint) the attribute is set synchronously with no
    * class, so page load never animates.
    *
    * @param theme - 'light' or 'dark'
    */
   export function applyTheme(theme: 'light' | 'dark'): void {
     const root = document.documentElement;
     if (root.getAttribute('data-theme') === theme) {
       return;
     }
     if (document.body.classList.contains('theme-loading')) {
       root.setAttribute('data-theme', theme);
       return;
     }
     if (transitionTimer !== undefined) {
       window.clearTimeout(transitionTimer);
       transitionTimer = undefined;
     }
     // Add the class first and flip the attribute on the next frame: a transition only
     // runs if the computed style before the change already had transition-property.
     root.classList.add('theme-transitioning');
     window.requestAnimationFrame(() => {
       root.setAttribute('data-theme', theme);
       transitionTimer = window.setTimeout(() => {
         root.classList.remove('theme-transitioning');
         transitionTimer = undefined;
       }, THEME_TRANSITION_MS);
     });
   }
   ```

   and replace the effect's cleanup (`grep -n 'cleanup?.();' src/components/ThemeManager.tsx`,
   line 151, with its surrounding `return () => { … };`) with:

   ```ts
   return () => {
     cleanup?.();
     if (transitionTimer !== undefined) {
       window.clearTimeout(transitionTimer);
       transitionTimer = undefined;
       document.documentElement.classList.remove('theme-transitioning');
     }
   };
   ```

3. In `src/components/HomeScreen.tsx`, three one-line edits:
   - after `import { LogoLockup } from './LogoLockup';` (line 26) add
     `import { applyTheme } from './ThemeManager';`
   - `let effectiveTheme: string;` (line 358) → `let effectiveTheme: 'light' | 'dark';`
   - `document.documentElement.setAttribute('data-theme', effectiveTheme);` (line 366) →
     `applyTheme(effectiveTheme);`

4. Create `tests/theme-transition.spec.ts`:

   ```ts
   import { expect, test } from '@playwright/test';

   /**
    * The home-screen toggle is the primary theme path in the web build. It must go through
    * ThemeManager.applyTheme, which wraps the switch in `.theme-transitioning` on <html>.
    */
   test('theme toggle wraps the switch in .theme-transitioning', async ({ page }) => {
     await page.emulateMedia({ colorScheme: 'light' });
     await page.addInitScript(() => {
       window.localStorage.setItem('graphium-theme', 'light');
     });
     await page.goto('/');
     await page.waitForSelector('#root:visible', { timeout: 60000 });

     const html = page.locator('html');
     const toggle = page.getByRole('button', { name: /Click to cycle themes/ });
     await expect(toggle).toHaveAttribute('aria-label', /Current theme: Light/);
     await expect(html).toHaveAttribute('data-theme', 'light');

     // Record whether the class ever appears; it lives for only ~300 ms.
     await page.evaluate(() => {
       const root = document.documentElement;
       new MutationObserver(() => {
         if (root.classList.contains('theme-transitioning')) {
           root.dataset.transitionSeen = 'true';
         }
       }).observe(root, { attributes: true, attributeFilter: ['class'] });
     });

     await toggle.click();

     await expect(html).toHaveAttribute('data-theme', 'dark');
     await expect(html).toHaveAttribute('data-transition-seen', 'true');
     await expect(html).not.toHaveClass(/theme-transitioning/, { timeout: 1000 });
   });
   ```

Expected behaviour change: the 32 `hover:` utilities without a `transition` utility now snap.
That is intended; it is not a failure.
**Do NOT**: edit `.theme-loading *` or the `@media (prefers-reduced-motion: reduce)` block;
add a transition to any component; touch `playground-registry.tsx`; change anything else in
`HomeScreen.tsx`; put the class on `document.body`.
**Commands**:

```bash
grep -c '^\* {' src/styles/theme.css
grep -c '^\.theme-transitioning \* {' src/styles/theme.css
grep -n '^body {' -A4 src/styles/theme.css | grep -c transition
grep -c "setAttribute('data-theme'" src/components/HomeScreen.tsx
grep -c '^export function applyTheme' src/components/ThemeManager.tsx
npm run verify:static
npx playwright test tests/theme-transition.spec.ts --project=Web-Chromium
npm run verify:web
```

**Expected**: `0`; `1`; `0`; `0`; `1`; exit 0; `1 passed`; exit 0.
**Check**: `verify:web` exits 0 with the new spec included.
**If it fails**: re-read the three code blocks against the files once and rerun; then STOP with
the failing assertion. If a non-hover animation (not a hover fade) broke, STOP and name it; do
not revert the step.
**Commit**: `plan-001 step-5: scope theme transition to .theme-transitioning`

### Step 6: Replace `app.css` literals with tokens and add the two regression guards

**Files**: `src/styles/app.css`, `src/styles/theme.css`, `src/styles/app-css-purity.test.ts`
(new), `src/styles/palette-classes.test.ts` (new).
**Do**:

1. Add two tokens to `src/styles/theme.css`, in the `[data-theme='light']` block (line 142)
   and the second `[data-theme='dark']` block (line 211) — never the first `[data-theme='dark']`
   at line 58. Light block: after `--app-error-solid-hover: var(--red-10); /* Solid error
hover */` (line 179) add `--app-error-solid-text: white; /* Text/icon colour on solid
error */`; after `--app-success-solid-hover: var(--green-10); /* Solid success hover */`
   (line 195) add `--app-success-solid-text: white; /* Text/icon colour on solid success */`.
   Dark block: after `--app-error-solid-hover: var(--red-10);` (line 248) add
   `--app-error-solid-text: white;`; after `--app-success-solid-hover: var(--green-10);`
   (line 264) add `--app-success-solid-text: white;`. `white` matches the existing
   `--app-accent-solid-text` and today's rendering.

2. In `src/styles/app.css` make these four rules exactly:

   ```css
   .toolbar {
     background: var(--app-bg-surface);
     border: 2px solid var(--app-border-default);
   }
   ```

   ```css
   .btn-tool {
     background: var(--app-bg-active);
     color: var(--app-text-primary);
     border: 1px solid var(--app-border-default);
   }

   .btn-tool:hover {
     background: var(--app-bg-hover);
     border-color: var(--app-border-hover);
   }
   ```

   ```css
   .btn-broadcast.active {
     background: var(--app-success-solid);
     color: var(--app-success-solid-text);
   }
   ```

   Dark theme: the toolbar goes from `#000000` to `--app-bg-surface` (`#212225`) and
   `.btn-tool` from `rgb(64, 64, 64)` to `--app-bg-active` (`#2e3135`). Light theme: it stops
   being a black slab. Both are intended.

3. Create `src/styles/app-css-purity.test.ts`:

   ```ts
   import { readFileSync } from 'node:fs';
   import path from 'node:path';

   import { describe, expect, it } from 'vitest';

   const APP_CSS_PATH = path.resolve(process.cwd(), 'src/styles/app.css');

   /** Colours written as literals instead of `--app-*` tokens (see theme.css header). */
   const LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(?:white|black)\b/g;

   describe('src/styles/app.css', () => {
     it('contains no literal colours; every colour comes from a --app-* token', () => {
       const css = readFileSync(APP_CSS_PATH, 'utf8');
       expect(css.match(LITERAL_COLOUR) ?? []).toEqual([]);
     });
   });
   ```

4. Create `src/styles/palette-classes.test.ts`. Set `BASELINE` to the number the count command
   below prints (396 expected; see **Expected**):

   ```ts
   import { readdirSync, readFileSync, statSync } from 'node:fs';
   import path from 'node:path';

   import { describe, expect, it } from 'vitest';

   /**
    * Ratchet: hardcoded Tailwind palette classes in src/**\/*.tsx may only go down.
    * Plan 004 lowers BASELINE as each component moves onto --app-* tokens.
    * Same count as: grep -rhoE '<PALETTE_CLASS>' src --include=*.tsx | wc -l
    */
   const BASELINE = 396;

   const PALETTE_CLASS =
     /\b(?:bg|text|border|ring|divide|placeholder|outline|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b|\b(?:bg|text|border)-(?:white|black)\b/g;

   function listTsxFiles(dir: string): string[] {
     const files: string[] = [];
     for (const entry of readdirSync(dir)) {
       const full = path.join(dir, entry);
       if (statSync(full).isDirectory()) {
         files.push(...listTsxFiles(full));
       } else if (full.endsWith('.tsx')) {
         files.push(full);
       }
     }
     return files;
   }

   describe('hardcoded Tailwind palette classes in src/**/*.tsx', () => {
     it(`do not exceed the ratchet baseline (${BASELINE})`, () => {
       const count = listTsxFiles(path.resolve(process.cwd(), 'src')).reduce(
         (sum, file) => sum + (readFileSync(file, 'utf8').match(PALETTE_CLASS) ?? []).length,
         0,
       );
       expect(count, `palette-class count is ${count}`).toBeLessThanOrEqual(BASELINE);
     });
   });
   ```

   Both files are matched by `vitest.config.ts` `include` (`grep -n 'src/\*\*' vitest.config.ts`)
   and excluded from `tsc` by `tsconfig.json` (`**/*.test.ts`), so only `npm run test:run`
   checks them — exactly as CONVENTIONS §12 says.

**Do NOT**: change any palette class in a `.tsx` file (`dark:` variants: `grep -rhoE '\bdark:'
src --include=*.tsx | wc -l` → 0; plan 004 owns all of it); change any existing `--app-*`
value; edit `.btn-tool.active` (already tokens); reformat `app.css`.
**Commands**:

```bash
grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b" src/styles/app.css; echo "exit=$?"
grep -c 'solid-text: white' src/styles/theme.css
grep -rhoE '\b(bg|text|border|ring|divide|placeholder|outline|from|to|via|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b|\b(bg|text|border)-(white|black)\b' src --include=*.tsx | wc -l
npx vitest run src/styles
npm run verify:static
npm run verify:web
```

**Expected**: nothing then `exit=1`; `6` (accent, error, success × two themes); `396` — the
count was 400 at d3d3642 and `PreferencesDialog.tsx` held 4 of them, which plan 000 deleted
(if the number differs, use the printed number as `BASELINE` and record both numbers under
Deviations in the report); `2 passed`; exit 0; exit 0 — `verify:web` runs the a11y suite over
the seven surfaces of CONVENTIONS §1 in both themes (14 scans), which is the contrast gate for
the substituted colours.
**Check**: `verify:web` exits 0.
**If it fails**: an axe colour-contrast violation → STOP with the violation and element; never
reintroduce a literal colour. `palette-classes.test.ts` failing with a count above `BASELINE`
→ STOP with both numbers.
**Commit**: `plan-001 step-6: replace app.css literal colours with tokens; add css guards`

### Step 7: Remove the duplicated Tailwind classes from the toolbar

**Files**: `src/App.tsx`.
**Do**: On the toolbar div (`grep -n 'className="toolbar' src/App.tsx`, line 556) remove only
`bg-black`, `border-2` and `border-neutral-600`, so it reads:

```tsx
<div className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-2xl flex items-center gap-2 z-50">
```

This changes no pixels: unlayered `.toolbar` already beat these utilities before and after
Step 6. The visual change belongs to Step 6.
**Do NOT**: touch any other class on that div; edit anything else in `App.tsx`; look for a
rendering difference.
**Commands**:

```bash
grep -cE 'bg-black|border-neutral-600' src/App.tsx
grep -c 'className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-2xl flex items-center gap-2 z-50"' src/App.tsx
npm run verify:static
```

**Expected**: `0`; `1`; exit 0.
**Check**: the `0`.
**If it fails**: re-read the line once; then STOP.
**Commit**: `plan-001 step-7: drop duplicated toolbar colour utilities`

### Step 8: Fix the pause button

**Files**: `src/styles/app.css`, `src/App.tsx`, `tests/pause-button.spec.ts` (new).
**Do**: The DM's pause control has never shown whether the game is paused (cascade, see
Context). In `src/styles/app.css`, directly after the `.btn-tool.active:hover { … }` rule
(`grep -n '.btn-tool.active:hover' src/styles/app.css`, line 71) add:

```css
/* Pause button state (App.tsx). Lives in this unlayered file so it beats Tailwind's
   @layer utilities the same way .btn-tool does. */
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

In `src/App.tsx` replace the pause button's `className` (`grep -n 'bg-red-500' src/App.tsx`,
lines 564–568) with:

```tsx
className={`btn btn-tool flex items-center justify-center font-semibold ${
  isGamePaused ? 'is-paused' : 'is-running'
}`}
```

Create `tests/pause-button.spec.ts`. In the web build `handlePauseToggle` only calls
`ipcRenderer.invoke('TOGGLE_PAUSE')` and `PauseManager` learns the state from
`PAUSE_STATE_CHANGED`, so the spec installs an IPC mock that owns the state after storage has
already initialised as the web service:

```ts
import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/** Computed colour of a token via a probe element, comparable with getComputedStyle output. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForSelector('#root:visible', { timeout: 60000 });

  // Storage is already the web service. This mock owns the pause state the way
  // electron/main.ts does, so the real path runs: button -> TOGGLE_PAUSE ->
  // PAUSE_STATE_CHANGED -> PauseManager -> store -> className.
  await page.evaluate(() => {
    type Listener = (event: unknown, ...args: unknown[]) => void;
    const listeners = new Map<string, Listener[]>();
    let paused = false;
    window.ipcRenderer = {
      on: (channel: string, listener: Listener) => {
        listeners.set(channel, [...(listeners.get(channel) ?? []), listener]);
      },
      off: (channel: string, listener: Listener) => {
        listeners.set(
          channel,
          (listeners.get(channel) ?? []).filter((l) => l !== listener),
        );
      },
      removeAllListeners: (channel: string) => {
        listeners.delete(channel);
      },
      send: () => {},
      invoke: (channel: string) => {
        if (channel === 'TOGGLE_PAUSE') {
          paused = !paused;
          for (const listener of listeners.get('PAUSE_STATE_CHANGED') ?? []) {
            listener({}, paused);
          }
          return Promise.resolve(paused);
        }
        if (channel === 'GET_PAUSE_STATE') {
          return Promise.resolve(paused);
        }
        return Promise.resolve({});
      },
    };
  });

  await page.getByTestId('new-campaign-button').click();
  await expect(page.getByTestId('editor-view')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`pause button is green when running and red when paused (${theme})`, async ({ page }) => {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const button = page.getByRole('button', { name: /^(Pause|Resume) game$/ });

    await expect(button).toHaveClass(/is-running/);
    await expect(button).toHaveCSS(
      'background-color',
      await tokenColor(page, '--app-success-solid'),
    );

    await button.click();
    await expect(button).toHaveClass(/is-paused/);
    await expect(button).toHaveCSS('background-color', await tokenColor(page, '--app-error-solid'));

    await button.click();
    await expect(button).toHaveClass(/is-running/);
  });
}
```

Contrast, for the report: white on `--app-success-solid` (`--green-9`, `#30a46c`) is ≈3.1:1
and on `--app-error-solid` (`--red-9`, `#e5484d`) ≈3.9:1. The button is icon-only, a
graphical object needing 3:1, and axe's colour-contrast rule does not evaluate icon-only
buttons, so do not expect an axe flag either way. Record the ratios; palette is plan 006b's.
**Do NOT**: restyle or reorder the toolbar; add a `data-testid` (the `aria-label` is the
selector); touch `PauseManager.tsx` or `handlePauseToggle`; change the `RiPlayFill` /
`RiPauseFill` swap or the `aria-label`.
**Commands**:

```bash
grep -cE 'bg-red-500|bg-green-500' src/App.tsx
grep -c 'is-paused' src/App.tsx src/styles/app.css
npx playwright test tests/pause-button.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `0`; `src/App.tsx:1` and `src/styles/app.css:2`; `2 passed`; exit 0; exit 0.
**Check**: the spec passes in both themes.
**If it fails**: if the button never gains `is-paused`, the IPC mock was installed before
storage initialised or after the editor mounted; re-read the spec once, rerun, then STOP.
**Commit**: `plan-001 step-8: pause button shows paused/running state`

### Step 9: Update docs and the coverage glob, take screenshots, run the full gate

**Files**: `docs/features/theming.md`, `docs/guides/CONVENTIONS.md`,
`docs/architecture/ARCHITECTURE.md`, `vite.config.ts`, `docs/planning/screenshots/001-final/`.
**Do**:

- `docs/features/theming.md` (`grep -n 'tailwind.config' docs/features/theming.md`, line 150):
  replace the sentence and the `js` block that follows it (through its closing fence, line 165)
  with:

  ````markdown
  Tailwind v4 is configured in CSS. To expose a semantic variable as a utility, add it to the
  `@theme inline` block in `src/index.css`:

  ```css
  @theme inline {
    --color-bg-surface: var(--app-bg-surface);
    /* generates bg-bg-surface, text-bg-surface, … */
  }
  ```
  ````

- `docs/guides/CONVENTIONS.md` (line 80): delete the `tailwind.config.js` line from the list.
- `docs/architecture/ARCHITECTURE.md` (line 1401): replace the line with
  `├── postcss.config.js           # PostCSS (Tailwind theme: src/index.css @theme)`.
- `vite.config.ts` (`grep -n 'tailwind.config' vite.config.ts`, line 66): delete the
  `'**/tailwind.config.js',` entry.
- Screenshots: `SHOTS_OUT=docs/planning/screenshots/001-final npm run shots`.

**Do NOT**: rewrite other parts of those docs; touch `postcss.config.js` again; edit the
Playwright config.
**Commands**:

```bash
grep -rn "tailwind.config" docs/ vite.config.ts src/ README.md; echo "exit=$?"
SHOTS_OUT=docs/planning/screenshots/001-final npm run shots
ls docs/planning/screenshots/001-final | wc -l
npm run verify
```

**Expected**: nothing then `exit=1`; exit 0; `14`; exit 0.
**Check**: `npm run verify` exits 0.
**If it fails**: STOP with the failing command's output.
**Commit**: `plan-001 step-9: docs and coverage glob follow the CSS config; screenshots`

### Step 10: Report, changelog, PR, handoff

**Files**: `plans/reports/001.md`, `CHANGELOG.md`, `plans/README.md`,
`plans/002-shadcn-compatibility-spike.md`.
**Do**: Write the report (`plans/reports/001.md`, CONVENTIONS §11). Its **Numbers** section
records: Step 1's grep output, the hover counts (90 / 32), the palette count and `BASELINE`,
the lockfile packages removed, and the two contrast ratios. Its **Screenshots** section lists
every file in `docs/planning/screenshots/001-final/` and names the expected differences for
Kyle: toolbar surface and button colours in both themes, pause button green, 32 snapped
hovers. Add three bullets under `## [Unreleased]` in `CHANGELOG.md` (create a `### Fixed`
heading under it if there is none): toast slide-down animation now runs; main toolbar follows
the light/dark theme; pause button shows red when paused and green when running. Push and
open the PR (CONVENTIONS §7) with the report as its body. After merge: set this plan's row in
`plans/README.md` to `DONE <merge sha>` and write the merge SHA into the `Grounded at` line of
`plans/002-shadcn-compatibility-spike.md`.
**Do NOT**: squash-merge; edit any other plan; write under a decision file's "Kyle's answer".
**Commands**:

```bash
npm run verify
git push -u origin plan/001-styling-foundation
```

**Expected**: exit 0; push accepted.
**Check**: the PR exists with the report as its body and CI green.
**If it fails**: CI red → fix at the step whose commit is implicated, rerun `npm run verify`,
push once more; then STOP.
**Commit**: `plan-001 step-10: report and changelog`

## Done criteria

- [ ] `grep -oE '\.animate-slide-down\{[^}]*\}' dist-web/assets/*.css` prints a rule after
      `npm run build:web`; `tests/toast-animation.spec.ts` passes
- [ ] `tailwind.config.js` and `src/App.css` no longer exist; `src/index.css` has one `@theme`
- [ ] `autoprefixer` is absent from `package.json` and `postcss.config.js`
- [ ] `src/styles/app-css-purity.test.ts` and `src/styles/palette-classes.test.ts` pass
- [ ] `grep -c '^\* {' src/styles/theme.css` is `0`; `tests/theme-transition.spec.ts` passes
- [ ] `--app-error-solid-text` and `--app-success-solid-text` exist under both theme blocks
- [ ] `tests/pause-button.spec.ts` passes in both themes
- [ ] `grep -rn "tailwind.config" docs/ vite.config.ts src/` prints nothing
- [ ] `npm run verify` exits 0; `docs/planning/screenshots/001-final/` holds 14 files
- [ ] PR merged (merge commit), `plans/reports/001.md` committed, README row `DONE <sha>`,
      002's `Grounded at` filled

## STOP conditions

CONVENTIONS §10 owns the generic ones. Specific to this plan:

- Step 1 prints an `.animate-slide-down` rule: the config is being loaded; premise wrong.
- The built CSS lacks `--app-bg-surface` or `.toolbar` after Step 2 or 3: the `@import`s were
  dropped and neither `theme.css` nor `app.css` is loading.
- An axe colour-contrast violation after Step 6: report it; never reintroduce a literal.
- `package-lock.json` gains a package in Step 3.
- Step 5 breaks an animation that is not a hover fade (the 32 snapped hovers are expected).

## Handoff / after it lands

- **Plan 002 depends on this**: the shadcn spike installs against the v4 CSS config.
- **Reviewer focus**: Step 6 (colour substitution) and the `001-final` screenshots.
- **Plan 004** lowers `BASELINE` in `src/styles/palette-classes.test.ts` as it migrates each
  component, and resolves the 286 inline styles per component.
- **Watch for** `.theme-transitioning` becoming a dumping ground: it is for theme switching
  only. A component that wants a transition declares its own.
