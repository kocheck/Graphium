import { expect, test } from '@playwright/test';

/**
 * Guards the Tailwind v4 CSS config: `animate-slide-down` exists only because
 * `--animate-slide-down` and `@keyframes slideDown` are declared in src/index.css.
 */
test('toast animates with the slideDown keyframes', async ({ page }) => {
  await page.goto('/design-system');
  await page.waitForSelector('#root:visible', { timeout: 60000 });

  await page.getByRole('button', { name: 'Show Success' }).click();

  const toast = page.locator('.animate-slide-down');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Operation completed successfully');

  const animationName = await toast.evaluate((el) => getComputedStyle(el).animationName);
  expect(animationName).toBe('slideDown');
});
