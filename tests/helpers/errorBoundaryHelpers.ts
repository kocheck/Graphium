/**
 * Error Boundary Test Helpers
 *
 * Utilities for testing error boundaries in E2E and integration tests.
 * These helpers make it easy to verify error boundaries catch errors correctly,
 * log appropriate information, and maintain application stability.
 *
 * **Note on Type Duplication:**
 * Interface definitions like ErrorWindow are duplicated within each page.evaluate()
 * block because the code inside evaluate() runs in the browser context and cannot
 * import types from Node.js modules. This duplication is intentional and necessary.
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
 * Test helper type matching ErrorInfo from src/window.d.ts
 * 
 * @see src/window.d.ts for canonical definition
 */
export type TestErrorContext = Record<string, unknown>;

export interface TestErrorInfo {
  tokenId?: string;
  overlayName?: string;
  error: string;
  timestamp: number;
  context?: TestErrorContext;
}

/**
 * Check if any token errors occurred
 *
 * @param page - Playwright Page object
 * @returns The last token error, or null if no errors
 */
export async function checkForTokenErrors(page: Page): Promise<TestErrorInfo | null> {
  return await page.evaluate(() => {
    // NOTE: Interface is redefined here because page.evaluate() runs in browser context
    // and cannot import types from Node.js. See src/window.d.ts for canonical definition.
    interface ErrorWindow extends Window {
      __LAST_TOKEN_ERROR__?: TestErrorInfo;
    }
    return (window as unknown as ErrorWindow).__LAST_TOKEN_ERROR__ || null;
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
    interface ErrorWindow extends Window {
      __LAST_OVERLAY_ERROR__?: TestErrorInfo;
    }
    return (window as unknown as ErrorWindow).__LAST_OVERLAY_ERROR__ || null;
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
    interface ErrorWindow extends Window {
      __LAST_ASSET_PROCESSING_ERROR__?: TestErrorInfo;
    }
    return (window as unknown as ErrorWindow).__LAST_ASSET_PROCESSING_ERROR__ || null;
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
    interface ErrorWindow extends Window {
      __OVERLAY_ERRORS__?: TestErrorInfo[];
    }
    return (window as unknown as ErrorWindow).__OVERLAY_ERRORS__ || [];
  });
}

/**
 * Get error history from the error boundary utilities
 *
 * @param page - Playwright Page object
 * @returns Array of error contexts
 */
export async function getErrorHistory(page: Page): Promise<unknown[]> {
  return await page.evaluate(() => {
    interface ErrorUtilsWindow extends Window {
      __ERROR_UTILS__?: {
        getErrorHistory: () => unknown[];
      };
    }
    const utils = (window as unknown as ErrorUtilsWindow).__ERROR_UTILS__;
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
    interface ErrorWindow extends Window {
      __LAST_TOKEN_ERROR__?: TestErrorInfo;
      __LAST_OVERLAY_ERROR__?: TestErrorInfo;
      __LAST_ASSET_PROCESSING_ERROR__?: TestErrorInfo;
      __OVERLAY_ERRORS__?: TestErrorInfo[];
      __ERROR_UTILS__?: {
        clearErrorHistory: () => void;
      };
    }
    const win = window as unknown as ErrorWindow;
    delete win.__LAST_TOKEN_ERROR__;
    delete win.__LAST_OVERLAY_ERROR__;
    delete win.__LAST_ASSET_PROCESSING_ERROR__;
    delete win.__OVERLAY_ERRORS__;

    const utils = win.__ERROR_UTILS__;
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
    interface ErrorUtilsWindow extends Window {
      __ERROR_UTILS__?: {
        addBreadcrumb: (action: string) => void;
      };
    }
    const utils = (window as unknown as ErrorUtilsWindow).__ERROR_UTILS__;
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
  return await page.evaluate(async (type) => {
    // NOTE: Interface is redefined here because page.evaluate() runs in browser context
    // and cannot import types from Node.js. See src/window.d.ts for canonical definition.
    interface ErrorWindow extends Window {
      __LAST_TOKEN_ERROR__?: TestErrorInfo;
      __LAST_OVERLAY_ERROR__?: TestErrorInfo;
      __LAST_ASSET_PROCESSING_ERROR__?: TestErrorInfo;
      __ERROR_UTILS__?: {
        exportErrorToClipboard: (context: TestErrorContext) => Promise<boolean>;
      };
    }
    
    const win = window as unknown as ErrorWindow;
    const utils = win.__ERROR_UTILS__;
    if (!utils) return false;

    let error: TestErrorInfo | undefined;
    switch (type) {
      case 'token':
        error = win.__LAST_TOKEN_ERROR__;
        break;
      case 'overlay':
        error = win.__LAST_OVERLAY_ERROR__;
        break;
      case 'asset':
        error = win.__LAST_ASSET_PROCESSING_ERROR__;
        break;
    }

    if (!error || !error.context) return false;

    // Await the promise to avoid Promise<Promise<boolean>> nesting
    return await utils.exportErrorToClipboard(error.context);
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
      interface TestErrorWindow extends Window {
        __TRIGGER_TEST_ERROR__?: {
          type: string;
          message: string;
          triggered: boolean;
        };
      }
      // Store error trigger in window for component to pick up
      (window as unknown as TestErrorWindow).__TRIGGER_TEST_ERROR__ = {
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
    interface ErrorWindow extends Window {
      __LAST_TOKEN_ERROR__?: TestErrorInfo;
      __LAST_OVERLAY_ERROR__?: TestErrorInfo;
      __LAST_ASSET_PROCESSING_ERROR__?: TestErrorInfo;
    }
    
    const win = window as unknown as ErrorWindow;
    let error: TestErrorInfo | undefined;
    switch (type) {
      case 'token':
        error = win.__LAST_TOKEN_ERROR__;
        break;
      case 'overlay':
        error = win.__LAST_OVERLAY_ERROR__;
        break;
      case 'asset':
        error = win.__LAST_ASSET_PROCESSING_ERROR__;
        break;
    }

    if (!error || !error.context) {
      return null;
    }

    const performance = (error.context as Record<string, unknown>).performance as {
      memory?: { used: number; total: number; limit: number };
      timing?: { loadTime: number; domReady: number };
    } | undefined;

    return performance || null;
  }, errorType);
}
