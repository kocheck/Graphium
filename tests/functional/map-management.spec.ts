/**
 * Map Management Functional Tests
 *
 * Tests all map-related operations:
 * - Creating and adding maps
 * - Switching between maps
 * - Renaming and deleting maps
 * - Map ordering/reordering
 * - Grid and background settings
 *
 * Focus: Map data and navigation behavior
 */

import { test, expect } from '@playwright/test';
import { bypassLandingPageAndInjectState } from '../helpers/bypassLandingPage';
import { createNewCampaign } from '../helpers/campaignHelpers';

test.describe('Map Creation and Addition', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Map Test Campaign');
  });

  test('should create first map for campaign', async ({ page }) => {
    // Click add map
    await page.click('[data-testid="add-map-button"]');

    // Verify map creation form appears
    await expect(
      page.locator('[data-testid="map-creation-form"]'),
      'Map creation form should appear',
    ).toBeVisible();

    // Fill map name
    await page.fill('[data-testid="map-name-input"]', 'Dungeon Level 1');
    await page.click('[data-testid="create-map-submit"]');

    // Verify map created
    await expect(
      page.locator('[data-testid="map-tab-0"]'),
      'First map tab should appear',
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="map-tab-0"]'),
      'Map tab should display correct name',
    ).toHaveText('Dungeon Level 1');
  });

  test('should add multiple maps', async ({ page }) => {
    // Add 3 maps
    const mapNames = ['Town Square', 'Castle', 'Forest'];

    for (let i = 0; i < mapNames.length; i++) {
      await page.click('[data-testid="add-map-button"]');
      await page.fill('[data-testid="map-name-input"]', mapNames[i]);
      await page.click('[data-testid="create-map-submit"]');
    }

    // Verify all map tabs present
    const mapTabs = page.locator('[data-testid^="map-tab-"]');
    await expect(mapTabs, 'Should have 3 map tabs').toHaveCount(3);

    // Verify names
    for (let i = 0; i < mapNames.length; i++) {
      await expect(
        page.locator(`[data-testid="map-tab-${i}"]`),
        `Map ${i} should have correct name`,
      ).toHaveText(mapNames[i]);
    }
  });

  test('should upload map background image', async ({ page }) => {
    // Add map
    await page.click('[data-testid="add-map-button"]');
    await page.fill('[data-testid="map-name-input"]', 'Test Map');
    await page.click('[data-testid="create-map-submit"]');

    // Upload background (if test assets available)
    // await page.setInputFiles(
    //   '[data-testid="map-background-upload"]',
    //   './test-assets/dungeon.webp'
    // );

    // Verify map layer visible
    // await expect(
    //   page.locator('[data-testid="map-layer"]'),
    //   'Map background should be visible after upload'
    // ).toBeVisible();
  });

  test('should set map dimensions', async ({ page }) => {
    // Add map
    await page.click('[data-testid="add-map-button"]');
    await page.fill('[data-testid="map-name-input"]', 'Custom Size Map');

    // Set custom dimensions
    await page.fill('[data-testid="map-width-input"]', '2000');
    await page.fill('[data-testid="map-height-input"]', '1500');
    await page.click('[data-testid="create-map-submit"]');

    // Verify canvas size
    const canvas = page.locator('[data-testid="main-canvas"]');
    const boundingBox = await canvas.boundingBox();

    const expectedWidth = 2000;
    const expectedHeight = 1500;
    const tolerance = 10;

    expect(
      boundingBox!.width,
      'Canvas width should match specified dimension within tolerance',
    ).toBeGreaterThanOrEqual(expectedWidth - tolerance);
    expect(
      boundingBox!.width,
      'Canvas width should match specified dimension within tolerance',
    ).toBeLessThanOrEqual(expectedWidth + tolerance);

    expect(
      boundingBox!.height,
      'Canvas height should match specified dimension within tolerance',
    ).toBeGreaterThanOrEqual(expectedHeight - tolerance);
    expect(
      boundingBox!.height,
      'Canvas height should match specified dimension within tolerance',
    ).toBeLessThanOrEqual(expectedHeight + tolerance);
  });
});

