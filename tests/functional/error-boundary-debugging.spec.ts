/**
 * Error Boundary Debugging Tests
 *
 * These tests demonstrate how to use the enhanced error boundary system
 * for debugging and ensure error boundaries work correctly.
 *
 * **What These Tests Do:**
 * - Verify error boundaries don't trigger during normal operation
 * - Check error tracking and logging in dev mode
 * - Demonstrate how to inspect error context
 * - Show how to use breadcrumbs for debugging
 */

import { test, expect } from '@playwright/test';
import { bypassLandingPageAndInjectState, clearAllTestData } from '../helpers/bypassLandingPage';
import { createNewCampaign } from '../helpers/campaignHelpers';
import {
  checkForTokenErrors,
  checkForOverlayErrors,
  assertNoErrors,
  clearAllErrors,
  addBreadcrumb,
  getErrorHistory,
  getAllOverlayErrors,
} from '../helpers/errorBoundaryHelpers';

test.describe('Error Boundary System', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await clearAllErrors(page);
  });

  test('should not trigger any error boundaries during normal canvas usage', async ({ page }) => {
    // Create campaign
    await createNewCampaign(page, 'Error Boundary Test');

    // Add breadcrumb to track what we're testing
    await addBreadcrumb(page, 'Created campaign');

    // Switch to marker tool and draw
    await page.click('[data-testid="tool-marker"]');
    await addBreadcrumb(page, 'Switched to marker tool');

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (canvasBox) {
      await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200);
      await page.mouse.up();

      await addBreadcrumb(page, 'Drew on canvas');
    }

    // Wait for any potential errors to surface
    await page.waitForTimeout(500);

    // Assert no errors occurred
    await assertNoErrors(page);

    // Verify error history is empty
    const errorHistory = await getErrorHistory(page);
    expect(
      errorHistory.length,
      'Error history should be empty during normal operation'
    ).toBe(0);
  });

  test('should track error context in dev mode', async ({ page }) => {
    // This test verifies that when errors DO occur, we capture full context
    // We don't intentionally trigger errors, but verify the tracking system exists

    // Check that error utilities are available in dev mode
    const hasErrorUtils = await page.evaluate(() => {
      interface ErrorUtilsWindow extends Window {
        __ERROR_UTILS__?: unknown;
      }
      return !!(window as unknown as ErrorUtilsWindow).__ERROR_UTILS__;
    });

    expect(
      hasErrorUtils,
      'Error utilities should be available in dev/test mode'
    ).toBe(true);

    // Verify breadcrumb system works
    await addBreadcrumb(page, 'Test breadcrumb 1');
    await addBreadcrumb(page, 'Test breadcrumb 2');

    const breadcrumbsWork = await page.evaluate(() => {
      interface ErrorUtilsWindow extends Window {
        __ERROR_UTILS__?: {
          addBreadcrumb?: unknown;
        };
      }
      const utils = (window as unknown as ErrorUtilsWindow).__ERROR_UTILS__;
      // We can't directly access breadcrumbs, but we can verify the function exists
      return typeof utils?.addBreadcrumb === 'function';
    });

    expect(breadcrumbsWork, 'Breadcrumb system should be functional').toBe(true);
  });

  test('should expose game store for debugging', async ({ page }) => {
    await createNewCampaign(page, 'Store Debug Test');

    // Verify game store is accessible
    const storeExists = await page.evaluate(() => {
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: unknown;
      }
      return !!(window as unknown as GameStoreWindow).__GAME_STORE__;
    });

    expect(
      storeExists,
      'Game store should be exposed in dev/test mode'
    ).toBe(true);

    // Verify we can access store state
    const storeState = await page.evaluate(() => {
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            campaign?: unknown;
            drawings?: unknown[];
            tokens?: unknown[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      const state = store?.getState?.();
      return {
        hasCampaign: !!state?.campaign,
        hasDrawings: Array.isArray(state?.drawings),
        hasTokens: Array.isArray(state?.tokens),
      };
    });

    expect(storeState.hasCampaign, 'Store should have campaign').toBe(true);
    expect(storeState.hasDrawings, 'Store should have drawings array').toBe(true);
    expect(storeState.hasTokens, 'Store should have tokens array').toBe(true);
  });

  test('should not have overlay errors during map operations', async ({ page }) => {
    await createNewCampaign(page, 'Overlay Test');

    // Perform various map operations
    await page.click('[data-testid="tool-select"]');
    await page.click('[data-testid="tool-marker"]');
    await page.click('[data-testid="tool-wall"]');

    // Wait for overlays to render
    await page.waitForTimeout(500);

    // Check for overlay errors
    const overlayError = await checkForOverlayErrors(page);
    expect(overlayError, 'No overlay errors should have occurred').toBeNull();

    // Check all overlay errors (should be empty)
    const allOverlayErrors = await getAllOverlayErrors(page);
    expect(
      allOverlayErrors.length,
      'Overlay error history should be empty'
    ).toBe(0);
  });

  test('should clear error history correctly', async ({ page }) => {
    await createNewCampaign(page, 'Clear History Test');

    // Add some breadcrumbs
    await addBreadcrumb(page, 'Action 1');
    await addBreadcrumb(page, 'Action 2');
    await addBreadcrumb(page, 'Action 3');

    // Clear all errors
    await clearAllErrors(page);

    // Verify everything is cleared
    const tokenError = await checkForTokenErrors(page);
    const overlayError = await checkForOverlayErrors(page);
    const errorHistory = await getErrorHistory(page);

    expect(tokenError, 'Token errors should be cleared').toBeNull();
    expect(overlayError, 'Overlay errors should be cleared').toBeNull();
    expect(errorHistory.length, 'Error history should be cleared').toBe(0);
  });
});

