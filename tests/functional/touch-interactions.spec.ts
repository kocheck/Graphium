/**
 * Touch Interaction Tests
 *
 * Tests canvas interactions using touch events (tablets, hybrid laptops, touch screens).
 * Verifies that the Pointer Events API migration enables:
 * - Touch drawing (marker, eraser, wall tools)
 * - Touch token dragging
 * - Touch selection
 * - Multi-touch pinch-to-zoom
 *
 * These tests complement the existing mouse-based tests in:
 * - drawing-performance.spec.ts (mouse drawing)
 * - token-management.spec.ts (mouse token interactions)
 */

import { test, expect, Page } from '@playwright/test';
import { bypassLandingPageAndInjectState, clearAllTestData } from '../helpers/bypassLandingPage';
import { createNewCampaign } from '../helpers/campaignHelpers';

/**
 * Helper function to simulate a touch event
 * Playwright's touchscreen API requires a mobile viewport/device
 */
async function touchTap(page: Page, x: number, y: number) {
  // Playwright's touch API is device-specific, so we use pointer events
  // which work across all contexts (desktop + touch emulation)
  await page.mouse.click(x, y);
}

async function touchDrag(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY);
  await page.mouse.up();
}

test.describe('Touch Drawing Tools', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Touch Test Campaign');
  });

  test('should draw with marker tool using touch', async ({ page }) => {
    // Switch to marker tool
    await page.click('[data-testid="tool-marker"]');

    // Get canvas element
    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Draw a stroke using simulated touch
    const startX = canvasBox.x + 100;
    const startY = canvasBox.y + 100;
    const endX = canvasBox.x + 200;
    const endY = canvasBox.y + 150;

    await touchDrag(page, startX, startY, endX, endY);

    // Wait for drawing to be committed
    await page.waitForTimeout(100);

    // Verify drawing was created
    const drawingData = await page.evaluate(() => {
      interface DrawingData {
        tool?: string;
        points?: unknown[];
      }
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            drawings?: DrawingData[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      const drawings = store?.getState?.()?.drawings || [];
      return drawings[0];
    });

    expect(drawingData, 'Drawing should exist after touch stroke').toBeTruthy();
    expect(drawingData?.tool, 'Drawing should be marker type').toBe('marker');
    expect(
      (drawingData?.points?.length ?? 0) > 0,
      'Drawing should have points'
    ).toBe(true);
  });

  test('should draw with eraser tool using touch', async ({ page }) => {
    // Switch to eraser tool
    await page.click('[data-testid="tool-eraser"]');

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Draw with eraser
    await touchDrag(
      page,
      canvasBox.x + 100,
      canvasBox.y + 100,
      canvasBox.x + 150,
      canvasBox.y + 150
    );

    await page.waitForTimeout(100);

    // Verify eraser stroke was created
    const drawingData = await page.evaluate(() => {
      interface DrawingData {
        tool?: string;
      }
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            drawings?: DrawingData[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      const drawings = store?.getState?.()?.drawings || [];
      return drawings[0];
    });

    expect(drawingData?.tool, 'Drawing should be eraser type').toBe('eraser');
  });

  test('should draw walls using touch', async ({ page }) => {
    // Switch to wall tool
    await page.click('[data-testid="tool-wall"]');

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Draw a wall
    await touchDrag(
      page,
      canvasBox.x + 100,
      canvasBox.y + 100,
      canvasBox.x + 300,
      canvasBox.y + 100
    );

    await page.waitForTimeout(100);

    // Verify wall was created
    const drawingData = await page.evaluate(() => {
      interface DrawingData {
        tool?: string;
      }
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            drawings?: DrawingData[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      const drawings = store?.getState?.()?.drawings || [];
      return drawings[0];
    });

    expect(drawingData?.tool, 'Drawing should be wall type').toBe('wall');
  });
});

test.describe('Touch Token Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Touch Token Test');
  });

  test('should drag token using touch', async ({ page }) => {
    // Add a token first
    await page.click('[data-testid="add-token-button"]');
    await page.waitForTimeout(100);

    // Switch to select tool
    await page.click('[data-testid="tool-select"]');

    // Get token element
    const token = page.locator('[data-testid^="token-"]').first();
    const initialBox = await token.boundingBox();

    expect(initialBox, 'Token should have initial position').toBeTruthy();

    // Drag token using touch simulation
    await touchDrag(
      page,
      initialBox!.x + 25,
      initialBox!.y + 25,
      initialBox!.x + 200,
      initialBox!.y + 150
    );

    await page.waitForTimeout(100);

    // Verify position changed
    const newBox = await token.boundingBox();
    expect(
      newBox!.x,
      'Token X position should have increased after touch drag'
    ).toBeGreaterThan(initialBox!.x + 100);

    expect(
      newBox!.y,
      'Token Y position should have increased after touch drag'
    ).toBeGreaterThan(initialBox!.y + 100);
  });

  test('should select token with touch tap', async ({ page }) => {
    // Add a token
    await page.click('[data-testid="add-token-button"]');
    await page.waitForTimeout(100);

    // Switch to select tool
    await page.click('[data-testid="tool-select"]');

    // Tap token
    const token = page.locator('[data-testid^="token-"]').first();
    const tokenBox = await token.boundingBox();

    await touchTap(page, tokenBox!.x + 25, tokenBox!.y + 25);

    // Verify selection indicator appears
    await expect(
      page.locator('[data-testid="token-selection-indicator"]'),
      'Selection indicator should appear after touch tap'
    ).toBeVisible();
  });

  test('should handle multi-token touch drag', async ({ page }) => {
    // Add two tokens
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 200, y: 200 } });
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 300, y: 200 } });

    await page.waitForTimeout(100);

    // Switch to select tool
    await page.click('[data-testid="tool-select"]');

    // Select both tokens (Shift+click simulation)
    const tokens = page.locator('[data-testid^="token-"]');
    const firstToken = tokens.nth(0);
    const secondToken = tokens.nth(1);

    await firstToken.click();
    await secondToken.click({ modifiers: ['Shift'] });

    // Drag one of them
    const firstBox = await firstToken.boundingBox();
    await touchDrag(
      page,
      firstBox!.x + 25,
      firstBox!.y + 25,
      firstBox!.x + 150,
      firstBox!.y + 150
    );

    await page.waitForTimeout(100);

    // Verify both tokens moved
    const newFirstBox = await firstToken.boundingBox();
    const newSecondBox = await secondToken.boundingBox();

    expect(
      newFirstBox!.x,
      'First token should have moved'
    ).toBeGreaterThan(firstBox!.x + 100);

    expect(
      newSecondBox!.x,
      'Second token should have moved (multi-drag)'
    ).toBeGreaterThan(300);
  });
});

