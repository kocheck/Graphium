import fs from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import { SURFACES, THEMES, gotoSurface } from './helpers/surfaces';

const outDir = process.env.SHOTS_OUT ?? 'test-results/shots';

test.describe('Surface screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(outDir, { recursive: true });
  });

  for (const surface of SURFACES) {
    for (const theme of THEMES) {
      test(`${surface} ${theme}`, async ({ page }) => {
        const target = await gotoSurface(page, surface, theme);
        await target.waitForTimeout(250);
        await target.screenshot({
          path: path.join(outDir, `${surface}-${theme}.png`),
          fullPage: false,
          animations: 'disabled',
        });
      });
    }
  }
});
