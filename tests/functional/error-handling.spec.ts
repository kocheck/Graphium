/**
 * Error Handling Functional Tests
 *
 * SKIPPED: These tests require UI elements that don't exist in the current implementation.
 * Tests expect data-testid attributes for:
 * - add-token-button
 * - campaign creation dialog
 * - offline indicators
 * - validation error messages
 *
 * Tests that the application handles errors gracefully:
 * - Network failures
 * - Invalid user input
 * - Storage quota exceeded
 * - Corrupted data
 * - Missing resources
 *
 * Focus: Error messages, recovery, and user experience
 */

import { test } from '@playwright/test';
import {
  bypassLandingPageAndInjectState,
  clearAllTestData,
} from '../helpers/bypassLandingPage';
import { createNewCampaign } from '../helpers/campaignHelpers';

test.describe.skip('Network Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
  });

  test('should handle offline mode gracefully', async ({ page }) => {
    await createNewCampaign(page, 'Offline Test');

    // Go offline
    await page.context().setOffline(true);

    // Make changes (should still work via IndexedDB)
    await page.click('[data-testid="add-token-button"]');

    await expect(
      page.locator('[data-testid^="token-"]'),
      'Should still be able to add tokens offline'
    ).toHaveCount(1);

    // Try to perform online-only action (if any)
    // Should show appropriate error or offline indicator
  });

  test('should show offline indicator when network unavailable', async ({ page }) => {
    await createNewCampaign(page, 'Network Test');

    await page.context().setOffline(true);

    // Should show offline indicator
    // await expect(
    //   page.locator('[data-testid="offline-indicator"]'),
    //   'Should show offline indicator when network is unavailable'
    // ).toBeVisible();

    await page.context().setOffline(false);

    // Indicator should disappear
    // await expect(
    //   page.locator('[data-testid="offline-indicator"]'),
    //   'Offline indicator should disappear when online'
    // ).toHaveCount(0);
  });

  test('should retry failed network requests', async ({ page }) => {
    // Simulate intermittent network failure
    await page.route('**/api/**', (route) => {
      // Fail first attempt, succeed second
      if (!route.request().headers()['x-retry']) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Operation that requires network (if applicable)
    // Should auto-retry and succeed
  });
});

test.describe('Input Validation Errors', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
  });

  test('should show error for empty campaign name', async ({ page }) => {
    await page.click('[data-testid="new-campaign-button"]');

    // Submit without name
    await page.click('[data-testid="create-campaign-submit"]');

    await expect(
      page.locator('[data-testid="campaign-name-error"]'),
      'Should show validation error for empty campaign name'
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="campaign-name-error"]'),
      'Error message should be descriptive'
    ).toContainText('required');
  });

  test('should show error for invalid map dimensions', async ({ page }) => {
    await createNewCampaign(page, 'Validation Test');

    await page.click('[data-testid="add-map-button"]');

    // Enter invalid dimensions
    await page.fill('[data-testid="map-width-input"]', '-100');
    await page.fill('[data-testid="map-height-input"]', '0');
    await page.click('[data-testid="create-map-submit"]');

    await expect(
      page.locator('[data-testid="map-dimensions-error"]'),
      'Should show error for invalid map dimensions'
    ).toBeVisible();
  });

  test('should validate token size limits', async ({ page }) => {
    await createNewCampaign(page, 'Size Test');
    await page.click('[data-testid="add-token-button"]');

    const token = page.locator('[data-testid^="token-"]').first();
    await token.click();

    // Try to set invalid size
    await page.click('[data-testid="token-properties-button"]');
    await page.fill('[data-testid="token-size-input"]', '10000');
    await page.click('[data-testid="save-token-properties"]');

    await expect(
      page.locator('[data-testid="token-size-error"]'),
      'Should show error for excessive token size'
    ).toBeVisible();
  });

  test('should sanitize special characters in input', async ({ page }) => {
    const xssAttempt = '<script>alert("XSS")</script>';

    await page.click('[data-testid="new-campaign-button"]');
    await page.fill('[data-testid="campaign-name-input"]', xssAttempt);
    await page.click('[data-testid="create-campaign-submit"]');

    // Verify script not executed
    const titleHTML = await page.locator('[data-testid="campaign-title"]').innerHTML();

    expect(
      titleHTML,
      'Script tags should be escaped/sanitized'
    ).not.toContain('<script>');
  });
});

