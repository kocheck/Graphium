# Plan 005: Fix the DOM-layer performance drags

> **Executor instructions**: Read `plans/CONVENTIONS.md` first. Run the pre-flight (§3), then
> the Drift check below. Follow the steps in order; each step's **Check** must hold before the
> next. If any **If it fails** or STOP condition fires, follow CONVENTIONS §10. Finish with the
> report in §11.

**Drift check** (run before Step 1):

```bash
git fetch origin main
git diff --stat <grounded-at>..origin/main -- src/ tests/ scripts/ vite.config.ts .github/workflows/e2e.yml docs/architecture/PERFORMANCE_OPTIMIZATIONS.md docs/guides/UI_RECIPES.md     # Expected: empty
```

**Citation re-check** (each row is the exact command; "hits" is `grep -c` output). Rows marked
"after 004" describe what plan 004 left behind and could not be verified at `d3d3642`.

| Anchor (grep)                                         | File                                        | Expected hits            |
| ----------------------------------------------------- | ------------------------------------------- | ------------------------ |
| `grep -c 'export default memo(Sidebar)'`              | `src/components/Sidebar.tsx`                | 1                        |
| `grep -c '^function Sidebar()'`                       | `src/components/Sidebar.tsx`                | 1                        |
| `grep -c 'export default memo(CanvasManager)'`        | `src/components/Canvas/CanvasManager.tsx`   | 1                        |
| `grep -c 'useState<string\[\]>(\[\])'`                | `src/components/Canvas/CanvasManager.tsx`   | 1                        |
| `grep -c 'Global components'`                         | `src/App.tsx`                               | 2                        |
| `grep -c '<AboutModal$'`                              | `src/App.tsx`                               | 2                        |
| `grep -c '<AboutModal$'`                              | `src/components/HomeScreen.tsx`             | 1                        |
| `grep -c 'onSelectionChange={setSelectedTokenIds}'`   | `src/App.tsx`                               | 1                        |
| `grep -c '<Toolbar$'` (after 004)                     | `src/App.tsx`                               | 1                        |
| `grep -c 'export interface ToolbarProps'` (after 004) | `src/components/Toolbar.tsx`                | 1                        |
| `grep -c 'dialog-about-root'` (after 004)             | `src/components/AboutModal.tsx`             | ≥ 1                      |
| `grep -c 'dialog-dungeon-generator-root'` (after 004) | `src/components/DungeonGeneratorDialog.tsx` | ≥ 1                      |
| `grep -c 'isWeb && {'`                                | `vite.config.ts`                            | 1                        |
| `grep -c 'new-campaign-button'`                       | `src/components/HomeScreen.tsx`             | 1                        |
| `grep -c '__GAME_STORE__ = useGameStore'`             | `src/store/gameStore.ts`                    | 1                        |
| `grep -c 'Build web app'`                             | `.github/workflows/e2e.yml`                 | 1                        |
| `ls tests/performance/`                               | —                                           | empty, or "No such file" |

If any row differs: STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/000-repair-verification-infrastructure.md,
  plans/001-stabilize-styling-foundation.md, **plans/004-migrate-screens-to-primitives.md**
- **Category**: perf
- **Requires**: `scripts/preflight.sh`; `tests/helpers/surfaces.ts`;
  `docs/planning/verification-baseline.md`; `src/components/Toolbar.tsx`;
  `docs/guides/UI_RECIPES.md`; `docs/planning/screenshots/004-final/`
- **Grounded at**: ‹merge SHA of plan 004's last PR, written there by its final step› (citations
  verified at d3d3642)

Branch, commits, PR, CI and rollback: `plans/CONVENTIONS.md` §7. Branch name:
`plan/005-ui-performance`. One PR. This plan adds one CI step to `e2e.yml` (the bundle budget,
Step 2); nothing else about landing is specific to it.

## Why this matters

The canvas is already tuned (`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`); the DOM chrome is
not. `src/App.tsx` keeps `tool`, `color`, `recentColors`, `doorOrientation`, `measurementMode`
and `selectedTokenIds` in local state (`grep -n 'useState<' src/App.tsx`, lines 135–162 at
d3d3642), so every tool switch and every selection re-renders App's whole return tree. The
memoised components (`Sidebar`, `CanvasManager`) bail out; the unmemoised ones — `ThemeManager`,
`SyncManager`, `PauseManager`, `Toast`, `ConfirmDialog`, `DungeonGeneratorDialog`, `AboutModal`,
`UpdateManager`, `AutoSaveManager`, `SessionConsoleEscapeStop`, `CommandPalette`, and after plan
004 the extracted `Toolbar` — do not. The web bundle statically imports the 1274-line playground
registry and the 1792-line `HomeScreen`, and has no vendor chunking. This plan measures first,
moves the six fields into a non-persisted store so App stops re-rendering, splits the bundle,
and leaves a Playwright-driven profiler, a Vitest render-count test and a CI bundle budget behind
so the gains cannot silently regress.

## Facts the steps rely on (verified at d3d3642)

- **`Sidebar` is memoised and prop-less**: `grep -n 'export default memo(Sidebar)' src/components/Sidebar.tsx`
  (line 477), `grep -n '^function Sidebar()' src/components/Sidebar.tsx` (line 97). It cannot
  re-render because App did. It _does_ re-render on a token move because it subscribes to the
  whole `tokens` array and the whole `campaign` object
  (`grep -n 'state.tokens)\|state.campaign)' src/components/Sidebar.tsx`, lines 99 and 104).
- **`CanvasManager` is memoised but owns the selection**: `grep -n 'export default memo(CanvasManager)'`
  (line 1489) and `grep -n 'useState<string\[\]>(\[\])' src/components/Canvas/CanvasManager.tsx`
  (line 220, `selectedIds`). A click sets that state, so CanvasManager renders itself on a
  selection _before_ calling `onSelectionChange` (`grep -n 'onSelectionChange(selectedIds)'`,
  line 434). It also takes `tool` as a prop, so it renders on a tool switch. Both are expected and
  are not this plan's target.
- **A `<Profiler>` fires whenever its own element re-renders**, even if the memoised child inside
  bails out. Wrapping `Sidebar` in a plain `<Profiler>` would therefore count App's renders, not
  Sidebar's. Step 1 wraps the two memoised components in memoised wrappers with the same bail-out
  semantics; the unmemoised components get a plain boundary, where boundary commits equal renders.
- **`React.StrictMode`** wraps the app (`grep -n 'React.StrictMode' src/main.tsx`). It double-invokes
  render functions in dev but produces one commit; count commits whose `phase !== 'mount'`, and
  treat `actualDuration` as a dev-mode number only.
- **The global components are mounted at two sites**: `grep -n 'Global components' src/App.tsx`
  (lines 454 HOME branch, 483 EDITOR branch). `AboutModal` is also rendered by `HomeScreen`
  (`grep -n '<AboutModal$' src/components/HomeScreen.tsx`, line 705) and imported statically there
  (`grep -n "from './AboutModal'" src/components/HomeScreen.tsx`, line 25).
- **`DungeonGeneratorDialog` takes no props** and opens from `gameStore.dungeonDialog`
  (`grep -n 'dungeonDialog' src/store/gameStore.ts`, 4 hits). **`UpdateManager` holds download
  state** (`grep -n 'useState' src/components/UpdateManager.tsx`, six fields at 333–338): it stays
  mounted. **`AboutModal`'s only state is its active tab** (`grep -n 'useState' src/components/AboutModal.tsx`,
  line 245); resetting it on reopen is accepted.
- **`window.__GAME_STORE__`** is the game store, exposed in DEV and test builds only
  (`grep -n '__GAME_STORE__ = useGameStore' src/store/gameStore.ts`, line 943). The profiling spec
  uses it on the dev server; it is absent from `preview:web`.
- **Stress fixture**: `?stress=1` loads 200 tokens and no map (`src/utils/stressFixture.ts`,
  `grep -n 'TOKEN_COUNT = 200\|map: null' src/utils/stressFixture.ts`). Token `i` sits at
  `(col * 100, row * 100)` with `col = i % 20`, `row = floor(i / 20)`; tokens are `gridSize` = 50 px
  squares drawn from that corner (`grep -n 'const tokenSize' src/components/Canvas/TokenNode.tsx`,
  line 147). Tokens 0–4 are PCs. The fixture loads at App mount while the home screen is showing;
  `new-campaign-button` only calls `onStartEditor()` (`grep -n 'const handleNewCampaign' src/components/HomeScreen.tsx`,
  line 159) and does not reset the store, so the fixture survives into the editor.
- **Keyboard**: `v/m/e/w/d/r/i` switch tools (`grep -n "case 'v':" src/App.tsx`, line 299); the
  handler ignores events whose target is an input or textarea (line 258).
- **`vite.config.ts` has a `build` block only for the web mode** (`grep -n 'isWeb && {' vite.config.ts`,
  line 43). Manual chunking is web-only; Electron loads from `graphium://` with no HTTP cache.
- **ResourceMonitor is toggled only through Electron IPC** (`grep -n 'MENU_TOGGLE_RESOURCE_MONITOR' src/App.tsx`,
  line 420); there is no display here, so the spec counts `requestAnimationFrame` itself, the same
  way ResourceMonitor does (`grep -n 'frameCountRef' src/components/ResourceMonitor.tsx`), and
  uses its colour thresholds 55 / 30 (`grep -n 'fps >= 55\|fps >= 30' src/components/ResourceMonitor.tsx`).
- **`Agentation` is a static import** (`grep -n "from 'agentation'" src/App.tsx`, line 13) rendered
  behind `import.meta.env.DEV`; Step 3 makes the import itself dev-only.
