/**
 * Overlay contract — characterisation spec. Each row records what the overlay does TODAY.
 * Plan 004 flips a row's expectations as it migrates that overlay. Rows with `open: null`
 * cannot be opened deterministically from a fresh campaign; they are asserted by name so the
 * gap stays visible.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { gotoSurface, openConfirmDialog } from '../helpers/surfaces';
import type { Surface } from '../helpers/surfaces';

interface OverlayCase {
  name: string;
  surface: Surface;
  root: string;
  open: ((page: Page) => Promise<void>) | null;
  hasRole: boolean; // role="dialog" on the root or inside it
  hasAriaModal: boolean; // aria-modal="true" on the root or inside it
  escOwns: boolean; // data-esc-owns="true" on the root or inside it
  escapeCloses: boolean; // Escape hides the root
  trapsFocus: boolean; // focus is inside the root after each of 40 Tabs
}

const OVERLAYS: OverlayCase[] = [
  {
    name: 'ConfirmDialog',
    surface: 'editor',
    root: '[data-testid="dialog-confirm-root"]',
    open: openConfirmDialog,
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
  {
    name: 'DungeonGeneratorDialog',
    surface: 'home',
    root: '[data-testid="dialog-dungeon-generator-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Generate a procedural dungeon"]').click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'AboutModal',
    surface: 'editor',
    root: '[data-testid="dialog-about-root"]',
    open: async (page) => {
      await page.keyboard.press('?');
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
  {
    name: 'UpdateManager',
    surface: 'editor',
    root: '[data-testid="dialog-update-manager-root"]',
    open: async (page) => {
      await page.keyboard.press('?');
      await page.getByRole('button', { name: 'Consult the Archives' }).click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'MapSettingsSheet',
    surface: 'editor',
    root: '[data-testid="sheet-map-settings-root"]',
    open: async (page) => {
      await page.getByRole('button', { name: 'New Map' }).click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
  {
    name: 'LibraryManager',
    surface: 'editor',
    root: '[data-testid="dialog-library-manager-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Manage library"]').click();
    },
    hasRole: false,
    hasAriaModal: false,
    escOwns: false,
    escapeCloses: false,
    trapsFocus: false,
  },
  {
    name: 'SessionConsoleSettingsSheet',
    surface: 'editor',
    root: '[data-testid="sheet-session-console-settings-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Session Console settings"]').click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
  {
    name: 'MobileSidebarDrawer',
    surface: 'editor-mobile',
    root: '[data-testid="sheet-mobile-sidebar-root"]',
    open: async (page) => {
      await page.locator('[aria-label="Open menu"]').click();
    },
    hasRole: true,
    hasAriaModal: true,
    escOwns: false,
    escapeCloses: true,
    trapsFocus: false,
  },
  // Not openable from a fresh campaign without a token, a library item, an image or a track.
  {
    name: 'MobileBottomSheet',
    surface: 'editor-mobile',
    root: '[data-testid="sheet-mobile-bottom-root"]',
    open: null,
    hasRole: true,
    hasAriaModal: true,
    escOwns: false,
    escapeCloses: true,
    trapsFocus: false,
  },
  {
    name: 'AddToLibraryDialog',
    surface: 'editor',
    root: '[data-testid="dialog-add-to-library-root"]',
    open: null,
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
  {
    name: 'TokenMetadataEditor',
    surface: 'editor',
    root: '[data-testid="dialog-token-metadata-root"]',
    open: null,
    hasRole: false,
    hasAriaModal: false,
    escOwns: false,
    escapeCloses: false,
    trapsFocus: false,
  },
  {
    name: 'ImageCropper',
    surface: 'editor',
    root: '[data-testid="dialog-image-cropper-root"]',
    open: null,
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
  {
    name: 'SessionConsoleEditorSheet',
    surface: 'editor',
    root: '[data-testid="sheet-session-console-editor-root"]',
    open: null,
    hasRole: true,
    hasAriaModal: true,
    escOwns: true,
    escapeCloses: true,
    trapsFocus: true,
  },
];

const UNREACHABLE = OVERLAYS.filter((o) => o.open === null).map((o) => o.name);

test.describe('Overlay contract', () => {
  test('overlays that cannot be opened from a fresh campaign are recorded', () => {
    expect(UNREACHABLE).toEqual([
      'MobileBottomSheet',
      'AddToLibraryDialog',
      'TokenMetadataEditor',
      'ImageCropper',
      'SessionConsoleEditorSheet',
    ]);
  });

  for (const overlay of OVERLAYS) {
    const open = overlay.open;
    if (open === null) {
      continue;
    }
    test(overlay.name, async ({ page }) => {
      await gotoSurface(page, overlay.surface, 'light');
      await open(page);
      const root = page.locator(overlay.root);
      await expect(root).toBeVisible();

      const has = async (selector: string): Promise<boolean> =>
        (await page.locator(`${overlay.root}${selector}, ${overlay.root} ${selector}`).count()) > 0;
      expect(await has('[role="dialog"]'), 'role="dialog"').toBe(overlay.hasRole);
      expect(await has('[aria-modal="true"]'), 'aria-modal="true"').toBe(overlay.hasAriaModal);
      expect(await has('[data-esc-owns="true"]'), 'data-esc-owns="true"').toBe(overlay.escOwns);

      let inside = true;
      for (let i = 0; i < 40 && inside; i += 1) {
        await page.keyboard.press('Tab');
        inside = await root.evaluate((el) => el.contains(document.activeElement));
      }
      expect(inside, 'focus stays inside the overlay for 40 Tabs').toBe(overlay.trapsFocus);

      await page.keyboard.press('Escape');
      if (overlay.escapeCloses) {
        await expect(root).toBeHidden();
      } else {
        await expect(root).toBeVisible();
      }
    });
  }
});
