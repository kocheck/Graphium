import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Campaign Helper Utilities
 *
 * Reusable functions for common campaign operations in tests.
 * Follows the Page Object Model (POM) pattern to avoid duplication.
 */

/**
 * Create a new campaign
 *
 * NOTE: The current Graphium UI doesn't have a campaign name input dialog.
 * Instead, clicking "New Campaign" immediately starts the editor with a default name.
 * This helper has been updated to match the actual UI flow.
 *
 * @param page - Playwright Page object
 * @param _campaignName - DEPRECATED: Name parameter is not used (no name input in current UI)
 * @returns Promise that resolves when campaign is created
 * @deprecated The campaignName parameter has no effect. Will be removed in future version.
 */
export async function createNewCampaign(page: Page, _campaignName?: string) {
  // Click new campaign button (this immediately starts the editor)
  const newCampaignButton = page.locator('[data-testid="new-campaign-button"]');
  await expect(newCampaignButton, 'New campaign button should be visible').toBeVisible();
  await newCampaignButton.click();

  // Wait for editor to load (editor view should appear)
  await expect(
    page.locator('[data-testid="editor-view"]'),
    'Editor view should appear after clicking new campaign',
  ).toBeVisible({ timeout: 5000 });

  // The current UI doesn't show a campaign title, so we can't verify it
  // Tests that check for campaign title will need to be updated or skipped
}

/**
 * Add a map background to the current campaign
 *
 * @param page - Playwright Page object
 * @param imagePath - Path to the map image file (relative to test root)
 */
export async function addMapBackground(page: Page, imagePath: string) {
  // Click add map button
  const addMapButton = page.locator('[data-testid="add-map-button"]');
  await expect(addMapButton, 'Add map button should be visible').toBeVisible();
  await addMapButton.click();

  // Upload map image
  const fileInput = page.locator('[data-testid="map-upload"]');
  await fileInput.setInputFiles(imagePath);

  // Wait for map to load
  await expect(
    page.locator('[data-testid="map-layer"]'),
    'Map layer should be visible after upload',
  ).toBeVisible();
}

/**
 * Open the token library modal
 *
 * @param page - Playwright Page object
 * @returns Locator for the token library modal
 */
export async function openTokenLibrary(page: Page): Promise<Locator> {
  const libraryButton = page.locator('[data-testid="token-library-button"]');
  await expect(libraryButton, 'Token library button should be visible').toBeVisible();
  await libraryButton.click();

  const libraryModal = page.locator('[data-testid="library-modal"]');
  await expect(libraryModal, 'Token library modal should open after clicking button').toBeVisible();

  return libraryModal;
}

/**
 * Add a token from the library to the canvas
 *
 * @param page - Playwright Page object
 * @param tokenId - ID or index of the token to add
 * @param position - { x, y } position on canvas
 */
export async function addTokenToCanvas(
  page: Page,
  tokenId: string,
  position: { x: number; y: number },
) {
  // Open library
  await openTokenLibrary(page);

  // Click token in library
  const token = page.locator(`[data-testid="library-token-${tokenId}"]`);
  await expect(token, `Token ${tokenId} should be visible in library`).toBeVisible();
  await token.click();

  // Click on canvas to place token
  const canvas = page.locator('[data-testid="canvas"]');
  await canvas.click({ position });

  // Verify token appears on canvas
  await expect(
    page.locator('[data-testid^="token-"]').first(),
    'Token should appear on canvas after placement',
  ).toBeVisible();
}

/**
 * Export the current campaign as a .graphium file
 *
 * @param page - Playwright Page object
 * @returns Promise that resolves with the download path
 */
export async function exportCampaign(page: Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-testid="export-campaign"]'),
  ]);

  const path = await download.path();
  if (!path) {
    throw new Error('Failed to download campaign file');
  }

  return path;
}

/**
 * Import a campaign from a .graphium file
 *
 * @param page - Playwright Page object
 * @param filePath - Path to the .graphium file to import
 */
export async function importCampaign(page: Page, filePath: string) {
  const fileInput = page.locator('[data-testid="import-file"]');
  await fileInput.setInputFiles(filePath);

  // Wait for campaign to load
  await expect(
    page.locator('[data-testid="main-canvas"]'),
    'Main canvas should appear after importing campaign',
  ).toBeVisible();

  await page.waitForLoadState('networkidle');
}

/**
 * Create a campaign with test data
 *
 * Utility for creating campaigns with predefined maps and tokens.
 *
 * @param page - Playwright Page object
 * @param config - Configuration for the test campaign
 */
export async function createCampaignWithData(
  page: Page,
  config: {
    name: string;
    maps?: number;
    tokensPerMap?: number;
  },
) {
  // Create campaign
  await createNewCampaign(page, config.name);

  // Add maps if specified
  if (config.maps && config.maps > 0) {
    for (let i = 0; i < config.maps; i++) {
      // Note: You'll need to provide actual test asset paths
      // await addMapBackground(page, `./test-assets/map-${i + 1}.webp`);

      // Add tokens to map if specified
      if (config.tokensPerMap && config.tokensPerMap > 0) {
        for (let j = 0; j < config.tokensPerMap; j++) {
          // Note: Adjust based on your actual implementation
          // await addTokenToCanvas(page, `${j + 1}`, { x: 100 + j * 50, y: 100 });
        }
      }
    }
  }
}

/**
 * Waits for the auto-save interval plus a 1s buffer (default effective wait ~31s)
 * and optionally verifies that a save occurred.
 *
 * @param page - Playwright Page object
 * @param intervalMs - Auto-save interval in milliseconds (default 30000); the function
 *   waits for intervalMs + 1000ms to account for timing variations
 */
export async function waitForAutoSave(page: Page, intervalMs: number = 30000) {
  // Wait for auto-save interval
  await page.waitForTimeout(intervalMs + 1000); // Add 1s buffer

  // Optionally verify auto-save indicator appeared
  // await expect(
  //   page.locator('[data-testid="auto-save-indicator"]'),
  //   'Auto-save indicator should appear after interval'
  // ).toBeVisible();
}

/**
 * Verify campaign state matches expected data
 *
 * @param page - Playwright Page object
 * @param expected - Expected campaign state
 */
export async function verifyCampaignState(
  page: Page,
  expected: {
    name?: string;
    tokenCount?: number;
    mapCount?: number;
  },
) {
  if (expected.name) {
    await expect(
      page.locator('[data-testid="campaign-title"]'),
      `Campaign name should be "${expected.name}"`,
    ).toHaveText(expected.name);
  }

  if (expected.tokenCount !== undefined) {
    const tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, `Should have ${expected.tokenCount} tokens`).toHaveCount(
      expected.tokenCount,
    );
  }

  if (expected.mapCount !== undefined) {
    const maps = page.locator('[data-testid^="map-"]');
    await expect(maps, `Should have ${expected.mapCount} maps`).toHaveCount(expected.mapCount);
  }
}

/**
 * Switch theme mode
 *
 * @param page - Playwright Page object
 * @param mode - Theme mode ('light' | 'dark' | 'system')
 */
export async function switchTheme(page: Page, mode: 'light' | 'dark' | 'system') {
  // Open settings
  await page.click('[data-testid="settings-button"]');

  // Select theme
  await page.selectOption('[data-testid="theme-selector"]', mode);

  // Wait for theme to apply
  const expectedTheme =
    mode === 'system'
      ? await page.evaluate(() =>
          window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        )
      : mode;

  await page.waitForFunction(
    (theme) => document.documentElement.getAttribute('data-theme') === theme,
    expectedTheme,
  );
}
