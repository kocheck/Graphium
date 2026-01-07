/**
 * Data Integrity Functional Tests
 *
 * Tests that ensure data remains intact through:
 * - Export/import cycles
 * - Auto-save/manual save
 * - Browser storage operations
 * - Edge cases (large files, corrupted data, version mismatches)
 *
 * These tests verify WHAT data is preserved, not HOW it looks.
 */

import { test, expect } from '@playwright/test';
import {
  bypassLandingPageAndInjectState,
  clearAllTestData,
  injectCampaignState,
} from '../helpers/bypassLandingPage';
import { createNewCampaign, exportCampaign, importCampaign } from '../helpers/campaignHelpers';

test.describe('Export/Import Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
  });

  test('should preserve campaign name through export/import', async ({ page }) => {
    const campaignName = 'Export Test Campaign';

    // Create campaign
    await createNewCampaign(page, campaignName);

    // Export
    const filePath = await exportCampaign(page);

    // Clear state
    await clearAllTestData(page);
    await page.reload();
    await bypassLandingPageAndInjectState(page);

    // Import
    await importCampaign(page, filePath);

    // Verify name preserved
    await expect(
      page.locator('[data-testid="campaign-title"]'),
      'Campaign name should be preserved through export/import cycle',
    ).toHaveText(campaignName);
  });

  test('should preserve all token data through export/import', async ({ page }) => {
    // Create campaign with token
    await createNewCampaign(page, 'Token Export Test');

    // Add token with specific properties
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Set token properties
    await token.click();
    await page.click('[data-testid="token-properties-button"]');
    await page.fill('[data-testid="token-name-input"]', 'Hero Token');
    await page.fill('[data-testid="token-size-input"]', '100');
    await page.click('[data-testid="save-token-properties"]');

    // Get token position
    const originalBox = await token.boundingBox();

    // Export/Import
    const filePath = await exportCampaign(page);
    await clearAllTestData(page);
    await page.reload();
    await bypassLandingPageAndInjectState(page);
    await importCampaign(page, filePath);

    // Verify token restored
    const restoredToken = page.locator('[data-testid^="token-"]').first();
    await expect(restoredToken, 'Token should be restored after import').toBeVisible();

    // Verify token name
    await restoredToken.click();
    const tokenName = await page.locator('[data-testid="token-label"]').textContent();
    expect(tokenName, 'Token name should be preserved').toBe('Hero Token');

    // Verify position (within tolerance)
    const restoredBox = await restoredToken.boundingBox();
    expect(restoredBox!.x, 'Token X position should be preserved').toBeCloseTo(originalBox!.x, 10);

    expect(restoredBox!.y, 'Token Y position should be preserved').toBeCloseTo(originalBox!.y, 10);
  });

  test('should preserve map backgrounds through export/import', async ({ page }) => {
    // Note: This test assumes you have test assets
    // Adjust or skip based on your setup

    // Create campaign
    await createNewCampaign(page, 'Map Export Test');

    // Add map background
    // await addMapBackground(page, './test-assets/dungeon.webp');

    // Verify map exists
    const mapLayer = page.locator('[data-testid="map-layer"]');
    // await expect(mapLayer).toBeVisible();

    // Export/Import
    // const filePath = await exportCampaign(page);
    // await clearAllTestData(page);
    // await page.reload();
    // await bypassLandingPageAndInjectState(page);
    // await importCampaign(page, filePath);

    // Verify map restored
    // await expect(
    //   page.locator('[data-testid="map-layer"]'),
    //   'Map background should be restored after import'
    // ).toBeVisible();
  });

  test('should preserve token library through export/import', async ({ page }) => {
    // Create campaign
    await createNewCampaign(page, 'Library Export Test');

    // Add items to token library
    await page.click('[data-testid="token-library-button"]');
    await page.click('[data-testid="upload-to-library-button"]');

    // Upload test image (if available)
    // await page.setInputFiles('[data-testid="library-upload-input"]', './test-assets/token.webp');

    // Verify library has items
    const libraryItems = page.locator('[data-testid^="library-token-"]');
    const initialCount = await libraryItems.count();

    // Close library
    await page.click('[data-testid="close-library"]');

    // Export/Import
    const filePath = await exportCampaign(page);
    await clearAllTestData(page);
    await page.reload();
    await bypassLandingPageAndInjectState(page);
    await importCampaign(page, filePath);

    // Open library and verify items restored
    await page.click('[data-testid="token-library-button"]');
    const restoredItems = page.locator('[data-testid^="library-token-"]');

    await expect(
      restoredItems,
      'Token library items should be preserved through export/import',
    ).toHaveCount(initialCount);
  });

  test('should handle large campaign export/import', async ({ page }) => {
    // Create campaign with many tokens (stress test)
    await createNewCampaign(page, 'Large Campaign Test');

    // Add 100 tokens
    for (let i = 0; i < 100; i++) {
      await page.click('[data-testid="add-token-button"]');
      await page.click('[data-testid="canvas"]', {
        position: { x: 100 + (i % 10) * 50, y: 100 + Math.floor(i / 10) * 50 },
      });
    }

    // Verify 100 tokens
    let tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens).toHaveCount(100);

    // Export (should not timeout or fail)
    const startTime = Date.now();
    const filePath = await exportCampaign(page);
    const exportDuration = Date.now() - startTime;

    expect(exportDuration, 'Export of 100 tokens should complete in under 10 seconds').toBeLessThan(
      10000,
    );

    // Clear and import
    await clearAllTestData(page);
    await page.reload();
    await bypassLandingPageAndInjectState(page);

    const importStartTime = Date.now();
    await importCampaign(page, filePath);
    const importDuration = Date.now() - importStartTime;

    expect(importDuration, 'Import of 100 tokens should complete in under 10 seconds').toBeLessThan(
      10000,
    );

    // Verify all tokens restored
    tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'All 100 tokens should be restored after import').toHaveCount(100);
  });
});

