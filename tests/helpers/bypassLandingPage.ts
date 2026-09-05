import type { Page } from '@playwright/test';
import type { Campaign } from '../../src/store/gameStore';

/**
 * Legacy Electron-mocked editor entry for door-sync and dm-world-sync.
 *
 * New tests should use `gotoSurface` from `tests/helpers/surfaces.ts` instead.
 * This helper injects `window.ipcRenderer`, which makes SyncManager skip
 * BroadcastChannel — so it cannot drive the World View in the web build.
 *
 * Flow: mock Electron APIs, seed IndexedDB, open `/?e2e=1`, click New Campaign,
 * wait for `editor-view`.
 */
export async function bypassLandingPageAndInjectState(
  page: Page,
  campaignData?: Partial<Campaign>,
) {
  // 1. Mock Electron APIs (for compatibility with web mode)
  await page.addInitScript(() => {
    // @ts-ignore - Adding to window object
    window.ipcRenderer = {
      on: () => {},
      off: () => {},
      send: () => {},
      invoke: () => Promise.resolve({}),
    };

    // @ts-ignore - Adding to window object
    window.themeAPI = {
      getThemeState: () =>
        Promise.resolve({
          mode: 'light',
          effectiveTheme: 'light',
        }),
      setThemeMode: () => Promise.resolve(),
      onThemeChanged: () => () => {},
    };

    // @ts-ignore - Adding to window object
    window.errorReporting = {
      getUsername: () => Promise.resolve('test-user'),
      openExternal: () => Promise.resolve(true),
      saveToFile: () => Promise.resolve({ success: true }),
    };
  });

  // 2. Inject IndexedDB state to skip onboarding
  await page.addInitScript((initialCampaign) => {
    // Mock IndexedDB with pre-configured state
    const request = indexedDB.open('graphium-storage', 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      if (!db.objectStoreNames.contains('autosave')) {
        db.createObjectStore('autosave', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('library')) {
        const libraryStore = db.createObjectStore('library', { keyPath: 'id' });
        libraryStore.createIndex('category', 'category', { unique: false });
        libraryStore.createIndex('dateAdded', 'dateAdded', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Insert mock campaign (simulates "returning user")
      const tx = db.transaction('autosave', 'readwrite');
      tx.objectStore('autosave').put({
        id: 'latest',
        campaign: initialCampaign || {
          name: 'Test Campaign',
          maps: {},
          currentMapId: null,
          tokenLibrary: [],
        },
        timestamp: Date.now(),
      });
    };
  }, campaignData);

  // 3. Set localStorage flags
  await page.addInitScript(() => {
    localStorage.setItem('graphium-onboarding-completed', 'true');
    localStorage.setItem('graphium-theme', 'light'); // Use light theme for tests
  });

  // 4. Navigate with ?e2e=1 so window.__GAME_STORE__ is exposed in every build
  await page.goto('/?e2e=1');

  // 5. Enter the editor. Nothing auto-enters EDITOR; New Campaign is the only path.
  await page.waitForSelector('[data-testid="new-campaign-button"]', {
    timeout: 10000,
    state: 'visible',
  });
  await page.click('[data-testid="new-campaign-button"]');
  await page.waitForSelector('[data-testid="editor-view"]', { timeout: 10000, state: 'visible' });

  // Wait for any initial animations/loading to complete
  await page.waitForLoadState('networkidle');
}

/**
 * Inject a specific campaign state into IndexedDB
 *
 * Use this when you need to test with pre-existing campaign data.
 *
 * @param page - Playwright Page object
 * @param campaign - Campaign object to inject
 */
export async function injectCampaignState(page: Page, campaign: any) {
  await page.evaluate((campaignData) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('graphium-storage', 1);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('autosave')) {
          reject(
            new Error('Database not initialized. Call bypassLandingPageAndInjectState first.'),
          );
          return;
        }

        const tx = db.transaction('autosave', 'readwrite');
        tx.objectStore('autosave').put({
          id: 'latest',
          campaign: campaignData,
          timestamp: Date.now(),
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };

      request.onerror = () => reject(request.error);
    });
  }, campaign);

  // Reload to apply the new state
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Clear all test data from IndexedDB and localStorage
 *
 * Use this when you need to simulate a fresh user session.
 *
 * @param page - Playwright Page object
 */
export async function clearAllTestData(page: Page) {
  // about:blank / opaque origins cannot read localStorage. Skip until a later
  // helper (bypassLandingPageAndInjectState) navigates with init scripts.
  if (!page.url().startsWith('http')) {
    return;
  }

  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      // Ignore storage access errors on unexpected origins.
    }
    return indexedDB.deleteDatabase('graphium-storage');
  });
}
