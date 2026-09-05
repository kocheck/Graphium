import { expect, test } from '@playwright/test';

import { gotoSurface } from '../helpers/surfaces';

const OVERLAYS = ['dialog', 'sheet', 'popover', 'dropdown'] as const;

async function bgOf(page: import('@playwright/test').Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor);
}

for (const name of OVERLAYS) {
  test(`${name}: opens, claims Escape, re-themes while open, closes, restores focus`, async ({
    page,
  }) => {
    await gotoSurface(page, 'design-system', 'light');
    const trigger = page.getByTestId(`playground-open-${name}`);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const content = page.getByTestId(`playground-${name}-content`);
    await expect(content).toBeVisible();
    await expect(content).toHaveAttribute('data-esc-owns', 'true');

    const lightBg = await bgOf(page, `playground-${name}-content`);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect.poll(() => bgOf(page, `playground-${name}-content`)).not.toBe(lightBg);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

    await page.keyboard.press('Escape');
    await expect(content).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test('tooltip: opens on focus and closes on Escape', async ({ page }) => {
  await gotoSurface(page, 'design-system', 'light');
  const trigger = page.getByTestId('playground-open-tooltip');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await expect(page.getByTestId('playground-tooltip-content')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('playground-tooltip-content')).toBeHidden();
});

test('dark: utilities follow data-theme, not the OS colour scheme', async ({ page }) => {
  await gotoSurface(page, 'design-system', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await bgOf(page, 'bridge-dark-probe')).toBe(await bgOf(page, 'bridge-dark-ref-light'));

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect
    .poll(() => bgOf(page, 'bridge-dark-probe'))
    .toBe(await bgOf(page, 'bridge-dark-ref-dark'));
});
