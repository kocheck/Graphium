# Pull Request: Electron to Web Migration

## Title
Electron to Web Migration: Dual-Target Support with BroadcastChannel Sync

## Base Branch
`main` (or your default branch)

## Compare Branch
`claude/electron-to-web-migration-ja6rD`

## Summary

This PR completes the Electron-to-Web migration, enabling Graphium to run as both a desktop Electron app and a browser-based web application from a unified codebase. All features are now supported on both platforms, including the previously Electron-only World View mode.

## Key Changes

### 1. Storage Adapter Pattern
- **Added:** `IStorageService` interface for platform-agnostic storage API
- **Added:** `ElectronStorageService` - thin wrapper around existing IPC handlers
- **Added:** `WebStorageService` - IndexedDB + File System Access API implementation
- **Added:** Runtime platform detection with `getStorage()` singleton

**Files:**
- `src/services/IStorageService.ts` (new)
- `src/services/ElectronStorageService.ts` (new)
- `src/services/WebStorageService.ts` (new)
- `src/services/storage.ts` (new)

### 2. BroadcastChannel Cross-Tab Sync
- **Modified:** `SyncManager.tsx` to support both IPC (Electron) and BroadcastChannel (Web)
- Enables World View in new browser tab with real-time synchronization
- Maintains all existing delta-based optimization logic
- Automatic transport selection based on runtime platform

**Files:**
- `src/components/SyncManager.tsx` (modified)

### 3. Component Migration
- **Modified:** All components to use storage adapter instead of direct IPC
- **Modified:** `ThemeManager.tsx` for dual-platform theme persistence
- **Modified:** `AutoSaveManager.tsx` with platform feature detection
- **Modified:** `PrivacyErrorBoundary.tsx` with web fallback

**Files:**
- `src/App.tsx` (campaign save/load)
- `src/components/ThemeManager.tsx`
- `src/components/AutoSaveManager.tsx`
- `src/components/PrivacyErrorBoundary.tsx`
- `src/utils/AssetProcessor.ts`

### 4. World View Button
- **Added:** World View button to toolbar
- Platform detection: IPC for Electron, `window.open()` for Web
- Opens projector display in new window (Electron) or new tab (Web)

**Files:**
- `src/App.tsx` (toolbar button)

### 5. Web Build Configuration
- **Modified:** `vite.config.ts` for dual-target builds
- Mode-based configuration (`--mode web`) skips Electron plugin
- Separate output directory (`dist-web/`) for web builds
- **Added:** `build:web`, `dev:web`, `preview:web` npm scripts

**Files:**
- `vite.config.ts`
- `package.json`

### 6. GitHub Pages Deployment
- **Added:** Automated deployment workflow
- **Added:** Launch page with "Launch Web App" and "Download Desktop" options
- Deploys on push to main branch or manual trigger

**Files:**
- `.github/workflows/deploy-web.yml` (new)
- `public/launch.html` (new)

## Feature Parity Matrix

| Feature | Electron | Web |
|---------|----------|-----|
| Token Library (IndexedDB) | ✅ | ✅ |
| Campaign Save/Load (.graphium ZIP) | ✅ | ✅ |
| Auto-Save | ✅ | ✅ |
| World View (Projector) | ✅ (IPC) | ✅ (BroadcastChannel) |
| Real-time Sync | ✅ | ✅ |
| Fog of War | ✅ | ✅ |
| Theme Persistence | ✅ (electron-store) | ✅ (localStorage) |
| Asset Upload | ✅ | ✅ |
| Dungeon Generator | ✅ | ✅ |

## Technical Highlights

### Runtime Platform Detection
```typescript
const isElectron = Boolean(window.ipcRenderer);
const storage = getStorage(); // Returns appropriate implementation
```

### Delta-Based Sync (Preserved)
- Existing SyncManager optimization maintained
- Reduces bandwidth from 7.8 MB/s → 0.15 MB/s
- Works identically on both IPC and BroadcastChannel

### Privacy-First Architecture
- No external APIs or databases
- All data stored locally (electron-store or IndexedDB)
- Campaign files remain `.graphium` ZIP format on both platforms

## Testing

### Web Build
```bash
npm run build:web
npm run preview:web
```

### Testing BroadcastChannel Sync
1. Open web app: `http://localhost:4173`
2. Click "World View" button to open new tab
3. Verify real-time sync between Architect and World View

### Electron Build
```bash
npm run build
```

## Migration Approach

- ✅ Zero code duplication
- ✅ No breaking changes to Electron implementation
- ✅ All existing IPC handlers unchanged
- ✅ Backward compatible with existing `.graphium` campaign files

## Commits in this PR

1. `e1a4693` - Fix TypeScript compilation warnings
2. `753e635` - Migrate all components to use storage adapter pattern
3. `e832dd3` - Implement storage adapter pattern for Electron/Web dual-target
4. `f19794f` - Add web build configuration for GitHub Pages deployment
5. `7faec8e` - Add BroadcastChannel support for web World View sync
6. `97fd878` - Add World View button with dual-platform support
7. `0b694b0` - Add GitHub Pages deployment workflow and launch page

## Future Enhancements

- [ ] Progressive Web App (PWA) support
- [ ] Service Worker for offline functionality
- [ ] Launch page as default entry point (currently React app deploys directly)

## Related Documentation

- `MIGRATION_PLAN.md` - Comprehensive architecture document
- `MIGRATION_PLAN.md` (Addendum) - BroadcastChannel API design

---

**Testing Recommendation:** Before merging, test both Electron and Web builds to ensure feature parity. Special attention to World View sync on both platforms.

## How to Create This PR

### Option 1: Using GitHub CLI
```bash
gh pr create --title "Electron to Web Migration: Dual-Target Support with BroadcastChannel Sync" --body-file PR_SUMMARY.md
```

### Option 2: Using GitHub Web UI
1. Go to your GitHub repository
2. Click "Pull Requests" tab
3. Click "New Pull Request"
4. Select base branch (usually `main`)
5. Select compare branch: `claude/electron-to-web-migration-ja6rD`
6. Copy the content from this file into the PR description
7. Click "Create Pull Request"

### Option 3: Direct Link
Navigate to:
```
https://github.com/YOUR_USERNAME/Graphium/compare/main...claude/electron-to-web-migration-ja6rD
```
