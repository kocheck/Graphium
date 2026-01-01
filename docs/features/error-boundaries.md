# Error Boundaries in Graphium

This document explains how error boundaries are set up in the Graphium application and provides guidance for correct usage.

## Overview

Graphium uses a **privacy-focused, local-first error boundary** system that:

1. Catches JavaScript errors anywhere in the React component tree
2. Catches global errors and unhandled promise rejections
3. Catches main process errors in Electron
4. Sanitizes error information to remove PII (Personal Identifiable Information):
   - Usernames in file paths
   - Email addresses
   - IP addresses (IPv4 and IPv6)
   - UUIDs
   - API keys and tokens
   - Environment variables
5. Persists errors locally for later reporting
6. Provides users with a friendly error UI
7. Allows users to add optional context about what they were doing
8. Allows users to report errors via email with explicit consent

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  uncaughtException / unhandledRejection handlers       │  │
│  │           ↓ sanitized errors via IPC ↓                 │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Renderer Process                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Global Error Handlers (globalErrorHandler)     │  │
│  │  • window.onerror                                      │  │
│  │  • unhandledrejection                                  │  │
│  │  • main-process-error (IPC)                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                             │                                │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │              PrivacyErrorBoundary (React)              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │                    <App />                       │  │  │
│  │  │         (your application components)            │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                             │                                │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │              localStorage (error persistence)          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. PrivacyErrorBoundary (`src/components/PrivacyErrorBoundary.tsx`)

The main error boundary component that wraps the application.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Child components to wrap |
| `supportEmail` | `string` | `"support@example.com"` | Email address for error reports |

**Example Usage:**

```tsx
import PrivacyErrorBoundary from './components/PrivacyErrorBoundary';

<PrivacyErrorBoundary supportEmail="support@graphium.app">
  <App />
</PrivacyErrorBoundary>
```

**Protected Components:**

All components in the app are protected by PrivacyErrorBoundary, including:
- `SyncManager` - Multi-window state synchronization
- `CanvasManager` - Battlemap canvas rendering
- `Sidebar` - Token library and controls
- All other app components

If any component throws an error, PrivacyErrorBoundary catches it and displays a user-friendly error UI with sanitized stack traces.

### 2. Error Sanitizer (`src/utils/errorSanitizer.ts`)

Utility functions for sanitizing error data.

**Functions:**

#### `sanitizeStack(error: Error, username: string): SanitizedError`

Removes PII from error stack traces. Sanitizes:
- Usernames in file paths → `<USER>`
- Email addresses → `<EMAIL>`
- IPv4/IPv6 addresses → `<IP>`
- UUIDs → `<UUID>`
- Bearer tokens → `Bearer <TOKEN>`
- API keys → `<REDACTED>`
- Sensitive environment variables → `<ENV_VAR>`

```ts
const sanitized = sanitizeStack(error, 'johnsmith');
// "/Users/johnsmith/project/file.ts" becomes "/Users/<USER>/project/file.ts"
// "user@example.com" becomes "<EMAIL>"
// "192.168.1.1" becomes "<IP>"
```

#### `generateReportBody(sanitizedError: SanitizedError): string`

Generates a formatted error report with system information.

```ts
const report = generateReportBody(sanitizedError);
// Returns formatted report with app version, platform, timestamp, and stack trace
```

### 3. Global Error Handler (`src/utils/globalErrorHandler.ts`)

Catches errors outside React's component tree and persists them locally.

**Functions:**

#### `initGlobalErrorHandlers(): () => void`

Initializes global error listeners. Call once at app startup. Returns a cleanup function.

```ts
// In main.tsx
import { initGlobalErrorHandlers } from './utils/globalErrorHandler';
initGlobalErrorHandlers();
```

#### `getStoredErrors(): StoredError[]`

Retrieves all errors stored in localStorage.

#### `storeError(error: StoredError): void`

Manually stores an error (used internally).

#### `markErrorReported(errorId: string): void`

Marks an error as reported (useful for tracking).

#### `clearStoredErrors(): void`

Clears all stored errors.

#### `clearReportedErrors(): void`

Clears only errors that have been reported.

#### `getUnreportedErrorCount(): number`

Returns the count of errors not yet reported.

#### `captureError(error: Error, source?): Promise<StoredError | null>`

Manually capture and store an error (useful in try/catch blocks).

