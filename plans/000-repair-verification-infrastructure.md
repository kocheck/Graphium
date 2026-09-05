# Plan 000: Verification infrastructure

> **Executor instructions**: Read `plans/CONVENTIONS.md` first. Run the pre-flight (§3), then
> the Drift check below. Follow the steps in order; each step's **Check** must hold before
> the next. If any **If it fails** or STOP condition fires, follow CONVENTIONS §10. Finish
> with the report in §11.

**Drift check** (run before Step 1):

```bash
git fetch origin main
git diff --stat d3d3642..origin/main -- src tests playwright.config.ts package.json .github/workflows electron TESTING_STRATEGY.md CHANGELOG.md docs/LOCAL_TESTING_WORKFLOW.md docs/HYBRID_TESTING_WORKFLOW.md     # Expected: empty
```

**Citation re-check** (each command must return exactly the listed hits):

| Anchor (grep)                                                                                        | File                                   | Expected hits                                   |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `grep -n 'data-testid="editor-view"' src/App.tsx`                                                    | `src/App.tsx`                          | 1 (line 482)                                    |
| `grep -n 'data-testid="new-campaign-button"' src/components/HomeScreen.tsx`                          | `src/components/HomeScreen.tsx`        | 1 (line 494)                                    |
| `grep -c 'btn btn-tool' src/App.tsx`                                                                 | `src/App.tsx`                          | `8`                                             |
| `grep -n "import.meta.env.MODE === 'test'" src/store/gameStore.ts`                                   | `src/store/gameStore.ts`               | 1 (line 938)                                    |
| `grep -n 'const isElectron = typeof window' src/services/storage.ts`                                 | `src/services/storage.ts`              | 1 (line 38)                                     |
| `grep -n 'const isWeb = !isElectron' src/components/SyncManager.tsx`                                 | `src/components/SyncManager.tsx`       | 1 (line 48)                                     |
| `grep -c 'min-h-\[56px\]' src/components/MobileToolbar.tsx`                                          | `src/components/MobileToolbar.tsx`     | `10`                                            |
| `grep -cE '^\s+/.*/,$' playwright.config.ts`                                                         | `playwright.config.ts`                 | `15` (testIgnore regexes)                       |
| `grep -c '@theme' src/index.css`                                                                     | `src/index.css`                        | `0`                                             |
| `grep -cE '^\s*push:' .github/workflows/deploy-web.yml`                                              | `.github/workflows/deploy-web.yml`     | `1`                                             |
| `grep -rl 'PreferencesDialog' src`                                                                   | `src/`                                 | only `src/components/PreferencesDialog.tsx`     |

If any row differs: STOP.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: MED (it repairs the gates every later plan relies on; the first PR will surface
  failures that were invisible before)
- **Depends on**: none
- **Category**: tests / infrastructure
- **Requires**: none (a clone of `origin/main`, Node 20+, npm 10+)
- **Grounded at**: `d3d3642` (2026-09-04)

## Why this matters

Plans 001–006 stake their safety on `npm run test:a11y`, the Playwright suite, and a
performance spec. At `d3d3642` the a11y suite scans the home screen only; the Web-Chromium
project runs 2 of the 15 `.spec.ts` files it could select; the performance spec selects zero
tests. A gate that passes whether or not the work was done licenses shipping a regression.
This plan builds what CONVENTIONS promises exists "after plan 000": the `verify:*` scripts,
`scripts/preflight.sh`, `tests/helpers/surfaces.ts`, a screenshot harness, a real a11y
suite, an overlay-contract spec, non-colour token families, and honest spec triage. Nothing
here changes a colour or a component's rendered output.

## Context the executor needs

- **Two views, one app.** `src/App.tsx` renders the Architect View (DM) or the World View
  (players) depending on `?type=world` (`src/utils/useWindowType.ts`). The World View is
  reachable in the web build at `/?type=world`; it renders `data-testid="editor-view"`
  immediately but only receives content after an Architect tab in the same browser
  answers its `REQUEST_INITIAL_STATE` with a `FULL_SYNC` over `BroadcastChannel('graphium-sync')`
  (`src/components/SyncManager.tsx`, `grep -n "'FULL_SYNC'" src/components/SyncManager.tsx`).
- **Nothing auto-enters the editor.** `viewState` starts at `'HOME'`
  (`grep -n "useState<'HOME' | 'EDITOR'>" src/App.tsx`, line 127) and only
  `handleStartEditor` (line 436) moves it, called from HomeScreen clicks. The editor
  root is `data-testid="editor-view"` (line 482). `tests/helpers/bypassLandingPage.ts`
  waits for `editor-view` with a `.catch` fallback that silently passes on the home screen.
  Step 2 fixes it.
- **A present `window.ipcRenderer` switches the app into Electron mode.**
  `src/services/storage.ts` (line 38) picks `ElectronStorageService` when it exists, and
  `SyncManager` then uses IPC instead of `BroadcastChannel` (line 47–48). The Electron mocks
  in `tests/helpers/mockElectronAPIs.ts` and `bypassLandingPage.ts` therefore disable web
  sync. The surface helper (Step 2) injects **no** mocks; the two restored legacy specs keep
  theirs.
- **Theme forcing that survives `ThemeManager`.** `src/components/ThemeManager.tsx` reads
  `getStorage().getThemeMode()`; in web mode that is `localStorage['graphium-theme']`
  (`grep -n "graphium-theme" src/services/WebStorageService.ts`, lines 494 and 504). Seeding
  that key in an init script before navigation is the durable mechanism; `index.html` applies
  the OS theme first, so every helper still waits for `data-theme` to equal the seeded value.
- **The store is exposed only in dev and vitest.** `src/store/gameStore.ts` line 938 sets
  `window.__GAME_STORE__` under `import.meta.env.DEV || MODE === 'test'`. `verify:web` runs
  against the production build (`CI=1` → `vite preview` on port 4173), so Step 2 adds a
  third condition: the URL carries `?e2e`. Every helper URL carries `?e2e=1`.
- **`confirmDialog` state is per window** (`grep -c confirmDialog src/components/SyncManager.tsx`
  → `0`). The `world-dialog` surface opens `ConfirmDialog` inside the World page itself.
- **Pause is Electron-only.** `handlePauseToggle` (`src/App.tsx`, line 181) returns when
  `window.ipcRenderer` is absent. Web specs assert the pause button exists, not that it toggles.
- **HomeScreen picks a random title** (`grep -n 'Math.random' src/components/HomeScreen.tsx`,
  line 150). The surface helper installs a seeded `Math.random` so screenshots are stable.
- **Existing axe exclusions to keep**: `canvas` (Konva) and `[aria-disabled="true"]`
  (`--app-text-disabled` is intentionally below AA per `docs/features/wcag-audit.md`).
- **Contrast finding to record, not fix**: `--app-error-solid` = `var(--red-9)` = `#e5484d`;
  white on it is ≈ 3.9:1. Users: `src/components/MobileToolbar.tsx` and
  `src/components/DesignSystemPlayground/playground-registry.tsx`
  (`grep -rn 'app-error-solid' src/ | grep -v theme.css` → 3 lines). `app.css` does not use it.
- **Pause-button cascade**: `src/index.css` imports `app.css` unlayered (line 4). Tailwind v4
  emits utilities in `@layer utilities`, and unlayered CSS beats any layer, so
  `.btn-tool { background: rgb(64,64,64) }` (`src/styles/app.css`, line 54) wins over
  `bg-red-500`/`bg-green-500` on the pause button (`src/App.tsx`, lines 564–567). The same
  rule makes `.btn { font-weight: 500 }` beat `font-semibold`. Plan 001 fixes it; record here.
- **Touch targets** (the only minimums that exist; none is documented):

  | Location                                                                          | Minimum       |
  | --------------------------------------------------------------------------------- | ------------- |
  | `src/App.tsx` mobile menu button (`grep -n "minHeight: '48px'" src/App.tsx`)      | 48 × 48 px    |
  | `src/components/MobileToolbar.tsx` (`grep -c 'min-h-\[56px\]'` → 10)              | 56 px tall    |
  | `src/components/TokenInspector.tsx` (`grep -c 'min-h-\[44px\]'` → 4)              | 44 px tall    |
  | `src/components/HomeScreen.tsx` `.action-card`, `.quick-action-btn`, `.recent-button` at ≤ 480 px | 44 px tall |
  | `.btn-tool` (`src/styles/app.css`)                                                | none          |

- **ESLint ignores `tests/**`** (`.eslintrc.cjs` `ignorePatterns`) and `tsconfig.json` includes
  only `src` and `electron`. Spec files are only syntax-checked by Playwright; vitest
  compiles `tests/unit/**`. `.ai-rules.md` is mandatory reading for any `src/` change.

## Inputs & resources

Gates: `plans/CONVENTIONS.md` §4. This plan **creates** those scripts in Step 1; until then
use the equivalents in §4. `verify:web` runs the web project and the a11y suite with `CI=1`
(built output, preview server on 4173, no dev-only components), so a single spec is run the
same way:

| Purpose                                  | Command                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| One web spec, same conditions as the gate | `npm run build:web && CI=1 npx playwright test <spec> --project=Web-Chromium`                                 |
| Count selected tests                     | `CI=1 npx playwright test --project=Web-Chromium --list \| tail -1` (prints `Total: N tests in M files`)       |
| Regenerate visual baselines (Step 3 only) | `npm run build:web && CI=1 npx playwright test tests/visual.spec.ts --project=Web-Chromium --update-snapshots` |
| Pre-flight for this plan                 | `bash scripts/preflight.sh 000` (exists after Step 1)                                                          |

## Scope

**In scope**

- `package.json` scripts; `scripts/preflight.sh`
- `tests/**` (helpers, specs, snapshots, `tests/README.md`); `playwright.config.ts`
- `data-testid` attributes and the `?e2e` store-exposure guard in `src/`
- `aria-*` / `id` / `htmlFor` attribute fixes in `src/components/**` for category (a) axe defects
- `src/index.css`, `src/styles/theme.css` (non-colour tokens only)
- `src/components/PreferencesDialog.tsx` (deleted); `src/components/README.md`
- `.github/workflows/deploy-web.yml`, `accessibility.yml`, `e2e.yml`
- `docs/planning/verification-baseline.md`, `docs/planning/screenshots/000-baseline/`
- `TESTING_STRATEGY.md`, `docs/LOCAL_TESTING_WORKFLOW.md`, `docs/HYBRID_TESTING_WORKFLOW.md`,
  `src/utils/useWindowType.ts` (JSDoc only), `CHANGELOG.md`

**Out of scope** (do NOT touch)

- Any `--app-*` colour value; any component's markup, styling or behaviour beyond the
  attributes named above; `src/components/Canvas/**`; `src/styles/app.css`
