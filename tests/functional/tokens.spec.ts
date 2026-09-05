import { test, expect } from '@playwright/test';

import { gotoSurface } from '../helpers/surfaces';

test.describe('Non-colour tokens are live', () => {
  test('rounded-lg, shadow-2xl, font-semibold and text-lg resolve through --app-* tokens', async ({
    page,
  }) => {
    await gotoSurface(page, 'confirm-dialog', 'light');
    const toolbar = page.locator('[data-testid="toolbar-root"]');
    const title = page.locator('#confirm-dialog-title');

    await expect(toolbar).toHaveCSS('border-radius', '8px');
    await expect(title).toHaveCSS('font-weight', '600');
    await expect(title).toHaveCSS('font-size', '18px');

    await page.addStyleTag({
      content:
        ':root { --app-radius-lg: 0px; --app-elevation-high: none; --app-font-weight-semibold: 900; --app-font-size-lg: 30px; }',
    });

    await expect(toolbar).toHaveCSS('border-radius', '0px');
    await expect(toolbar).toHaveCSS('box-shadow', 'none');
    await expect(title).toHaveCSS('font-weight', '900');
    await expect(title).toHaveCSS('font-size', '30px');
  });
});