```ts
try {
  riskyOperation();
} catch (err) {
  captureError(err, 'global');
  // Error is sanitized and stored, but app continues
}
```

## IPC Handlers (Electron)

The error boundary uses two IPC handlers in the main process:

### `get-username`

Returns the system username for sanitization purposes.

```ts
// Main process (electron/main.ts)
ipcMain.handle('get-username', () => {
  return os.userInfo().username;
});
```

### `open-external`

Opens external URLs (mailto: or https: only) in the default application.

```ts
// Main process (electron/main.ts)
ipcMain.handle('open-external', async (_event, url: string) => {
  if (url.startsWith('mailto:') || url.startsWith('https:')) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});
```

### `save-error-report`

Saves an error report to a file using the native save dialog.

```ts
// Main process (electron/main.ts)
ipcMain.handle('save-error-report', async (_event, reportContent: string) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Error Report',
      defaultPath: `graphium-error-report-${Date.now()}.txt`,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return { success: false, reason: 'User canceled' };
    }

    await fs.writeFile(filePath, reportContent, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
});
```

## Preload API

The error reporting API is exposed via `contextBridge`:

```ts
// Available in renderer process
window.errorReporting.getUsername(): Promise<string>
window.errorReporting.openExternal(url: string): Promise<boolean>
window.errorReporting.saveToFile(reportContent: string): Promise<{ success: boolean; filePath?: string; reason?: string }>
```

## Setup Checklist

Ensure the following are in place for error boundaries to work correctly:

### 1. Main Process Setup (`electron/main.ts`)

- [x] Import `shell` from `electron`
- [x] Import `os` from `node:os`
- [x] Register `get-username` handler
- [x] Register `open-external` handler
- [x] Register `save-error-report` handler
- [ ] Add `get-username` IPC handler
- [ ] Add `open-external` IPC handler

```ts
import { shell } from 'electron';
import os from 'node:os';

// Inside app.whenReady()
ipcMain.handle('get-username', () => os.userInfo().username);

ipcMain.handle('open-external', async (_event, url: string) => {
  if (url.startsWith('mailto:') || url.startsWith('https:')) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});
```

### 2. Preload Script (`electron/preload.ts`)

- [ ] Expose `errorReporting` API via `contextBridge`

```ts
contextBridge.exposeInMainWorld('errorReporting', {
  getUsername: (): Promise<string> => ipcRenderer.invoke('get-username'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('open-external', url),
});
```

### 3. TypeScript Types (`electron/electron-env.d.ts`)

- [ ] Add `errorReporting` interface to `Window`

```ts
interface Window {
  ipcRenderer: import('electron').IpcRenderer;
  errorReporting: {
    getUsername: () => Promise<string>;
    openExternal: (url: string) => Promise<boolean>;
  };
}
```

### 4. Application Entry (`src/main.tsx`)

- [ ] Import `PrivacyErrorBoundary`
- [ ] Wrap `<App />` with the error boundary

```tsx
import PrivacyErrorBoundary from './components/PrivacyErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivacyErrorBoundary supportEmail="support@graphium.app">
      <App />
    </PrivacyErrorBoundary>
  </React.StrictMode>,
);
```

### 5. Vite Configuration (`vite.config.ts`)

- [ ] Define `__APP_VERSION__` for error reports

```ts
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // ...
});
```

## Testing Error Boundaries

