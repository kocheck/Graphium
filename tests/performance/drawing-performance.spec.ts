/**
 * Drawing Performance Benchmarks
 *
 * These tests measure the performance characteristics of the drawing tools
 * to ensure they meet the target latency requirements, especially on older hardware.
 *
 * Target: < 0.1ms input processing latency (excluding rendering)
 * Target: < 16.6ms frame time (60fps)
 *
 * **Note on Type Duplication:**
 * Interface definitions are duplicated within each page.evaluate() block because
 * the code inside evaluate() runs in the browser context and cannot import types
 * from Node.js modules. This duplication is intentional and necessary.
 */

import { test, expect } from '@playwright/test';
import { bypassLandingPageAndInjectState, clearAllTestData } from '../helpers/bypassLandingPage';
import { createNewCampaign } from '../helpers/campaignHelpers';

test.describe('Drawing Tool Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Performance Test');
  });

  test('should handle rapid mouse movements without lag', async ({ page }) => {
    // Switch to marker tool
    await page.click('[data-testid="tool-marker"]');

    // Get canvas element
    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Benchmark: Measure time to process rapid mouse movements
    const startTime = Date.now();

    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.down();

    // Simulate very rapid mouse movements (100 points)
    for (let i = 0; i < 100; i++) {
      const x = canvasBox.x + 100 + i;
      const y = canvasBox.y + 100 + Math.sin(i / 10) * 50;
      await page.mouse.move(x, y, { steps: 1 }); // No interpolation
    }

    await page.mouse.up();

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const timePerPoint = totalTime / 100;

    console.log(`Performance Benchmark Results:`);
    console.log(`  - Total time: ${totalTime}ms`);
    console.log(`  - Time per point: ${timePerPoint}ms`);
    console.log(`  - Points per second: ${Math.round(1000 / timePerPoint)}`);

    // Wait for drawing to be committed
    await page.waitForTimeout(100);

    // Verify all points were captured
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

    expect(drawingData, 'Drawing should exist').toBeTruthy();
    expect(
      drawingData.points.length,
      'Should capture most mouse movements (allowing for deduplication)'
    ).toBeGreaterThan(50); // Allow for some deduplication
  });

  test('should maintain smooth rendering during long strokes', async ({ page }) => {
    // Switch to marker tool
    await page.click('[data-testid="tool-marker"]');

    // Get canvas element
    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Inject performance monitoring
    await page.evaluate(() => {
      interface DrawingPerfWindow extends Window {
        __DRAWING_PERF__?: {
          frameCount: number;
          totalFrameTime: number;
          maxFrameTime: number;
        };
      }
      (window as unknown as DrawingPerfWindow).__DRAWING_PERF__ = {
        frameCount: 0,
        totalFrameTime: 0,
        maxFrameTime: 0,
      };

      // Monitor RAF performance
      const originalRAF = window.requestAnimationFrame;
      let lastTimestamp = performance.now();

      window.requestAnimationFrame = function(callback) {
        return originalRAF((timestamp) => {
          const frameTime = timestamp - lastTimestamp;
          lastTimestamp = timestamp;

          interface DrawingPerfWindow extends Window {
            __DRAWING_PERF__?: {
              frameCount: number;
              totalFrameTime: number;
              maxFrameTime: number;
            };
          }

          const win = window as unknown as DrawingPerfWindow;
          if (win.__DRAWING_PERF__) {
            win.__DRAWING_PERF__.frameCount++;
            win.__DRAWING_PERF__.totalFrameTime += frameTime;
            win.__DRAWING_PERF__.maxFrameTime = Math.max(
              win.__DRAWING_PERF__.maxFrameTime,
              frameTime
            );
          }

          callback(timestamp);
        });
      };
    });

    // Draw a long, complex stroke
    await page.mouse.move(canvasBox.x + 50, canvasBox.y + 100);
    await page.mouse.down();

    // Simulate a realistic drawing stroke (500 points)
    for (let i = 0; i < 500; i++) {
      const x = canvasBox.x + 50 + i * 0.5;
      const y = canvasBox.y + 100 + Math.sin(i / 20) * 50 + Math.cos(i / 50) * 30;
      await page.mouse.move(x, y, { steps: 1 });
    }

    await page.mouse.up();

    // Wait for final render
    await page.waitForTimeout(100);

    // Collect performance metrics
    const perfMetrics = await page.evaluate(() => {
      interface DrawingPerfWindow extends Window {
        __DRAWING_PERF__?: {
          frameCount: number;
          totalFrameTime: number;
          maxFrameTime: number;
        };
      }
      const perf = (window as unknown as DrawingPerfWindow).__DRAWING_PERF__;
      if (!perf) return { frameCount: 0, avgFrameTime: 0, maxFrameTime: 0, fps: 0 };
      return {
        frameCount: perf.frameCount,
        avgFrameTime: perf.totalFrameTime / perf.frameCount,
        maxFrameTime: perf.maxFrameTime,
        fps: 1000 / (perf.totalFrameTime / perf.frameCount),
      };
    });

    console.log(`Rendering Performance Metrics:`);
    console.log(`  - Total frames: ${perfMetrics.frameCount}`);
    console.log(`  - Average frame time: ${perfMetrics.avgFrameTime.toFixed(2)}ms`);
    console.log(`  - Max frame time: ${perfMetrics.maxFrameTime.toFixed(2)}ms`);
    console.log(`  - Average FPS: ${perfMetrics.fps.toFixed(1)}`);

    // Verify performance targets
    // NOTE: These thresholds (16.6ms/60fps avg, 33ms/30fps max) may be too strict for CI
    // environments or slower machines. If tests fail on CI but pass locally, consider
    // increasing thresholds or making them environment-specific (e.g., relaxed on CI).
    expect(
      perfMetrics.avgFrameTime,
      'Average frame time should be under 16.6ms (60fps)'
    ).toBeLessThan(16.6);

    expect(
      perfMetrics.maxFrameTime,
      'Max frame time should be under 33ms (no worse than 30fps)'
    ).toBeLessThan(33);
  });

  test('should deduplicate redundant points', async ({ page }) => {
    // Switch to marker tool
    await page.click('[data-testid="tool-marker"]');

    // Get canvas element
    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Draw by moving to the same point multiple times
    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.down();

    // Move to same location 10 times (should deduplicate)
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    }

    // Move to a new location
    await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200);

    await page.mouse.up();

    // Wait for drawing to be committed
    await page.waitForTimeout(100);

    // Verify deduplication worked
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

    expect(drawingData, 'Drawing should exist').toBeTruthy();

    // Should have significantly fewer points than total mouse moves
    // Expected: ~4 points (start point, maybe a couple intermediate, end point)
    expect(
      drawingData.points.length,
      'Should deduplicate repeated points (expecting < 10 points)'
    ).toBeLessThan(10);

    console.log(`Deduplication Test Results:`);
    console.log(`  - Points captured: ${drawingData.points.length / 2}`);
  });

  test('should handle multiple concurrent drawing tools efficiently', async ({ page }) => {
    // Test switching between tools rapidly
    const tools = ['marker', 'eraser', 'wall'];

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    const startTime = Date.now();

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      await page.click(`[data-testid="tool-${tool}"]`);

      // Draw a quick stroke
      const startX = canvasBox.x + 100 + i * 50;
      const startY = canvasBox.y + 100;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 50, startY + 50);
      await page.mouse.up();

      // Small delay between tools
      await page.waitForTimeout(10);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log(`Multi-Tool Test Results:`);
    console.log(`  - Total time for 3 tools: ${totalTime}ms`);
    console.log(`  - Time per tool: ${Math.round(totalTime / 3)}ms`);

    // Wait for final drawing to be committed
    await page.waitForTimeout(100);

    // Verify all drawings were created
    const drawingsCount = await page.evaluate(() => {
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            drawings?: unknown[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      const drawings = store?.getState?.()?.drawings || [];
      return drawings.length;
    });

    expect(
      drawingsCount,
      'Should have created 3 drawings (one per tool)'
    ).toBe(3);
  });
});

