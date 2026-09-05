import { test, expect } from '@playwright/test';

import { gotoSurface } from '../helpers/surfaces';

test.describe('Mobile smoke', () => {
  test('mobile toolbar has five buttons and no desktop toolbar', async ({ page }) => {
    await gotoSurface(page, 'editor-mobile', 'light');
    await expect(page.locator('[data-testid="toolbar-mobile-root"] button')).toHaveCount(5);
    await expect(page.locator('[data-testid="toolbar-root"]')).toHaveCount(0);
  });

  test('more menu opens', async ({ page }) => {
    await gotoSurface(page, 'editor-mobile', 'light');
    await page.locator('[data-testid="toolbar-mobile-more"]').click();
    await expect(page.locator('[data-testid="toolbar-mobile-more-menu"]')).toBeVisible();
  });
});