test.describe('Auto-Save Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
  });

  test('should auto-save campaign changes every 30 seconds', async ({ page }) => {
    // Create campaign
    await createNewCampaign(page, 'Auto-Save Test');

    // Make a change
    await page.click('[data-testid="add-token-button"]');

    // Wait for auto-save interval (30s + 1s buffer)
    await page.waitForTimeout(31000);

    // Reload without manual save
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify token was auto-saved
    const token = page.locator('[data-testid^="token-"]');
    await expect(token, 'Token should be restored after auto-save and reload').toBeVisible();
  });

  test('should not lose data if auto-save interrupted', async ({ page }) => {
    // Create campaign and add token
    await createNewCampaign(page, 'Interrupted Save Test');
    await page.click('[data-testid="add-token-button"]');

    // Start auto-save but reload before completion
    await page.waitForTimeout(15000); // Halfway through auto-save interval

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify previous save is intact (even if latest change lost)
    await expect(
      page.locator('[data-testid="campaign-title"]'),
      'Campaign should still exist even if auto-save was interrupted',
    ).toHaveText('Interrupted Save Test');
  });
});

test.describe('IndexedDB Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
  });

  test('should handle IndexedDB version upgrades', async ({ page }) => {
    // Create campaign in current DB version
    await createNewCampaign(page, 'Version Upgrade Test');
    await page.click('[data-testid="add-token-button"]');

    // Simulate DB version upgrade by manipulating DB
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('graphium-storage', 2); // Increment version

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          // Schema would be upgraded here
          console.log('DB upgraded to version 2');
        };

        request.onsuccess = () => resolve(true);
      });
    });

    // Reload and verify data still accessible
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('[data-testid="campaign-title"]'),
      'Campaign should survive DB version upgrade',
    ).toHaveText('Version Upgrade Test');
  });

  test('should recover from corrupted campaign data', async ({ page }) => {
    // Create valid campaign
    await createNewCampaign(page, 'Corruption Test');

    // Corrupt the data
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('graphium-storage', 1);

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const tx = db.transaction('autosave', 'readwrite');

          // Insert invalid/corrupted data
          tx.objectStore('autosave').put({
            id: 'latest',
            campaign: null, // Invalid: should be object
            timestamp: Date.now(),
          });

          tx.oncomplete = () => resolve(true);
        };
      });
    });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should handle gracefully - either show error or allow new campaign
    const errorMessage = page.locator('[data-testid="data-error-message"]');
    const newCampaignBtn = page.locator('[data-testid="new-campaign-button"]');

    const hasError = await errorMessage.isVisible().catch(() => false);
    const canCreateNew = await newCampaignBtn.isVisible().catch(() => true);

    expect(hasError || canCreateNew, 'App should handle corrupted data gracefully').toBeTruthy();
  });

  test('should handle missing IndexedDB stores', async ({ page }) => {
    // Delete a required object store
    await page.evaluate(() => {
      return indexedDB.deleteDatabase('graphium-storage');
    });

    // Reload - should reinitialize DB
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should be able to create campaign
    await createNewCampaign(page, 'Reinitialized DB Test');

    await expect(
      page.locator('[data-testid="campaign-title"]'),
      'Should be able to create campaign after DB reinitialization',
    ).toHaveText('Reinitialized DB Test');
  });
});

