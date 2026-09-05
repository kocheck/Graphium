/**
 * Touch-target baseline. These record what ships today (grounded at d3d3642); they do not
 * impose a standard. Plan 006 may not shrink any of them.
 */
import { test, expect } from '@playwright/test';

import { gotoSurface } from './helpers/surfaces';

const MOBILE_MENU_MIN = 48; // src/App.tsx: minWidth/minHeight '48px'
const MOBILE_TOOLBAR_MIN = 56; // src/components/MobileToolbar.tsx: min-h-[56px]
// Desktop .btn-tool has no minimum. Pinned from the first run's failure output (Step 8).
const BTN_TOOL_WIDTH = 46;
const BTN_TOOL_HEIGHT = 30;

test.describe('Touch targets', () => {
  test('mobile menu button is at least 48 x 48', async ({ page }) => {
    await gotoSurface(page, 'editor-mobile', 'light');
    const box = await page.locator('[aria-label="Open menu"]').boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(MOBILE_MENU_MIN);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MOBILE_MENU_MIN);
  });

  test('mobile toolbar buttons are at least 56 tall', async ({ page }) => {
    await gotoSurface(page, 'editor-mobile', 'light');
    const buttons = page.locator('[data-testid="toolbar-mobile-root"] button');
    await expect(buttons).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      const box = await buttons.nth(i).boundingBox();
      expect(box?.height ?? 0, `button ${i}`).toBeGreaterThanOrEqual(MOBILE_TOOLBAR_MIN);
    }
  });

  test('desktop .btn-tool size is unchanged', async ({ page }) => {
    await gotoSurface(page, 'editor', 'light');
    const box = await page.locator('[data-testid="toolbar-tool-select"]').boundingBox();
    expect(box).not.toBeNull();
    expect({ width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0) }).toEqual({
      width: BTN_TOOL_WIDTH,
      height: BTN_TOOL_HEIGHT,
    });
  });
});
