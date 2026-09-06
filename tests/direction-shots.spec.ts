import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

// Plan 006a Step 2b: one full-page screenshot of /design-system per direction and theme.
// Default output avoids test.skip (plan 000 guard). SHOTS_OUT names the committed set.
const out = process.env.SHOTS_OUT ?? 'test-results/direction-shots';

for (const direction of ['a', 'b', 'c'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`design-system-${direction}-${theme}`, async ({ page }) => {
      await page.goto('/design-system');
      await page.getByTestId(`playground-direction-${direction}`).click();
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForFunction(
        ([d, t]) =>
          document.documentElement.dataset.direction === d &&
          document.documentElement.getAttribute('data-theme') === t,
        [direction, theme] as const,
      );
      await page.evaluate(() => document.fonts.ready);
      mkdirSync(out, { recursive: true });
      await page.screenshot({
        path: path.join(out, `design-system-${direction}-${theme}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}