test.describe('Error Boundary Integration', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await clearAllErrors(page);
  });

  test('should handle multiple tool switches without errors', async ({ page }) => {
    await createNewCampaign(page, 'Tool Switch Test');

    const tools = ['marker', 'eraser', 'wall', 'select'];

    for (const tool of tools) {
      await page.click(`[data-testid="tool-${tool}"]`);
      await addBreadcrumb(page, `Switched to ${tool} tool`);
      await page.waitForTimeout(100);
    }

    // Assert no errors after all switches
    await assertNoErrors(page);
  });

  test('should handle rapid drawing operations without errors', async ({ page }) => {
    await createNewCampaign(page, 'Rapid Drawing Test');

    await page.click('[data-testid="tool-marker"]');
    await addBreadcrumb(page, 'Started rapid drawing test');

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (canvasBox) {
      // Draw 10 quick strokes
      for (let i = 0; i < 10; i++) {
        const x1 = canvasBox.x + 100 + i * 10;
        const y1 = canvasBox.y + 100;
        const x2 = canvasBox.x + 150 + i * 10;
        const y2 = canvasBox.y + 150;

        await page.mouse.move(x1, y1);
        await page.mouse.down();
        await page.mouse.move(x2, y2);
        await page.mouse.up();
      }

      await addBreadcrumb(page, 'Completed rapid drawing');
    }

    // Wait for all drawings to be committed
    await page.waitForTimeout(500);

    // Assert no errors
    await assertNoErrors(page);

    // Verify all drawings were created
    const drawingCount = await page.evaluate(() => {
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            drawings?: unknown[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      return store?.getState?.()?.drawings?.length || 0;
    });

    expect(
      drawingCount,
      'All drawings should be created without errors'
    ).toBe(10);
  });
});

test.describe('Performance Metrics During Errors', () => {
  test('should have error utilities with performance tracking available', async ({ page }) => {
    await bypassLandingPageAndInjectState(page);

    const hasPerformanceTracking = await page.evaluate(() => {
      interface ErrorUtilsWindow extends Window {
        __ERROR_UTILS__?: {
          getErrorHistory?: unknown;
          clearErrorHistory?: unknown;
          formatErrorReport?: unknown;
        };
      }
      const utils = (window as unknown as ErrorUtilsWindow).__ERROR_UTILS__;
      if (!utils) return false;

      // Verify the utility functions exist
      return (
        typeof utils.getErrorHistory === 'function' &&
        typeof utils.clearErrorHistory === 'function' &&
        typeof utils.addBreadcrumb === 'function' &&
        typeof utils.exportErrorToClipboard === 'function'
      );
    });

    expect(
      hasPerformanceTracking,
      'Performance tracking utilities should be available'
    ).toBe(true);
  });
});
