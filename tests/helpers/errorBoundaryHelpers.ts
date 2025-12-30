/**
 * Error Boundary Test Helpers
 *
 * Utilities for testing error boundaries in E2E and integration tests.
 * These helpers make it easy to verify error boundaries catch errors correctly,
 * log appropriate information, and maintain application stability.
 *
 * **Usage:**
 * ```typescript
 * import { checkForTokenErrors, clearAllErrors, getErrorHistory } from '../helpers/errorBoundaryHelpers';
 *
 * test('should not have any token errors', async ({ page }) => {
 *   // ... perform actions that might cause errors ...
 *
 *   const tokenError = await checkForTokenErrors(page);
 *   expect(tokenError).toBeNull();
 * });
 * ```
 */

import type { Page } from '@playwright/test';

/**
 * Error information returned by test helpers
 */
export interface TestErrorInfo {
  tokenId?: string;
  overlayName?: string;
  error: string;
  timestamp: number;
  context?: any;
}

/**
 * Check if any token errors occurred
 *
 * @param page - Playwright Page object
 * @returns The last token error, or null if no errors
 */
export async function checkForTokenErrors(page: Page): Promise<TestErrorInfo | null> {
  return await page.evaluate(() => {
    return (window as any).__LAST_TOKEN_ERROR__ || null;
  });
}

/**
 * Check if any overlay errors occurred
 *
 * @param page - Playwright Page object
 * @returns The last overlay error, or null if no errors
 */
export async function checkForOverlayErrors(page: Page): Promise<TestErrorInfo | null> {
  return await page.evaluate(() => {
    return (window as any).__LAST_OVERLAY_ERROR__ || null;
  });
}

/**
 * Check if any asset processing errors occurred
 *
 * @param page - Playwright Page object
 * @returns The last asset processing error, or null if no errors
 */
export async function checkForAssetProcessingErrors(page: Page): Promise<TestErrorInfo | null> {
  return await page.evaluate(() => {
    return (window as any).__LAST_ASSET_PROCESSING_ERROR__ || null;
  });
}

/**
 * Get all overlay errors (up to 10 most recent)
 *
 * @param page - Playwright Page object
 * @returns Array of overlay errors
 */
export async function getAllOverlayErrors(page: Page): Promise<TestErrorInfo[]> {
  return await page.evaluate(() => {
    return (window as any).__OVERLAY_ERRORS__ || [];
  });
}

/**
 * Get error history from the error boundary utilities
 *
 * @param page - Playwright Page object
 * @returns Array of error contexts
 */
export async function getErrorHistory(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    const utils = (window as any).__ERROR_UTILS__;
    return utils ? utils.getErrorHistory() : [];
  });
}

/**
 * Clear all error history
 *
 * @param page - Playwright Page object
 */
export async function clearAllErrors(page: Page): Promise<void> {
  await page.evaluate(() => {
    delete (window as any).__LAST_TOKEN_ERROR__;
    delete (window as any).__LAST_OVERLAY_ERROR__;
    delete (window as any).__LAST_ASSET_PROCESSING_ERROR__;
    delete (window as any).__OVERLAY_ERRORS__;

    const utils = (window as any).__ERROR_UTILS__;
    if (utils) {
      utils.clearErrorHistory();
    }
  });
}

/**
 * Add a breadcrumb to the error tracking system
 * Useful for marking specific user actions during tests
 *
 * @param page - Playwright Page object
 * @param action - Description of the action
 */
export async function addBreadcrumb(page: Page, action: string): Promise<void> {
  await page.evaluate((actionText) => {
    const utils = (window as any).__ERROR_UTILS__;
    if (utils) {
      utils.addBreadcrumb(actionText);
    }
  }, action);
}

/**
 * Export current error to clipboard (for manual debugging)
 *
 * @param page - Playwright Page object
 * @param errorType - Type of error to export ('token' | 'overlay' | 'asset')
 * @returns True if export succeeded
 */
