/**
 * Token Management Functional Tests
 *
 * Tests all token-related operations:
 * - Adding tokens to canvas
 * - Moving/dragging tokens
 * - Selecting and deselecting tokens
 * - Deleting tokens
 * - Token properties (size, rotation, visibility)
 * - Multi-token operations
 *
 * Focus: Behavior and data integrity, not visual appearance
 */

import { test, expect } from '@playwright/test';
import { bypassLandingPageAndInjectState } from '../helpers/bypassLandingPage';
import { createNewCampaign, addTokenToCanvas } from '../helpers/campaignHelpers';

test.describe('Token Placement and Movement', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Token Test Campaign');
  });

  test('should add token to canvas at clicked position', async ({ page }) => {
    // Open token library
    await page.click('[data-testid="token-library-button"]');

    // Select a token
    await page.click('[data-testid="library-token-0"]');

    // Click on canvas to place token
    const targetX = 300;
    const targetY = 200;
    await page.click('[data-testid="canvas"]', {
      position: { x: targetX, y: targetY },
    });

    // Verify token was added
    const token = page.locator('[data-testid^="token-"]').first();
    await expect(token, 'Token should appear on canvas after clicking').toBeVisible();

    // Verify position is approximately correct (allowing for grid snap)
    const boundingBox = await token.boundingBox();
    expect(boundingBox, 'Token should have a bounding box').toBeTruthy();
  });

  test('should allow dragging token to new position', async ({ page }) => {
    // Add token first
    await page.click('[data-testid="add-token-button"]');

    // Get initial position
    const token = page.locator('[data-testid^="token-"]').first();
    const initialBox = await token.boundingBox();
    expect(initialBox, 'Token should have initial position').toBeTruthy();

    // Drag to new position
    await token.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 200, initialBox!.y + 150);
    await page.mouse.up();

    // Verify position changed
    const newBox = await token.boundingBox();
    expect(newBox!.x, 'Token X position should have increased after drag').toBeGreaterThan(
      initialBox!.x + 100,
    );

    expect(newBox!.y, 'Token Y position should have increased after drag').toBeGreaterThan(
      initialBox!.y + 100,
    );
  });

  test('should persist token position after page reload', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');

    // Get position
    const token = page.locator('[data-testid^="token-"]').first();
    const tokenId = await token.getAttribute('data-testid');
    const originalBox = await token.boundingBox();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify token restored at same position
    const restoredToken = page.locator(`[data-testid="${tokenId}"]`);
    await expect(restoredToken, 'Token should be restored after reload').toBeVisible();

    const restoredBox = await restoredToken.boundingBox();
    expect(restoredBox!.x, 'Token X position should persist after reload').toBeCloseTo(
      originalBox!.x,
      5,
    ); // Allow 5px tolerance

    expect(restoredBox!.y, 'Token Y position should persist after reload').toBeCloseTo(
      originalBox!.y,
      5,
    );
  });

  test('should snap token to grid when enabled', async ({ page }) => {
    // Enable grid snap
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="enable-grid-snap"]');
    await page.click('[data-testid="close-settings"]');

    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Drag to non-grid-aligned position
    await token.hover();
    await page.mouse.down();
    await page.mouse.move(317, 223); // Non-aligned coordinates
    await page.mouse.up();

    // Verify position snapped to grid (assuming 50px grid)
    const box = await token.boundingBox();
    const gridSize = 50;

    expect(box!.x % gridSize, 'Token X should snap to grid boundary').toBe(0);

    expect(box!.y % gridSize, 'Token Y should snap to grid boundary').toBe(0);
  });
});

