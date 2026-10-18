import { test, expect } from '@playwright/test';

import { gotoSurface } from '../helpers/surfaces';

// Shortcuts from the keydown switch in src/App.tsx. 'r' rotates a door when the door tool
// is active, so every shortcut test starts from the select tool.
const TOOLS = [
  { name: 'select', key: 'v' },
  { name: 'marker', key: 'm' },
  { name: 'eraser', key: 'e' },
  { name: 'wall', key: 'w' },
  { name: 'door', key: 'd' },
  { name: 'measure', key: 'r' },
] as const;

test.describe('Editor smoke', () => {
  test('new campaign opens the editor with the toolbar and select active', async ({ page }) => {
    await gotoSurface(page, 'editor', 'light');
    await expect(page.locator('[data-testid="toolbar-root"]')).toBeVisible();
    await expect(page.locator('[data-testid="toolbar-tool-select"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Pause only works under Electron (handlePauseToggle returns without ipcRenderer).
    await expect(page.locator('[data-testid="toolbar-pause"]')).toHaveAttribute(
      'aria-label',
      'Pause game',
    );
  });

  for (const tool of TOOLS) {
    test(`clicking ${tool.name} activates it`, async ({ page }) => {
      await gotoSurface(page, 'editor', 'light');
      const button = page.locator(`[data-testid="toolbar-tool-${tool.name}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    test(`pressing ${tool.key} activates ${tool.name}`, async ({ page }) => {
      await gotoSurface(page, 'editor', 'light');
      await page.locator('[data-testid="toolbar-tool-select"]').click();
      await page.keyboard.press(tool.key);
      await expect(page.locator(`[data-testid="toolbar-tool-${tool.name}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  }
});