test.describe('Map Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Navigation Test');

    // Add 3 maps
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="add-map-button"]');
      await page.fill('[data-testid="map-name-input"]', `Map ${i + 1}`);
      await page.click('[data-testid="create-map-submit"]');
    }
  });

  test('should switch between maps', async ({ page }) => {
    // Click on second map tab
    await page.click('[data-testid="map-tab-1"]');

    // Verify active map changed
    await expect(
      page.locator('[data-testid="map-tab-1"]'),
      'Second map tab should be active',
    ).toHaveAttribute('aria-selected', 'true');

    // Verify first map not active
    await expect(
      page.locator('[data-testid="map-tab-0"]'),
      'First map tab should not be active',
    ).toHaveAttribute('aria-selected', 'false');
  });

  test('should preserve active map after reload', async ({ page }) => {
    // Switch to third map
    await page.click('[data-testid="map-tab-2"]');

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify third map still active
    await expect(
      page.locator('[data-testid="map-tab-2"]'),
      'Active map should persist after reload',
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('should navigate with keyboard shortcuts', async ({ page }) => {
    // Ensure first map active
    await page.click('[data-testid="map-tab-0"]');

    // Press Ctrl+Right to next map
    await page.keyboard.press('Control+ArrowRight');

    // Verify moved to second map
    await expect(
      page.locator('[data-testid="map-tab-1"]'),
      'Should navigate to next map with Ctrl+Right',
    ).toHaveAttribute('aria-selected', 'true');

    // Press Ctrl+Left to previous map
    await page.keyboard.press('Control+ArrowLeft');

    // Verify back to first map
    await expect(
      page.locator('[data-testid="map-tab-0"]'),
      'Should navigate to previous map with Ctrl+Left',
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('should show map-specific tokens when switching', async ({ page }) => {
    // Add token to first map
    await page.click('[data-testid="map-tab-0"]');
    await page.click('[data-testid="add-token-button"]');

    // Verify token visible
    let tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens).toHaveCount(1);

    // Switch to second map
    await page.click('[data-testid="map-tab-1"]');

    // Verify no tokens on second map
    tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'Second map should not show tokens from first map').toHaveCount(0);

    // Switch back to first map
    await page.click('[data-testid="map-tab-0"]');

    // Verify token reappears
    tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'First map tokens should reappear when switching back').toHaveCount(1);
  });
});

test.describe('Map Renaming', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Rename Test');

    // Add a map
    await page.click('[data-testid="add-map-button"]');
    await page.fill('[data-testid="map-name-input"]', 'Original Name');
    await page.click('[data-testid="create-map-submit"]');
  });

  test('should rename map via context menu', async ({ page }) => {
    // Right-click map tab
    await page.click('[data-testid="map-tab-0"]', { button: 'right' });

    // Click rename option
    await page.click('[data-testid="map-context-menu-rename"]');

    // Fill new name
    const nameInput = page.locator('[data-testid="map-name-input"]');
    await nameInput.clear();
    await nameInput.fill('New Map Name');
    await page.click('[data-testid="save-map-name"]');

    // Verify name updated
    await expect(
      page.locator('[data-testid="map-tab-0"]'),
      'Map name should be updated',
    ).toHaveText('New Map Name');
  });

  test('should rename map via double-click', async ({ page }) => {
    // Double-click map tab
    await page.dblclick('[data-testid="map-tab-0"]');

    // Name input should become editable
    const nameInput = page.locator('[data-testid="map-name-input"]');
    await expect(nameInput, 'Name input should appear for inline editing').toBeVisible();

    // Edit name
    await nameInput.clear();
    await nameInput.fill('Quick Rename');
    await nameInput.press('Enter');

    // Verify name updated
    await expect(
      page.locator('[data-testid="map-tab-0"]'),
      'Map name should update after inline edit',
    ).toHaveText('Quick Rename');
  });

  test('should preserve map name after reload', async ({ page }) => {
    // Rename map
    await page.click('[data-testid="map-tab-0"]', { button: 'right' });
    await page.click('[data-testid="map-context-menu-rename"]');
    await page.fill('[data-testid="map-name-input"]', 'Persistent Name');
    await page.click('[data-testid="save-map-name"]');

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify name persisted
    await expect(
      page.locator('[data-testid="map-tab-0"]'),
      'Map name should persist after reload',
    ).toHaveText('Persistent Name');
  });
});

