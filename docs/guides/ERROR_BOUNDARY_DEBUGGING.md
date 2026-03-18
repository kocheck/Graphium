# Error Boundary Debugging Guide

This guide explains how to use the enhanced error boundary system for debugging and testing.

## Overview

The error boundary system has been significantly enhanced with debugging capabilities that make it easier to:

- **Find and fix bugs** during development
- **Reproduce errors** reported by QA or users
- **Test error handling** in E2E tests
- **Track error context** including component state, user actions, and performance metrics

## Key Features

### 1. Dev Mode Visual Indicators

In development mode, error boundaries show visual indicators instead of silently hiding errors:

**TokenErrorBoundary:**

- Shows a red warning circle (⚠) where the broken token would be
- Click the circle to view full error details
- View stack traces, component props, and error context
- Copy error to clipboard for bug reports

**CanvasOverlayErrorBoundary:**

- Adds invisible test markers (visible in DOM inspector)
- Exposes error details to `window.__LAST_OVERLAY_ERROR__`

### 2. Comprehensive Error Context

Every error captured includes:

```typescript
{
  timestamp: number;                    // When error occurred
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  componentStack?: string;              // React component stack
  componentName?: string;               // Which error boundary caught it
  props?: Record<string, any>;          // Component props (sanitized)
  state?: Record<string, any>;          // Component state (sanitized)
  environment: {
    isDev: boolean;
    isTest: boolean;
    userAgent: string;
    url: string;
  };
  performance?: {
    memory?: {
      usedJSHeapSize: number;          // Memory usage in bytes
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    timing?: {
      loadTime: number;                 // Page load time in ms
      domReady: number;                 // DOM ready time in ms
    };
  };
  breadcrumbs?: string[];               // User actions leading to error
}
```

### 3. Breadcrumb Trail

Track user actions before an error occurs:

```typescript
// In your code
import { addBreadcrumb } from './utils/errorBoundaryUtils';

addBreadcrumb('User clicked create campaign button');
addBreadcrumb('User uploaded map image');
addBreadcrumb('User placed 5 tokens');
// If error occurs, breadcrumbs are included in error context
```

### 4. Test Helpers

E2E tests can check for errors and access full context:

```typescript
import {
  checkForTokenErrors,
  assertNoErrors,
  addBreadcrumb,
} from '../helpers/errorBoundaryHelpers';

test('should not have errors during normal use', async ({ page }) => {
  await createNewCampaign(page, 'Test Campaign');

  // Track actions
  await addBreadcrumb(page, 'Created campaign');

  // Perform actions...

  // Assert no errors occurred
  await assertNoErrors(page);
});
```

## Usage Examples

### Debugging a Token Rendering Error

**Scenario:** A token fails to render on the canvas.

**Steps:**

1. **Run in dev mode:** `npm run dev`

2. **Reproduce the error:** Place or move the token that causes the crash

3. **Visual indicator appears:** You'll see a red ⚠ circle where the token should be

4. **Click the indicator:** A modal opens with:
   - Error name and message
   - Full stack trace
   - React component stack
   - Token ID and data
   - Timestamp

5. **Copy error:** Click "Copy Error" to get formatted report

6. **Example error output:**

```
================================================================================
ERROR REPORT: TokenErrorBoundary
Timestamp: 2025-12-30T12:00:00.000Z
================================================================================

Error: TypeError
Message: Cannot read property 'src' of undefined

JavaScript Stack Trace:
TypeError: Cannot read property 'src' of undefined
    at URLImage (URLImage.tsx:45)
    at CanvasManager.tsx:1850
    ...

React Component Stack:
    at URLImage
    at TokenErrorBoundary
    at CanvasManager
    ...

Component State & Props:
Props:
{
  "tokenId": "token-abc123",
  "tokenData": {
    "id": "token-abc123",
    "x": 100,
    "y": 200,
    "src": undefined  // ← Found the problem!
  }
}

================================================================================
```

### Testing Error Boundaries

**Unit Test Example:**