- **ESLint**: `import/no-unused-modules` with `unusedExports: true` and `--max-warnings 0` means
  every export must have an importer; `react-refresh/only-export-components` means a `.tsx` file
  exports components only. Test files (`*.test.tsx`) are exempt from type-aware rules and from
  `tsc` (`tsconfig.json` excludes them); only `npm run test:run` catches a broken test file.
- **Vitest** collects `src/**/*.test.tsx` (`vitest.config.ts`); Playwright collects every
  `tests/**/*.spec.ts` for `Web-Chromium` (`testMatch: /.*\.spec\.ts/`), so the profiling spec is
  selected in CI and must skip itself unless `PERF=1`.

## Inputs & resources

Gates: `plans/CONVENTIONS.md` §4. Commands specific to this plan:

| Purpose                                  | Command                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile on the dev server (harness live) | `PERF=1 PERF_TAG=<tag> npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\]'`                             |
| Time the built app                       | `npm run build:web && CI=1 PERF=1 PERF_TAG=<tag> npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[built\]'` |
| Read a dump                              | `node scripts/perf-counts.mjs docs/planning/perf/<scenario>-<tag>.json [+MustBePositive ...] [MustBeZero ...]`                                            |
| Bundle numbers                           | `bash scripts/bundle-budget.sh` (check) / `bash scripts/bundle-budget.sh --write` (rebaseline)                                                            |

`<tag>` names the dump files: `before`, then `step1`, `step4`, `step7`, `step8`, `after`.
Read first: `.ai-rules.md`, `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`,
`docs/planning/verification-baseline.md`.

## Scope

**In scope** (the only paths any step may touch): `src/App.tsx`, `src/perf/profiler.tsx`,
`src/store/uiStore.ts`, `src/store/uiStore.test.ts`, `src/components/Toolbar.tsx`,
`src/components/Toolbar.render-count.test.tsx`, `src/components/MobileToolbar.tsx`,
`src/components/AssetLibrary/CommandPalette.tsx`, `src/components/HomeScreen.tsx` (the
`AboutModal` import and render site only), `src/components/Sidebar.tsx` (store selectors only),
`src/components/CanvasHost.tsx`, `src/components/TokenInspectorGate.tsx`,
`src/components/DungeonGeneratorDialogGate.tsx`, `src/components/README.md`, `vite.config.ts`,
`scripts/bundle-budget.sh`, `scripts/perf-counts.mjs`, `bundle-budget.json`,
`.github/workflows/e2e.yml`, `tests/performance/profile.spec.ts`, `docs/planning/perf/`,
`docs/planning/ui-perf-baseline.md`, `docs/planning/screenshots/005-final/`,
`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`, `docs/guides/UI_RECIPES.md`, `CHANGELOG.md`,
`plans/reports/005.md`, `plans/README.md`, `plans/006-visual-redesign.md` (Grounded-at line only).

**Out of scope**: `src/components/Canvas/**` (including `ImageCropper`, which lives behind
`CanvasManager`); `src/components/SyncManager.tsx`; `src/workers/`; `PreferencesDialog` (deleted
by plan 000); `UpdateManager` gating; `React.memo` on anything a dump does not name; any
`--app-*` value or visual change; any persistence in `uiStore`; any dependency.

## Steps

### Step 1: Build the profiling harness and the profiling spec

**Files**: `src/perf/profiler.tsx` (new), `src/App.tsx`, `tests/performance/profile.spec.ts`
(new), `scripts/perf-counts.mjs` (new), `docs/planning/perf/` (new, written by the spec).
**Do**: Create `src/perf/profiler.tsx` exactly:

```tsx
import { memo, Profiler } from 'react';

import CanvasManager from '../components/Canvas/CanvasManager';
import Sidebar from '../components/Sidebar';

import type { ComponentProps, JSX, ProfilerOnRenderCallback, ReactNode } from 'react';

interface ProfileEntry {
  id: string;
  phase: Parameters<ProfilerOnRenderCallback>[1];
  actualDuration: number;
  timestamp: number;
}

declare global {
  interface Window {
    __profile?: ProfileEntry[];
    __profileDump?: () => string;
  }
}

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  window.__profile?.push({ id, phase, actualDuration, timestamp: performance.now() });
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__profile = [];
  window.__profileDump = (): string => JSON.stringify(window.__profile ?? []);
}

/**
 * Dev-only render counter for an UNMEMOISED child (plan 005). A Profiler commits whenever its
 * subtree renders, which for an unmemoised child equals the number of times the parent rendered
 * it. In production builds this is a plain fragment.
 */
export function ProfiledBoundary({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): JSX.Element {
  if (!import.meta.env.DEV) {
    return <>{children}</>;
  }
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

/**
 * Sidebar is `memo()` with no props. A plain ProfiledBoundary around it would still commit on
 * every App render (the boundary's own element changes), so this wrapper is memoised and
 * prop-less exactly like Sidebar: it bails out with Sidebar and commits only when Sidebar's own
 * store subscriptions update it.
 */
export const ProfiledSidebar = memo(function ProfiledSidebar(): JSX.Element {
  if (!import.meta.env.DEV) {
    return <Sidebar />;
  }
  return (
    <Profiler id="Sidebar" onRender={onRender}>
      <Sidebar />
    </Profiler>
  );
});

type CanvasManagerProps = ComponentProps<typeof CanvasManager>;

/** Same idea for CanvasManager: memoised with the same shallow prop comparison as the real one. */
export const ProfiledCanvasManager = memo(function ProfiledCanvasManager(
  props: CanvasManagerProps,
): JSX.Element {
  if (!import.meta.env.DEV) {
    return <CanvasManager {...props} />;
  }
  return (
    <Profiler id="CanvasManager" onRender={onRender}>
      <CanvasManager {...props} />
    </Profiler>
  );
});
```

In `src/App.tsx`: add
`import { ProfiledBoundary, ProfiledCanvasManager, ProfiledSidebar } from './perf/profiler';`
(sibling group, after `./hooks/...`, before `./services/storage`); delete the
`import Sidebar from './components/Sidebar';` and `import CanvasManager from './components/Canvas/CanvasManager';`
lines; replace `<Sidebar />` with `<ProfiledSidebar />` and `<CanvasManager` with
`<ProfiledCanvasManager` (its props unchanged). Then wrap every element in this table, at **both**
`Global components` sites where it appears, as
`<ProfiledBoundary id="<id>"> … </ProfiledBoundary>` with the element (all its lines) inside. Where
the element is behind a condition (`{isArchitectView && <X />}`), the boundary goes inside the
condition: `{isArchitectView && (<ProfiledBoundary id="X"><X /></ProfiledBoundary>)}`. For
`UpdateManager`, wrap the `<UpdateManager …/>` element inside its existing
`UpdateManagerErrorBoundary`, not the boundary itself.

| id                         | Element                          | Sites                |
| -------------------------- | -------------------------------- | -------------------- |
| `ThemeManager`             | `<ThemeManager />`               | HOME, EDITOR         |
| `Toast`                    | `<Toast />`                      | HOME, EDITOR         |
| `ConfirmDialog`            | `<ConfirmDialog />`              | HOME, EDITOR         |
| `AboutModal`               | `<AboutModal … />`               | HOME, EDITOR         |
| `UpdateManager`            | `<UpdateManager … />`            | HOME, EDITOR         |
| `SyncManager`              | `<SyncManager />`                | EDITOR               |
| `PauseManager`             | `<PauseManager />`               | EDITOR               |
| `DungeonGeneratorDialog`   | `<DungeonGeneratorDialog />`     | EDITOR               |
| `SessionConsoleEscapeStop` | `<SessionConsoleEscapeStop … />` | EDITOR (conditional) |
| `AutoSaveManager`          | `<AutoSaveManager />`            | EDITOR (conditional) |
| `Toolbar`                  | `<Toolbar … />` (plan 004)       | EDITOR (conditional) |
| `TokenInspector`           | `<TokenInspector … />`           | EDITOR (conditional) |
| `CommandPalette`           | `<CommandPalette … />`           | EDITOR (conditional) |

Create `scripts/perf-counts.mjs` exactly:

```js
// Plan 005. Prints the per-component update counts of a profile dump. Extra arguments are
// component ids: `+Id` must have a count >= 1, `Id` must have a count of 0. Exits 1 otherwise.
// Usage: node scripts/perf-counts.mjs docs/planning/perf/<scenario>-<tag>.json [+Id ...] [Id ...]
import { readFileSync } from 'node:fs';

const [file, ...ids] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/perf-counts.mjs <dump.json> [+Id ...] [Id ...]');
  process.exit(2);
}
const counts = JSON.parse(readFileSync(file, 'utf8')).updateCounts ?? {};
console.log(JSON.stringify(counts));
const mustBePositive = ids.filter((id) => id.startsWith('+')).map((id) => id.slice(1));
const mustBeZero = ids.filter((id) => !id.startsWith('+'));
const missing = mustBePositive.filter((id) => (counts[id] ?? 0) === 0);
const nonZero = mustBeZero.filter((id) => (counts[id] ?? 0) > 0);
if (missing.length > 0) {
  console.log(`expected >= 1 but got 0: ${missing.join(', ')}`);
}
if (nonZero.length > 0) {
  console.log(`expected 0 but got more: ${nonZero.join(', ')}`);
}
process.exit(missing.length + nonZero.length > 0 ? 1 : 0);
```

Create `tests/performance/profile.spec.ts` exactly:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

// Plan 005 measurement tool. Not a CI gate: every test skips unless PERF=1.
// [dev] tests need the dev server (the profiler harness and window.__GAME_STORE__ exist only
// there); the [built] test needs `CI=1` so Playwright serves the production build.
test.skip(!process.env.PERF, 'set PERF=1 to profile');
test.describe.configure({ mode: 'serial' });

const TAG = process.env.PERF_TAG ?? 'before';
const OUT_DIR = path.resolve(process.cwd(), 'docs/planning/perf');

interface ProfileEntry {
  id: string;
  phase: string;
  actualDuration: number;
  timestamp: number;
}