export async function exportErrorToClipboard(
  page: Page,
  errorType: 'token' | 'overlay' | 'asset'
): Promise<boolean> {
  return await page.evaluate((type) => {
    const utils = (window as any).__ERROR_UTILS__;
    if (!utils) return false;

    let error: any;
    switch (type) {
      case 'token':
        error = (window as any).__LAST_TOKEN_ERROR__;
        break;
      case 'overlay':
        error = (window as any).__LAST_OVERLAY_ERROR__;
        break;
      case 'asset':
        error = (window as any).__LAST_ASSET_PROCESSING_ERROR__;
        break;
    }

    if (!error || !error.context) return false;

    return utils.exportErrorToClipboard(error.context);
  }, errorType);
}

/**
 * Assert no errors occurred during test
 * Throws descriptive error if any error boundary was triggered
 *
 * @param page - Playwright Page object
 * @param options - Options for error checking
 */
export async function assertNoErrors(
  page: Page,
  options: {
    checkTokens?: boolean;
    checkOverlays?: boolean;
    checkAssetProcessing?: boolean;
  } = {
    checkTokens: true,
    checkOverlays: true,
    checkAssetProcessing: true,
  }
): Promise<void> {
  const errors: string[] = [];

  if (options.checkTokens) {
    const tokenError = await checkForTokenErrors(page);
    if (tokenError) {
      errors.push(
        `Token Error: ${tokenError.error} (Token ID: ${tokenError.tokenId || 'unknown'}, Time: ${new Date(tokenError.timestamp).toISOString()})`
      );
    }
  }

  if (options.checkOverlays) {
    const overlayError = await checkForOverlayErrors(page);
    if (overlayError) {
      errors.push(
        `Overlay Error: ${overlayError.error} (Overlay: ${overlayError.overlayName || 'unknown'}, Time: ${new Date(overlayError.timestamp).toISOString()})`
      );
    }
  }

  if (options.checkAssetProcessing) {
    const assetError = await checkForAssetProcessingErrors(page);
    if (assetError) {
      errors.push(
        `Asset Processing Error: ${assetError.error} (Time: ${new Date(assetError.timestamp).toISOString()})`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Error boundaries were triggered:\n${errors.join('\n')}`);
  }
}

/**
 * Wait for an error to occur (useful for testing error boundaries themselves)
 *
 * @param page - Playwright Page object
 * @param errorType - Type of error to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 5000)
 * @returns The error that occurred, or null if timeout
 */
export async function waitForError(
  page: Page,
  errorType: 'token' | 'overlay' | 'asset',
  timeout: number = 5000
): Promise<TestErrorInfo | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    let error: TestErrorInfo | null = null;

    switch (errorType) {
      case 'token':
        error = await checkForTokenErrors(page);
        break;
      case 'overlay':
        error = await checkForOverlayErrors(page);
        break;
      case 'asset':
        error = await checkForAssetProcessingErrors(page);
        break;
    }

    if (error) {
      return error;
    }

    // Wait a bit before checking again
    await page.waitForTimeout(100);
  }

  return null;
}

/**
 * Trigger a test error (dev mode only)
 * Useful for testing error boundary behavior
 *
 * @param page - Playwright Page object
 * @param componentType - Type of component to throw error from
 * @param message - Error message
 */
export async function triggerTestError(
  page: Page,
  componentType: 'token' | 'overlay' | 'asset',
  message: string = 'Test error'
): Promise<void> {
  await page.evaluate(
    ({ type, msg }) => {
      // Store error trigger in window for component to pick up
      (window as any).__TRIGGER_TEST_ERROR__ = {
        type,
        message: msg,
        triggered: false,
      };
    },
    { type: componentType, msg: message }
  );
}

/**
 * Get performance metrics from last error
 *
 * @param page - Playwright Page object
 * @param errorType - Type of error to get metrics from
 * @returns Performance metrics or null
 */
export async function getErrorPerformanceMetrics(
  page: Page,
  errorType: 'token' | 'overlay' | 'asset'
): Promise<{
  memory?: { used: number; total: number; limit: number };
  timing?: { loadTime: number; domReady: number };
} | null> {
  return await page.evaluate((type) => {
    let error: any;
    switch (type) {
      case 'token':
        error = (window as any).__LAST_TOKEN_ERROR__;
        break;
      case 'overlay':
        error = (window as any).__LAST_OVERLAY_ERROR__;
        break;
      case 'asset':
        error = (window as any).__LAST_ASSET_PROCESSING_ERROR__;
        break;
    }

    if (!error || !error.context || !error.context.performance) {
      return null;
    }

    return error.context.performance;
  }, errorType);
}
