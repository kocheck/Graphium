# Auto-Updater Implementation

This document describes the auto-update functionality implemented for Graphium using `electron-updater`.

## Overview

The auto-updater allows Graphium to automatically detect, download, and install new releases published to the GitHub repository. Users can check for updates manually through the UI, download them in the background, and install with a simple restart.

## Architecture

### Components

1. **Main Process (`electron/autoUpdater.ts`)**
   - Configures `electron-updater` with GitHub Releases
   - Handles update events (checking, available, downloading, downloaded, error)
   - Provides IPC handlers for renderer process communication
   - Logs all update activity to production logs

2. **IPC Bridge (`electron/preload.ts`)**
   - Exposes secure API via `window.autoUpdater`
   - Provides methods: `checkForUpdates`, `downloadUpdate`, `quitAndInstall`, `getCurrentVersion`
   - Event listeners: `onUpdateAvailable`, `onDownloadProgress`, `onUpdateDownloaded`, etc.

3. **UI Component (`src/components/UpdateManager.tsx`)**
   - Modal dialog for update workflow
   - Shows current version, available version, download progress
   - Handles user interactions (check, download, install)
   - **Test Coverage:** `UpdateManager.test.tsx` (comprehensive unit tests)

4. **Error Boundary (`src/components/UpdateManagerErrorBoundary.tsx`)**
   - Wraps UpdateManager to catch rendering and update errors
   - Prevents update failures from crashing the application
   - Provides user-friendly error messages with retry option
   - Logs detailed error information for debugging
   - **Test Coverage:** `UpdateManagerErrorBoundary.test.tsx`

5. **Integration (`src/App.tsx`, `src/components/AboutModal.tsx`)**
   - "Check for Updates" button in About modal
   - Opens UpdateManager modal when clicked
   - Keyboard shortcut support (Escape to close)
   - Wrapped in error boundary for graceful error handling

## User Workflow

1. User presses `?` to open About modal
2. User clicks "Check for Updates" button
3. UpdateManager modal opens and checks GitHub Releases
4. If update available:
   - Shows new version number and release notes
   - User clicks "Download Update"
   - Progress bar shows download status
5. When download completes:
   - User clicks "Restart & Install"
   - App quits and installs new version

## Configuration

### electron-builder.json5

```json5
"publish": {
  "provider": "github",
  "owner": "kocheck",
  "repo": "Graphium"
}
```

This tells `electron-updater` where to look for releases.

### Dependencies

- `electron-updater` (^6.3.9): Auto-update library
- `electron-log` (^5.2.4): Production logging for debugging

## Development Mode

The auto-updater is **disabled in development mode** to prevent accidental updates while developing. The system detects development mode via:

```typescript
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
```

When running from source, the "Check for Updates" button will show "Development mode" message.

## Production Usage

### Publishing a Release

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Create a GitHub Release:**
   - Tag the release with a version number (e.g., `v0.5.4`)
   - Upload the built installers:
     - `Graphium-Mac-0.5.4-Installer.dmg` (macOS)
     - `Graphium-Windows-0.5.4-Setup.exe` (Windows)
     - `Graphium-Linux-0.5.4.AppImage` (Linux)

3. **electron-builder auto-generates:**
   - `latest-mac.yml` (macOS update metadata)
   - `latest.yml` (Windows update metadata)
   - `latest-linux.yml` (Linux update metadata)

4. **Upload these `.yml` files** to the GitHub Release

### Code Signing (Required for macOS)

For auto-update to work on macOS in production, the app **must be code-signed and notarized**:

```json5
// electron-builder.json5
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

Without code signing:
- macOS will block the installer
- Auto-update will fail with signature verification errors

## Testing

### Unit Tests

The auto-updater has comprehensive test coverage:

**UpdateManager.test.tsx** - Tests for the UI component:
- Rendering states (idle, checking, available, downloading, downloaded, error)
- User interactions (check, download, install, close)
- Event handling (update events, progress updates)
- Electron environment detection
- Keyboard shortcuts (Escape to close)
- Download progress formatting
- Error handling for all async operations

**UpdateManagerErrorBoundary.test.tsx** - Tests for the error boundary:
- Error catching and display
- Error reset functionality
- Console logging verification
- Component recovery after error
- Specific error type handling (network, IPC, signature)

Run tests with:
```bash
npm test UpdateManager
npm test UpdateManagerErrorBoundary
```

### Testing in Development

To test the update workflow without building:

1. Create a `dev-app-update.yml` file in the project root:
   ```yaml
   version: 0.5.4
   files:
     - url: Graphium-Mac-0.5.4-Installer.dmg
       sha512: ...
   path: Graphium-Mac-0.5.4-Installer.dmg
   sha512: ...
   releaseDate: '2026-01-05T00:00:00.000Z'
   ```

2. Set environment variable:
   ```bash
   export ELECTRON_UPDATER_ALLOW_PRERELEASE=true
   ```

3. The updater will read from the local file instead of GitHub

### Testing in Production

1. Build and sign the app
2. Create a test release on GitHub
3. Install the previous version
4. Open About modal → Check for Updates
5. Verify download progress works
6. Click "Restart & Install"
7. Verify app restarts with new version

## Event Flow

```
User clicks "Check for Updates"
  ↓
checkForUpdates() called
  ↓
autoUpdater.checkForUpdates() → GitHub API
  ↓
[If update available]
  ↓
onUpdateAvailable event → UI shows new version
  ↓
User clicks "Download Update"
  ↓
downloadUpdate() called
  ↓
autoUpdater.downloadUpdate() → Download from GitHub
  ↓
onDownloadProgress events → UI shows progress bar
  ↓
onUpdateDownloaded event → UI shows "Restart & Install"
  ↓
User clicks "Restart & Install"
  ↓
quitAndInstall() called
  ↓
autoUpdater.quitAndInstall() → App restarts
  ↓
[Update applied on restart]
```

## Security

- **Signature Verification:** `electron-updater` automatically verifies code signatures (when app is signed)
- **HTTPS Only:** All downloads are over HTTPS from GitHub
- **No Auto-Download:** `autoDownload: false` gives users control over when updates are downloaded
- **Sandboxed Renderer:** Update API is exposed via contextBridge, renderer cannot access Node.js directly

## Troubleshooting

### Updates Not Detected

1. Check that GitHub Release has the correct `.yml` files
2. Verify `electron-builder.json5` has correct `owner` and `repo`
3. Check production logs: `~/Library/Logs/Graphium/main.log` (macOS)

### Download Fails

1. Ensure GitHub Release assets are public
2. Check network connectivity
3. Look for errors in production logs

### Install Fails on macOS

1. Verify app is code-signed: `codesign -dv --verbose=4 Graphium.app`
2. Check notarization status
3. Ensure user has write permissions to `/Applications`

## File Locations

- **Main Process:** `electron/autoUpdater.ts`
- **Preload:** `electron/preload.ts` (line 180-247)
- **UI Component:** `src/components/UpdateManager.tsx`
- **Error Boundary:** `src/components/UpdateManagerErrorBoundary.tsx`
- **Tests:**
  - `src/components/UpdateManager.test.tsx` (UI component tests)
  - `src/components/UpdateManagerErrorBoundary.test.tsx` (error boundary tests)
- **Type Definitions:** `src/window.d.ts` (line 73-86)
- **Integration:** `src/App.tsx`, `src/components/AboutModal.tsx`
- **Configuration:** `electron-builder.json5` (line 17-21)
- **Dependencies:** `package.json` (line 31-33)
- **Design System:** `src/components/DesignSystemPlayground/playground-registry.tsx`

## Logs

Production logs are written to:
- **macOS:** `~/Library/Logs/Graphium/main.log`
- **Windows:** `%USERPROFILE%\AppData\Roaming\Graphium\logs\main.log`
- **Linux:** `~/.config/Graphium/logs/main.log`

All update events are logged with `[AutoUpdater]` prefix for easy filtering.

## Future Enhancements

Potential improvements:
1. **Automatic update checks** on app startup (currently manual only)
2. **Release notes display** in UpdateManager modal
3. **Update notifications** badge on About button when update available
4. **Background downloads** with notification when ready
5. **Staged rollouts** using GitHub Release pre-releases
6. **Delta updates** for faster downloads (large apps only)

## References

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