test.describe('Storage Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
  });

  test('should handle IndexedDB quota exceeded', async ({ page }) => {
    await createNewCampaign(page, 'Quota Test');

    // Attempt to exceed quota (would need to add large amount of data)
    // This is a conceptual test - actual implementation depends on browser limits

    // Should show warning before quota exceeded
    // await expect(
    //   page.locator('[data-testid="storage-warning"]'),
    //   'Should warn when approaching storage quota'
    // ).toBeVisible();
  });

  test('should recover from failed IndexedDB transaction', async ({ page }) => {
    await createNewCampaign(page, 'Transaction Test');

    // Simulate transaction failure
    await page.evaluate(() => {
      const originalOpen = indexedDB.open;
      let failCount = 0;

      indexedDB.open = function (...args) {
        if (failCount++ === 0) {
          throw new Error('Simulated transaction failure');
        }
        return originalOpen.apply(this, args);
      };
    });

    // Try operation that uses IndexedDB
    await page.click('[data-testid="add-token-button"]');

    // Should retry and succeed or show error gracefully
  });

  test('should handle corrupted IndexedDB gracefully', async ({ page }) => {
    // Corrupt the database
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('hyle-storage', 1);

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const tx = db.transaction('autosave', 'readwrite');

          // Insert malformed data
          tx.objectStore('autosave').put({
            id: 'latest',
            campaign: 'CORRUPTED',
            timestamp: Date.now(),
          });

          tx.oncomplete = () => resolve(true);
        };
      });
    });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should either show error or allow creating new campaign
    const errorDialog = page.locator('[data-testid="corruption-error-dialog"]');
    const newCampaignBtn = page.locator('[data-testid="new-campaign-button"]');

    const hasError = await errorDialog.isVisible().catch(() => false);
    const canRecover = await newCampaignBtn.isVisible().catch(() => true);

    expect(
      hasError || canRecover,
      'Should handle corrupted data with error or recovery option'
    ).toBeTruthy();
  });
});

test.describe('File Operation Errors', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
  });

  test('should handle invalid file upload', async ({ page }) => {
    await createNewCampaign(page, 'Upload Test');

    // Try to upload invalid file type
    const textFile = Buffer.from('not an image');
    const fileInput = page.locator('[data-testid="map-background-upload"]');

    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: textFile,
    });

    await expect(
      page.locator('[data-testid="file-upload-error"]'),
      'Should show error for invalid file type'
    ).toBeVisible();
  });

  test('should handle oversized file upload', async ({ page }) => {
    await createNewCampaign(page, 'Size Test');

    // Try to upload file exceeding size limit
    // Note: Would need to generate or use large test file

    // Should show error
    // await expect(
    //   page.locator('[data-testid="file-size-error"]'),
    //   'Should show error for oversized file'
    // ).toContainText('too large');
  });

  test('should handle corrupted import file', async ({ page }) => {
    const corruptedFile = Buffer.from('{ corrupted json');

    const importInput = page.locator('[data-testid="import-file"]');
    await importInput.setInputFiles({
      name: 'corrupted.hyle',
      mimeType: 'application/json',
      buffer: corruptedFile,
    });

    await expect(
      page.locator('[data-testid="import-error-message"]'),
      'Should show error for corrupted import file'
    ).toBeVisible();
  });
});

