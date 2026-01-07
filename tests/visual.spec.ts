import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('landing page snapshot', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for canvas to load
    await page.waitForSelector('canvas');

    // Hide dynamic elements (like FPS counter if it exists, or random hints) to ensure stability
    // For now taking full page snapshot
    await expect(page).toHaveScreenshot('landing-page.png', {
      maxDiffPixels: 100, // Allow tiny rendering differences
    });
  });

  test('grid rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');

    // Default grid (Square Lines) should be visible
    // We snapshot specifically the canvas area to verify grid lines
    const canvas = page.locator('#map canvas').first();
    await expect(canvas).toBeVisible();

    // Take snapshot of the center of the viewport where grid lines should be
    await expect(page).toHaveScreenshot('default-grid.png', {
      clip: { x: 500, y: 300, width: 200, height: 200 },
    });
  });

  test('dark mode grid', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');

    // Simulate system dark mode preference or toggle it via UI if we have a button
    // Since we rely on data-theme attribute or system pref, let's force the attribute on html
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Allow transition
    await page.waitForTimeout(500);

    // Verify grid lines in dark mode (should be lighter)
    await expect(page).toHaveScreenshot('dark-mode-grid.png', {
      clip: { x: 500, y: 300, width: 200, height: 200 },
    });
  });
});