interface StoreToken {
  id: string;
  x: number;
  y: number;
}

interface ProfileWindow {
  __profile?: ProfileEntry[];
  __profileDump?: () => string;
  __GAME_STORE__?: {
    getState: () => {
      tokens: StoreToken[];
      showDungeonDialog: () => void;
      clearDungeonDialog: () => void;
    };
  };
}

// Stress fixture geometry (src/utils/stressFixture.ts): token i at (col * 100, row * 100),
// col = i % 20, row = floor(i / 20); every token is a 50 px square from that corner.
// Tokens 0–4 are PCs, which fog of war never hides.
function tokenCentre(index: number): { x: number; y: number } {
  return { x: (index % 20) * 100 + 25, y: Math.floor(index / 20) * 100 + 25 };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function writeDump(name: string, data: object): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, `${name}-${TAG}.json`), JSON.stringify(data, null, 2));
}

async function openEditor(page: Page): Promise<{ x: number; y: number }> {
  await page.goto('/?stress=1');
  await page.getByTestId('new-campaign-button').click();
  await expect(page.getByTestId('editor-view')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const box = await page.locator('[data-testid="editor-view"] canvas').first().boundingBox();
  if (!box) {
    throw new Error('canvas not found');
  }
  return { x: box.x, y: box.y };
}

async function resetProfile(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as ProfileWindow).__profile = [];
  });
}

async function dumpProfile(page: Page, scenario: string): Promise<Record<string, number>> {
  const raw = await page.evaluate(
    () => (window as unknown as ProfileWindow).__profileDump?.() ?? '[]',
  );
  const entries = JSON.parse(raw) as ProfileEntry[];
  const updateCounts: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.phase !== 'mount') {
      updateCounts[entry.id] = (updateCounts[entry.id] ?? 0) + 1;
    }
  }
  writeDump(scenario, { scenario, tag: TAG, updateCounts, entries });
  return updateCounts;
}

async function tokenPosition(page: Page, id: string): Promise<StoreToken | null> {
  return page.evaluate((tokenId) => {
    const state = (window as unknown as ProfileWindow).__GAME_STORE__?.getState();
    return state?.tokens.find((token) => token.id === tokenId) ?? null;
  }, id);
}