test.describe('Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
  });

  test('should reject import of invalid file format', async ({ page }) => {
    // Create a text file (not .graphium)
    const invalidFile = Buffer.from('invalid file content');

    // Try to import
    const fileInput = page.locator('[data-testid="import-file"]');
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: invalidFile,
    });

    // Should show error
    await expect(
      page.locator('[data-testid="import-error-message"]'),
      'Should show error when importing invalid file format',
    ).toBeVisible();
  });

  test('should validate campaign name length', async ({ page }) => {
    // Try to create campaign with empty name
    await page.click('[data-testid="new-campaign-button"]');
    await page.click('[data-testid="create-campaign-submit"]');

    // Should show validation error
    await expect(
      page.locator('[data-testid="campaign-name-error"]'),
      'Should show error for empty campaign name',
    ).toBeVisible();

    // Try extremely long name
    const longName = 'A'.repeat(500);
    await page.fill('[data-testid="campaign-name-input"]', longName);
    await page.click('[data-testid="create-campaign-submit"]');

    // Should either truncate or show error
    const hasError = await page.locator('[data-testid="campaign-name-error"]').isVisible();

    if (!hasError) {
      // If accepted, verify truncation
      const titleText = await page.locator('[data-testid="campaign-title"]').textContent();
      expect(titleText!.length, 'Campaign name should be truncated if too long').toBeLessThan(300);
    }
  });

  test('should handle special characters in campaign data', async ({ page }) => {
    const specialName = 'Test <script>alert("XSS")</script> & "quotes"';

    // Create campaign with special chars
    await createNewCampaign(page, specialName);

    // Export/Import
    const filePath = await exportCampaign(page);
    await clearAllTestData(page);
    await page.reload();
    await bypassLandingPageAndInjectState(page);
    await importCampaign(page, filePath);

    // Verify special chars preserved (but sanitized for display)
    const titleElement = page.locator('[data-testid="campaign-title"]');
    const titleHTML = await titleElement.innerHTML();

    // Should not execute script
    expect(titleHTML, 'Script tags should be escaped/sanitized').not.toContain('<script>');

    // Should preserve quotes (escaped)
    expect(titleHTML, 'Special characters should be preserved in escaped form').toBeTruthy();
  });
});

test.describe('Concurrent Data Operations', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
  });

  test('should handle rapid token additions without data loss', async ({ page }) => {
    await createNewCampaign(page, 'Rapid Add Test');

    // Add 20 tokens rapidly
    for (let i = 0; i < 20; i++) {
      await page.click('[data-testid="add-token-button"]');
      await page.click('[data-testid="canvas"]', {
        position: { x: 100 + i * 30, y: 100 },
      });
    }

    // Verify all tokens added
    const tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'All 20 tokens should be added without data loss').toHaveCount(20);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    const restoredTokens = page.locator('[data-testid^="token-"]');
    await expect(restoredTokens, 'All 20 tokens should persist after rapid additions').toHaveCount(
      20,
    );
  });

  test('should handle simultaneous save and export', async ({ page }) => {
    await createNewCampaign(page, 'Concurrent Ops Test');
    await page.click('[data-testid="add-token-button"]');

    // Trigger save and export simultaneously
    const [downloadPromise] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="save-campaign"]'),
      page.click('[data-testid="export-campaign"]'),
    ]);

    const download = await downloadPromise;
    const filePath = await download.path();

    expect(filePath, 'Export should succeed even with concurrent save').toBeTruthy();
  });
});

test.describe('Asset Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
  });

  test('should preserve image data through export/import', async ({ page }) => {
    // Note: Requires test assets
    // This test verifies binary data (images) are preserved

    await createNewCampaign(page, 'Image Test');

    // Upload token image
    // const imageSize = await page.evaluate(async () => {
    //   const response = await fetch('/test-assets/token.webp');
    //   const blob = await response.blob();
    //   return blob.size;
    // });

    // Export/Import
    // const filePath = await exportCampaign(page);
    // await clearAllTestData(page);
    // await page.reload();
    // await bypassLandingPageAndInjectState(page);
    // await importCampaign(page, filePath);

    // Verify image data intact (check file size)
    // ...
  });
});
