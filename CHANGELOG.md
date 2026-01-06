# Changelog

All notable changes to Graphium will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Auto-Update System**: Seamless updates from GitHub Releases
  - Check for updates via About modal (`?` keyboard shortcut)
  - Download progress indicator with speed and percentage
  - One-click "Restart & Install" when update is ready
  - Comprehensive error handling with user-friendly messages
  - Error boundary protection prevents update failures from crashing app
  - Full test coverage (708 lines of tests)
  - Production logging for debugging update issues
  - Disabled in development mode to prevent accidental updates
  - Requires code signing for macOS production builds

### Technical Details
- Added `electron-updater` ^6.3.9 for update management
- Added `electron-log` ^5.2.4 for production logging
- New components:
  - `UpdateManager.tsx`: Update UI modal (329 lines)
  - `UpdateManagerErrorBoundary.tsx`: Error protection (152 lines)
  - `electron/autoUpdater.ts`: Main process logic (233 lines)
- IPC bridge in `electron/preload.ts` for secure communication
- Type definitions in `src/window.d.ts` for `window.autoUpdater` API
- Integrated in `src/App.tsx` with error boundary wrapping
- "Check for Updates" button added to About modal
- Design system documentation in playground
- Comprehensive documentation in `AUTO_UPDATER.md`

### Security
- Signature verification (when app is code-signed)
- HTTPS-only downloads from GitHub
- No auto-download - user controls update installation
- Sandboxed renderer access via contextBridge

## [0.5.3] - 2025-01-05

### Fixed
- Logo not appearing in Mac production builds (#223)

## [0.5.2] - Previous Release

(Add previous releases as needed)

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements
