import { expect, test } from '@playwright/test';

import { gotoSurface } from './helpers/surfaces';

const TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

async function bg(page: import('@playwright/test').Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor);
}

for (const theme of ['light', 'dark'] as const) {
  test(`every bridged token resolves to its --app-* value (${theme})`, async ({ page }) => {
    await gotoSurface(page, 'design-system', theme);
    await expect(page.getByTestId('bridge-probe')).toBeVisible();
    for (const token of TOKENS) {
      const actual = await bg(page, `bridge-swatch-${token}`);
      const expected = await bg(page, `bridge-expected-${token}`);
      expect(actual, token).not.toBe(TRANSPARENT);
      expect(actual, token).toBe(expected);
    }
    // Negative control: an unbridged token must NOT resolve, proving the probe can fail.
    expect(await bg(page, 'bridge-swatch-none')).toBe(TRANSPARENT);
  });
}