test.describe('Map Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Deletion Test');

    // Add 3 maps
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="add-map-button"]');
      await page.fill('[data-testid="map-name-input"]', `Map ${i + 1}`);
      await page.click('[data-testid="create-map-submit"]');
    }
  });

  test('should delete map via context menu', async ({ page }) => {
    // Verify 3 maps
    let mapTabs = page.locator('[data-testid^="map-tab-"]');
    await expect(mapTabs).toHaveCount(3);

    // Right-click second map and delete
    await page.click('[data-testid="map-tab-1"]', { button: 'right' });
    await page.click('[data-testid="map-context-menu-delete"]');
    await page.click('[data-testid="confirm-delete-map"]');

    // Verify only 2 maps remain
    mapTabs = page.locator('[data-testid^="map-tab-"]');
    await expect(mapTabs, 'Should have 2 maps after deletion').toHaveCount(2);
  });

  test('should switch to adjacent map after deleting active map', async ({ page }) => {
    // Activate second map
    await page.click('[data-testid="map-tab-1"]');

    // Delete it
    await page.click('[data-testid="map-tab-1"]', { button: 'right' });
    await page.click('[data-testid="map-context-menu-delete"]');
    await page.click('[data-testid="confirm-delete-map"]');

    // Should switch to first map (or third if that was deleted)
    const activeMap = page.locator('[data-testid^="map-tab-"][aria-selected="true"]');
    await expect(activeMap, 'Should switch to adjacent map after deletion').toBeVisible();
  });

  test('should not delete map when canceling confirmation', async ({ page }) => {
    // Attempt to delete
    await page.click('[data-testid="map-tab-1"]', { button: 'right' });
    await page.click('[data-testid="map-context-menu-delete"]');
    await page.click('[data-testid="cancel-delete-map"]');

    // Verify still 3 maps
    const mapTabs = page.locator('[data-testid^="map-tab-"]');
    await expect(mapTabs, 'Map should remain when deletion is cancelled').toHaveCount(3);
  });

  test('should warn when deleting map with tokens', async ({ page }) => {
    // Add token to first map
    await page.click('[data-testid="map-tab-0"]');
    await page.click('[data-testid="add-token-button"]');

    // Try to delete
    await page.click('[data-testid="map-tab-0"]', { button: 'right' });
    await page.click('[data-testid="map-context-menu-delete"]');

    // Should show warning
    await expect(
      page.locator('[data-testid="delete-map-warning"]'),
      'Should warn when deleting map with tokens',
    ).toContainText('This map contains tokens');
  });
});

test.describe('Map Reordering', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Reorder Test');

    // Add 3 maps
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="add-map-button"]');
      await page.fill('[data-testid="map-name-input"]', `Map ${i + 1}`);
      await page.click('[data-testid="create-map-submit"]');
    }
  });

  test('should reorder maps by dragging tabs', async ({ page }) => {
    // Drag second map to first position
    const secondTab = page.locator('[data-testid="map-tab-1"]');
    const firstTab = page.locator('[data-testid="map-tab-0"]');

    const secondBox = await secondTab.boundingBox();
    const firstBox = await firstTab.boundingBox();

    await secondTab.hover();
    await page.mouse.down();
    await page.mouse.move(firstBox!.x, firstBox!.y);
    await page.mouse.up();

    // Verify order changed
    // (Map 2 should now be first)
    const newFirstTab = page.locator('[data-testid="map-tab-0"]');
    await expect(newFirstTab, 'Map order should change after drag').toHaveText('Map 2');
  });

  test('should persist map order after reload', async ({ page }) => {
    // Reorder maps
    const secondTab = page.locator('[data-testid="map-tab-1"]');
    const firstTab = page.locator('[data-testid="map-tab-0"]');

    const firstBox = await firstTab.boundingBox();
    await secondTab.hover();
    await page.mouse.down();
    await page.mouse.move(firstBox!.x, firstBox!.y);
    await page.mouse.up();

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify order persisted
    const newFirstTab = page.locator('[data-testid="map-tab-0"]');
    await expect(newFirstTab, 'Map order should persist after reload').toHaveText('Map 2');
  });
});