The error boundary system includes comprehensive automated tests. Run them with:

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage
```

### Test Files

| File | Description |
|------|-------------|
| `src/utils/errorSanitizer.test.ts` | Unit tests for sanitization functions |
| `src/components/PrivacyErrorBoundary.test.tsx` | Component tests for error boundary |
| `src/test/setup.ts` | Test setup with mocks for Electron APIs |

### What's Tested

**errorSanitizer.test.ts:**
- Unix-style path sanitization (`/Users/username/...`)
- Linux home directory sanitization (`/home/username/...`)
- Windows-style path sanitization (`C:\Users\username\...`)
- Error message sanitization
- Edge cases (empty username, missing stack, special regex characters)
- Report body generation

**PrivacyErrorBoundary.test.tsx:**
- Normal rendering when no error occurs
- Error UI display when child throws
- Privacy notice display
- Copy & email button functionality
- Clipboard and mailto integration
- Graceful handling of IPC failures

### Manual Testing

Add a temporary error trigger in a component:

```tsx
function TestComponent() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('Test error for error boundary');
  }

  return (
    <button onClick={() => setShouldError(true)}>
      Trigger Error
    </button>
  );
}
```

### Verify Sanitization

Check that the error UI shows:
- `<USER>` instead of your actual username in file paths
- A formatted, scrollable stack trace
- "Copy Report & Email Support" button that works correctly

## Privacy Considerations

The error boundary is designed with privacy as a priority:

1. **No Automatic Reporting**: Errors are never sent automatically. Users must explicitly click "Copy Report & Email Support".

2. **PII Sanitization**: Usernames are scrubbed from all file paths in the error stack trace.

3. **Clipboard-Based Reporting**: The error report is copied to clipboard rather than placed in the mailto: URL body. This:
   - Avoids URL character limits that could crash the app
   - Gives users control to review before pasting
   - Prevents accidental exposure of sensitive data in URL logs

4. **Local-First**: No third-party telemetry services (Sentry, Bugsnag, etc.) are used.

## Nested Error Boundaries

For complex applications, you may want multiple error boundaries:

```tsx
<PrivacyErrorBoundary supportEmail="support@graphium.app">
  <Header />
  <PrivacyErrorBoundary supportEmail="support@graphium.app">
    <MainContent />
  </PrivacyErrorBoundary>
  <Footer />
</PrivacyErrorBoundary>
```

This allows parts of the UI to fail gracefully while keeping other parts functional.

## Limitations

Error boundaries do **NOT** catch errors in:

- Event handlers (use try/catch instead)
- Asynchronous code (setTimeout, requestAnimationFrame, etc.)
- Server-side rendering
- Errors thrown in the error boundary itself

For these cases, use traditional try/catch blocks and consider logging to console or a local error store.

## Components with Special Error Handling

### ResourceMonitor (`src/components/ResourceMonitor.tsx`)

The Resource Monitor is a performance diagnostics overlay that tracks FPS, memory usage, IPC metrics, and Web Worker activity. It includes extensive error handling to prevent crashes:

**Error-Prone Operations:**
- IPC method interception (modifies `window.ipcRenderer.send` and `.on`)
- Performance API access (`performance.memory`, Chrome/Edge only)
- JSON.stringify on IPC messages (may contain circular references)

**Error Handling Strategy:**
1. **Global Coverage**: Already wrapped in `PrivacyErrorBoundary` via `main.tsx`
2. **Method Guards**: Checks if IPC methods exist before interception
3. **Try-Catch Blocks**: Wraps all IPC operations to prevent breaking message passing
4. **Graceful Degradation**: If APIs unavailable, shows warning instead of crashing

**Example Safeguards:**
```typescript
// Check if IPC methods exist
if (typeof window.ipcRenderer.send !== 'function') {
  console.warn('[ResourceMonitor] IPC methods not available, skipping');
  return;
}

// Wrap metrics collection
try {
  const size = JSON.stringify(args).length;
  ipcBytesRef.current += size;
} catch (err) {
  // Don't break IPC if JSON.stringify fails
  console.warn('[ResourceMonitor] Failed to track IPC:', err);
}
```

**Why This Matters:**
- IPC interception could break core app functionality if not handled carefully
- Performance APIs may not exist in all browsers (Firefox doesn't support `performance.memory`)
- Circular references in IPC data would crash JSON.stringify

### AssetProcessingErrorBoundary (`src/components/AssetProcessingErrorBoundary.tsx`)

Wraps file upload and image processing operations to catch:
- Web Worker errors (async failures)
- Corrupt or unsupported file formats
- IPC storage failures

See `src/components/Canvas/CanvasManager.tsx` for usage example.

## Troubleshooting

### Error boundary not catching errors

1. Ensure the component throwing the error is a descendant of `PrivacyErrorBoundary`
2. Check that the error occurs during rendering, not in an event handler
3. Verify React StrictMode isn't causing double-rendering issues

### Username not being sanitized

1. Check that `get-username` IPC handler is registered in `app.whenReady()`
2. Verify preload script exposes `errorReporting.getUsername()`
3. Check browser console for any IPC errors

### Email button not working

1. Ensure `open-external` IPC handler is registered
2. Check that the URL starts with `mailto:` or `https:`
3. Verify a default email client is configured on the system
