# Error Boundaries in Hyle

This document explains how error boundaries are set up in the Hyle application and provides guidance for correct usage.

## Overview

Hyle uses a **privacy-focused error boundary** system that:

1. Catches JavaScript errors anywhere in the React component tree
2. Sanitizes error information to remove PII (Personal Identifiable Information)
3. Provides users with a friendly error UI
4. Allows users to report errors via email with explicit consent

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Application                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PrivacyErrorBoundary                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │                    <App />                       │  │  │
│  │  │         (your application components)            │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
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

<PrivacyErrorBoundary supportEmail="support@hyle.app">
  <App />
</PrivacyErrorBoundary>
```

### 2. Error Sanitizer (`src/utils/errorSanitizer.ts`)

Utility functions for sanitizing error data.

**Functions:**

#### `sanitizeStack(error: Error, username: string): SanitizedError`

Removes PII from error stack traces by replacing usernames with `<USER>`.

```ts
const sanitized = sanitizeStack(error, 'johnsmith');
// "/Users/johnsmith/project/file.ts" becomes "/Users/<USER>/project/file.ts"
```

#### `generateReportBody(sanitizedError: SanitizedError): string`

Generates a formatted error report with system information.

```ts
const report = generateReportBody(sanitizedError);
// Returns formatted report with app version, platform, timestamp, and stack trace
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

## Preload API

The error reporting API is exposed via `contextBridge`:

```ts
// Available in renderer process
window.errorReporting.getUsername(): Promise<string>
window.errorReporting.openExternal(url: string): Promise<boolean>
```

## Setup Checklist

Ensure the following are in place for error boundaries to work correctly:

### 1. Main Process Setup (`electron/main.ts`)

- [ ] Import `shell` from `electron`
- [ ] Import `os` from `node:os`
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
    <PrivacyErrorBoundary supportEmail="support@hyle.app">
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

To test that error boundaries are working correctly:

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
<PrivacyErrorBoundary supportEmail="support@hyle.app">
  <Header />
  <PrivacyErrorBoundary supportEmail="support@hyle.app">
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