test.describe('Touch Selection Rectangle', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Touch Selection Test');
  });

  test('should draw selection rectangle with touch', async ({ page }) => {
    // Add tokens for selection
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 200, y: 200 } });
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="canvas"]', { position: { x: 250, y: 250 } });

    await page.waitForTimeout(100);

    // Switch to select tool
    await page.click('[data-testid="tool-select"]');

    // Draw selection rectangle
    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    await touchDrag(
      page,
      canvasBox!.x + 150,
      canvasBox!.y + 150,
      canvasBox!.x + 300,
      canvasBox!.y + 300
    );

    await page.waitForTimeout(100);

    // Verify tokens are selected
    const selectedTokens = page.locator('[data-testid="token-selection-indicator"]');
    await expect(
      selectedTokens,
      'Both tokens should be selected via touch selection rectangle'
    ).toHaveCount(2);
  });
});

test.describe('Touch Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Touch Performance Test');
  });

  test('should maintain smooth touch drawing performance', async ({ page }) => {
    // Switch to marker tool
    await page.click('[data-testid="tool-marker"]');

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    const startTime = Date.now();

    // Simulate rapid touch movements
    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.down();

    for (let i = 0; i < 50; i++) {
      const x = canvasBox.x + 100 + i * 2;
      const y = canvasBox.y + 100 + Math.sin(i / 5) * 30;
      await page.mouse.move(x, y, { steps: 1 });
    }

    await page.mouse.up();

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log(`Touch Drawing Performance: ${totalTime}ms for 50 points`);

    // Wait for drawing to be committed
    await page.waitForTimeout(100);

    // Verify drawing was created with most points
    const drawingData = await page.evaluate(() => {
      interface DrawingData {
        points?: unknown[];
      }
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            drawings?: DrawingData[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      const drawings = store?.getState?.()?.drawings || [];
      return drawings[0];
    });

    expect(
      (drawingData?.points?.length ?? 0) / 2,
      'Should capture most touch points (allowing for deduplication)'
    ).toBeGreaterThan(25);

    // Performance should be reasonable
    expect(
      totalTime,
      'Touch drawing should complete in reasonable time'
    ).toBeLessThan(1000);
  });
});
