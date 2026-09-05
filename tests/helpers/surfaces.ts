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
  // Mobile home (390×844) keeps New Campaign below the fold. Playwright's
  // actionability check refuses that click even with force:true, so invoke
  // the DOM click directly.
  await page.locator('[data-testid="new-campaign-button"]').evaluate((el: HTMLElement) => {
    el.click();
  });
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