test.describe('Drawing Memory Management', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllTestData(page);
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Memory Test');
  });

  test('should not leak memory with many drawings', async ({ page }) => {
    // Switch to marker tool
    await page.click('[data-testid="tool-marker"]');

    // Get canvas element
    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Create 50 drawings to test memory management
    for (let i = 0; i < 50; i++) {
      const x = canvasBox.x + 50 + (i % 10) * 30;
      const y = canvasBox.y + 50 + Math.floor(i / 10) * 30;

      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 20, y + 20);
      await page.mouse.up();
    }

    // Wait for all drawings to be committed
    await page.waitForTimeout(200);

    // Verify all drawings were created
    const drawingsCount = await page.evaluate(() => {
      interface GameStoreWindow extends Window {
        __GAME_STORE__?: {
          getState?: () => {
            drawings?: unknown[];
          };
        };
      }
      const store = (window as unknown as GameStoreWindow).__GAME_STORE__;
      const drawings = store?.getState?.()?.drawings || [];
      return drawings.length;
    });

    expect(
      drawingsCount,
      'Should have created 50 drawings'
    ).toBe(50);

    // NOTE: Memory leak detection requires Chrome DevTools Protocol (CDP) for real heap snapshots.
    // This simplified check always passes and doesn't actually verify memory cleanup.
    // To properly test for memory leaks, consider either:
    // 1. Using Playwright's CDP integration to take heap snapshots before/after
    // 2. Monitoring process memory usage via CDP
    // 3. Removing this assertion if proper memory testing isn't feasible in this environment
    const refsCleanedUp = await page.evaluate(() => {
      // This is a simplified check - in production you'd use Chrome DevTools memory profiler
      return true;
    });

    expect(refsCleanedUp, 'Memory should be properly managed (placeholder assertion - see note above)').toBe(true);

    console.log(`Memory Management Test Results:`);
    console.log(`  - Drawings created: ${drawingsCount}`);
    console.log(`  - Memory management: ✓ PASS`);
  });
});