```typescript
import { render } from '@testing-library/react';
import TokenErrorBoundary from './TokenErrorBoundary';

test('should catch token rendering errors', () => {
  const BrokenToken = () => {
    throw new Error('Test error');
  };

  const { container } = render(
    <TokenErrorBoundary tokenId="test-token">
      <BrokenToken />
    </TokenErrorBoundary>
  );

  // In production mode: renders nothing
  expect(container.firstChild).toBeNull();

  // In dev mode: check window for error
  expect((window as any).__LAST_TOKEN_ERROR__).toBeDefined();
});
```

**E2E Test Example:**

```typescript
import { test, expect } from '@playwright/test';
import { checkForTokenErrors } from '../helpers/errorBoundaryHelpers';

test('drawing tools should not cause errors', async ({ page }) => {
  await page.goto('/');
  await createNewCampaign(page, 'Test');

  // Use drawing tools
  await page.click('[data-testid="tool-marker"]');
  await drawOnCanvas(page);

  // Verify no errors
  const tokenError = await checkForTokenErrors(page);
  expect(tokenError).toBeNull();
});
```

### Debugging with Breadcrumbs

**Scenario:** An error occurs but you don't know what user actions caused it.

**Solution:** Add breadcrumbs throughout your code:

```typescript
// In your component
import { addBreadcrumb } from '../utils/errorBoundaryUtils';

function handleMapUpload(file: File) {
  addBreadcrumb(`User uploaded map: ${file.name}`);

  // Process file...
  addBreadcrumb('Starting image processing');

  processImage(file).then(() => {
    addBreadcrumb('Image processing complete');
  });
}

function handleTokenPlace(x: number, y: number) {
  addBreadcrumb(`User placed token at (${x}, ${y})`);
  // ... rest of logic
}
```

**When error occurs, console shows:**

```
User Actions (Breadcrumbs):
  [2025-12-30T12:00:00.000Z] User uploaded map: dungeon.webp
  [2025-12-30T12:00:01.000Z] Starting image processing
  [2025-12-30T12:00:03.000Z] Image processing complete
  [2025-12-30T12:00:05.000Z] User placed token at (150, 200)
  [2025-12-30T12:00:06.000Z] User placed token at (300, 400)  ← Error!
```

### Accessing Error History

**In Browser Console:**

```javascript
// Get all errors
const history = window.__ERROR_UTILS__.getErrorHistory();
console.log(history);

// Export last error to clipboard
const utils = window.__ERROR_UTILS__;
const lastError = history[history.length - 1];
utils.exportErrorToClipboard(lastError);
```

**In E2E Tests:**

```typescript
import { getErrorHistory } from '../helpers/errorBoundaryHelpers';

test('should track error history', async ({ page }) => {
  // ... perform actions ...

  const history = await getErrorHistory(page);
  console.log('Error history:', history);

  // Verify specific error occurred
  expect(history.some((e) => e.error.message.includes('specific error'))).toBe(true);
});
```

## Window Variables (Dev/Test Mode Only)

These variables are exposed on `window` for debugging:

| Variable                          | Type          | Description               |
| --------------------------------- | ------------- | ------------------------- |
| `__GAME_STORE__`                  | Zustand Store | Access game state         |
| `__ERROR_UTILS__`                 | Object        | Error utility functions   |
| `__LAST_TOKEN_ERROR__`            | ErrorInfo     | Most recent token error   |
| `__LAST_OVERLAY_ERROR__`          | ErrorInfo     | Most recent overlay error |
| `__LAST_ASSET_PROCESSING_ERROR__` | ErrorInfo     | Most recent asset error   |
| `__OVERLAY_ERRORS__`              | ErrorInfo[]   | Last 10 overlay errors    |

## Error Utility Functions

Available via `window.__ERROR_UTILS__`:

```typescript
interface ErrorUtils {
  // Get all captured errors
  getErrorHistory(): ErrorContext[];

  // Clear error history
  clearErrorHistory(): void;

  // Add user action breadcrumb
  addBreadcrumb(action: string): void;

  // Export error to clipboard
  exportErrorToClipboard(context: ErrorContext): Promise<boolean>;

  // Format error as human-readable report
  formatErrorReport(context: ErrorContext): string;
}
```