- The `canvas` and `[aria-disabled="true"]` axe exclusions; any new axe exclusion
- The pause-button cascade (plan 001), the `--app-error-solid` contrast (plan 006)
- shadcn, primitives, or any new dependency

Branch, commits, PR, CI and rollback: `plans/CONVENTIONS.md` §7. Branch name:
`plan/000-verification-infrastructure`. This is the one PR whose CI cannot fully vouch for
itself; expect it to surface failures that were previously invisible and record each in
`docs/planning/verification-baseline.md`.

## Steps

### Step 1: Record the baseline, add the gate scripts and the pre-flight script

**Files**: `package.json`, `scripts/preflight.sh`, `docs/planning/verification-baseline.md`,
plus any file `npm run format` rewrites (commit those too).

**Do**:

1. Run and record (exit code and the last line of each) into a new
   `docs/planning/verification-baseline.md` under `## Before` :

   ```bash
   npm install && npx playwright install chromium
   npm run lint:strict; npm run type-check; npm run test:run
   npx prettier --check "**/*.{ts,tsx,js,jsx,json,md,css}"
   CI=1 npx playwright test --project=Web-Chromium --list | tail -1
   CI=1 npx playwright test --project=Electron-App --list | tail -1
   ls tests/functional tests/performance tests/electron tests/*.spec.ts
   grep -rnoE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx | wc -l
   grep -rn "style={{" --include=*.tsx src | wc -l
   grep -rhoE 'data-testid="[^"]+"' src/ | sort -u | wc -l
   ```

   Expected at `d3d3642`: `Total: 13 tests in 2 files` for Web-Chromium (4 in
   `accessibility.spec.ts`, 9 in `campaign-workflow.spec.ts` of which 8 are skipped; if `--list`
   omits skipped tests the number is smaller — the file count is what must match),
   `in 2 files` for Electron-App, palette count `400`, inline-style count `286`, test-id count `22`.
   Write the palette command verbatim into the doc under the heading
   `## Palette-class regex` — later plans cite this command and this number.
   If `prettier --check` exits non-zero, run `npm run format`, record
   `git status --porcelain | wc -l` as "files reformatted", and include them in this commit.
2. In `package.json` `scripts`, replace the `test:a11y` and `test:e2e` lines and add the
   five new ones, exactly:

   ```json
   "test:a11y": "playwright test tests/accessibility.spec.ts --config=playwright.config.ts --project=Web-Chromium",
   "test:e2e": "npm run verify:web && npm run verify:electron",
   "verify:static": "npm run lint:strict && npm run type-check && npm run format:check && npm run test:run",
   "verify:web": "npm run build:web && CI=1 npm run test:e2e:web && CI=1 npm run test:a11y",
   "verify:electron": "npm run build:electron && xvfb-run -a npm run test:e2e:electron",
   "verify": "npm run verify:static && npm run verify:web && npm run verify:electron",
   "shots": "npm run build:web && CI=1 playwright test tests/shots.spec.ts --config=playwright.config.ts --project=Web-Chromium",
   ```

   Bare `test:e2e` is made safe by delegating to the two `verify:*` scripts, which build
   first. There is deliberately no `pretest:e2e:electron` hook: it would double-build inside
   `verify:electron`.