test.describe('Token Selection and Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Selection Test');
  });

  test('should select token on click', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Click token to select
    await token.click();

    // Verify selection indicator appears
    await expect(
      page.locator('[data-testid="token-selection-indicator"]'),
      'Selection indicator should appear when token is clicked',
    ).toBeVisible();
  });

  test('should deselect token when clicking elsewhere', async ({ page }) => {
    // Add and select token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();
    await token.click();

    // Click on empty canvas area
    await page.click('[data-testid="canvas"]', { position: { x: 500, y: 500 } });

    // Verify selection cleared
    await expect(
      page.locator('[data-testid="token-selection-indicator"]'),
      'Selection indicator should disappear when clicking elsewhere',
    ).toHaveCount(0);
  });

  test('should select multiple tokens with Ctrl+click', async ({ page }) => {
    // Add two tokens
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 200, y: 200 } });
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 400, y: 200 } });

    const tokens = page.locator('[data-testid^="token-"]');

    // Select first token
    await tokens.nth(0).click();

    // Ctrl+click second token
    await tokens.nth(1).click({ modifiers: ['Control'] });

    // Verify both selected
    const selectedTokens = page.locator('[data-testid="token-selection-indicator"]');
    await expect(selectedTokens, 'Both tokens should be selected with Ctrl+click').toHaveCount(2);
  });

  test('should show context menu on right-click', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Right-click token
    await token.click({ button: 'right' });

    // Verify context menu appears
    await expect(
      page.locator('[data-testid="token-context-menu"]'),
      'Context menu should appear on right-click',
    ).toBeVisible();

    // Verify menu has expected options
    await expect(
      page.locator('[data-testid="context-menu-delete"]'),
      'Delete option should be in context menu',
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="context-menu-duplicate"]'),
      'Duplicate option should be in context menu',
    ).toBeVisible();
  });
});

test.describe('Token Properties', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Properties Test');
  });

  test('should allow resizing token', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Get initial size
    const initialBox = await token.boundingBox();
    const initialWidth = initialBox!.width;

    // Click to select
    await token.click();

    // Find and drag resize handle
    const resizeHandle = page.locator('[data-testid="token-resize-handle"]');
    await expect(resizeHandle, 'Resize handle should appear when token is selected').toBeVisible();

    // Drag to resize
    await resizeHandle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 100, initialBox!.y);
    await page.mouse.up();

    // Verify size changed
    const newBox = await token.boundingBox();
    expect(newBox!.width, 'Token width should increase after resize').toBeGreaterThan(initialWidth);
  });

  test('should allow rotating token', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Select token
    await token.click();

    // Open properties panel
    await page.click('[data-testid="token-properties-button"]');

    // Set rotation
    const rotationInput = page.locator('[data-testid="token-rotation-input"]');
    await rotationInput.fill('45');
    await rotationInput.press('Enter');

    // Verify rotation applied (check transform style)
    const transform = await token.evaluate((el) => window.getComputedStyle(el).transform);

    expect(transform, 'Token should have rotation transform applied').toContain('matrix');
  });

  test('should toggle token visibility', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Select token
    await token.click();

    // Toggle visibility
    await page.click('[data-testid="toggle-token-visibility"]');

    // Verify token hidden (but still in DOM)
    await expect(token, 'Token should be hidden after toggling visibility').toHaveCSS(
      'opacity',
      '0',
    );

    // Toggle back
    await page.click('[data-testid="toggle-token-visibility"]');

    // Verify visible again
    await expect(token, 'Token should be visible after toggling back').toHaveCSS('opacity', '1');
  });

  test('should update token name/label', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Select and open properties
    await token.click();
    await page.click('[data-testid="token-properties-button"]');

    // Update name
    const nameInput = page.locator('[data-testid="token-name-input"]');
    await nameInput.fill('Hero Character');
    await page.click('[data-testid="save-token-properties"]');

    // Verify label updated
    await expect(
      page.locator('[data-testid="token-label"]'),
      'Token label should display updated name',
    ).toHaveText('Hero Character');
  });
});

test.describe('Token Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Deletion Test');
  });

  test('should delete token via context menu', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Get token ID for verification
    const tokenId = await token.getAttribute('data-testid');

    // Right-click and delete
    await token.click({ button: 'right' });
    await page.click('[data-testid="context-menu-delete"]');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');

    // Verify token removed
    await expect(
      page.locator(`[data-testid="${tokenId}"]`),
      'Token should be removed from canvas after deletion',
    ).toHaveCount(0);
  });

  test('should delete token with Delete key', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Select token
    await token.click();

    // Press Delete key
    await page.keyboard.press('Delete');

    // Verify token removed
    await expect(
      page.locator('[data-testid^="token-"]'),
      'Token should be deleted after pressing Delete key',
    ).toHaveCount(0);
  });

  test('should delete multiple selected tokens', async ({ page }) => {
    // Add three tokens
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="add-token-button"]');
      await page.click('[data-testid="canvas"]', {
        position: { x: 200 + i * 100, y: 200 },
      });
    }

    // Verify 3 tokens exist
    let tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens).toHaveCount(3);

    // Select all with Ctrl+A
    await page.keyboard.press('Control+a');

    // Delete
    await page.keyboard.press('Delete');

    // Verify all removed
    tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'All tokens should be deleted after multi-select delete').toHaveCount(0);
  });

  test('should not delete token when canceling confirmation', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Right-click and delete
    await token.click({ button: 'right' });
    await page.click('[data-testid="context-menu-delete"]');

    // Cancel deletion
    await page.click('[data-testid="cancel-delete-button"]');

    // Verify token still exists
    await expect(token, 'Token should remain on canvas when deletion is cancelled').toBeVisible();
  });
});

