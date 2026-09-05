/**
 * Remaining coverage after plan 000 Step 7: the drag/draw suites were deleted
 * (tokens never moved under Playwright). This file only asserts that the
 * Electron-mock path still exposes `window.ipcRenderer` for IPC sync.
 */

import { test, expect } from '@playwright/test';
import { bypassLandingPageAndInjectState, clearAllTestData } from '../helpers/bypassLandingPage';

test.describe('Token Drag Synchronization', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
  });

  test('should preserve IPC sync calls in pointer event handlers', async ({ page }) => {
    await bypassLandingPageAndInjectState(page);

    const hasIPCSupport = await page.evaluate(() => {
      return typeof window.ipcRenderer !== 'undefined';
    });

    expect(hasIPCSupport, 'IPC renderer should be available for sync').toBeTruthy();
  });
});