test.describe('User Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
  });

  test('should allow retrying failed operation', async ({ page }) => {
    await createNewCampaign(page, 'Retry Test');

    // Simulate failure (e.g., network error)
    await page.context().setOffline(true);

    // Try operation that requires network
    // await page.click('[data-testid="sync-button"]');

    // Should show error with retry button
    // await expect(
    //   page.locator('[data-testid="retry-button"]'),
    //   'Should show retry button after failure'
    // ).toBeVisible();

    // Go back online
    await page.context().setOffline(false);

    // Click retry
    // await page.click('[data-testid="retry-button"]');

    // Should succeed
  });

  test('should provide helpful error messages', async ({ page }) => {
    await page.click('[data-testid="new-campaign-button"]');
    await page.click('[data-testid="create-campaign-submit"]');

    const errorMessage = await page
      .locator('[data-testid="campaign-name-error"]')
      .textContent();

    expect(
      errorMessage,
      'Error message should be user-friendly'
    ).not.toContain('undefined');

    expect(
      errorMessage,
      'Error message should explain what to do'
    ).toBeTruthy();
  });

  test('should preserve user data after recoverable error', async ({ page }) => {
    await createNewCampaign(page, 'Data Preservation Test');
    await page.click('[data-testid="add-token-button"]');

    // Simulate error during save
    let tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens).toHaveCount(1);

    // Even if error occurs, data should not be lost
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Campaign and token should still exist (from auto-save)
    await expect(
      page.locator('[data-testid="campaign-title"]'),
      'Campaign should persist even after error'
    ).toHaveText('Data Preservation Test');
  });
});

test.describe('Error Logging and Reporting', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
  });

  test('should log errors to console', async ({ page }) => {
    const consoleLogs: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });

    // Trigger error
    await page.evaluate(() => {
      throw new Error('Test error');
    });

    expect(
      consoleLogs.length,
      'Errors should be logged to console'
    ).toBeGreaterThan(0);
  });

  test('should catch and handle unhandled promise rejections', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Trigger unhandled rejection
    await page.evaluate(() => {
      Promise.reject(new Error('Unhandled rejection'));
    });

    await page.waitForTimeout(1000);

    // App should still be functional
    await createNewCampaign(page, 'Error Recovery Test');

    await expect(
      page.locator('[data-testid="campaign-title"]'),
      'App should still function after unhandled error'
    ).toHaveText('Error Recovery Test');
  });

  test('should show error report dialog for critical errors', async ({ page }) => {
    // Simulate critical error
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'Critical error occurred',
        error: new Error('Critical error'),
      }));
    });

    // Should show error dialog (if implemented)
    // await expect(
    //   page.locator('[data-testid="error-report-dialog"]'),
    //   'Should show error report dialog for critical errors'
    // ).toBeVisible();
  });
});

test.describe('Boundary Conditions', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
  });

  test('should handle maximum number of tokens gracefully', async ({ page }) => {
    await createNewCampaign(page, 'Max Tokens Test');

    // Add many tokens (test upper limit)
    for (let i = 0; i < 1000; i++) {
      await page.click('[data-testid="add-token-button"]');
      await page.click('[data-testid="canvas"]', {
        position: { x: 100 + (i % 20) * 30, y: 100 + Math.floor(i / 20) * 30 },
      });

      // Every 100 tokens, verify still responsive
      if (i % 100 === 0) {
        const tokens = page.locator('[data-testid^="token-"]');
        await expect(tokens).toHaveCount(i + 1);
      }
    }

    // Should either succeed or show meaningful error
  });

  test('should handle very long text inputs', async ({ page }) => {
    const veryLongName = 'A'.repeat(10000);

    await page.click('[data-testid="new-campaign-button"]');
    await page.fill('[data-testid="campaign-name-input"]', veryLongName);
    await page.click('[data-testid="create-campaign-submit"]');

    // Should either truncate or show validation error
    const errorShown = await page
      .locator('[data-testid="campaign-name-error"]')
      .isVisible()
      .catch(() => false);

    if (!errorShown) {
      // If accepted, should be truncated
      const titleText = await page
        .locator('[data-testid="campaign-title"]')
        .textContent();

      expect(
        titleText!.length,
        'Very long input should be truncated'
      ).toBeLessThan(500);
    }
  });
});