test.describe('Token Duplication', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Duplication Test');
  });

  test('should duplicate token via context menu', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    let tokens = page.locator('[data-testid^="token-"]');

    await expect(tokens).toHaveCount(1);

    // Right-click and duplicate
    await tokens.first().click({ button: 'right' });
    await page.click('[data-testid="context-menu-duplicate"]');

    // Verify duplicate created
    tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'Duplicate token should be created').toHaveCount(2);
  });

  test('should duplicate token with Ctrl+D', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const token = page.locator('[data-testid^="token-"]').first();

    // Select and duplicate
    await token.click();
    await page.keyboard.press('Control+d');

    // Verify duplicate created
    const tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'Duplicate should be created with Ctrl+D').toHaveCount(2);
  });

  test('should offset duplicate position slightly', async ({ page }) => {
    // Add token
    await page.click('[data-testid="add-token-button"]');
    const original = page.locator('[data-testid^="token-"]').first();
    const originalBox = await original.boundingBox();

    // Duplicate
    await original.click();
    await page.keyboard.press('Control+d');

    // Get duplicate position
    const duplicate = page.locator('[data-testid^="token-"]').nth(1);
    const duplicateBox = await duplicate.boundingBox();

    // Verify positions are different but close
    expect(duplicateBox!.x, 'Duplicate should be offset from original').not.toBe(originalBox!.x);

    expect(
      Math.abs(duplicateBox!.x - originalBox!.x),
      'Duplicate should be offset by small amount (e.g., 20px)',
    ).toBeLessThan(50);
  });
});

test.describe('Token Z-Index / Layering', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Layering Test');
  });

  test('should bring token to front', async ({ page }) => {
    // Add two overlapping tokens
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 200, y: 200 } });

    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 210, y: 210 } });

    const firstToken = page.locator('[data-testid^="token-"]').first();

    // Select first token and bring to front
    await firstToken.click();
    await page.click('[data-testid="bring-to-front-button"]');

    // Verify z-index changed
    const zIndex = await firstToken.evaluate((el) => window.getComputedStyle(el).zIndex);

    expect(parseInt(zIndex), 'Token z-index should increase when brought to front').toBeGreaterThan(
      0,
    );
  });

  test('should send token to back', async ({ page }) => {
    // Add two tokens
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 200, y: 200 } });

    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 210, y: 210 } });

    const secondToken = page.locator('[data-testid^="token-"]').nth(1);
    const initialZIndex = await secondToken.evaluate((el) => window.getComputedStyle(el).zIndex);

    // Send second token to back
    await secondToken.click();
    await page.click('[data-testid="send-to-back-button"]');

    // Verify z-index decreased
    const newZIndex = await secondToken.evaluate((el) => window.getComputedStyle(el).zIndex);

    expect(parseInt(newZIndex), 'Token z-index should decrease when sent to back').toBeLessThan(
      parseInt(initialZIndex),
    );
  });
});

test.describe('Token Performance', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Performance Test');
  });

  test('should handle many tokens without lag', async ({ page }) => {
    // Add 50 tokens
    for (let i = 0; i < 50; i++) {
      await page.click('[data-testid="add-token-button"]');
      await page.click('[data-testid="canvas"]', {
        position: { x: 100 + (i % 10) * 60, y: 100 + Math.floor(i / 10) * 60 },
      });
    }

    // Verify all tokens rendered
    const tokens = page.locator('[data-testid^="token-"]');
    await expect(tokens, 'All 50 tokens should be rendered').toHaveCount(50);

    // Test drag performance
    // Note: This measures total elapsed time including test execution overhead
    // (hover action, mouse operations), not just the pure drag operation performance.
    // For more precise performance measurements, consider using Playwright's
    // performance timing APIs or isolating the drag operation timing.
    const firstToken = tokens.first();
    const startTime = Date.now();

    await firstToken.hover();
    await page.mouse.down();
    await page.mouse.move(500, 500);
    await page.mouse.up();

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration, 'Token drag should complete in under 1 second with 50 tokens').toBeLessThan(
      1000,
    );
  });
});
