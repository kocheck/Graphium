import { test, expect } from '@playwright/test';

import { SURFACES, THEMES, gotoSurface } from './helpers/surfaces';

test.describe('Visual regression', () => {
  for (const surface of SURFACES) {
    for (const theme of THEMES) {
      test(`${surface} ${theme}`, async ({ page }) => {
        const target = await gotoSurface(page, surface, theme);
        await target.waitForTimeout(250);
        await expect(target).toHaveScreenshot(`${surface}-${theme}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
        });
      });
    }
  }
});