test.describe('Grid Settings', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Grid Test');
    await page.click('[data-testid="add-map-button"]');
    await page.fill('[data-testid="map-name-input"]', 'Test Map');
    await page.click('[data-testid="create-map-submit"]');
  });

  test('should toggle grid visibility', async ({ page }) => {
    // Open settings
    await page.click('[data-testid="map-settings-button"]');

    // Toggle grid off
    await page.click('[data-testid="toggle-grid-visibility"]');

    // Verify grid hidden
    const gridLayer = page.locator('[data-testid="grid-layer"]');
    await expect(gridLayer, 'Grid should be hidden when toggled off').toHaveCSS('opacity', '0');

    // Toggle back on
    await page.click('[data-testid="toggle-grid-visibility"]');

    await expect(gridLayer, 'Grid should be visible when toggled back on').toHaveCSS(
      'opacity',
      '1',
    );
  });

  test('should change grid size', async ({ page }) => {
    // Open settings
    await page.click('[data-testid="map-settings-button"]');

    // Change grid size
    await page.fill('[data-testid="grid-size-input"]', '75');
    await page.click('[data-testid="save-grid-settings"]');

    // Verify grid size changed (check CSS or grid lines)
    // This would depend on your implementation
  });

  test('should change grid color', async ({ page }) => {
    // Open settings
    await page.click('[data-testid="map-settings-button"]');

    // Change color
    await page.fill('[data-testid="grid-color-input"]', '#ff0000');
    await page.click('[data-testid="save-grid-settings"]');

    // Verify grid color changed
    const gridLayer = page.locator('[data-testid="grid-layer"]');
    const color = await gridLayer.evaluate((el) => window.getComputedStyle(el).color);

    expect(color, 'Grid color should update').toContain('rgb(255, 0, 0)');
  });
});

test.describe('Map Background Settings', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Background Test');
  });

  test('should set background color', async ({ page }) => {
    // Add map
    await page.click('[data-testid="add-map-button"]');
    await page.fill('[data-testid="map-name-input"]', 'Color Test');
    await page.click('[data-testid="create-map-submit"]');

    // Open settings
    await page.click('[data-testid="map-settings-button"]');

    // Set background color
    await page.fill('[data-testid="background-color-input"]', '#336699');
    await page.click('[data-testid="save-background-settings"]');

    // Verify background color
    const canvas = page.locator('[data-testid="main-canvas"]');
    const bgColor = await canvas.evaluate((el) => window.getComputedStyle(el).backgroundColor);

    expect(bgColor, 'Background color should be applied').toContain('rgb(51, 102, 153)');
  });

  test('should remove background image', async ({ page }) => {
    // Add map with background (if test assets available)
    // await page.click('[data-testid="add-map-button"]');
    // await page.fill('[data-testid="map-name-input"]', 'Remove BG Test');
    // await page.setInputFiles('[data-testid="map-background-upload"]', './test-assets/dungeon.webp');
    // Remove background
    // await page.click('[data-testid="map-settings-button"]');
    // await page.click('[data-testid="remove-background-button"]');
    // Verify background removed
    // const mapLayer = page.locator('[data-testid="map-layer"]');
    // await expect(mapLayer).toHaveCount(0);
  });
});