3. Create `scripts/preflight.sh`:

   ```bash
   #!/usr/bin/env bash
   # Pre-flight for plan executors (plans/CONVENTIONS.md §3).
   # Usage: bash scripts/preflight.sh NNN     e.g. bash scripts/preflight.sh 001
   # Exits 0 only when every check passes; prints one "preflight:" line per failure.
   set -u
   NNN="${1:-}"
   if [ -z "$NNN" ]; then
     echo "usage: bash scripts/preflight.sh NNN"
     exit 2
   fi
   fail=0
   say() { echo "preflight: $*"; }

   # 1. The plan file (plans/NNN-*.md; 006a/006b share plans/006-*.md).
   PLAN_FILE=$(ls plans/"${NNN}"-*.md 2>/dev/null | head -1)
   if [ -z "$PLAN_FILE" ]; then
     BASE="${NNN%%[a-z]*}"
     PLAN_FILE=$(ls plans/"${BASE}"-*.md 2>/dev/null | head -1)
   fi
   if [ -z "$PLAN_FILE" ]; then
     say "no plan file plans/${NNN}-*.md"
     exit 1
   fi

   # 2. Every plan in this plan's "Depends on" column of plans/README.md is DONE.
   ROW=$(grep -E "^\| *${NNN} *\|" plans/README.md | head -1)
   if [ -z "$ROW" ]; then
     say "no row for ${NNN} in plans/README.md"
     fail=1
   fi
   DEPS=$(echo "$ROW" | awk -F'|' '{print $7}' | tr -d '*' | tr ',' ' ')
   for dep in $DEPS; do
     [ "$dep" = "—" ] && continue
     STATUS=$(grep -E "^\| *${dep} *\|" plans/README.md | head -1 | awk -F'|' '{print $(NF-1)}' | sed 's/^ *//;s/ *$//')
     case "$STATUS" in
       DONE*) ;;
       *) say "plan ${dep} is '${STATUS:-missing}', not DONE"; fail=1 ;;
     esac
   done

   # 3. Every path in the plan's **Requires** line exists.
   REQ_LINE=$(grep -m1 -E '\*\*Requires\*\*' "$PLAN_FILE" || true)
   for p in $(echo "$REQ_LINE" | grep -oE '`[^`]+`' | tr -d '`'); do
     [ -e "$p" ] || { say "required artefact missing: $p"; fail=1; }
   done

   # 4. Tooling.
   [ -x node_modules/.bin/playwright ] || { say "node_modules/.bin/playwright missing: run npm install"; fail=1; }
   BROWSERS="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
   if ! ls -d "$BROWSERS"/chromium* >/dev/null 2>&1; then
     say "Playwright Chromium missing under ${BROWSERS}: run npx playwright install chromium"
     fail=1
   fi
   NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
   [ "${NODE_MAJOR:-0}" -ge 20 ] || { say "node 20+ required, found $(node -v)"; fail=1; }

   # 5. Branch.
   BRANCH=$(git branch --show-current)
   case "$BRANCH" in
     plan/${NNN}-*) ;;
     *) say "on branch '${BRANCH}', expected plan/${NNN}-<slug>"; fail=1 ;;
   esac

   [ "$fail" -eq 0 ] || exit 1
   say "OK: plan ${NNN} (${PLAN_FILE}) on ${BRANCH}"
   exit 0
   ```

**Do NOT**: change `lint`, `lint:strict`, `format:check` or any existing script other than
the two named; add `xvfb-run` to `test:e2e:electron` itself; edit `playwright.config.ts`;
run `npm run test:e2e`.

**Commands**: `bash scripts/preflight.sh 000`; `npm run verify:static`
**Expected**: preflight prints `preflight: OK: plan 000 (...) on plan/000-verification-infrastructure`, exit 0; `verify:static` exit 0.
**Check**: `node -e 'const s=require("./package.json").scripts;process.exit(["verify","verify:static","verify:web","verify:electron","shots"].every(k=>s[k])?0:1)'` exits 0 **and** `grep -cE 'Total: [0-9]+ tests in 2 files' docs/planning/verification-baseline.md` prints `2`.
**If it fails**: if `verify:static` fails only in `format:check`, run `npm run format` and retry once; any other failure is a pre-existing red gate — record its output under `## Before` and STOP.
**Commit**: `plan-000 step-1: baseline, gate scripts, preflight`

### Step 2: Fix the entry helper, add the surface helper, the screenshot harness and the toolbar test ids

**Files**: `src/store/gameStore.ts`, `src/App.tsx`, `src/components/MobileToolbar.tsx`,
`src/components/ConfirmDialog.tsx`, `tests/helpers/bypassLandingPage.ts`,
`tests/helpers/surfaces.ts`, `tests/shots.spec.ts`, `docs/planning/screenshots/000-baseline/`

**Do**:

1. `src/store/gameStore.ts`: replace the single line
   `if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {`
   (line 938) with:

   ```ts
   const exposeStoreForE2E =
     typeof window !== 'undefined' &&
     (import.meta.env.DEV ||
       import.meta.env.MODE === 'test' ||
       new URLSearchParams(window.location.search).has('e2e'));

   // Expose store to window for E2E testing: dev, vitest, or any build opened with ?e2e=1
   if (exposeStoreForE2E) {
   ```

   Delete the old comment line `// Expose store to window for E2E testing` above it.
2. `src/App.tsx` — add one attribute per row, on the line after the anchor:

   | Anchor (`grep -n … src/App.tsx`, exactly 1 hit each)                 | Add                                          |
   | -------------------------------------------------------------------- | -------------------------------------------- |
   | `className="toolbar fixed bottom-4`                                  | `data-testid="toolbar-root"` (on that `div`) |
   | `aria-label={isGamePaused ? 'Resume game' : 'Pause game'}`           | `data-testid="toolbar-pause"`                |
   | `aria-label="Select tool"`                                           | `data-testid="toolbar-tool-select"`          |
   | `aria-label="Marker tool"`                                           | `data-testid="toolbar-tool-marker"`          |
   | `aria-label="Eraser tool"`                                           | `data-testid="toolbar-tool-eraser"`          |
   | `aria-label="Wall tool"`                                             | `data-testid="toolbar-tool-wall"`            |
   | `aria-label="Door tool"`                                             | `data-testid="toolbar-tool-door"`            |
   | `aria-label="Measure tool"`                                          | `data-testid="toolbar-tool-measure"`         |

3. `src/components/MobileToolbar.tsx`: add `data-testid="toolbar-mobile-root"` to the `<div`
   that follows the comment `{/* Bottom Navigation Bar */}`; `data-testid="toolbar-mobile-more"`
   to the `<button onClick={handleMoreClick}`; `data-testid="toolbar-mobile-more-menu"` to the
   `<div` whose className starts `fixed bottom-16 right-0 left-0`.
4. `src/components/ConfirmDialog.tsx`: add `data-testid="dialog-confirm-root"` to the `div`
   carrying `aria-labelledby="confirm-dialog-title"`.
5. `tests/helpers/bypassLandingPage.ts`: replace everything from the comment
   `// 4. Navigate to app` through the `.catch(...)` block's closing `});` (lines 103–116) with:

   ```ts
     // 4. Navigate with ?e2e=1 so window.__GAME_STORE__ is exposed in every build
     await page.goto('/?e2e=1');

     // 5. Enter the editor. Nothing auto-enters EDITOR; New Campaign is the only path.
     await page.waitForSelector('[data-testid="new-campaign-button"]', {
       timeout: 10000,
       state: 'visible',
     });
     await page.click('[data-testid="new-campaign-button"]');
     await page.waitForSelector('[data-testid="editor-view"]', { timeout: 10000, state: 'visible' });
   ```

   Keep the following `waitForLoadState('networkidle')` and the rest of the file.
6. Create `tests/helpers/surfaces.ts`:

   ```ts
   /**
    * Surface helper (plans/CONVENTIONS.md §1): navigates to a named surface in a theme and
    * returns the page to inspect (a new World page for `world` / `world-dialog`).
    *
    * Runs the app in plain web mode. No Electron mocks are injected: `src/services/storage.ts`
    * treats a present `window.ipcRenderer` as Electron, and `SyncManager` then skips
    * BroadcastChannel. Every URL carries `?e2e=1` so `src/store/gameStore.ts` exposes
    * `window.__GAME_STORE__` in the production build too.
    */
   import { expect } from '@playwright/test';
   import type { Page } from '@playwright/test';

   export const SURFACES = [
     'home',
     'editor',
     'editor-mobile',
     'confirm-dialog',
     'world',
     'world-dialog',
     'design-system',
   ] as const;
   export type Surface = (typeof SURFACES)[number];

   export const THEMES = ['light', 'dark'] as const;
   export type Theme = (typeof THEMES)[number];

   export const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
   export const MOBILE_VIEWPORT = { width: 390, height: 844 };

   interface StoreWindow extends Window {
     __GAME_STORE__?: {
       getState: () => {
         showConfirmDialog: (message: string, onConfirm: () => void, confirmText?: string) => void;
       };
     };
     __syncLog?: string[];
   }

   /** Seeds the theme (read by WebStorageService) and a deterministic Math.random. */
   async function prepare(page: Page, theme: Theme): Promise<void> {
     await page.emulateMedia({ reducedMotion: 'reduce' });
     await page.addInitScript((seedTheme: string) => {
       localStorage.setItem('graphium-theme', seedTheme);
       // mulberry32: HomeScreen picks a random title; screenshots must not depend on it.
       let seed = 0x9e3779b9;
       Math.random = (): number => {
         seed = (seed + 0x6d2b79f5) | 0;
         let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
         t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
         return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
       };
     }, theme);
   }

   async function load(page: Page, url: string, theme: Theme): Promise<void> {
     await page.goto(url);
     await page.waitForSelector('#root:visible', { timeout: 30000 });
     await page.waitForFunction(
       (t: string) => document.documentElement.getAttribute('data-theme') === t,
       theme,
     );
     await page.waitForLoadState('networkidle');
   }

   async function gotoHome(page: Page, theme: Theme): Promise<void> {
     await page.setViewportSize(DESKTOP_VIEWPORT);
     await prepare(page, theme);
     await load(page, '/?e2e=1', theme);
     await expect(page.locator('[data-testid="new-campaign-button"]')).toBeVisible();
   }

   async function gotoEditor(
     page: Page,
     theme: Theme,
     viewport: { width: number; height: number },
   ): Promise<void> {
     await page.setViewportSize(viewport);
     await prepare(page, theme);
     await load(page, '/?e2e=1', theme);
     await page.locator('[data-testid="new-campaign-button"]').click();
     await expect(page.locator('[data-testid="editor-view"]')).toBeVisible();
     await page.waitForLoadState('networkidle');
   }

   /** Opens ConfirmDialog through the store; the dialog is per window, never synced. */
   export async function openConfirmDialog(page: Page): Promise<void> {
     await page.evaluate(() => {
       const store = (window as StoreWindow).__GAME_STORE__;
       if (!store) {
         throw new Error('window.__GAME_STORE__ is missing; the URL must carry ?e2e=1');
       }
       store
         .getState()
         .showConfirmDialog('Delete this map? This cannot be undone.', () => undefined, 'Delete');
     });
     await expect(page.locator('[data-testid="dialog-confirm-root"]')).toBeVisible();
   }

   /** `page` becomes the broadcasting Architect tab; the returned page is the World View. */
   async function gotoWorld(page: Page, theme: Theme): Promise<Page> {
     await gotoEditor(page, theme, DESKTOP_VIEWPORT);
     const world = await page.context().newPage();
     await world.setViewportSize(DESKTOP_VIEWPORT);
     await prepare(world, theme);
     await world.addInitScript(() => {
       // A second channel with the same name receives everything the Architect sends.
       const log: string[] = [];
       (window as StoreWindow).__syncLog = log;
       const sniffer = new BroadcastChannel('graphium-sync');
       sniffer.onmessage = (event: MessageEvent<{ type?: string }>): void => {
         if (event.data?.type) {
           log.push(event.data.type);
         }
       };
     });
     await load(world, '/?type=world&e2e=1', theme);
     await expect(world.locator('[data-testid="editor-view"]')).toBeVisible();
     await world.waitForFunction(() =>
       ((window as StoreWindow).__syncLog ?? []).includes('FULL_SYNC'),
     );
     return world;
   }

   async function gotoDesignSystem(page: Page, theme: Theme): Promise<void> {
     await page.setViewportSize(DESKTOP_VIEWPORT);
     await prepare(page, theme);
     await load(page, '/design-system?e2e=1', theme);
     await expect(page.getByRole('button', { name: /Switch to (Dark|Light) Mode/ })).toBeVisible();
   }

   export async function gotoSurface(page: Page, surface: Surface, theme: Theme): Promise<Page> {
     switch (surface) {
       case 'home':
         await gotoHome(page, theme);
         return page;
       case 'editor':
         await gotoEditor(page, theme, DESKTOP_VIEWPORT);
         return page;
       case 'editor-mobile':
         await gotoEditor(page, theme, MOBILE_VIEWPORT);
         await expect(page.locator('[data-testid="toolbar-mobile-root"]')).toBeVisible();
         return page;
       case 'confirm-dialog':
         await gotoEditor(page, theme, DESKTOP_VIEWPORT);
         await openConfirmDialog(page);
         return page;
       case 'world':
         return gotoWorld(page, theme);
       case 'world-dialog': {
         const world = await gotoWorld(page, theme);
         await openConfirmDialog(world);
         return world;
       }
       case 'design-system':
         await gotoDesignSystem(page, theme);
         return page;
       default: {
         const never: never = surface;
         throw new Error(`Unknown surface ${String(never)}`);
       }
     }
   }
   ```

7. Create `tests/shots.spec.ts` (runs in every web gate as a surface smoke test; writes to
   `test-results/shots/` unless `SHOTS_OUT` is set):

   ```ts
   import fs from 'node:fs';
   import path from 'node:path';

   import { test } from '@playwright/test';

   import { SURFACES, THEMES, gotoSurface } from './helpers/surfaces';

   const outDir = process.env.SHOTS_OUT ?? 'test-results/shots';

   test.describe('Surface screenshots', () => {
     test.beforeAll(() => {
       fs.mkdirSync(outDir, { recursive: true });
     });

     for (const surface of SURFACES) {
       for (const theme of THEMES) {
         test(`${surface} ${theme}`, async ({ page }) => {
           const target = await gotoSurface(page, surface, theme);
           await target.waitForTimeout(250);
           await target.screenshot({
             path: path.join(outDir, `${surface}-${theme}.png`),
             fullPage: false,
             animations: 'disabled',
           });
         });
       }
     }
   });
   ```

**Do NOT**: add `hasTouch` or a second Playwright project; mock `window.ipcRenderer` in the
surface helper; rename or remove any existing `data-testid`; touch `tests/helpers/campaignHelpers.ts`;
change what any toolbar button renders.

**Commands**: `npm run verify:static`; `npm run verify:web`;
`SHOTS_OUT=docs/planning/screenshots/000-baseline npm run shots`
**Expected**: all exit 0; the last prints `14 passed`.
**Check**: `ls docs/planning/screenshots/000-baseline/*.png | wc -l` prints `14` **and**
`grep -c 'data-testid="toolbar-' src/App.tsx` prints `8`.
**If it fails**: a `world` test failing on `FULL_SYNC` means the Architect tab did not answer
over BroadcastChannel — confirm `grep -n "ipcRenderer" tests/helpers/surfaces.ts` returns
nothing and retry once; otherwise STOP with the failing test's output.
**Commit**: `plan-000 step-2: surface helper, screenshot harness, toolbar test ids`

### Step 3: Rewrite the visual spec on the surface helper and commit baselines

**Files**: `tests/visual.spec.ts`, `playwright.config.ts`, `tests/visual.spec.ts-snapshots/`

**Do**:

1. Replace `tests/visual.spec.ts` with:

   ```ts
   import { test, expect } from '@playwright/test';

   import { SURFACES, THEMES, gotoSurface } from './helpers/surfaces';

   test.describe('Visual regression', () => {
     for (const surface of SURFACES) {
       for (const theme of THEMES) {
         test(`${surface} ${theme}`, async ({ page }) => {
           const target = await gotoSurface(page, surface, theme);
           await target.waitForTimeout(250);
           await expect(target).toHaveScreenshot(`${surface}-${theme}.png`, {
             maxDiffPixelRatio: 0.01,
             animations: 'disabled',
           });
         });
       }
     }
   });
   ```

2. In `playwright.config.ts`, delete the line `/tests\/visual\.spec\.ts/,` from `testIgnore`.
3. Generate baselines:
   `npm run build:web && CI=1 npx playwright test tests/visual.spec.ts --project=Web-Chromium --update-snapshots`

**Do NOT**: remove any other `testIgnore` entry (Step 7 does); change `maxDiffPixelRatio`;
mask or hide elements; commit snapshots generated without `CI=1`.

**Commands**: `npm run build:web && CI=1 npx playwright test tests/visual.spec.ts --project=Web-Chromium`; `npm run verify:static`
**Expected**: `14 passed`, exit 0; exit 0.
**Check**: `ls tests/visual.spec.ts-snapshots/*.png | wc -l` prints `14`.
**If it fails**: run the spec a second time without `--update-snapshots`; if any surface differs from its own fresh baseline, that surface is non-deterministic — STOP with the diff image path.
**Commit**: `plan-000 step-3: visual spec on surfaces with baselines`

### Step 4: Rewrite the accessibility suite over seven surfaces × two themes and triage

**Files**: `tests/accessibility.spec.ts`, `docs/planning/verification-baseline.md`, and, only
for category (a) fixes, any `src/components/**/*.tsx` file named in a violation's
`nodes[].target` — attribute additions only (`aria-label`, `aria-labelledby`, `id`, `htmlFor`,
`role`).

**Do**:

1. Replace `tests/accessibility.spec.ts` with:

   ```ts
   /**
    * WCAG 2.1 AA audit (axe-core) on every surface in both themes: 14 scans.
    * Exclusions: `canvas` (Konva graphics) and `[aria-disabled="true"]` (intentional, see
    * docs/features/wcag-audit.md). Do not add exclusions here.
    */
   import fs from 'node:fs';

   import AxeBuilder from '@axe-core/playwright';
   import { test, expect } from '@playwright/test';

   import { SURFACES, THEMES, gotoSurface } from './helpers/surfaces';
   import type { Surface } from './helpers/surfaces';

   // Surfaces whose only remaining violations are `color-contrast`. Each entry is recorded in
   // docs/planning/verification-baseline.md, fixed by plan 006. Plan 006b empties this list.
   const CONTRAST_DEFERRED: Surface[] = [];

   test.describe('Accessibility audit (WCAG 2.1 AA)', () => {
     for (const surface of SURFACES) {
       for (const theme of THEMES) {
         test(`${surface} ${theme} has no WCAG AA violations`, async ({ page }) => {
           const target = await gotoSurface(page, surface, theme);
           await target.waitForTimeout(250);

           let builder = new AxeBuilder({ page: target })
             .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
             .exclude('canvas')
             .exclude('[aria-disabled="true"]');
           if (CONTRAST_DEFERRED.includes(surface)) {
             builder = builder.disableRules(['color-contrast']);
           }
           const results = await builder.analyze();

           if (results.violations.length > 0) {
             fs.writeFileSync(
               `accessibility-violations-${surface}-${theme}.json`,
               JSON.stringify(results.violations, null, 2),
             );
           }
           expect(results.violations).toEqual([]);
         });
       }
     }
   });
   ```

   The old "System theme syncs with OS preference" test (CI-skipped) and the
   "variables are defined" test are dropped; record both under `## Deleted tests`.
2. Run `npm run build:web && CI=1 npm run test:a11y`. For every failing scan open its
   `accessibility-violations-<surface>-<theme>.json` and classify each violation `id`:
   - **(b) `color-contrast`** — add the surface to `CONTRAST_DEFERRED`; add a row to the
     triage table in the baseline doc (`surface | theme | rule | selector | ratio`).
   - **(a) anything else** — fix by adding an attribute to the named element in
     `src/components/**`. If the fix needs a markup change, a new element, or a colour: STOP.
   - **(c) suspected false positive** — treat as (a); there is no exclusion path.
3. Write the triage table under `## Accessibility triage` in the baseline doc, one row per
   violation found, including the ones fixed.

**Do NOT**: add `.exclude()` calls; call `disableRules` outside the `CONTRAST_DEFERRED`
branch; put a surface in `CONTRAST_DEFERRED` that has a non-contrast violation; edit
`accessibility.yml` (Step 10).

**Commands**: `npm run verify:static`; `npm run verify:web`;
`CI=1 npm run test:a11y -- --list | tail -1`
**Expected**: exit 0; exit 0; `Total: 14 tests in 1 file`.
**Check**: `CI=1 npm run test:a11y` exits 0 **and** every surface named in `CONTRAST_DEFERRED` has at least one row in the triage table.
**If it fails**: a scan still failing after one attribute fix is a STOP; attach the JSON.
**Commit**: `plan-000 step-4: a11y audit on every surface`

### Step 5: Add root test ids to the remaining overlays

**Files**: `src/components/DungeonGeneratorDialog.tsx`, `src/components/AboutModal.tsx`,
`src/components/UpdateManager.tsx`, `src/components/MapSettingsSheet.tsx`,
`src/components/MobileSidebarDrawer.tsx`, `src/components/MobileBottomSheet.tsx`,
`src/components/AssetLibrary/AddToLibraryDialog.tsx`, `src/components/AssetLibrary/LibraryManager.tsx`,
`src/components/AssetLibrary/TokenMetadataEditor.tsx`, `src/components/ImageCropper.tsx`,
`src/components/SessionConsole/SessionConsoleEditorSheet.tsx`,
`src/components/SessionConsole/SessionConsoleSettingsSheet.tsx` (one attribute each)

**Do**: add the attribute to the element whose opening tag contains the anchor (each anchor
has exactly one hit in its file; verify with `grep -c`):

| File                                  | Anchor                                          | Attribute                                              |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| `DungeonGeneratorDialog.tsx`          | `aria-labelledby="dungeon-dialog-title"`        | `data-testid="dialog-dungeon-generator-root"`          |
| `AboutModal.tsx`                      | `className="about-modal-backdrop"`              | `data-testid="dialog-about-root"`                      |
| `UpdateManager.tsx`                   | `className="fixed inset-0 z-[200]`              | `data-testid="dialog-update-manager-root"`             |
| `MapSettingsSheet.tsx`                | `className="fixed right-0 top-0 bottom-0`       | `data-testid="sheet-map-settings-root"`                |
| `MobileSidebarDrawer.tsx`             | `aria-label="Navigation menu"`                  | `data-testid="sheet-mobile-sidebar-root"`              |
| `MobileBottomSheet.tsx`               | `aria-label="Bottom sheet"`                     | `data-testid="sheet-mobile-bottom-root"`               |
| `AssetLibrary/AddToLibraryDialog.tsx` | `className="fixed inset-0 z-50`                 | `data-testid="dialog-add-to-library-root"`             |
| `AssetLibrary/LibraryManager.tsx`     | `className="fixed inset-0 z-50`                 | `data-testid="dialog-library-manager-root"`            |
| `AssetLibrary/TokenMetadataEditor.tsx`| `className="fixed inset-0 z-50`                 | `data-testid="dialog-token-metadata-root"`             |
| `ImageCropper.tsx`                    | `className="fixed inset-0 z-50`                 | `data-testid="dialog-image-cropper-root"`              |
| `SessionConsoleEditorSheet.tsx`       | `data-esc-owns="true"`                          | `data-testid="sheet-session-console-editor-root"`      |
| `SessionConsoleSettingsSheet.tsx`     | `data-esc-owns="true"`                          | `data-testid="sheet-session-console-settings-root"`    |

**Do NOT**: add `role`, `aria-modal` or `data-esc-owns` anywhere (Step 6 records their
absence; plan 004 adds them); move the attribute to an inner element; touch `ConfirmDialog.tsx`
(done in Step 2).

**Commands**: `npm run verify:static`; `npm run verify:web`
**Expected**: exit 0; exit 0.
**Check**: `grep -rhoE 'data-testid="(dialog|sheet)-[a-z-]+-root"' src/components | sort -u | wc -l` prints `13`.
**If it fails**: an anchor with 0 or 2+ hits means drift — STOP.
**Commit**: `plan-000 step-5: overlay root test ids`

### Step 6: Add the overlay-contract spec

**Files**: `tests/functional/overlays.spec.ts`, `docs/planning/verification-baseline.md`

**Do**: create `tests/functional/overlays.spec.ts`. Every row encodes today's behaviour as
read from the component (grounded at `d3d3642`); plan 004 flips fields to `true` as it
migrates each overlay.

```ts
/**
 * Overlay contract — characterisation spec. Each row records what the overlay does TODAY.
 * Plan 004 flips a row's expectations as it migrates that overlay. Rows with `open: null`
 * cannot be opened deterministically from a fresh campaign; they are asserted by name so the
 * gap stays visible.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { gotoSurface, openConfirmDialog } from '../helpers/surfaces';
import type { Surface } from '../helpers/surfaces';

interface OverlayCase {
  name: string;
  surface: Surface;
  root: string;
  open: ((page: Page) => Promise<void>) | null;
  hasRole: boolean; // role="dialog" on the root or inside it
  hasAriaModal: boolean; // aria-modal="true" on the root or inside it
  escOwns: boolean; // data-esc-owns="true" on the root or inside it
  escapeCloses: boolean; // Escape hides the root
  trapsFocus: boolean; // focus is inside the root after each of 40 Tabs
}

const OVERLAYS: OverlayCase[] = [
  {
    name: 'ConfirmDialog',
    surface: 'editor',
    root: '[data-testid="dialog-confirm-root"]',
    open: openConfirmDialog,
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'DungeonGeneratorDialog',
    surface: 'home',
    root: '[data-testid="dialog-dungeon-generator-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Generate a procedural dungeon"]').click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'AboutModal',
    surface: 'editor',
    root: '[data-testid="dialog-about-root"]',
    open: async (page) => {
      await page.keyboard.press('?');
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
  {
    name: 'UpdateManager',
    surface: 'editor',
    root: '[data-testid="dialog-update-manager-root"]',
    open: async (page) => {
      await page.keyboard.press('?');
      await page.getByRole('button', { name: 'Consult the Archives' }).click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'MapSettingsSheet',
    surface: 'editor',
    root: '[data-testid="sheet-map-settings-root"]',
    open: async (page) => {
      await page.getByRole('button', { name: 'New Map' }).click();
    },
    hasRole: false,
    hasAriaModal: false,
    escOwns: false,
    escapeCloses: false,
    trapsFocus: false,
  },
  {
    name: 'LibraryManager',
    surface: 'editor',
    root: '[data-testid="dialog-library-manager-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Manage library"]').click();
    },
    hasRole: false,
    hasAriaModal: false,
    escOwns: false,
    escapeCloses: false,
    trapsFocus: false,
  },
  {
    name: 'SessionConsoleSettingsSheet',
    surface: 'editor',
    root: '[data-testid="sheet-session-console-settings-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Session Console settings"]').click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'MobileSidebarDrawer',
    surface: 'editor-mobile',
    root: '[data-testid="sheet-mobile-sidebar-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Open menu"]').click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: false,
    escapeCloses: true,
    trapsFocus: false,
  },
  // Not openable from a fresh campaign without a token, a library item, an image or a track.
  {
    name: 'MobileBottomSheet',
    surface: 'editor-mobile',
    root: '[data-testid="sheet-mobile-bottom-root"]',
    open: null,
    hasRole: true,
    hasAriaModal: true,
    escOwns: false,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'AddToLibraryDialog',
    surface: 'editor',
    root: '[data-testid="dialog-add-to-library-root"]',
    open: null,
    hasRole: false,
    hasAriaModal: false,
    escOwns: false,
    escapeCloses: false,
    trapsFocus: false,
  },
  {
    name: 'TokenMetadataEditor',
    surface: 'editor',
    root: '[data-testid="dialog-token-metadata-root"]',
    open: null,
    hasRole: false,
    hasAriaModal: false,
    escOwns: false,
    escapeCloses: false,
    trapsFocus: false,
  },
  {
    name: 'ImageCropper',
    surface: 'editor',
    root: '[data-testid="dialog-image-cropper-root"]',
    open: null,
    hasRole: false,
    hasAriaModal: false,
    escOwns: false,
    escapeCloses: false,
    trapsFocus: false,
  },
  {
    name: 'SessionConsoleEditorSheet',
    surface: 'editor',
    root: '[data-testid="sheet-session-console-editor-root"]',
    open: null,
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: false,
  },
];

const UNREACHABLE = OVERLAYS.filter((o) => o.open === null).map((o) => o.name);

test.describe('Overlay contract', () => {
  test('overlays that cannot be opened from a fresh campaign are recorded', () => {
    expect(UNREACHABLE).toEqual([
      'MobileBottomSheet',
      'AddToLibraryDialog',
      'TokenMetadataEditor',
      'ImageCropper',
      'SessionConsoleEditorSheet',
    ]);
  });

  for (const overlay of OVERLAYS) {
    const open = overlay.open;
    if (open === null) {
      continue;
    }
    test(overlay.name, async ({ page }) => {
      await gotoSurface(page, overlay.surface, 'light');
      await open(page);
      const root = page.locator(overlay.root);
      await expect(root).toBeVisible();

      const has = async (selector: string): Promise<boolean> =>
        (await page.locator(`${overlay.root}${selector}, ${overlay.root} ${selector}`).count()) >
        0;
      expect(await has('[role="dialog"]'), 'role="dialog"').toBe(overlay.hasRole);
      expect(await has('[aria-modal="true"]'), 'aria-modal="true"').toBe(overlay.hasAriaModal);
      expect(await has('[data-esc-owns="true"]'), 'data-esc-owns="true"').toBe(overlay.escOwns);

      let inside = true;
      for (let i = 0; i < 40 && inside; i += 1) {
        await page.keyboard.press('Tab');
        inside = await root.evaluate((el) => el.contains(document.activeElement));
      }
      expect(inside, 'focus stays inside the overlay for 40 Tabs').toBe(overlay.trapsFocus);

      await page.keyboard.press('Escape');
      if (overlay.escapeCloses) {
        await expect(root).toBeHidden();
      } else {
        await expect(root).toBeVisible();
      }
    });
  }
});
```

Run it. `hasRole`, `hasAriaModal`, `escOwns` and `escapeCloses` were read from the source
and must hold. `trapsFocus` is measured: if a row fails **only** on the
`focus stays inside` assertion, set that row's `trapsFocus` to the observed value and add a
line under `## Overlay contract` in the baseline doc naming the row and the flip.

**Do NOT**: add `role`/`aria-modal`/`data-esc-owns`/Escape handlers to any component to make a
row pass; delete a row; change a value other than `trapsFocus`; use `test.skip` for the
`open: null` rows.

**Commands**: `npm run build:web && CI=1 npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium`; `npm run verify:static`
**Expected**: `9 passed`, exit 0; exit 0.
**Check**: `CI=1 npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium --list | tail -1` prints `Total: 9 tests in 1 file` and the run above exits 0.
**If it fails**: a failure on `toBeVisible()` right after `open` means the open path is wrong — STOP with the row name; a failure on a source-read field means drift — STOP.
**Commit**: `plan-000 step-6: overlay contract spec`

### Step 7: Triage the ignored specs, add smoke specs, guard the config

**Files**: delete `tests/functional/data-integrity.spec.ts`, `tests/functional/error-handling.spec.ts`,
`tests/functional/map-management.spec.ts`, `tests/functional/token-library.spec.ts`,
`tests/functional/token-management.spec.ts`, `tests/functional/state-persistence.spec.ts`,
`tests/functional/touch-interactions.spec.ts`, `tests/functional/error-boundary-debugging.spec.ts`,
`tests/functional/campaign-workflow.spec.ts`, `tests/performance/drawing-performance.spec.ts`;
edit `tests/functional/dm-world-sync.spec.ts`, `playwright.config.ts`,
`docs/planning/verification-baseline.md`; create `tests/functional/editor-smoke.spec.ts`,
`tests/functional/mobile-smoke.spec.ts`, `tests/unit/playwrightConfig.test.ts`.

**Do**:

1. Record the evidence first, then delete. Run and paste the output under
   `## Deleted specs` in the baseline doc:

   ```bash
   APP=$(grep -rhoE 'data-testid="[^"]+"' src/ | sed -E 's/data-testid="([^"]+)"/\1/' | sort -u)
   for f in tests/functional/*.spec.ts tests/performance/*.spec.ts; do
     need=$(grep -ohE 'data-testid[="^~*]+[a-z0-9-]+' "$f" | sed -E 's/data-testid[="^~*]+//' | sort -u)
     total=$(echo "$need" | grep -c .); miss=0
     for t in $need; do echo "$APP" | grep -qx "$t" || miss=$((miss+1)); done
     echo "$f needs=$total missing=$miss"
   done
   ```

   At `d3d3642` this prints (needs/missing): campaign-workflow 20/18, data-integrity 24/23,
   dm-world-sync 0/0, door-sync 0/0, error-boundary-debugging 4/4, error-handling 28/27,
   map-management 30/30, state-persistence 12/11, token-library 30/30, token-management
   23/23, touch-interactions 8/8, drawing-performance 2/2. Delete the ten files listed under
   **Files**. `campaign-workflow.spec.ts` goes too: 5 of its 9 tests are `test.skip` and 3 sit
   in a `test.describe.skip`; its one live test (new campaign opens the editor) is covered by
   `editor-smoke.spec.ts`. Write one line of lost coverage per deleted file.
2. `tests/functional/dm-world-sync.spec.ts`: delete every line matching `createNewCampaign`
   (`grep -n createNewCampaign` — the import and one call per test; the bypass helper now
   lands in the editor). Nothing else changes; its `window.ipcRenderer` assertion depends on
   the helper's mocks, which stay.
3. `playwright.config.ts`: reduce `testIgnore` to exactly:

   ```ts
         testIgnore: [/.*\.electron\.spec\.ts/, /tests\/unit\//, /tests\/integration\//],
   ```

   and delete the three comment lines that explained the stale entries.
4. Create `tests/functional/editor-smoke.spec.ts`:

   ```ts
   import { test, expect } from '@playwright/test';

   import { gotoSurface } from '../helpers/surfaces';

   // Shortcuts from the keydown switch in src/App.tsx. 'r' rotates a door when the door tool
   // is active, so every shortcut test starts from the select tool.
   const TOOLS = [
     { name: 'select', key: 'v' },
     { name: 'marker', key: 'm' },
     { name: 'eraser', key: 'e' },
     { name: 'wall', key: 'w' },
     { name: 'door', key: 'd' },
     { name: 'measure', key: 'r' },
   ] as const;

   test.describe('Editor smoke', () => {
     test('new campaign opens the editor with the toolbar and select active', async ({ page }) => {
       await gotoSurface(page, 'editor', 'light');
       await expect(page.locator('[data-testid="toolbar-root"]')).toBeVisible();
       await expect(page.locator('[data-testid="toolbar-tool-select"]')).toHaveClass(/\bactive\b/);
       // Pause only works under Electron (handlePauseToggle returns without ipcRenderer).
       await expect(page.locator('[data-testid="toolbar-pause"]')).toHaveAttribute(
         'aria-label',
         'Pause game',
       );
     });

     for (const tool of TOOLS) {
       test(`clicking ${tool.name} activates it`, async ({ page }) => {
         await gotoSurface(page, 'editor', 'light');
         const button = page.locator(`[data-testid="toolbar-tool-${tool.name}"]`);
         await button.click();
         await expect(button).toHaveClass(/\bactive\b/);
       });

       test(`pressing ${tool.key} activates ${tool.name}`, async ({ page }) => {
         await gotoSurface(page, 'editor', 'light');
         await page.locator('[data-testid="toolbar-tool-select"]').click();
         await page.keyboard.press(tool.key);
         await expect(page.locator(`[data-testid="toolbar-tool-${tool.name}"]`)).toHaveClass(
           /\bactive\b/,
         );
       });
     }
   });
   ```

5. Create `tests/functional/mobile-smoke.spec.ts`:

   ```ts
   import { test, expect } from '@playwright/test';

   import { gotoSurface } from '../helpers/surfaces';

   test.describe('Mobile smoke', () => {
     test('mobile toolbar has five buttons and no desktop toolbar', async ({ page }) => {
       await gotoSurface(page, 'editor-mobile', 'light');
       await expect(page.locator('[data-testid="toolbar-mobile-root"] button')).toHaveCount(5);
       await expect(page.locator('[data-testid="toolbar-root"]')).toHaveCount(0);
     });

     test('more menu opens', async ({ page }) => {
       await gotoSurface(page, 'editor-mobile', 'light');
       await page.locator('[data-testid="toolbar-mobile-more"]').click();
       await expect(page.locator('[data-testid="toolbar-mobile-more-menu"]')).toBeVisible();
     });
   });
   ```

6. Create `tests/unit/playwrightConfig.test.ts` (vitest; keeps `testIgnore` and the no-skip
   rule from regrowing silently):

   ```ts
   import fs from 'node:fs';
   import path from 'node:path';
   import { fileURLToPath } from 'node:url';

   import { describe, expect, it } from 'vitest';

   import config from '../../playwright.config';

   const TESTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
   // The single permitted skip: plan 005's opt-in profiling spec.
   const ALLOWED_SKIP = "test.skip(!process.env.PERF, 'set PERF=1 to profile')";

   function listSpecFiles(dir: string): string[] {
     const out: string[] = [];
     for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
       const full = path.join(dir, entry.name);
       if (entry.isDirectory()) {
         out.push(...listSpecFiles(full));
       } else if (/\.(spec|test)\.tsx?$/.test(entry.name)) {
         out.push(full);
       }
     }
     return out;
   }

   describe('playwright.config.ts guard', () => {
     it('Web-Chromium ignores only the three structural patterns', () => {
       const web = config.projects?.find((p) => p.name === 'Web-Chromium');
       expect(web).toBeDefined();
       const ignore = web?.testIgnore;
       expect(Array.isArray(ignore) ? ignore.length : -1).toBe(3);
     });

     it('no spec under tests/ is skipped or fixme', () => {
       const offenders: string[] = [];
       for (const file of listSpecFiles(TESTS_DIR)) {
         fs.readFileSync(file, 'utf8')
           .split('\n')
           .forEach((line, index) => {
             if (
               /\b(test|describe|testInfo)\.(skip|fixme)\(/.test(line) &&
               !line.includes(ALLOWED_SKIP)
             ) {
               offenders.push(`${path.relative(TESTS_DIR, file)}:${index + 1}`);
             }
           });
       }
       expect(offenders).toEqual([]);
     });
   });
   ```

7. Run `npm run verify:web`. If a test in `door-sync.spec.ts` or `dm-world-sync.spec.ts` fails
   twice for a reason other than a missing helper, delete **that test only**, record it under
   `## Deleted tests` with the failure's first line, and re-run. If a file ends up with no
   tests, delete the file and record it.

**Do NOT**: delete or edit `door-sync.spec.ts` beyond step 7 above; edit `tests/helpers/campaignHelpers.ts`
or `mockElectronAPIs.ts`; keep any deleted spec "for reference"; add a fourth `testIgnore`
entry; add `test.skip` anywhere.

**Commands**: `npm run verify:static`; `npm run verify:web`;
`CI=1 npx playwright test --project=Web-Chromium --list | tail -1`;
`grep -rnE '\b(test|describe|testInfo)\.(skip|fixme)\(' tests/ | grep -vF "test.skip(!process.env.PERF, 'set PERF=1 to profile')"`
**Expected**: exit 0; exit 0; `Total: N tests in 8 files` (record N; 75 if no legacy test was deleted); no output.
**Check**: `grep -cE '^\s+/.*/,$' playwright.config.ts` prints `0` and the `--list` line says `in 8 files`.
**If it fails**: if `tests/unit/playwrightConfig.test.ts` cannot import `playwright.config.ts` under vitest, replace the first `it` with a text check — read the file, take the substring between `testIgnore: [` and the next `]`, split on `,`, and expect three non-blank regex literals — then retry once; anything else: STOP.
**Commit**: `plan-000 step-7: spec triage, smoke specs, config guard`

### Step 8: Record the touch-target baseline as a spec

**Files**: `tests/touch-targets.spec.ts`, `docs/planning/verification-baseline.md`

**Do**: create `tests/touch-targets.spec.ts`:

```ts
/**
 * Touch-target baseline. These record what ships today (grounded at d3d3642); they do not
 * impose a standard. Plan 006 may not shrink any of them.
 */
import { test, expect } from '@playwright/test';

import { gotoSurface } from './helpers/surfaces';

const MOBILE_MENU_MIN = 48; // src/App.tsx: minWidth/minHeight '48px'
const MOBILE_TOOLBAR_MIN = 56; // src/components/MobileToolbar.tsx: min-h-[56px]
// Desktop .btn-tool has no minimum. Pinned from the first run's failure output (Step 8).
const BTN_TOOL_WIDTH = -1;
const BTN_TOOL_HEIGHT = -1;

test.describe('Touch targets', () => {
  test('mobile menu button is at least 48 x 48', async ({ page }) => {
    await gotoSurface(page, 'editor-mobile', 'light');
    const box = await page.locator('[aria-label="Open menu"]').boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(MOBILE_MENU_MIN);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MOBILE_MENU_MIN);
  });

  test('mobile toolbar buttons are at least 56 tall', async ({ page }) => {
    await gotoSurface(page, 'editor-mobile', 'light');
    const buttons = page.locator('[data-testid="toolbar-mobile-root"] button');
    await expect(buttons).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      const box = await buttons.nth(i).boundingBox();
      expect(box?.height ?? 0, `button ${i}`).toBeGreaterThanOrEqual(MOBILE_TOOLBAR_MIN);
    }
  });

  test('desktop .btn-tool size is unchanged', async ({ page }) => {
    await gotoSurface(page, 'editor', 'light');
    const box = await page.locator('[data-testid="toolbar-tool-select"]').boundingBox();
    expect(box).not.toBeNull();
    expect({ width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0) }).toEqual(
      { width: BTN_TOOL_WIDTH, height: BTN_TOOL_HEIGHT },
    );
  });
});
```

Then pin the desktop value: run the spec (it must fail on `desktop .btn-tool`, printing the
received `width`/`height`), copy those two integers into `BTN_TOOL_WIDTH`/`BTN_TOOL_HEIGHT`,
re-run (passes), and record them under `## Touch targets` in the baseline doc, together with
the note that `.btn-tool` has no minimum and that `TokenInspector`'s 44 px buttons and
HomeScreen's ≤ 480 px rules are unasserted (they need a selected token / a 480 px viewport).
Finally prove the mobile assertions bite: set `MOBILE_MENU_MIN` to `1000`, run (fails),
restore `48`, run (passes).

**Do NOT**: invent a `.btn-tool` minimum; edit any `src/` file; assert `TokenInspector`
targets.

**Commands**: `npm run build:web && CI=1 npx playwright test tests/touch-targets.spec.ts --project=Web-Chromium` (three runs as described); `npm run verify:static`
**Expected**: run 1 exit 1 with `Expected: … "width": -1` in the output; run 2 exit 0; the `1000` run exit 1; final run exit 0; `verify:static` exit 0.
**Check**: `grep -E 'BTN_TOOL_(WIDTH|HEIGHT) = [0-9]+;' tests/touch-targets.spec.ts | wc -l` prints `2` and the final run printed `3 passed`.
**If it fails**: if run 1 fails on a mobile test, the `editor-mobile` surface is broken — STOP.
**Commit**: `plan-000 step-8: touch-target baseline spec`

### Step 9: Add non-colour token families and alias them into Tailwind

**Files**: `src/styles/theme.css`, `src/index.css`, `tests/functional/tokens.spec.ts`,
`docs/planning/verification-baseline.md`

**Do**:

1. Confirm the seed values against Tailwind's defaults (they must match, or this step is not
   pixel-inert):
   `grep -E '^\s*--(radius-(sm|md|lg)|shadow-(sm|lg|2xl)|ease-out|text-(xs|sm|base|lg|xl|2xl)|font-weight-(normal|medium|semibold|bold)|spacing):' node_modules/tailwindcss/theme.css`.
   If a value differs from the block below, use the file's value and note it in the baseline doc.