function measureFps(page: Page, ms: number): Promise<number> {
  return page.evaluate(
    (duration) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = (): void => {
          frames += 1;
          const elapsed = performance.now() - start;
          if (elapsed < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve(Math.round((frames * 1000) / elapsed));
          }
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

async function timeUntilVisible(
  page: Page,
  action: () => Promise<void>,
  testId: string,
): Promise<number> {
  const start = await page.evaluate(() => performance.now());
  await action();
  await page.getByTestId(testId).waitFor({ state: 'visible' });
  const end = await page.evaluate(() => performance.now());
  return end - start;
}

test('[dev] tool switch: V, M, E', async ({ page }) => {
  await openEditor(page);
  await resetProfile(page);
  for (const key of ['v', 'm', 'e']) {
    await page.keyboard.press(key);
  }
  await expect(page.getByLabel('Eraser tool')).toHaveAttribute('aria-pressed', 'true');
  const counts = await dumpProfile(page, 'tool-switch');
  expect(counts['CanvasManager'] ?? 0).toBeGreaterThan(0); // it takes `tool` as a prop
});

test('[dev] token selection: click one PC, shift-click three more', async ({ page }) => {
  const origin = await openEditor(page);
  await resetProfile(page);
  const first = tokenCentre(1);
  await page.mouse.click(origin.x + first.x, origin.y + first.y);
  await page.keyboard.down('Shift');
  for (const index of [2, 3, 4]) {
    const centre = tokenCentre(index);
    await page.mouse.click(origin.x + centre.x, origin.y + centre.y);
  }
  await page.keyboard.up('Shift');
  await expect(page.getByText('4 Tokens Selected')).toBeVisible();
  const counts = await dumpProfile(page, 'token-selection');
  expect(counts['CanvasManager'] ?? 0).toBeGreaterThan(0); // it owns selectedIds
});

test('[dev] token move: drag one PC one cell to the right', async ({ page }) => {
  const origin = await openEditor(page);
  const centre = tokenCentre(2);
  const before = await tokenPosition(page, 'stress-token-2');
  expect(before?.x).toBe(200);
  await resetProfile(page);
  await page.mouse.move(origin.x + centre.x, origin.y + centre.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(origin.x + centre.x + step * 5, origin.y + centre.y);
  }
  await page.mouse.up();
  await expect
    .poll(async () => (await tokenPosition(page, 'stress-token-2'))?.x ?? 0)
    .toBeGreaterThan(200);
  await dumpProfile(page, 'token-move');
});

test('[dev] frame rate: idle, then dragging a PC for three seconds', async ({ page }) => {
  const origin = await openEditor(page);
  const idle = await measureFps(page, 3000);
  const centre = tokenCentre(3);
  await page.mouse.move(origin.x + centre.x, origin.y + centre.y);
  await page.mouse.down();
  const dragging = measureFps(page, 3000);
  const start = Date.now();
  let step = 0;
  while (Date.now() - start < 3000) {
    step += 1;
    await page.mouse.move(origin.x + centre.x + (step % 40), origin.y + centre.y + (step % 40));
  }
  const drag = await dragging;
  await page.mouse.up();
  writeDump('fps', { tag: TAG, idle, drag });
  expect(idle).toBeGreaterThan(0);
});

test('[dev] modal open: About and Dungeon Generator, warm, in ms', async ({ page }) => {
  await openEditor(page);
  const about = page.getByTestId('dialog-about-root');
  const dungeon = page.getByTestId('dialog-dungeon-generator-root');
  const showDungeon = (): Promise<void> =>
    page.evaluate(() => {
      (window as unknown as ProfileWindow).__GAME_STORE__?.getState().showDungeonDialog();
    });
  const hideDungeon = (): Promise<void> =>
    page.evaluate(() => {
      (window as unknown as ProfileWindow).__GAME_STORE__?.getState().clearDungeonDialog();
    });
  // Warm-up: open and close each once so lazy chunks are cached before timing.
  await page.keyboard.press('?');
  await about.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await about.waitFor({ state: 'detached' });
  await showDungeon();
  await dungeon.waitFor({ state: 'visible' });
  await hideDungeon();
  await dungeon.waitFor({ state: 'detached' });
  const aboutMs = await timeUntilVisible(page, () => page.keyboard.press('?'), 'dialog-about-root');
  await page.keyboard.press('Escape');
  await about.waitFor({ state: 'detached' });
  const dungeonMs = await timeUntilVisible(page, showDungeon, 'dialog-dungeon-generator-root');
  await hideDungeon();
  writeDump('modal-open', { tag: TAG, aboutMs, dungeonMs });
});

test('[built] initial load: home ready and editor ready, median of five', async ({ page }) => {
  const homeMs: number[] = [];
  const editorMs: number[] = [];
  for (let run = 0; run < 5; run += 1) {
    await page.goto('/');
    await page.getByTestId('new-campaign-button').waitFor({ state: 'visible' });
    homeMs.push(await page.evaluate(() => performance.now()));
    await page.getByTestId('new-campaign-button').click();
    await page.getByTestId('editor-view').waitFor({ state: 'visible' });
    editorMs.push(await page.evaluate(() => performance.now()));
  }
  writeDump('load', {
    tag: TAG,
    homeMs,
    editorMs,
    homeMedian: median(homeMs),
    editorMedian: median(editorMs),
  });
  expect(homeMs).toHaveLength(5);
});
```

**Do NOT**: wrap `Sidebar` or `CanvasManager` in `ProfiledBoundary` (see Facts); wrap
`MobileToolbar` (not rendered at 1280 px); put the harness behind anything but
`import.meta.env.DEV`; add `test.skip` anywhere else; touch `playwright.config.ts`.
**Commands**:

```bash
grep -c '<ProfiledBoundary id=' src/App.tsx
grep -c 'ProfiledSidebar />\|<ProfiledCanvasManager' src/App.tsx
npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --list | tail -1
PERF=1 PERF_TAG=step1 npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\] tool switch'
node scripts/perf-counts.mjs docs/planning/perf/tool-switch-step1.json +ThemeManager +CanvasManager Sidebar
npx prettier --write docs/planning/perf/
npm run verify:static
npm run verify:web
```

**Expected**: `18`; `2`; `Total: 6 tests in 1 file`; `1 passed`; a JSON line then exit 0;
formatted; exit 0; exit 0 (the profile spec shows as skipped inside `verify:web`).
**Check**: `perf-counts` exits 0: on a tool switch `Sidebar` committed 0 times and both
`ThemeManager` and `CanvasManager` committed at least once.
**If it fails**: `ProfiledCanvasManager` fails `type-check` on `ComponentProps` → replace the
alias with a local `interface CanvasManagerProps` copied from
`grep -n 'interface CanvasManagerProps' -A7 src/components/Canvas/CanvasManager.tsx` and retry
once. `Sidebar` shows a count ≥ 1 or `ThemeManager` shows 0 → the instrument is wrong: STOP with
the JSON line.
**Commit**: `plan-005 step-1: profiler harness, profiling spec and perf-counts`

### Step 2: Record the baseline and install the bundle budget

**Files**: `scripts/bundle-budget.sh` (new), `bundle-budget.json` (new),
`.github/workflows/e2e.yml`, `docs/planning/perf/*-before.json` (new, written by the spec),
`docs/planning/ui-perf-baseline.md` (new).
**Do**: Create `scripts/bundle-budget.sh` exactly, then `chmod +x scripts/bundle-budget.sh`:

```bash
#!/usr/bin/env bash
# Plan 005. Compares dist-web's main chunk and its total JS+CSS bytes with bundle-budget.json.
# Usage: bash scripts/bundle-budget.sh          # exit 1 when either number drifts more than 2 %
#        bash scripts/bundle-budget.sh --write  # rewrite bundle-budget.json from dist-web
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d dist-web/assets ]; then
  echo "bundle-budget: dist-web/assets missing; run npm run build:web first" >&2
  exit 2
fi
MAIN_FILE=$(ls dist-web/assets/index-*.js | head -n 1)
MAIN=$(wc -c < "$MAIN_FILE" | tr -d ' ')
TOTAL=$(find dist-web \( -name '*.js' -o -name '*.css' \) -type f -print0 \
  | xargs -0 wc -c | awk '$2 != "total" { s += $1 } END { print s }')
echo "bundle-budget: main=$MAIN ($MAIN_FILE) total=$TOTAL"
if [ "${1:-}" = "--write" ]; then
  printf '{\n  "main": %s,\n  "total": %s\n}\n' "$MAIN" "$TOTAL" > bundle-budget.json
  echo "bundle-budget: wrote bundle-budget.json"
  exit 0
fi
node - "$MAIN" "$TOTAL" <<'EOF'
const fs = require('node:fs');
const budget = JSON.parse(fs.readFileSync('bundle-budget.json', 'utf8'));
const [main, total] = process.argv.slice(2).map(Number);
const tolerance = Number(process.env.BUNDLE_TOLERANCE ?? '2');
let failed = false;
for (const [name, actual, expected] of [['main', main, budget.main], ['total', total, budget.total]]) {
  const delta = ((actual - expected) / expected) * 100;
  const verdict = Math.abs(delta) > tolerance ? 'FAIL' : 'ok';
  if (verdict === 'FAIL') failed = true;
  console.log(`bundle-budget: ${name}: ${actual} bytes, budget ${expected}, delta ${delta.toFixed(2)}% (${verdict})`);
}
process.exit(failed ? 1 : 0);
EOF
```

In `.github/workflows/e2e.yml`, directly after the `Build web app` step of the `test-web` job
(`grep -n 'Build web app' .github/workflows/e2e.yml`), insert:

```yaml
- name: Check bundle budget
  run: bash scripts/bundle-budget.sh
```

Run the commands below, then write `docs/planning/ui-perf-baseline.md` from this skeleton, filling
every `‹›` from the command output (copy numbers; do not round):

```markdown
# UI performance baseline (plan 005, before any optimisation)

Grounded at: ‹git rev-parse --short HEAD›. Dumps: `docs/planning/perf/*-before.json`.
Dev-server numbers come from React in development mode under StrictMode: counts are commits with
`phase !== 'mount'`; durations are not comparable to production. The stress fixture is 200 tokens
and no map — lighter than the 500-token scenario in `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`.

## Render counts (dev server, `?stress=1`)

| Scenario        | Dump                          | Counts (from perf-counts) |
| --------------- | ----------------------------- | ------------------------- |
| tool switch     | `tool-switch-before.json`     | ‹JSON line›               |
| token selection | `token-selection-before.json` | ‹JSON line›               |
| token move      | `token-move-before.json`      | ‹JSON line›               |

## Frame rate (dev server, rAF count, 3 s each): idle ‹n› fps, dragging ‹n› fps (`fps-before.json`)

## Modal open, warm (dev server): About ‹n› ms, Dungeon Generator ‹n› ms (`modal-open-before.json`)

## Initial load (built app via `preview:web`, median of 5): home ‹n› ms, editor ‹n› ms (`load-before.json`)

## Bundle (`npm run build:web`): main ‹bytes› (`‹file›`), total JS+CSS ‹bytes›; `agentation` in production chunks: ‹0 or n›
```

**Do NOT**: change any `src/` file in this step; round any number; skip a scenario because it is
slow; edit `playwright.config.ts`.
**Commands**:

```bash
PERF=1 PERF_TAG=before npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\]'
node scripts/perf-counts.mjs docs/planning/perf/tool-switch-before.json +ThemeManager +CanvasManager Sidebar
node scripts/perf-counts.mjs docs/planning/perf/token-selection-before.json +CanvasManager Sidebar
node scripts/perf-counts.mjs docs/planning/perf/token-move-before.json +Sidebar +CanvasManager
npm run build:web && CI=1 PERF=1 PERF_TAG=before npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[built\]'
bash scripts/bundle-budget.sh --write
cat bundle-budget.json
grep -ci agentation dist-web/assets/*.js | grep -v ':0$' || echo "no agentation in production"
ls docs/planning/perf/
npx prettier --write docs/planning/perf/ docs/planning/ui-perf-baseline.md bundle-budget.json
npm run verify:static
```

**Expected**: `5 passed`; three JSON lines, each followed by exit 0; `1 passed`; `bundle-budget:
main=… total=…` then `wrote`; two numbers; either file names (record them) or `no agentation in
production`; six `-before.json` files; formatted; exit 0.
**Check**: all three `perf-counts` calls exit 0 (in particular `Sidebar` is 0 on tool switch and
selection, and ≥ 1 on token move) and `docs/planning/ui-perf-baseline.md` has no `‹` left
(`grep -c '‹' docs/planning/ui-perf-baseline.md` prints `0`).
**If it fails**: `Sidebar` ≥ 1 on tool switch or selection → the plan's model of the code is
wrong: STOP with the JSON line. A spec test fails on a selector → STOP naming the selector.
**Commit**: `plan-005 step-2: baseline dumps, bundle budget and CI check`

### Step 3: Code-split the Design System Playground and make `Agentation` dev-only

**Files**: `src/App.tsx`, `bundle-budget.json`.
**Do**: In `src/App.tsx` delete the two imports
`import { Agentation } from 'agentation';` and
`import { DesignSystemPlayground } from './components/DesignSystemPlayground/DesignSystemPlayground';`
and add, directly under the existing `const WorldStage = lazy(…)` block
(`grep -n 'const WorldStage = lazy' src/App.tsx`):

```tsx
const DesignSystemPlayground = lazy(async () => {
  const module = await import('./components/DesignSystemPlayground/DesignSystemPlayground');
  return { default: module.DesignSystemPlayground };
});

// Dev-only feedback toolbar. The ternary lets the production build drop the import entirely.
const Agentation = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('agentation');
      return { default: module.Agentation };
    })
  : (): null => null;
```

Replace the playground render site (`grep -n '<DesignSystemPlayground />' src/App.tsx`) with
`<Suspense fallback={null}><DesignSystemPlayground /></Suspense>` and each of the three
`{import.meta.env.DEV && <Agentation />}` sites with
`{import.meta.env.DEV && (<Suspense fallback={null}><Agentation /></Suspense>)}`.
**Do NOT**: touch `HomeScreen` (Step 4) or any modal (Step 5); add a visible fallback; remove
the `/design-system` route check.
**Commands**:

```bash
npm run build:web
ls dist-web/assets/ | grep -c 'DesignSystemPlayground'
grep -ci agentation dist-web/assets/*.js | grep -v ':0$' || echo "no agentation in production"
bash scripts/bundle-budget.sh || true
bash scripts/bundle-budget.sh --write
npm run verify:static
npm run verify:web
```

**Expected**: exit 0; `1` (or `2` if Vite also emits a CSS chunk for it); `no agentation in
production`; the `main:` line shows a negative delta (record it in the commit message); `wrote`;
exit 0; exit 0.
**Check**: a `DesignSystemPlayground-*.js` chunk exists and the `main:` delta printed by
`bundle-budget.sh` is negative.
**If it fails**: the count is `0` → the lazy import was not applied to the render site; fix and
retry once, else STOP. `main:` delta is not negative → STOP with the two `bundle-budget:` lines.
**Commit**: `plan-005 step-3: lazy-load the playground; drop agentation from production`

### Step 4: Code-split `HomeScreen`, keep it only if first paint does not slip

**Files**: `src/App.tsx`, `bundle-budget.json`, `docs/planning/perf/load-step4.json` (written by
the spec).
**Do**: Delete `import { HomeScreen } from './components/HomeScreen';` and add under the
`DesignSystemPlayground` lazy block:

```tsx
const HomeScreen = lazy(async () => {
  const module = await import('./components/HomeScreen');
  return { default: module.HomeScreen };
});
```

Replace `<HomeScreen onStartEditor={handleStartEditor} />` with
`<Suspense fallback={null}><HomeScreen onStartEditor={handleStartEditor} /></Suspense>`.
Then run the commands. The decision rule is mechanical: if the home-ready median of the built app
is more than 100 ms slower than the baseline, revert this step's `src/App.tsx` change with
`git checkout -- src/App.tsx`, delete `docs/planning/perf/load-step4.json`, and record
"HomeScreen kept static: home ready before ‹n› ms, lazy ‹n› ms" in the commit message of Step 5.
**Do NOT**: add a spinner or any visible fallback; lazy-load anything else here; run the load
scenario on the dev server (it must be `CI=1` so `preview:web` serves the built output).
**Commands**:

```bash
npm run build:web && CI=1 PERF=1 PERF_TAG=step4 npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[built\]'
node -e "const b=require('./docs/planning/perf/load-before.json'),a=require('./docs/planning/perf/load-step4.json');console.log('home before',b.homeMedian,'after',a.homeMedian,'editor before',b.editorMedian,'after',a.editorMedian);process.exit(a.homeMedian<=b.homeMedian+100?0:1)"
ls dist-web/assets/ | grep -c 'HomeScreen'
bash scripts/bundle-budget.sh || true
bash scripts/bundle-budget.sh --write
npx prettier --write docs/planning/perf/
npm run verify:static
npm run verify:web
```

**Expected**: `1 passed`; four numbers then exit 0; `1`; `main:` delta negative; `wrote`;
formatted; exit 0; exit 0.
**Check**: the `node -e` comparison exits 0 (home ready within +100 ms of baseline) and a
`HomeScreen-*.js` chunk exists — or the change is reverted per the rule above and
`git diff --stat` shows no change to `src/App.tsx`.
**If it fails**: the comparison (command 2) exits 1 → this is the revert rule, not a STOP: stop the
command list there, revert as described, run `npm run build:web && bash scripts/bundle-budget.sh`
(expected exit 0), skip this step's commit, and continue to Step 5. Any other failure → STOP.
**Commit**: `plan-005 step-4: lazy-load HomeScreen (home ready ‹before› ms → ‹after› ms)` with the
two medians filled in.

### Step 5: Gate and lazy-load `AboutModal` and `DungeonGeneratorDialog`

**Files**: `src/App.tsx`, `src/components/HomeScreen.tsx`,
`src/components/DungeonGeneratorDialogGate.tsx` (new), `src/components/README.md`,
`bundle-budget.json`, `docs/planning/perf/modal-open-step5.json` (written by the spec).
**Do**: Create `src/components/DungeonGeneratorDialogGate.tsx` exactly:

```tsx
import { lazy, Suspense } from 'react';

import { useGameStore } from '../store/gameStore';

import type { JSX } from 'react';

const DungeonGeneratorDialog = lazy(async () => {
  const module = await import('./DungeonGeneratorDialog');
  return { default: module.DungeonGeneratorDialog };
});

/**
 * Mounts the Dungeon Generator only while `gameStore.dungeonDialog` is true, so App itself never
 * subscribes to that flag and the dialog's chunk is fetched on first open (plan 005).
 */
export default function DungeonGeneratorDialogGate(): JSX.Element | null {
  const open = useGameStore((state) => state.dungeonDialog);
  if (!open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <DungeonGeneratorDialog />
    </Suspense>
  );
}
```

In `src/App.tsx`: replace
`import { DungeonGeneratorDialog } from './components/DungeonGeneratorDialog';` with
`import DungeonGeneratorDialogGate from './components/DungeonGeneratorDialogGate';` and the
element `<DungeonGeneratorDialog />` with `<DungeonGeneratorDialogGate />` (its
`ProfiledBoundary id="DungeonGeneratorDialog"` stays around it). Delete
`import { AboutModal } from './components/AboutModal';` and add under the other lazy blocks:

```tsx
const AboutModal = lazy(async () => {
  const module = await import('./components/AboutModal');
  return { default: module.AboutModal };
});
```

At **both** `<AboutModal` sites (`grep -n '<AboutModal$' src/App.tsx`), change the wrapped element
so that it is rendered only while open — the `ProfiledBoundary` stays outermost:

```tsx
{isAboutOpen && (
  <ProfiledBoundary id="AboutModal">
    <Suspense fallback={null}>
      <AboutModal
        isOpen={isAboutOpen}
        … the existing props, unchanged …
      />
    </Suspense>
  </ProfiledBoundary>
)}
```

In `src/components/HomeScreen.tsx`: change line 25's import to
`import type { AboutModalTab } from './AboutModal';`, add `lazy, Suspense` to the `react` import
on line 1, add the same `const AboutModal = lazy(…)` block (with `'./AboutModal'`) below the
imports, and wrap the render site (`grep -n '<AboutModal$' src/components/HomeScreen.tsx`) as
`{isAboutOpen && (<Suspense fallback={null}><AboutModal …unchanged props… /></Suspense>)}`.
Add to the "Modal components" bullet of `src/components/README.md`
(`grep -n 'Modal components' src/components/README.md`) the text
`—`DungeonGeneratorDialogGate` mounts the generator only while open (plan 005)`.
**Do NOT**: gate or lazy-load `UpdateManager` (it holds download state across close/reopen);
touch `ImageCropper` (under `Canvas/`); change any modal's props, testids or `data-esc-owns`;
subscribe App to `dungeonDialog`.
**Commands**:

```bash
grep -c 'isAboutOpen && (' src/App.tsx src/components/HomeScreen.tsx
PERF=1 PERF_TAG=step5 npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\] modal open'
node -e "const m=require('./docs/planning/perf/modal-open-step5.json');console.log(m);process.exit(m.aboutMs<100&&m.dungeonMs<100?0:1)"
npm run build:web
ls dist-web/assets/ | grep -c 'AboutModal\|DungeonGeneratorDialog'
bash scripts/bundle-budget.sh || true
bash scripts/bundle-budget.sh --write
npx prettier --write docs/planning/perf/
npm run verify:static
npm run verify:web
```

**Expected**: `src/App.tsx:2` and `src/components/HomeScreen.tsx:1`; `1 passed`; the two times
then exit 0; exit 0; `2` (more only if a CSS chunk is emitted too); `main:` delta negative;
`wrote`; formatted; exit 0; exit 0.
**Check**: both warm open times are under 100 ms and both chunks exist.
**If it fails**: one modal is ≥ 100 ms → keep that modal's gate but restore its static import
(no `lazy`) and retry once; still ≥ 100 ms → STOP with the JSON. `verify:web` fails in the
overlay-contract or a11y spec → STOP naming the spec.
**Commit**: `plan-005 step-5: gate and lazy-load AboutModal and DungeonGeneratorDialog`

### Step 6: Add manual vendor chunks to the web build

**Files**: `vite.config.ts`, `bundle-budget.json`.
**Do**: Above `export default defineConfig` in `vite.config.ts` add:

```ts
/**
 * Web build only (plan 005): split stable vendor code into its own chunks so repeat visitors to
 * the GitHub Pages build keep them cached across releases. Electron loads from graphium:// with
 * no HTTP cache and is unaffected. react-dom imports scheduler, so the three sit together;
 * react-konva and react-reconciler sit with konva.
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('/node_modules/')) {
    return undefined;
  }
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
    return 'vendor-react';
  }
  if (/\/node_modules\/(konva|react-konva|react-reconciler)\//.test(id)) {
    return 'vendor-konva';
  }
  if (id.includes('/node_modules/@remixicon/react/')) {
    return 'vendor-icons';
  }
  return undefined;
}
```

and replace the web `build` block (`grep -n 'isWeb && {' -A6 vite.config.ts`) with:

```ts
    ...(isWeb && {
      base: './', // Use relative paths for GitHub Pages
      build: {
        outDir: 'dist-web',
        emptyOutDir: true,
        rollupOptions: {
          output: { manualChunks },
        },
      },
    }),
```

**Do NOT**: add a `build` block outside the `isWeb` spread; split anything but those three
groups; change `base`, `outDir` or `emptyOutDir`.
**Commands**:

```bash
npm run build:web
ls dist-web/assets/ | grep -c '^vendor-'
bash scripts/bundle-budget.sh || true
bash scripts/bundle-budget.sh --write
npm run build:electron
npm run verify:static
npm run verify:web
npm run verify:electron
```

**Expected**: exit 0 with no "circular" warning in the output; `3`; the `total:` line shows a delta
between −2.00 % and +2.00 % (`main:` shrinks a lot — expected); `wrote`; exit 0; exit 0; exit 0;
exit 0.
**Check**: three `vendor-*` chunks exist and the `total:` delta is within ±2 %.
**If it fails**: `total:` grows more than 2 % → a module is in two chunks: STOP with the
`bundle-budget:` lines and `ls -la dist-web/assets/`. Rollup prints a circular-chunk warning →
STOP with the warning text.
**Commit**: `plan-005 step-6: vendor-react, vendor-konva and vendor-icons chunks (web build)`

### Step 7: Move tool state into `uiStore` and take it out of `App`

**Files**: `src/store/uiStore.ts` (new), `src/store/uiStore.test.ts` (new), `src/App.tsx`,
`src/components/Toolbar.tsx`, `src/components/MobileToolbar.tsx`,
`src/components/AssetLibrary/CommandPalette.tsx`, `src/components/CanvasHost.tsx` (new),
`src/components/TokenInspectorGate.tsx` (new), `src/components/README.md`,
`docs/planning/perf/tool-switch-step7.json`, `docs/planning/perf/token-selection-step7.json`
(written by the spec).
**Do**: Create `src/store/uiStore.ts` exactly:

```ts
import { create } from 'zustand';

import { useGameStore } from './gameStore';

import type { MeasurementMode } from '../types/measurement';

type Tool = 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
type DoorOrientation = 'horizontal' | 'vertical';

interface UiState {
  tool: Tool;
  color: string;
  recentColors: string[];
  doorOrientation: DoorOrientation;
  measurementMode: MeasurementMode;
  selectedTokenIds: string[];
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  toggleDoorOrientation: () => void;
  setMeasurementMode: (mode: MeasurementMode) => void;
  setSelectedTokenIds: (ids: string[]) => void;
  clearSelection: () => void;
}

const EMPTY_SELECTION: string[] = [];

/**
 * Ephemeral editor UI state: active tool, marker colour, door orientation, measurement mode and
 * the mirrored token selection. Deliberately NOT persisted and NOT part of gameStore: nothing here
 * may reach a .graphium file or the World View broadcast. Anything durable belongs in gameStore.
 */
export const useUiStore = create<UiState>((set) => ({
  tool: 'select',
  color: '#df4b26',
  recentColors: ['#df4b26', '#3b82f6', '#22c55e'],
  doorOrientation: 'horizontal',
  measurementMode: 'ruler',
  selectedTokenIds: EMPTY_SELECTION,
  setTool: (tool) => set({ tool }),
  setColor: (color) =>
    set((state) => ({
      color,
      recentColors: [
        color,
        ...state.recentColors.filter((c) => c.toLowerCase() !== color.toLowerCase()),
      ].slice(0, 3),
    })),
  toggleDoorOrientation: () =>
    set((state) => ({
      doorOrientation: state.doorOrientation === 'horizontal' ? 'vertical' : 'horizontal',
    })),
  setMeasurementMode: (measurementMode) => {
    set({ measurementMode });
    // App.tsx used to clear the active measurement in an effect keyed on measurementMode.
    useGameStore.getState().setActiveMeasurement(null);
  },
  setSelectedTokenIds: (selectedTokenIds) => set({ selectedTokenIds }),
  clearSelection: () => set({ selectedTokenIds: EMPTY_SELECTION }),
}));
```

Create `src/store/uiStore.test.ts` exactly:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGameStore } from './gameStore';
import { useUiStore } from './uiStore';

const DEFAULTS = {
  tool: 'select' as const,
  color: '#df4b26',
  recentColors: ['#df4b26', '#3b82f6', '#22c55e'],
  doorOrientation: 'horizontal' as const,
  measurementMode: 'ruler' as const,
  selectedTokenIds: [] as string[],
};

describe('uiStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState(DEFAULTS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts on the select tool with the default colour and three recent colours', () => {
    expect(useUiStore.getState()).toMatchObject(DEFAULTS);
  });

  it('setColor puts the colour first in recentColors, deduplicated case-insensitively, max three', () => {
    useUiStore.getState().setColor('#3B82F6');
    expect(useUiStore.getState().color).toBe('#3B82F6');
    expect(useUiStore.getState().recentColors).toEqual(['#3B82F6', '#df4b26', '#22c55e']);
    useUiStore.getState().setColor('#ffffff');
    expect(useUiStore.getState().recentColors).toEqual(['#ffffff', '#3B82F6', '#df4b26']);
  });

  it('toggleDoorOrientation flips between horizontal and vertical', () => {
    useUiStore.getState().toggleDoorOrientation();
    expect(useUiStore.getState().doorOrientation).toBe('vertical');
    useUiStore.getState().toggleDoorOrientation();
    expect(useUiStore.getState().doorOrientation).toBe('horizontal');
  });

  it('setMeasurementMode clears the active measurement in gameStore', () => {
    const clear = vi.spyOn(useGameStore.getState(), 'setActiveMeasurement');
    useUiStore.getState().setMeasurementMode('blast');
    expect(useUiStore.getState().measurementMode).toBe('blast');
    expect(clear).toHaveBeenCalledWith(null);
  });

  it('setSelectedTokenIds and clearSelection round-trip', () => {
    useUiStore.getState().setSelectedTokenIds(['a', 'b']);
    expect(useUiStore.getState().selectedTokenIds).toEqual(['a', 'b']);
    useUiStore.getState().clearSelection();
    expect(useUiStore.getState().selectedTokenIds).toEqual([]);
  });

  it('writes nothing to localStorage (not persisted)', () => {
    useUiStore.getState().setTool('marker');
    useUiStore.getState().setColor('#000000');
    expect(localStorage.length).toBe(0);
  });
});
```

Create `src/components/CanvasHost.tsx` exactly (it renders the profiled wrapper; Step 10 swaps
it for the plain `CanvasManager`):

```tsx
import { useShallow } from 'zustand/shallow';

import { ProfiledCanvasManager } from '../perf/profiler';
import { useUiStore } from '../store/uiStore';

import type { JSX } from 'react';

/**
 * Feeds CanvasManager from uiStore so App does not subscribe to tool state (plan 005).
 * CanvasManager takes `tool` as a prop and must re-render on a tool switch; that render is
 * expected. Selection is written back through the store's stable setter.
 */
export default function CanvasHost({ isWorldView }: { isWorldView: boolean }): JSX.Element {
  const { tool, color, doorOrientation, measurementMode, setSelectedTokenIds } = useUiStore(
    useShallow((state) => ({
      tool: state.tool,
      color: state.color,
      doorOrientation: state.doorOrientation,
      measurementMode: state.measurementMode,
      setSelectedTokenIds: state.setSelectedTokenIds,
    })),
  );
  return (
    <ProfiledCanvasManager
      tool={tool}
      color={color}
      doorOrientation={doorOrientation}
      isWorldView={isWorldView}
      onSelectionChange={setSelectedTokenIds}
      measurementMode={measurementMode}
    />
  );
}
```

Create `src/components/TokenInspectorGate.tsx` exactly — this is the restructured
`selectedTokensOnly` (`grep -n 'selectedTokensOnly' src/App.tsx`, lines 196–197 at d3d3642): the
ids come from `uiStore`, the existence filter still runs against `gameStore.tokensById` with
`useShallow`, and `onClose` is the store's stable `clearSelection` instead of a fresh arrow:

```tsx
import { useShallow } from 'zustand/shallow';

import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';

import TokenInspector from './TokenInspector';

import type { JSX } from 'react';

/** Renders TokenInspector for the selected tokens that still exist; App no longer subscribes. */
export default function TokenInspectorGate(): JSX.Element | null {
  const selectedTokenIds = useUiStore((state) => state.selectedTokenIds);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const selectedTokensOnly = useGameStore(
    useShallow((state) => selectedTokenIds.filter((id) => Boolean(state.tokensById[id]))),
  );
  if (selectedTokensOnly.length === 0) {
    return null;
  }
  return <TokenInspector selectedTokenIds={selectedTokensOnly} onClose={clearSelection} />;
}
```

`src/App.tsx` — delete: the six `useState` lines for `tool`, `color`, `recentColors`,
`doorOrientation`, `measurementMode`, `selectedTokenIds`; the `handleColorChange` function; the
`setActiveMeasurement` selector line and the `useEffect` that calls `setActiveMeasurement(null)`
(`grep -n 'setActiveMeasurement' src/App.tsx`); the `selectedTokensOnly` selector; the `useShallow`
import; the `Tooltip` import; the `import TokenInspector from './components/TokenInspector';`
line; the floating colour palette block
(`grep -n 'Floating Color Palette' src/App.tsx`, the `{isArchitectView && !isMobile && tool === 'marker' && (…)}`
expression, moved to `Toolbar.tsx` below). Keep `colorInputRef`.
Add `import CanvasHost from './components/CanvasHost';`,
`import TokenInspectorGate from './components/TokenInspectorGate';` and
`import { useUiStore } from './store/uiStore';`. Replace the whole `<ProfiledCanvasManager …/>`
element with `<CanvasHost isWorldView={isWorldView} />` and drop `ProfiledCanvasManager` from the
`./perf/profiler` import (`noUnusedLocals` fails otherwise); replace the whole
`{isArchitectView && selectedTokensOnly.length > 0 && (<ProfiledBoundary id="TokenInspector">…</ProfiledBoundary>)}`
expression with
`{isArchitectView && (<ProfiledBoundary id="TokenInspector"><TokenInspectorGate /></ProfiledBoundary>)}`.
In the keyboard handler (`grep -n 'const handleKeyDown' src/App.tsx`): add
`const ui = useUiStore.getState();` as its first line; replace `tool === 'door'` (two places) with
`ui.tool === 'door'`; replace each `setDoorOrientation((prev) => { … });` block (two places) with
`ui.toggleDoorOrientation();`; replace the six `setTool('…')` calls with `ui.setTool('…')`; change
the effect's dependency array from `[isArchitectView, tool, isAboutOpen, isUpdateManagerOpen]` to
`[isArchitectView, isAboutOpen, isUpdateManagerOpen]`. Remove these props from the three render
sites: `<Toolbar>` loses `tool`, `setTool`, `color`, `onColorChange`, `doorOrientation`,
`onToggleDoorOrientation`, `measurementMode`, `setMeasurementMode` (keeps `colorInputRef`,
`broadcastMeasurement`, `setBroadcastMeasurement`, `isGamePaused`, `onPauseToggle`);
`<CommandPalette>` loses `onSetTool`; `<MobileToolbar>` loses `tool`, `setTool`, `color`,
`setColor`, `doorOrientation`, `setDoorOrientation` (keeps `isGamePaused`, `onPauseToggle`).

`src/components/Toolbar.tsx` (plan 004's file): delete the three exported type aliases
`ToolbarTool`, `MeasurementMode`, `DoorOrientation`; reduce `ToolbarProps` to the five kept props
above; add `import { useShallow } from 'zustand/shallow';` (external group) and
`import { useUiStore } from '../store/uiStore';`; as the first statement of `Toolbar` add:

```tsx
const {
  tool,
  setTool,
  color,
  setColor,
  recentColors,
  doorOrientation,
  toggleDoorOrientation,
  measurementMode,
  setMeasurementMode,
} = useUiStore(
  useShallow((state) => ({
    tool: state.tool,
    setTool: state.setTool,
    color: state.color,
    setColor: state.setColor,
    recentColors: state.recentColors,
    doorOrientation: state.doorOrientation,
    toggleDoorOrientation: state.toggleDoorOrientation,
    measurementMode: state.measurementMode,
    setMeasurementMode: state.setMeasurementMode,
  })),
);
```

then in its JSX replace `onColorChange(` with `setColor(` and `onToggleDoorOrientation()` with
`toggleDoorOrientation()`. Change the component's `return (<div …toolbar-root…>…</div>)` to return
a fragment `<>…</>` containing that `div` followed by the floating palette block moved verbatim
from `App.tsx`, with its leading `isArchitectView && !isMobile &&` removed (Toolbar is only
rendered under that condition) — i.e. `{tool === 'marker' && (<div className="fixed bottom-24 …">…</div>)}`,
where `handleColorChange(recentColor)` becomes `setColor(recentColor)`.

`src/components/MobileToolbar.tsx`: remove the six props from `MobileToolbarProps` and from the
destructuring; add the `useShallow` and `useUiStore` imports; as the first statement add:

```tsx
const { tool, setTool, color, setColor, doorOrientation, toggleDoorOrientation } = useUiStore(
  useShallow((state) => ({
    tool: state.tool,
    setTool: state.setTool,
    color: state.color,
    setColor: state.setColor,
    doorOrientation: state.doorOrientation,
    toggleDoorOrientation: state.toggleDoorOrientation,
  })),
);
```

replace `{tool === 'door' && setDoorOrientation && (` with `{tool === 'door' && (` and the
`setDoorOrientation(doorOrientation === 'horizontal' ? 'vertical' : 'horizontal')` call with
`toggleDoorOrientation()` (`grep -n 'setDoorOrientation' src/components/MobileToolbar.tsx`).

`src/components/AssetLibrary/CommandPalette.tsx`: remove `onSetTool` from `CommandPaletteProps`
and the destructuring; add `import { useUiStore } from '../../store/uiStore';`; in
`createCommandRegistry` replace each `() => onSetTool('x')` with
`() => useUiStore.getState().setTool('x')` and drop `onSetTool` from the `useMemo` dependency
array. Add one line to `src/components/README.md` under "Layout components":
`CanvasHost` and `TokenInspectorGate` feed `CanvasManager` and `TokenInspector` from `uiStore`
(plan 005).
**Do NOT**: add `persist` to `uiStore`; add any `useGameStore` subscription to `App`; touch
`src/components/Canvas/**` (selection is written only through `onSelectionChange`); add
`React.memo` anywhere; change a shortcut, `aria-label`, `data-testid` or `Tooltip` text.
**Commands**:

```bash
grep -c 'useState<' src/App.tsx
grep -c 'useUiStore' src/App.tsx src/components/Toolbar.tsx src/components/MobileToolbar.tsx src/components/AssetLibrary/CommandPalette.tsx src/components/CanvasHost.tsx src/components/TokenInspectorGate.tsx
npx vitest run src/store/uiStore.test.ts
PERF=1 PERF_TAG=step7 npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\]'
node scripts/perf-counts.mjs docs/planning/perf/tool-switch-step7.json +CanvasManager +Toolbar ThemeManager SyncManager PauseManager Toast ConfirmDialog DungeonGeneratorDialog AboutModal UpdateManager AutoSaveManager SessionConsoleEscapeStop CommandPalette Sidebar TokenInspector
node scripts/perf-counts.mjs docs/planning/perf/token-selection-step7.json +CanvasManager +TokenInspector ThemeManager SyncManager PauseManager Toast ConfirmDialog DungeonGeneratorDialog AboutModal UpdateManager AutoSaveManager SessionConsoleEscapeStop CommandPalette Sidebar Toolbar
npx prettier --write docs/planning/perf/
npm run verify:static
npm run verify:web
npm run verify:electron
```

**Expected**: `1` (only `viewState` still uses a typed `useState<`); six files, each with a count
≥ 1; `6 passed`; `5 passed`; JSON line then exit 0; JSON line then exit 0; formatted; exit 0;
exit 0; exit 0.
**Check**: both `perf-counts` calls exit 0 — on a tool switch only `CanvasManager` and `Toolbar`
commit; on a selection only `CanvasManager` and `TokenInspector` commit; every other named
component is at 0.
**If it fails**: a named component is non-zero → App still subscribes to something it should not:
`grep -n 'useUiStore(' src/App.tsx` must print nothing; fix and retry once, else STOP with the
JSON line. A `[dev]` test fails on `aria-pressed` or `4 Tokens Selected` → a rewired component
lost a store read: STOP naming the test.
**Commit**: `plan-005 step-7: uiStore; App no longer re-renders on tool switch or selection`

### Step 8: Narrow `Sidebar`'s store subscriptions

**Files**: `src/components/Sidebar.tsx`, `docs/planning/perf/token-move-step8.json` (written by
the spec).
**Do**: Add `import { useShallow } from 'zustand/shallow';` to the external import group of
`src/components/Sidebar.tsx`. Replace the two whole-object selectors and the derived `useMemo`
(`grep -n 'state.campaign)\|state.tokens)\|const recentTokens = useMemo' src/components/Sidebar.tsx`,
lines 99, 104 and 107–109 at d3d3642) as follows: delete
`const campaign = useGameStore((state) => state.campaign);` and
`const tokens = useGameStore((state) => state.tokens);`; replace the `recentTokens` `useMemo`
block with

```tsx
// Selected inside the store so a token move (new `tokens` array, same library items) does
// not re-render the Sidebar: useShallow compares the resulting LibraryItem[] element-wise.
const recentTokens = useGameStore(
  useShallow((state) => getRecentTokens(state.tokens, state.campaign.tokenLibrary)),
);
```

and add next to the remaining selectors:

```tsx
const campaignName = useGameStore((state) => state.campaign.name);
const maps = useGameStore(
  useShallow((state) =>
    Object.values(state.campaign.maps).sort((a, b) => a.name.localeCompare(b.name)),
  ),
);
```

Delete the old `const maps = Object.values(campaign.maps).sort(…)` line
(`grep -n 'Object.values(campaign.maps)' src/components/Sidebar.tsx`) and replace the two
`campaign.name` reads (`grep -n 'campaign.name' src/components/Sidebar.tsx`) with `campaignName`.
Then `grep -n 'campaign\.' src/components/Sidebar.tsx` must print nothing.
**Do NOT**: memoise anything; change JSX, classes, testids or behaviour; touch child components
(if a child still re-renders on a token move that is its own subscription and out of scope —
record it).
**Commands**:

```bash
grep -c 'useShallow' src/components/Sidebar.tsx
grep -c 'campaign\.' src/components/Sidebar.tsx
PERF=1 PERF_TAG=step8 npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\] token move'
node scripts/perf-counts.mjs docs/planning/perf/token-move-step8.json +CanvasManager Sidebar
npx prettier --write docs/planning/perf/
npm run verify:static
npm run verify:web
```

**Expected**: `3`; `0`; `1 passed`; JSON line then exit 0; formatted; exit 0; exit 0.
**Check**: `perf-counts` exits 0: `Sidebar` committed 0 times on the token move (it was ≥ 1 in
`token-move-before.json`) and `CanvasManager` committed at least once.
**If it fails**: `Sidebar` ≥ 1 → find the remaining subscription with
`grep -n 'useGameStore(' src/components/Sidebar.tsx` and list which selector returns a new
reference on `updateTokenPositions`; fix once, else STOP with the JSON line and that list.
**Commit**: `plan-005 step-8: Sidebar selects recent tokens, maps and name instead of tokens and campaign`

### Step 9: Add the Vitest render-count regression test

**Files**: `src/components/Toolbar.render-count.test.tsx` (new).
**Do**: Create the file exactly:

```tsx
import { createRef, Profiler } from 'react';

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../store/uiStore';

import { ThemeManager } from './ThemeManager';
import Toolbar from './Toolbar';

import type { ProfilerOnRenderCallback } from 'react';

/**
 * Plan 005 regression guard: a tool change in uiStore must re-render the Toolbar exactly once
 * and must not re-render an unmemoised sibling. If someone reintroduces `tool` as a prop fed from
 * a parent's state, the sibling starts committing and this test fails.
 */
describe('Toolbar render count', () => {
  beforeEach(() => {
    useUiStore.setState({ tool: 'select' });
  });

  it('re-renders only the toolbar when the tool changes', () => {
    const commits: Record<string, number> = {};
    let counting = false;
    const onRender: ProfilerOnRenderCallback = (id, phase) => {
      if (counting && phase !== 'mount') {
        commits[id] = (commits[id] ?? 0) + 1;
      }
    };
    const noop = (): void => {};
    render(
      <>
        <Profiler id="ThemeManager" onRender={onRender}>
          <ThemeManager />
        </Profiler>
        <Profiler id="Toolbar" onRender={onRender}>
          <Toolbar
            colorInputRef={createRef<HTMLInputElement>()}
            broadcastMeasurement={false}
            setBroadcastMeasurement={noop}
            isGamePaused={false}
            onPauseToggle={noop}
          />
        </Profiler>
      </>,
    );
    expect(screen.getByLabelText('Select tool')).toHaveAttribute('aria-pressed', 'true');

    counting = true;
    act(() => {
      useUiStore.setState({ tool: 'marker' });
    });

    expect(commits['Toolbar']).toBe(1);
    expect(commits['ThemeManager'] ?? 0).toBe(0);
    expect(screen.getByLabelText('Marker tool')).toHaveAttribute('aria-pressed', 'true');
  });
});
```

**Do NOT**: render `App`; mock `uiStore`; loosen `toBe(1)` to `toBeGreaterThan(0)`; add
`data-testid`s to `Toolbar` for this test (it uses the existing `aria-label`s).
**Commands**:

```bash
npx vitest run src/components/Toolbar.render-count.test.tsx
npm run verify:static
```

**Expected**: `1 passed`; exit 0.
**Check**: the test passes.
**If it fails**: `commits.Toolbar` is 2 → `Toolbar` still has more than one `useUiStore` call;
merge them into the single `useShallow` selector from Step 7 and retry once. Any label not found
→ plan 004 changed an `aria-label`: STOP naming it.
**Commit**: `plan-005 step-9: Toolbar render-count regression test`

### Step 10: Final numbers, production check, docs, recipes, report and handoff

**Files**: `src/components/CanvasHost.tsx`, `docs/planning/perf/*-after.json` (written by the
spec), `bundle-budget.json`, `docs/planning/screenshots/005-final/` (new),
`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`, `docs/guides/UI_RECIPES.md`, `CHANGELOG.md`,
`plans/reports/005.md` (new), `plans/README.md`, `plans/006-visual-redesign.md`.
**Do**: The harness stays: it is dev-only, every wrapper is a plain passthrough in production, and
the profiling spec is useless without it. `CanvasHost.tsx` keeps rendering `ProfiledCanvasManager`
for the same reason — do not swap it. Prove the production build carries none of it (command 3).
Run the `after` measurements (commands 1–2, 4–6). Append to
`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`, before `## Performance Benchmark Summary`
(`grep -n '^## Performance Benchmark Summary' docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`), a
section in the document's own shape:

```markdown
## 🚨 Bottleneck #4: DOM chrome re-renders on every tool switch (MEDIUM)

### The Problem

**Location:** `src/App.tsx`

Tool, colour, door orientation, measurement mode and the selection were `useState` in `App`, so
every tool switch and selection re-rendered App's whole tree. Memoised components bailed out; the
unmemoised global components did not. The web bundle also shipped the playground, the home screen
and all vendor code in one chunk.

### The Solution: `uiStore`, gates and code splitting

**Files Modified:** `src/store/uiStore.ts`, `src/components/{Toolbar,MobileToolbar,CanvasHost,TokenInspectorGate,DungeonGeneratorDialogGate}.tsx`, `src/components/Sidebar.tsx`, `vite.config.ts`

- Tool state lives in `useUiStore` (not persisted, not broadcast); `Toolbar`, `MobileToolbar`,
  `CommandPalette` and `CanvasHost` read it directly, so `App` no longer subscribes to it.
- `AboutModal` and `DungeonGeneratorDialog` mount only while open and load lazily.
- `Sidebar` selects `recentTokens`, `maps` and `campaign.name` instead of `tokens` and `campaign`.
- Web build: `vendor-react`, `vendor-konva`, `vendor-icons` chunks; `bundle-budget.json` is
  enforced in `e2e.yml` (±2 %).

**Results** (dev-server commit counts, `?stress=1`; see `docs/planning/perf/*-before.json` and
`*-after.json`):

| Scenario / metric               | Before    | After     |
| ------------------------------- | --------- | --------- |
| tool switch: unmemoised commits | ‹n›       | 0         |
| token selection: unmemoised     | ‹n›       | 0         |
| token move: Sidebar commits     | ‹n›       | 0         |
| idle / drag fps                 | ‹n› / ‹n› | ‹n› / ‹n› |
| home / editor ready (ms)        | ‹n› / ‹n› | ‹n› / ‹n› |
| main chunk / total bytes        | ‹n› / ‹n› | ‹n› / ‹n› |

### How to re-measure

`src/perf/profiler.tsx` (dev-only) records every commit of the wrapped components into
`window.__profile`. `PERF=1 PERF_TAG=<tag> npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\]'`
drives the scenarios and writes `docs/planning/perf/<scenario>-<tag>.json`;
`node scripts/perf-counts.mjs <file> [+Id ...] [Id ...]` reads them. Add `CI=1` and
`-g '\[built\]'` for load times against the production build.
```

Fill the "Add a toolbar tool" section of `docs/guides/UI_RECIPES.md`
(`grep -n 'Add a toolbar tool' docs/guides/UI_RECIPES.md`) with:

```markdown
1. Add the literal to the `Tool` union in `src/store/uiStore.ts`; `CanvasManager`'s prop type
   (`grep -n "tool?: 'select'" src/components/Canvas/CanvasManager.tsx`) and
   `src/components/Canvas/hooks/useCanvasInteraction.ts` carry the same union — extend both.
2. Shortcut: add a `case` to the `switch` in `handleKeyDown` in `src/App.tsx`
   (`grep -n "case 'v':" src/App.tsx`) calling `ui.setTool('<name>')`.
3. Button: in `src/components/Toolbar.tsx` add a `<Button variant="tool" active={tool === '<name>'} aria-pressed={tool === '<name>'} aria-label="<Name> tool" data-testid="toolbar-tool-<name>" onClick={() => setTool('<name>')}>` inside a `Tooltip`; mirror it in `MobileToolbar.tsx` and add a `setTool<Name>` command to `createCommandRegistry` in `CommandPalette.tsx`.
4. Test: add the shortcut and `aria-pressed` assertion to the tool-switch test in
   `tests/functional/editor-smoke.spec.ts`, and a `useUiStore.setState({ tool: '<name>' })` case
   to `src/components/Toolbar.render-count.test.tsx` if the button reads new store fields.
```

Fill "Add a surface to the test harness" with:

```markdown
1. Add the name to the surface union and its navigation in `tests/helpers/surfaces.ts`
   (`grep -n 'export' tests/helpers/surfaces.ts` shows the helper's exports).
2. Give the surface's root element a `data-testid` per `plans/CONVENTIONS.md` §8 and wait for it
   in the navigation.
3. `SHOTS_OUT=<dir> npm run shots` and `npm run test:a11y` iterate every surface in both themes:
   check the new surface appears in both outputs (`ls <dir>` and the a11y scan count).
```

Add one bullet under `## [Unreleased]` in `CHANGELOG.md`: "Web build: the home screen, About
dialog, Dungeon Generator and Design System Playground load on demand; vendor code is cached
separately. About and Dungeon Generator now reset when reopened." Write `plans/reports/005.md`
(CONVENTIONS §11) with every number from Step 2 and this step under **Numbers**, and list
`docs/planning/screenshots/005-final/` under **Screenshots** ("expected identical to
`004-final`"). After merge: set this plan's row in `plans/README.md` to `DONE <merge sha>` and
write the merge SHA into the `Grounded at` line of `plans/006-visual-redesign.md`.
**Do NOT**: delete `src/perf/profiler.tsx` or the `ProfiledBoundary` wrappers; add a
`--exclude`-free `Profiler` grep as a gate (the harness legitimately contains it); edit
`plans/CONVENTIONS.md`; fill any other recipe.
**Commands**:

```bash
PERF=1 PERF_TAG=after npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[dev\]'
npm run build:web && CI=1 PERF=1 PERF_TAG=after npx playwright test tests/performance/profile.spec.ts --project=Web-Chromium --workers=1 -g '\[built\]'
grep -c '__profileDump\|ProfiledBoundary' dist-web/assets/*.js | grep -v ':0$' || echo "harness absent from production"
grep -rn 'Profiler' src/ --include=*.ts --include=*.tsx --exclude=*.test.tsx | grep -v '^src/perf/profiler.tsx' || echo "Profiler only in the harness"
node scripts/perf-counts.mjs docs/planning/perf/tool-switch-after.json +CanvasManager +Toolbar ThemeManager SyncManager PauseManager Toast ConfirmDialog DungeonGeneratorDialog AboutModal UpdateManager AutoSaveManager SessionConsoleEscapeStop CommandPalette Sidebar TokenInspector
node -e "const b=require('./docs/planning/perf/fps-before.json'),a=require('./docs/planning/perf/fps-after.json');console.log(b,a);process.exit(a.idle>=b.idle-5&&a.drag>=b.drag-5?0:1)"
bash scripts/bundle-budget.sh --write
SHOTS_OUT=docs/planning/screenshots/005-final npm run shots
npx prettier --write docs/planning/perf/ bundle-budget.json
npm run verify
```

**Expected**: `5 passed`; `1 passed`; `harness absent from production`; `Profiler only in the
harness`; JSON line then exit 0; two objects then exit 0; `wrote`; exit 0 with one PNG per
surface and theme; formatted; exit 0.
**Check**: commands 3, 4, 5 and 6 print their success line / exit 0, and `npm run verify` exits 0.
**If it fails**: command 3 prints a file → a `ProfiledBoundary` is not behind
`import.meta.env.DEV`: fix `src/perf/profiler.tsx` and retry once. Command 6 exits 1 → fps
regressed more than 5: STOP with both objects. Anything else → STOP.
**Commit**: `plan-005 step-10: final numbers, docs, recipes and report`

## Done criteria

- [ ] `src/perf/profiler.tsx` exists, is dev-only, and `dist-web` contains no `__profileDump`
- [ ] `docs/planning/ui-perf-baseline.md` and `docs/planning/perf/*-before.json` were committed before any optimisation
- [ ] `tool-switch-after.json` shows 0 commits for every unmemoised global component; `token-move-after.json` shows 0 for `Sidebar`
- [ ] Playground, `HomeScreen` (or a recorded revert), `AboutModal` and `DungeonGeneratorDialog` are separate chunks; `agentation` is absent from production
- [ ] `UpdateManager` and `src/components/Canvas/**` untouched
- [ ] `vite.config.ts` emits `vendor-react`, `vendor-konva`, `vendor-icons`; total bytes within 2 % of Step 5
- [ ] `src/store/uiStore.ts` is not persisted and has `uiStore.test.ts`
- [ ] `Toolbar.render-count.test.tsx` passes; `scripts/bundle-budget.sh` runs in `e2e.yml`
- [ ] `PERFORMANCE_OPTIMIZATIONS.md` has Bottleneck #4 with real numbers; both `UI_RECIPES.md` sections filled
- [ ] `plans/reports/005.md` written; `plans/README.md` row `DONE <merge sha>`; plan 006's `Grounded at` filled

## STOP conditions

- Step 1: `Sidebar` ≥ 1 or `ThemeManager` = 0 on a tool switch — the instrument is wrong.
- Step 2: `Sidebar` ≥ 1 on a tool switch or selection — the plan's model of the code is wrong.
- Step 6: total bytes grow more than 2 % — a module is duplicated across chunks.
- Step 7: a named component still commits after one fix — `App` still holds tool state.
- Any step: you are about to edit `src/components/Canvas/**`, add `persist` to `uiStore`, or add a
  `React.memo` no dump names.

## Handoff / after it lands

- **Reviewer focus**: (1) the `docs/planning/perf/*.json` dumps match the numbers in the report;
  (2) Step 7's rewiring (`Toolbar`, `MobileToolbar`, `CommandPalette`, the keyboard handler);
  (3) the one sanctioned behaviour change: About and Dungeon Generator unmount on close.
- **Deferred**: canvas and fog-of-war performance (already tuned), `ImageCropper`,
  `UpdateManager` gating, Electron-target chunking, `recentColors` persistence (a product
  decision; raise a decision file if it comes up), any dependency upgrade.
- **Watch for**: `uiStore` accumulating durable state; the harness wrappers drifting away from the
  components they name; `bundle-budget.json` being rewritten to make CI pass without a recorded
  reason.