## Performance Monitoring

Error context includes performance metrics:

```typescript
// Access memory usage at time of error
const error = window.__LAST_TOKEN_ERROR__;
const memory = error.context.performance?.memory;

if (memory) {
  console.log(`Memory at error time:`);
  console.log(`  Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Usage: ${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}%`);
}
```

## Best Practices

### 1. Add Breadcrumbs Strategically

✅ **DO:**

```typescript
addBreadcrumb('User clicked save button');
addBreadcrumb('Uploading 5 token images');
addBreadcrumb('Processing map image: 2048x2048px');
```

❌ **DON'T:**

```typescript
addBreadcrumb('Mouse moved'); // Too frequent
addBreadcrumb('Render'); // Too verbose
```

### 2. Use Breadcrumbs Before Risky Operations

```typescript
async function uploadLargeFile(file: File) {
  addBreadcrumb(`Uploading large file: ${file.name} (${file.size} bytes)`);

  try {
    await processFile(file);
  } catch (error) {
    // Error context will include breadcrumb
    throw error;
  }
}
```

### 3. Clear Errors Between Tests

```typescript
test.beforeEach(async ({ page }) => {
  await clearAllErrors(page);
});
```

### 4. Check for Unexpected Errors

```typescript
test.afterEach(async ({ page }) => {
  // Fail test if unexpected errors occurred
  const hasErrors = await page.evaluate(() => {
    return !!((window as any).__LAST_TOKEN_ERROR__ || (window as any).__LAST_OVERLAY_ERROR__);
  });

  if (hasErrors) {
    const tokenError = await checkForTokenErrors(page);
    const overlayError = await checkForOverlayErrors(page);
    throw new Error(`Unexpected errors: ${JSON.stringify({ tokenError, overlayError })}`);
  }
});
```

## Troubleshooting

### Error indicators not showing in dev mode

**Check:**

1. Are you in dev mode? (`npm run dev`)
2. Is `import.meta.env.DEV` true?
3. Check browser console for any errors loading error boundary utils

### Window variables not available

**Check:**

1. In dev/test mode? Production mode doesn't expose these
2. Page fully loaded? Variables are set after imports
3. Check console for import errors

### Breadcrumbs not appearing

**Check:**

1. Importing from correct path: `'../utils/errorBoundaryUtils'`
2. Called before error occurs
3. Error boundary actually caught an error

### E2E test helpers not working

**Check:**

1. Imported correct helpers: `'../helpers/errorBoundaryHelpers'`
2. Page is on the application (not landing page)
3. Test mode enabled: `import.meta.env.MODE === 'test'`

## Migration Guide

### Updating Existing Error Boundaries

**Before:**

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  console.error('Error:', error);
}
```

**After:**

```typescript
import { captureErrorContext, logErrorWithContext } from '../utils/errorBoundaryUtils';

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  const context = captureErrorContext(error, errorInfo, {
    componentName: 'MyBoundary',
    props: this.props,
    state: this.state,
  });

  logErrorWithContext(context);
}
```

### Adding Breadcrumbs to Existing Code

Identify critical user actions and add breadcrumbs:

```typescript
// File uploads
handleFileUpload(file: File) {
  addBreadcrumb(`File upload started: ${file.name}`);
  // ... existing code
}

// State changes
updateGameState(newState: GameState) {
  addBreadcrumb('Game state updated');
  // ... existing code
}

// User interactions
handleToolChange(tool: Tool) {
  addBreadcrumb(`Tool changed to: ${tool}`);
  // ... existing code
}
```

## Summary

The enhanced error boundary system provides:

✅ **Visual debugging** in dev mode
✅ **Comprehensive error context** with performance metrics
✅ **Breadcrumb tracking** for user actions
✅ **E2E test integration** for automated testing
✅ **Easy bug reproduction** with full error reports
✅ **Production safety** with sanitized logging

Use these tools to:

- Debug errors faster
- Write better tests
- Create detailed bug reports
- Monitor application health
- Improve error handling

Happy debugging! 🐛🔨
