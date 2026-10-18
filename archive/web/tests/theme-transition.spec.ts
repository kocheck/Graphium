import { expect, test } from '@playwright/test';

/**
 * The home-screen toggle is the primary theme path in the web build. It must go through
 * ThemeManager.applyTheme, which wraps the switch in `.theme-transitioning` on <html>.
 */
test('theme toggle wraps the switch in .theme-transitioning', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    window.localStorage.setItem('graphium-theme', 'light');
  });
  await page.goto('/');
  await page.waitForSelector('#root:visible', { timeout: 60000 });

  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: /Click to cycle themes/ });
  await expect(toggle).toHaveAttribute('aria-label', /Current theme: Light/);
  await expect(html).toHaveAttribute('data-theme', 'light');

  // Record whether the class ever appears; it lives for only ~300 ms.
  await page.evaluate(() => {
    const root = document.documentElement;
    new MutationObserver(() => {
      if (root.classList.contains('theme-transitioning')) {
        root.dataset.transitionSeen = 'true';
      }
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
  });

  await toggle.click();

  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-transition-seen', 'true');
  await expect(html).not.toHaveClass(/theme-transitioning/, { timeout: 1000 });
});