2. Append to `src/styles/theme.css` (after the `[data-theme='dark']` block, before
   `BASE APPLICATION STYLES`):

   ```css
   /* ============================================
      NON-COLOUR TOKENS (theme-independent)
      Values are exactly what the code used before these names existed.
      Plan 006 may change values; plan 000 only names them.
      --app-shadow-sm|md|lg above are COLOURS; elevation tokens are real box-shadows.
      ============================================ */
   :root {
     /* Radius: .btn is 0.25rem (app.css); the toolbar is rounded-lg (0.5rem) */
     --app-radius-sm: 0.25rem;
     --app-radius-md: 0.375rem;
     --app-radius-lg: 0.5rem;

     /* Elevation: Tailwind v4 shadow-sm / shadow-lg / shadow-2xl */
     --app-elevation-low: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
     --app-elevation-medium: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
     --app-elevation-high: 0 25px 50px -12px rgb(0 0 0 / 0.25);

     /* Motion: theme.css and .btn use 0.2s ease; duration-300 / slide-down use 0.3s */
     --app-duration-fast: 0.2s;
     --app-duration-base: 0.3s;
     --app-duration-slow: 0.5s;
     --app-ease-standard: ease;
     --app-ease-decelerate: cubic-bezier(0, 0, 0.2, 1); /* Tailwind ease-out */

     /* Spacing: every Tailwind spacing utility is a multiple of this unit */
     --app-space-unit: 0.25rem;

     /* Type: Tailwind v4 sizes (text-xs … text-2xl are the sizes in use); fonts.css weights */
     --app-font-size-xs: 0.75rem;
     --app-font-size-sm: 0.875rem;
     --app-font-size-base: 1rem;
     --app-font-size-lg: 1.125rem;
     --app-font-size-xl: 1.25rem;
     --app-font-size-2xl: 1.5rem;
     --app-font-weight-normal: 400;
     --app-font-weight-medium: 500;
     --app-font-weight-semibold: 600;
     --app-font-weight-bold: 700;
   }
   ```

   In the same file replace the two hard-coded transitions
   (`grep -n '0.2s' src/styles/theme.css` → lines 286, 287, 293): `body` becomes
   `transition: background-color var(--app-duration-fast) var(--app-ease-standard), color var(--app-duration-fast) var(--app-ease-standard);`
   and the `*` rule becomes `transition-duration: var(--app-duration-fast); transition-timing-function: var(--app-ease-standard);`.
