import type { Page } from '@playwright/test';
import type { Campaign } from '../../src/store/gameStore';

/**
 * Bypass Landing Page and Inject Test State
 *
 * This helper bypasses the "Download Landing Page" gateway by:
 * 1. Mocking Electron APIs (for web mode compatibility)
 * 2. Injecting pre-configured IndexedDB state
 * 3. Setting localStorage flags to simulate returning user
 *
 * **Why this is needed:**
 * The production web build shows a landing page before the main app.
 * For functional tests, we want to skip directly to the app to test behavior,
 * not landing page UX.
 *
 * **Usage:**
 * ```typescript
 * test.beforeEach(async ({ page }) => {
 *   await bypassLandingPageAndInjectState(page);
 * });
 * ```
 *
 * @param page - Playwright Page object
 * @param campaignData - Optional initial campaign data to inject
 */
export async function bypassLandingPageAndInjectState(
  page: Page,
  campaignData?: Partial<Campaign>
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

  // 4. Navigate to app (landing page logic will detect "returning user" and skip)
  await page.goto('/');

  // 5. Wait for main app to render
  // Note: The app uses data-testid="editor-view" on the editor root div (when in EDITOR state)
  await page.waitForSelector('[data-testid="editor-view"]', {
    timeout: 10000,
    state: 'visible',
  }).catch(async () => {
    // Fallback: If editor-view doesn't exist, wait for root to be visible
    await page.waitForSelector('#root:visible', { timeout: 10000 });
  });

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
          reject(new Error('Database not initialized. Call bypassLandingPageAndInjectState first.'));
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
  await page.evaluate(() => {
    localStorage.clear();
    return indexedDB.deleteDatabase('graphium-storage');
  });
}
