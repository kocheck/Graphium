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