3. Append to `src/index.css` (after the four `@import` lines; this is the program's single
   `@theme` block for token aliases — plan 001 appends `--animate-slide-down` to it; plan 002
   adds a second `@theme inline` block for the shadcn `--color-*` bridge):

   ```css
   /*
    * Tailwind namespace aliases → Graphium tokens. `rounded-lg`, `shadow-2xl`, `ease-out`,
    * `font-semibold`, `text-sm` and every spacing utility now resolve to `--app-*` variables
    * from styles/theme.css. Values are unchanged; only the indirection is new. Bare `rounded`
    * (0.25rem) is a literal in Tailwind v4 and is not covered.
    */
   @theme inline {
     --radius-sm: var(--app-radius-sm);
     --radius-md: var(--app-radius-md);
     --radius-lg: var(--app-radius-lg);
     --shadow-sm: var(--app-elevation-low);
     --shadow-lg: var(--app-elevation-medium);
     --shadow-2xl: var(--app-elevation-high);
     --ease-out: var(--app-ease-decelerate);
     --spacing: var(--app-space-unit);
     --text-xs: var(--app-font-size-xs);
     --text-sm: var(--app-font-size-sm);
     --text-base: var(--app-font-size-base);
     --text-lg: var(--app-font-size-lg);
     --text-xl: var(--app-font-size-xl);
     --text-2xl: var(--app-font-size-2xl);
     --font-weight-normal: var(--app-font-weight-normal);
     --font-weight-medium: var(--app-font-weight-medium);
     --font-weight-semibold: var(--app-font-weight-semibold);
     --font-weight-bold: var(--app-font-weight-bold);
   }
   ```

4. Create `tests/functional/tokens.spec.ts` (proves the aliases are live; the confirm-dialog
   title is used because `.btn` in unlayered `app.css` overrides utilities on buttons):

   ```ts
   import { test, expect } from '@playwright/test';

   import { gotoSurface } from '../helpers/surfaces';

   test.describe('Non-colour tokens are live', () => {
     test('rounded-lg, shadow-2xl, font-semibold and text-lg resolve through --app-* tokens', async ({
       page,
     }) => {
       await gotoSurface(page, 'confirm-dialog', 'light');
       const toolbar = page.locator('[data-testid="toolbar-root"]');
       const title = page.locator('#confirm-dialog-title');

       await expect(toolbar).toHaveCSS('border-radius', '8px');
       await expect(title).toHaveCSS('font-weight', '600');
       await expect(title).toHaveCSS('font-size', '18px');

       await page.addStyleTag({
         content:
           ':root { --app-radius-lg: 0px; --app-elevation-high: none; --app-font-weight-semibold: 900; --app-font-size-lg: 30px; }',
       });

       await expect(toolbar).toHaveCSS('border-radius', '0px');
       await expect(toolbar).toHaveCSS('box-shadow', 'none');
       await expect(title).toHaveCSS('font-weight', '900');
       await expect(title).toHaveCSS('font-size', '30px');
     });
   });
   ```

5. Record under `## Tokens` in the baseline doc: the families added, that `--app-space-unit`
   is the only spacing token (the code implies Tailwind's 0.25 rem scale and nothing else),
   and that `--app-duration-*` have no Tailwind namespace to alias (v4 `duration-*` takes
   numbers).

**Do NOT**: change any `--app-shadow-*` colour or reuse those names; touch `src/styles/app.css`;
add a second `@theme` block; write `@theme` without `inline`; change any seed value to a
"nicer" one.

**Commands**: `npm run verify:static`; `npm run verify:web`;
`grep -c -- '--app-radius-lg' dist-web/assets/*.css`
**Expected**: exit 0; exit 0 (`tests/visual.spec.ts` passing against the Step 3 baselines proves no pixel changed); a count ≥ 1.
**Check**: `grep -c '@theme inline' src/index.css` prints `1` **and** `verify:web` exited 0.
**If it fails**: if `build:web` fails or `visual.spec.ts` reports a diff, remove the `--spacing` alias line, re-run; if it still fails remove the six `--text-*` alias lines, re-run; record every removal under `## Tokens`; still failing → STOP.
**Commit**: `plan-000 step-9: non-colour token families and Tailwind aliases`

### Step 10: Delete PreferencesDialog, pin the web deploy, extend CI artefacts

**Files**: `src/components/PreferencesDialog.tsx` (delete), `.github/workflows/deploy-web.yml`,
`.github/workflows/accessibility.yml`, `.github/workflows/e2e.yml`, `CHANGELOG.md`

**Do**:

1. `git rm src/components/PreferencesDialog.tsx` (decided in CONVENTIONS §9; zero importers —
   confirm `grep -rln 'PreferencesDialog' src` lists only that file first). Its two
   `eslint-disable-next-line` comments go with it.
2. `.github/workflows/deploy-web.yml`: replace lines 3–7 (`on:` through `workflow_dispatch:`) with:

   ```yaml
   on:
     # Pinned to manual dispatch for the UI redesign program (plan 000). Plan 006b restores:
     #   push:
     #     branches:
     #       - main
     workflow_dispatch: # Allow manual deployment
   ```

3. `.github/workflows/accessibility.yml`: in the "Upload accessibility report" step replace
   `path: playwright-report/` with

   ```yaml
             path: |
               playwright-report/
               accessibility-violations*.json
   ```

   and in the "Comment PR with results" script replace the seven lines from
   `const reportPath = 'accessibility-violations.json';` through the closing `}` of the
   `if (fs.existsSync(reportPath))` block with:

   ```js
               const files = fs.readdirSync('.').filter((f) => /^accessibility-violations.*\.json$/.test(f));
               let violations = [];
               for (const file of files) {
                 const surface = file.replace(/^accessibility-violations-?/, '').replace(/\.json$/, '');
                 for (const v of JSON.parse(fs.readFileSync(file, 'utf8'))) {
                   violations.push({ ...v, surface });
                 }
               }
   ```

   and change `- **${v.id}**: ${v.description}` to `- **${v.id}** (${v.surface}): ${v.description}`.
4. `.github/workflows/e2e.yml`: after the `Build web app` step of the `test-web` job add:

   ```yaml
         - name: Report web bundle size (bytes; plan 005 adds the budget)
           run: find dist-web/assets \( -name '*.js' -o -name '*.css' \) -print0 | xargs -0 wc -c | tail -1
   ```

5. `CHANGELOG.md`, under `## [Unreleased]`, add before `### Added`:

   ```markdown
   ### Removed

   - `PreferencesDialog` component (unreferenced; kept in git history).

   ### Changed

   - Web deploy workflow runs on manual dispatch only for the duration of the UI redesign program.
   ```

**Do NOT**: change any other trigger or job; add a size budget; touch `lint.yml`, `test.yml`
or `build-release.yml`; remove the `NEXT` branch from `accessibility.yml` (harmless).

**Commands**: `npm run verify:static`; `npm run verify:web`;
`grep -rnoE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx | wc -l`;
`grep -rn "style={{" --include=*.tsx src | wc -l`
**Expected**: exit 0; exit 0; `396`; `241`.
**Check**: `grep -cE '^\s*push:' .github/workflows/deploy-web.yml` prints `0` **and** `test ! -e src/components/PreferencesDialog.tsx`.
**If it fails**: if `lint:strict` reports an unused import of `PreferencesDialog`, the importer count drifted — STOP.
**Commit**: `plan-000 step-10: delete PreferencesDialog, pin deploy-web, CI artefacts`

### Step 11: Bring the testing docs in line with reality

**Files**: `src/components/README.md`, `tests/README.md`, `TESTING_STRATEGY.md`,
`docs/LOCAL_TESTING_WORKFLOW.md`, `docs/HYBRID_TESTING_WORKFLOW.md`, `src/utils/useWindowType.ts`

**Do**:

1. Replace `src/components/README.md` entirely with:

   ```markdown
   # Components

   React components for Graphium's renderer. This is an orientation map, not an inventory:
   it names areas and responsibilities and carries no line counts (they rot). The component
   you are about to change is the source of truth; read it.

   ## Areas

   | Area                     | What lives there                                                                                                                                                                                                                                                                                       |
   | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `src/App.tsx`            | Picks Architect vs World View (`?type=world`), HOME vs EDITOR, renders the desktop toolbar and the global overlays.                                                                                                                                                                                     |
   | `Canvas/`                | The Konva stage: `CanvasManager.tsx`, `GridOverlay.tsx`, `TokenLayer.tsx`, `DrawingLayer.tsx`, `DoorLayer.tsx`, `StairsLayer.tsx`, `FogOfWarLayer.tsx`, `MeasurementOverlay.tsx`, `Minimap.tsx`, `hooks/`. See `Canvas/README.md`.                                                                     |
   | `AssetLibrary/`          | Token library: `LibraryManager.tsx`, `AddToLibraryDialog.tsx`, `TokenMetadataEditor.tsx`, `CommandPalette.tsx`.                                                                                                                                                                                         |
   | `SessionConsole/`        | Audio/ambience panel and the player-facing stage: `SessionConsolePanel.tsx`, the editor and settings sheets, `WorldStage.tsx`, `WorldAudioEngine.tsx`, hotkeys.                                                                                                                                         |
   | `DesignSystemPlayground/`| The `/design-system` route (`playground-registry.tsx` lists every example).                                                                                                                                                                                                                             |
   | Sidebar and navigation   | `Sidebar.tsx`, `MapNavigator.tsx`, `CollapsibleSection.tsx`, `MobileSidebarDrawer.tsx`, `MobileToolbar.tsx`, `MobileBottomSheet.tsx`.                                                                                                                                                                  |
   | Overlays                 | `ConfirmDialog.tsx`, `DungeonGeneratorDialog.tsx`, `AboutModal.tsx`, `UpdateManager.tsx`, `MapSettingsSheet.tsx`, `ImageCropper.tsx`, `Toast.tsx`, `LoadingOverlay.tsx`.                                                                                                                               |
   | Inspectors and panels    | `TokenInspector.tsx`, `QuickTokenSidebar.tsx`, `DoorControls.tsx`, `ResourceMonitor.tsx`.                                                                                                                                                                                                              |
   | System (no UI)           | `SyncManager.tsx` (Architect ↔ World state over IPC in Electron, `BroadcastChannel` on the web), `ThemeManager.tsx`, `AutoSaveManager.tsx`, `PauseManager.tsx`.                                                                                                                                         |
   | Error handling           | `GlobalErrorBoundary.tsx`, `PrivacyErrorBoundary.tsx`, `ErrorFallbackUI.tsx`, `UpdateErrorFallbackUI.tsx`, `PendingErrorsIndicator.tsx`, and a `*ErrorBoundary.tsx` next to each feature it wraps.                                                                                                     |
   | Adapters                 | `Tooltip.tsx`, `ToggleSwitch.tsx`, `CollapsibleSection.tsx` — thin components whose props stay stable while their internals change.                                                                                                                                                                   |
   | Brand                    | `LogoIcon.tsx`, `LogoLockup.tsx`.                                                                                                                                                                                                                                                                       |

   ## Conventions that matter here

   - Colours come from `--app-*` variables in `src/styles/theme.css`; never raw palette values
     in new code. Non-colour tokens (`--app-radius-*`, `--app-elevation-*`, `--app-duration-*`,
     `--app-ease-*`, `--app-space-unit`, `--app-font-size-*`, `--app-font-weight-*`) are
     aliased into Tailwind in `src/index.css`.
   - `data-testid` values are kebab-case `<surface>-<element>` and are never renamed.
   - Every overlay root carries `data-testid="dialog-<x>-root"` or `sheet-<x>-root`.
     `tests/functional/overlays.spec.ts` records each overlay's `role`, `aria-modal`,
     `data-esc-owns`, Escape and focus behaviour.
   - `data-esc-owns="true"` on an open overlay stops the global Escape from killing Session
     Console audio.
   - Unit tests are co-located `*.test.tsx` (Vitest); browser specs live in `tests/`.

   ## Related documentation

   - [Canvas System](../../docs/components/canvas.md)
   - [Architecture Overview](../../docs/architecture/ARCHITECTURE.md)
   - [Code Conventions](../../docs/guides/CONVENTIONS.md)
   - [Error Boundaries](../../docs/features/error-boundaries.md)
   - [Tests](../../tests/README.md)
   ```

2. Replace `tests/README.md` entirely with:

   ````markdown
   # Tests

   Two runners:

   - **Vitest** (`npm run test:run`): `src/**/*.test.tsx` next to the code, plus `tests/unit/**`
     and `tests/integration/**`.
   - **Playwright** (`playwright.config.ts`): every other `*.spec.ts` under `tests/`, in the
     `Web-Chromium` project (browser) and the `Electron-App` project (`*.electron.spec.ts`).

   ## Layout

   ```text
   tests/
   ├── accessibility.spec.ts        # axe WCAG 2.1 AA on every surface × theme (14 scans)
   ├── shots.spec.ts                # screenshots every surface × theme into $SHOTS_OUT
   ├── visual.spec.ts               # toHaveScreenshot baselines in visual.spec.ts-snapshots/
   ├── touch-targets.spec.ts        # today's touch-target minimums
   ├── functional/
   │   ├── overlays.spec.ts         # overlay contract: role, aria-modal, data-esc-owns, Escape, focus
   │   ├── editor-smoke.spec.ts     # toolbar tools by click and shortcut
   │   ├── mobile-smoke.spec.ts     # mobile toolbar and more-menu
   │   ├── tokens.spec.ts           # non-colour --app-* tokens are live
   │   ├── door-sync.spec.ts        # DM and World tabs both load (URL-only assertions)
   │   └── dm-world-sync.spec.ts    # store-driven drag and draw checks on one page
   ├── electron/                    # Electron-App project
   ├── helpers/
   │   ├── surfaces.ts              # gotoSurface(page, surface, theme) — start here
   │   ├── bypassLandingPage.ts     # Electron-mocked entry used by the two legacy specs
   │   └── …
   └── unit/, integration/          # Vitest
   ```

   ## Running

   Use the gates, not raw Playwright commands: `npm run verify:static`, `npm run verify:web`,
   `npm run verify:electron`, `npm run verify`. `verify:web` builds `dist-web` and runs the
   `Web-Chromium` project and the a11y suite against the built output with `CI=1` (preview
   server on port 4173, no dev-only components). One spec the same way:

   ```bash
   npm run build:web && CI=1 npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
   ```

   Without `CI=1` the dev server on 5173 is used and `import.meta.env.DEV` extras (the
   Agentation toolbar) render.

   - Screenshots: `SHOTS_OUT=docs/planning/screenshots/<plan>-<step> npm run shots`
   - Visual baselines (only when a change is intended; commit the PNGs):
     `npm run build:web && CI=1 npx playwright test tests/visual.spec.ts --project=Web-Chromium --update-snapshots`
   - Electron: `npm run verify:electron` builds first and uses `xvfb-run -a` (Linux).
   - The bare `test:e2e` script is `verify:web` followed by `verify:electron`; it is slow by design.

   ## Surfaces

   | Surface          | What it is                                                                 |
   | ---------------- | -------------------------------------------------------------------------- |
   | `home`           | HomeScreen at 1280×720                                                     |
   | `editor`         | New campaign → editor with the desktop toolbar and sidebar                 |
   | `editor-mobile`  | The editor at 390×844 (mobile toolbar, hamburger)                          |
   | `confirm-dialog` | `editor` with `ConfirmDialog` open via the store                           |
   | `world`          | `?type=world` in a second tab, after `FULL_SYNC` from the editor tab       |
   | `world-dialog`   | `world` with `ConfirmDialog` open in the World tab                         |
   | `design-system`  | `/design-system`                                                           |

   ## Rules

   - No `test.skip`, `test.fixme`, `describe.skip` or `testInfo.skip`
     (`tests/unit/playwrightConfig.test.ts` fails otherwise); the one exception is plan 005's
     `test.skip(!process.env.PERF, 'set PERF=1 to profile')`.
   - `testIgnore` in `playwright.config.ts` holds exactly the three structural patterns.
   - Helper URLs carry `?e2e=1`, which exposes `window.__GAME_STORE__` in every build.
   - Run the app in plain web mode unless a spec needs Electron IPC mocks: mocking
     `window.ipcRenderer` switches the app to Electron mode and disables `BroadcastChannel`.
   ````

3. `TESTING_STRATEGY.md`: change the three `npm run build` references that mean the Electron
   build to `npm run build:electron` (`grep -nE 'npm run build([^:]|$)' TESTING_STRATEGY.md` →
   lines 106, 149, 695; line 695 becomes `run: npm run type-check && npm run build:electron`,
   matching `e2e.yml`).
4. Replace the bodies of `docs/LOCAL_TESTING_WORKFLOW.md` and `docs/HYBRID_TESTING_WORKFLOW.md`
   (both instruct disabling or editing `.github/workflows/e2e.yml`) with, keeping each file's
   first-line `# ` title and appending ` (superseded)` to it:

   ```markdown
   This document described disabling `.github/workflows/e2e.yml` to save CI minutes. It is
   obsolete: CI runs on every pull request into `main` and is the enforcement for the UI
   redesign program. Use the gate scripts in `package.json` (`verify:static`, `verify:web`,
   `verify:electron`, `verify`) and see `tests/README.md` for running tests locally.
   ```

   `docs/ENABLE_CI_TESTING.md` (branch protection settings) does not contradict the gates; leave it.
5. `src/utils/useWindowType.ts` JSDoc: change `(see electron/main.ts:259)` to
   `(see electron/main.ts, grep "type=world")` and `electron/main.ts:243-263` to
   `electron/main.ts (the loadURL calls carrying ?type=world)`.

**Do NOT**: add line counts anywhere; edit `docs/ENABLE_CI_TESTING.md`; change any code in
`useWindowType.ts`; rewrite `TESTING_STRATEGY.md` beyond the three lines.

**Commands**: `npm run verify:static`
**Expected**: exit 0.
**Check**: `grep -cE '\([0-9]+ lines' src/components/README.md` prints `0`, `grep -cE 'npm run build([^:]|$)' TESTING_STRATEGY.md` prints `0`, `grep -c 'main.ts:' src/utils/useWindowType.ts` prints `0`, and `grep -c 'rm .github' docs/LOCAL_TESTING_WORKFLOW.md` prints `0`.
**If it fails**: Prettier reflows the tables; that is fine. Anything else: STOP.
**Commit**: `plan-000 step-11: testing docs match the repo`

### Step 12: Finish the baseline document, verify everything, write the report

**Files**: `docs/planning/verification-baseline.md`, `plans/reports/000.md`, `plans/README.md`,
`plans/001-stabilize-styling-foundation.md` (Grounded-at line only, after merge)

**Do**:

1. Complete `docs/planning/verification-baseline.md` so it has these sections, each filled:
   `## Before` (Step 1), `## After` (selected-test counts per project from
   `CI=1 npx playwright test --project=<P> --list | tail -1`, run now), `## Palette-class regex`
   (command, `400` before, `396` after Step 10), `## Inline styles` (`286` → `241`),
   `## Test ids added` (the 24 ids from Steps 2 and 5, plus the total from
   `grep -rhoE 'data-testid="[^"]+"' src/ | sort -u | wc -l`), `## Accessibility triage`,
   `## Overlay contract` (the five unreachable overlays and any `trapsFocus` flip),
   `## Deleted specs` and `## Deleted tests`, `## Touch targets`, `## Tokens`, and
   `## Deferred findings` with: the pause-button cascade mechanism (plan 001 fixes),
   `--app-error-solid` ≈ 3.9:1 white-on-`#e5484d` with its three users (plan 006), `.btn-tool`
   has no touch minimum (measured size recorded), and `door-sync.spec.ts` asserts URLs only —
   real World View sync coverage is `gotoSurface('world')`'s `FULL_SYNC` wait.
2. Run `npm run verify` (all three gates) and `SHOTS_OUT=docs/planning/screenshots/000-final npm run shots`.
3. Write the report (`plans/reports/000.md`, CONVENTIONS §11); add one bullet under
   `## [Unreleased]` in `CHANGELOG.md` for any user-visible change (Step 10 already added
   two; add none unless a category (a) a11y fix changed visible text); set this plan's row in
   `plans/README.md` to `DONE <merge sha>` after merge; write the merge SHA into
   `plans/001-stabilize-styling-foundation.md`'s `Grounded at` line.

**Do NOT**: edit `plans/CONVENTIONS.md`; touch any plan other than the 001 `Grounded at` line;
open the PR before `npm run verify` exits 0.

**Commands**: `npm run verify`; `SHOTS_OUT=docs/planning/screenshots/000-final npm run shots`;
`grep -cE '^## ' docs/planning/verification-baseline.md`
**Expected**: exit 0; exit 0 with `14 passed`; `12`.
**Check**: `ls docs/planning/screenshots/000-final/*.png | wc -l` prints `14` and `test -f plans/reports/000.md`.
**If it fails**: `verify:electron` failing in a `*.electron.spec.ts` untouched by this plan is a pre-existing failure — record it under `## Deferred findings`, do not fix it, and STOP only if `verify:static` or `verify:web` fails.
**Commit**: `plan-000 step-12: baseline document and report`

## Done criteria

- [ ] `package.json` has `verify`, `verify:static`, `verify:web`, `verify:electron`, `shots`; `scripts/preflight.sh 000` exits 0
- [ ] `tests/helpers/surfaces.ts` reaches all seven surfaces; `npm run shots` writes 14 PNGs
- [ ] `npm run test:a11y` lists 14 tests and passes; `CONTRAST_DEFERRED` entries all have triage rows (plan 006b empties the list)
- [ ] `tests/visual.spec.ts` has 14 committed baselines and passes after Step 9 (tokens changed no pixel)
- [ ] `tests/functional/overlays.spec.ts` has 13 rows, 8 exercised, 5 recorded unreachable
- [ ] `testIgnore` has exactly three entries; `grep -rnE '\b(test|describe|testInfo)\.(skip|fixme)\(' tests/` returns only the plan 005 pattern (or nothing); `tests/unit/playwrightConfig.test.ts` enforces both
- [ ] Every deleted spec and test has a lost-coverage line in the baseline doc
- [ ] `tests/touch-targets.spec.ts` passes with pinned `.btn-tool` size and was seen to fail
- [ ] `--app-radius-*`, `--app-elevation-*`, `--app-duration-*`, `--app-ease-*`, `--app-space-unit`, `--app-font-size-*`, `--app-font-weight-*` exist; one `@theme inline` block in `src/index.css`; `tests/functional/tokens.spec.ts` passes
- [ ] `src/components/PreferencesDialog.tsx` is gone; palette count `396`; inline-style count `241`
- [ ] `deploy-web.yml` has no `push:` trigger; `accessibility.yml` uploads `accessibility-violations*.json`; `e2e.yml` prints the bundle size
- [ ] Docs in Step 11 updated; no line counts in `src/components/README.md`
- [ ] `docs/planning/verification-baseline.md` has all 12 sections; `plans/reports/000.md` written
- [ ] No `--app-*` colour value changed; no component markup changed beyond attributes
- [ ] PR merged as a merge commit; `plans/README.md` row `DONE <sha>`; plan 001 `Grounded at` filled

## STOP conditions

- A category (a) axe violation that cannot be fixed by adding an attribute (Step 4).
- An overlay row fails on `toBeVisible()` after `open`, or on a source-read field (Step 6).
- Any surface is non-deterministic across two fresh baseline runs (Step 3).
- `world` never receives `FULL_SYNC` although the helper injects no `ipcRenderer` (Step 2).
- Step 9 still changes a visual baseline after removing the `--spacing` and `--text-*` aliases.
- You are tempted to add an axe exclusion, a `test.skip`, a fourth `testIgnore` entry, or to
  change a colour to clear a contrast violation.

## Handoff

- Every later plan runs `bash scripts/preflight.sh NNN`, uses `gotoSurface`, and cites the
  palette-class command and number from `docs/planning/verification-baseline.md`.
- Plan 001 fixes the pause-button cascade and appends `--animate-slide-down` to the
  `@theme inline` block. Plan 004 expects `toolbar-tool-<name>`, `toolbar-pause`, and
  `dialog-<x>-root` / `sheet-<x>-root` ids, and flips `overlays.spec.ts` rows as it migrates.
  Plan 005 adds `tests/performance/profile.spec.ts` with the one permitted `test.skip`.
  Plan 006 owns the palette, `CONTRAST_DEFERRED`, and every token **value**; 006b restores
  the `deploy-web.yml` push trigger.
- The five unreachable overlays (`MobileBottomSheet`, `AddToLibraryDialog`,
  `TokenMetadataEditor`, `ImageCropper`, `SessionConsoleEditorSheet`) need fixtures (a token,
  a library item, an image, a track) that no helper builds yet; plan 004 adds them when it
  migrates those overlays.
- The `?e2e` store exposure in `src/store/gameStore.ts` is the only test hook in production
  code; it is inert unless the URL asks for it.
