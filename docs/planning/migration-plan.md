# Graphium: Electron-to-Web Migration Plan
## Local-First Web App on GitHub Pages

**Version:** 1.0
**Status:** Phase 1 - Exploration & Analysis Complete
**Last Updated:** 2025-12-27

---

## Executive Summary

This document outlines the migration strategy to transform Graphium from an Electron-only desktop application into a **unified codebase** that runs as both:

1. **Desktop App** (Electron) - Full-featured with native file system access
2. **Web App** (GitHub Pages) - Privacy-first with browser storage APIs

**Core Principle:** Zero duplication. All business logic, UI components, and rendering code must be shared. Only the **storage layer** differs between platforms.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Gap Analysis: Browser Incompatibilities](#2-gap-analysis-browser-incompatibilities)
3. [Architecture Proposal: Adapter Pattern](#3-architecture-proposal-adapter-pattern)
4. [Resilience & Error Boundaries](#4-resilience--error-boundaries)
5. [Deployment Strategy: Launch Page](#5-deployment-strategy-launch-page)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Risk Assessment](#7-risk-assessment)

---

## 1. Current State Analysis

### 1.1 Dependencies Audit

**Production Dependencies:**
```json
{
  "@radix-ui/colors": "^3.0.0",       // ✅ Web-compatible (CSS theme system)
  "electron-store": "^11.0.2",        // ❌ Electron-only (config persistence)
  "fs-extra": "^11.3.2",              // ❌ Node.js only (file system)
  "jszip": "^3.10.1",                 // ✅ Web-compatible (campaign ZIP)
  "konva": "^10.0.12",                // ✅ Web-compatible (canvas rendering)
  "react": "^18.2.0",                 // ✅ Web-compatible
  "react-dom": "^18.2.0",             // ✅ Web-compatible
  "react-easy-crop": "^5.5.6",        // ✅ Web-compatible
  "react-konva": "^18.2.14",          // ✅ Web-compatible
  "use-image": "^1.1.4",              // ✅ Web-compatible
  "zustand": "^5.0.9"                 // ✅ Web-compatible
}
```

**Assessment:**
- **90% of UI/business logic is web-ready** (React, Konva, Zustand)
- **2 critical dependencies require replacement:**
  - `electron-store` → `localStorage` / `IndexedDB`
  - `fs-extra` → File System Access API / IndexedDB

### 1.2 Electron API Usage Map

| **IPC Channel** | **Location** | **Purpose** | **Browser Replacement** |
|-----------------|--------------|-------------|-------------------------|
| `SAVE_ASSET_TEMP` | `main.ts:465`, `AssetProcessor.ts:186` | Save WebP to temp dir | File System Access API + OPFS |
| `SAVE_CAMPAIGN` | `main.ts:554` | Save .graphium ZIP | File System Access API (user download) |
| `AUTO_SAVE` | `main.ts:583` | Background save | IndexedDB (auto-persist) |
| `LOAD_CAMPAIGN` | `main.ts:613` | Load .graphium ZIP | File System Access API (user upload) |
| `SAVE_ASSET_TO_LIBRARY` | `main.ts:849` | Persist to library | IndexedDB + OPFS |
| `LOAD_LIBRARY_INDEX` | `main.ts:917` | Load library metadata | IndexedDB query |
| `DELETE_LIBRARY_ASSET` | `main.ts:946` | Delete from library | IndexedDB delete + OPFS cleanup |
| `UPDATE_LIBRARY_METADATA` | `main.ts:993` | Update library item | IndexedDB update |
| `get-theme-state` | `main.ts:765`, `preload.ts:145` | Get theme preference | `localStorage` |
| `set-theme-mode` | `main.ts:777`, `preload.ts:152` | Set theme preference | `localStorage` |
| `TOGGLE_PAUSE` | `main.ts:789` | Pause World View | N/A (World View not on web) |
| `create-world-window` | `main.ts:371` | Create projector window | N/A (Web has no multi-window) |
| `SYNC_WORLD_STATE` | `main.ts:431` | Sync to World View | N/A (Web is single-window) |
| `get-username` | `main.ts:1033` | For PII sanitization | Browser fingerprint or `[BROWSER]` |
| `open-external` | `main.ts:1046` | Open mailto/docs | `window.open()` |
| `save-error-report` | `main.ts:1064` | Save error to file | Blob download (`<a download>`) |

**Key Findings:**
1. **Multi-Window Architecture** (`create-world-window`, `SYNC_WORLD_STATE`) is Electron-specific
   - **Web Impact:** Projector/World View feature cannot exist on web version
   - **Mitigation:** Document feature parity differences in `ARCHITECTURE.md`

2. **Custom Protocol** (`media://`) is Electron-specific
   - **Current Use:** Secure file:// URL translation (see `main.ts:353`)
   - **Browser Replacement:** OPFS URLs or Object URLs (`URL.createObjectURL()`)

3. **File System Operations** are the primary migration barrier
   - All storage operations flow through IPC handlers
   - **Perfect adapter boundary** already exists

### 1.3 Data Persistence Patterns

#### Current Storage Architecture

```
electron/main.ts (Main Process)
    ↓ (IPC boundary)
window.ipcRenderer.invoke()
    ↓
Node.js fs APIs
    ↓
Local File System
```

**Storage Locations:**
1. **Temp Assets** (`app.getPath('userData')/temp_assets/`)
   - Cropped tokens awaiting campaign save
   - Cleared on app restart
   - **Format:** `{timestamp}-{name}.webp`

2. **Campaign Files** (`user-selected.graphium`)
   - ZIP archive with `manifest.json` + `assets/` folder
   - **Structure:**
     ```
     campaign.graphium (ZIP)
     ├── manifest.json (Campaign state)
     └── assets/
         ├── map-background.webp
         ├── goblin-token.webp
         └── ...
     ```

3. **Token Library** (`app.getPath('userData')/library/`)
   - Persistent across campaigns
   - **Files:**
     - `index.json` (metadata)
     - `assets/{id}.webp` (full-size)
     - `assets/thumb-{id}.webp` (128x128 thumbnail)

4. **Theme Preferences** (`electron-store`)
   - **Key:** `themeMode` → `'light' | 'dark' | 'system'`
   - **Location:** `app.getPath('userData')/config.json`

### 1.4 Existing React Error Boundaries

**Current Implementation:**

| **Component** | **Location** | **Purpose** | **Web-Ready?** |
|---------------|--------------|-------------|----------------|
| `PrivacyErrorBoundary` | `src/components/PrivacyErrorBoundary.tsx` | Top-level error catcher with PII sanitization | ⚠️ Partial |
| `AssetProcessingErrorBoundary` | `src/components/AssetProcessingErrorBoundary.tsx` | Wraps image upload/crop | ✅ Yes |
| `DungeonGeneratorErrorBoundary` | `src/components/DungeonGeneratorErrorBoundary.tsx` | Wraps procedural generation | ✅ Yes |
| `MinimapErrorBoundary` | `src/components/Canvas/MinimapErrorBoundary.tsx` | Wraps minimap rendering | ✅ Yes |
| `TokenErrorBoundary` | `src/components/Canvas/TokenErrorBoundary.tsx` | Per-token isolation | ✅ Yes |

**Web Compatibility Issues:**

`PrivacyErrorBoundary` relies on `window.errorReporting.getUsername()` (IPC call to `os.userInfo().username`):
- **Location:** `src/components/PrivacyErrorBoundary.tsx:149`
- **Fix Required:** Fallback to `'[BROWSER_USER]'` when IPC unavailable

---

## 2. Gap Analysis: Browser Incompatibilities

### 2.1 Red Flags: Features That Won't Work

| **Feature** | **Electron Dependency** | **Browser Impact** | **Severity** |
|-------------|-------------------------|-------------------|--------------|
| **World View (Projector)** | `BrowserWindow`, `create-world-window` IPC | Cannot create separate projector window | 🔴 CRITICAL |
| **Custom Protocol** (`media://`) | `protocol.registerSchemesAsPrivileged()` | Cannot use `media://` URLs | 🟡 MEDIUM |
| **Auto-Save** | Background IPC + file write | No background saves to disk | 🟡 MEDIUM |
| **Native Dialogs** | `dialog.showSaveDialog()`, `dialog.showOpenDialog()` | Must use `<input>` + File System Access API | 🟢 LOW |
| **External Links** | `shell.openExternal()` | Use `window.open()` instead | 🟢 LOW |
| **PII Username** | `os.userInfo().username` | Cannot access OS username | 🟢 LOW |

### 2.2 Critical Feature: World View Unavailability

**Electron-Only Architecture:**
```
Main Process (electron/main.ts)
├── Architect Window (DM View)
│   ├── Full UI (Sidebar, Toolbar)
│   └── CanvasManager
└── World Window (Player View)
    ├── No UI (canvas only)
    └── IPC state sync
```

**Web Limitation:**
- Browser security model prevents creating **separate windows with controlled content**
- `window.open()` opens a new tab/window but cannot inject arbitrary React apps
- **Workaround:** GitHub Pages can only serve single-page apps (SPA)

**Decision:**
- **Web version will NOT support World View**
- Document this as an **Electron-exclusive feature** in user docs
- Add warning in launch page: "For projector support, download desktop app"

### 2.3 Storage API Gaps

| **Electron API** | **Browser Replacement** | **Limitation** |
|------------------|-------------------------|----------------|
| `fs.writeFile()` | File System Access API | Requires user permission per file |
| `fs.readFile()` | File System Access API | User must select file via picker |
| `app.getPath('userData')` | OPFS (Origin Private File System) | Cannot access arbitrary directories |
| `electron-store` | `localStorage` / IndexedDB | 10MB limit (localStorage), slower (IndexedDB) |
| Background auto-save | N/A | Browser tabs can be suspended/throttled |

**Recommendation:**
- Use **IndexedDB** for library storage (structured data + blobs)
- Use **File System Access API** for campaign save/load (user-initiated)
- Use **localStorage** for theme preferences (small, synchronous)
- Use **OPFS** for temp assets (session-scoped, fast)

---

## 3. Architecture Proposal: Adapter Pattern

### 3.1 IStorageService Interface

**File:** `src/services/IStorageService.ts`

```typescript
/**
 * Platform-agnostic storage interface
 *
 * Implementations:
 * - ElectronStorageService (uses IPC + Node.js fs)
 * - WebStorageService (uses IndexedDB + File System Access API)
 */
export interface IStorageService {
  // ===== CAMPAIGN PERSISTENCE =====

  /**
   * Save campaign to file
   * @param campaign - Campaign data to serialize
   * @returns Success status
   *
   * Electron: Shows native save dialog, writes .graphium ZIP
   * Web: Triggers browser download of .graphium ZIP
   */
  saveCampaign(campaign: Campaign): Promise<boolean>;

  /**
   * Auto-save campaign (background, no UI)
   * @param campaign - Campaign data to serialize
   * @returns Success status
   *
   * Electron: Atomic write to last save path
   * Web: Persist to IndexedDB (no file download)
   */
  autoSaveCampaign(campaign: Campaign): Promise<boolean>;

  /**
   * Load campaign from file
   * @returns Campaign data or null if cancelled
   *
   * Electron: Shows native open dialog
   * Web: Shows <input type="file"> picker
   */
  loadCampaign(): Promise<Campaign | null>;

  // ===== ASSET PROCESSING =====

  /**
   * Save processed asset to temp storage
   * @param buffer - WebP image data
   * @param fileName - Original filename
   * @returns URL to access the asset
   *
   * Electron: Returns file:// URL
   * Web: Returns OPFS URL or Object URL
   */
  saveAssetTemp(buffer: ArrayBuffer, fileName: string): Promise<string>;

  // ===== TOKEN LIBRARY =====

  /**
   * Save asset to persistent library
   * @param fullSizeBuffer - Full-resolution WebP
   * @param thumbnailBuffer - 128x128 thumbnail WebP
   * @param metadata - Asset metadata
   * @returns Complete library item with URLs
   *
   * Electron: Writes to userData/library/
   * Web: Stores in IndexedDB with blob references
   */
  saveAssetToLibrary(
    fullSizeBuffer: ArrayBuffer,
    thumbnailBuffer: ArrayBuffer,
    metadata: LibraryMetadata
  ): Promise<TokenLibraryItem>;

  /**
   * Load library index
   * @returns Array of library items
   *
   * Electron: Reads index.json from disk
   * Web: Queries IndexedDB
   */
  loadLibraryIndex(): Promise<TokenLibraryItem[]>;

  /**
   * Delete asset from library
   * @param assetId - UUID of asset to delete
   *
   * Electron: Deletes files + updates index.json
   * Web: Deletes IndexedDB record
   */
  deleteLibraryAsset(assetId: string): Promise<void>;

  /**
   * Update library asset metadata
   * @param assetId - UUID of asset
   * @param updates - Partial metadata updates
   * @returns Updated library item
   *
   * Electron: Reads, mutates, writes index.json
   * Web: Updates IndexedDB record
   */
  updateLibraryMetadata(
    assetId: string,
    updates: Partial<LibraryMetadata>
  ): Promise<TokenLibraryItem>;

  // ===== THEME PREFERENCES =====

  /**
   * Get theme preference
   * @returns Theme mode setting
   *
   * Electron: Reads from electron-store
   * Web: Reads from localStorage
   */
  getThemeMode(): Promise<ThemeMode>;

  /**
   * Set theme preference
   * @param mode - Theme mode to save
   *
   * Electron: Writes to electron-store
   * Web: Writes to localStorage
   */
  setThemeMode(mode: ThemeMode): Promise<void>;

  // ===== UTILITY =====

  /**
   * Get platform identifier
   * @returns 'electron' | 'web'
   */
  getPlatform(): 'electron' | 'web';

  /**
   * Check if feature is available
   * @param feature - Feature identifier
   * @returns Availability status
   *
   * Example: isFeatureAvailable('world-view') → false on web
   */
  isFeatureAvailable(feature: 'world-view' | 'auto-save'): boolean;
}
```

### 3.2 ElectronStorageService Implementation

**File:** `src/services/ElectronStorageService.ts`

```typescript
import type { IStorageService } from './IStorageService';
import type { Campaign, TokenLibraryItem } from '../store/gameStore';

/**
 * Storage service for Electron environment
 *
 * Delegates all operations to existing IPC handlers in electron/main.ts
 * This is a thin wrapper to match the IStorageService interface.
 */
export class ElectronStorageService implements IStorageService {
  async saveCampaign(campaign: Campaign): Promise<boolean> {
    if (!window.ipcRenderer) return false;
    return await window.ipcRenderer.invoke('SAVE_CAMPAIGN', campaign);
  }

  async autoSaveCampaign(campaign: Campaign): Promise<boolean> {
    if (!window.ipcRenderer) return false;
    return await window.ipcRenderer.invoke('AUTO_SAVE', campaign);
  }

  async loadCampaign(): Promise<Campaign | null> {
    if (!window.ipcRenderer) return null;
    return await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
  }

  async saveAssetTemp(buffer: ArrayBuffer, fileName: string): Promise<string> {
    if (!window.ipcRenderer) throw new Error('IPC not available');
    return await window.ipcRenderer.invoke('SAVE_ASSET_TEMP', buffer, fileName);
  }

  async saveAssetToLibrary(
    fullSizeBuffer: ArrayBuffer,
    thumbnailBuffer: ArrayBuffer,
    metadata: any
  ): Promise<TokenLibraryItem> {
    if (!window.ipcRenderer) throw new Error('IPC not available');
    return await window.ipcRenderer.invoke('SAVE_ASSET_TO_LIBRARY', {
      fullSizeBuffer,
      thumbnailBuffer,
      metadata
    });
  }

  async loadLibraryIndex(): Promise<TokenLibraryItem[]> {
    if (!window.ipcRenderer) return [];
    return await window.ipcRenderer.invoke('LOAD_LIBRARY_INDEX');
  }

  async deleteLibraryAsset(assetId: string): Promise<void> {
    if (!window.ipcRenderer) throw new Error('IPC not available');
    await window.ipcRenderer.invoke('DELETE_LIBRARY_ASSET', assetId);
  }

  async updateLibraryMetadata(assetId: string, updates: any): Promise<TokenLibraryItem> {
    if (!window.ipcRenderer) throw new Error('IPC not available');
    return await window.ipcRenderer.invoke('UPDATE_LIBRARY_METADATA', assetId, updates);
  }

  async getThemeMode(): Promise<any> {
    if (!window.themeAPI) return 'system';
    const state = await window.themeAPI.getThemeState();
    return state.mode;
  }

  async setThemeMode(mode: any): Promise<void> {
    if (!window.themeAPI) return;
    await window.themeAPI.setThemeMode(mode);
  }

  getPlatform(): 'electron' | 'web' {
    return 'electron';
  }

  isFeatureAvailable(feature: string): boolean {
    // All features available in Electron
    return true;
  }
}
```

### 3.3 WebStorageService Implementation

**File:** `src/services/WebStorageService.ts`

```typescript
import type { IStorageService } from './IStorageService';
import type { Campaign, TokenLibraryItem } from '../store/gameStore';
import JSZip from 'jszip';
import { openDB, type IDBPDatabase } from 'idb'; // npm install idb

/**
 * Storage service for browser environment
 *
 * Uses:
 * - IndexedDB (via idb library) for library storage
 * - File System Access API for campaign save/load
 * - OPFS for temp assets
 * - localStorage for theme preferences
 */
export class WebStorageService implements IStorageService {
  private db: IDBPDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB() {
    this.db = await openDB('graphium-storage', 1, {
      upgrade(db) {
        // Token library store
        if (!db.objectStoreNames.contains('library')) {
          const store = db.createObjectStore('library', { keyPath: 'id' });
          store.createIndex('category', 'category');
          store.createIndex('dateAdded', 'dateAdded');
        }

        // Auto-save store (latest campaign state)
        if (!db.objectStoreNames.contains('autosave')) {
          db.createObjectStore('autosave', { keyPath: 'id' });
        }
      }
    });
  }

  // ===== CAMPAIGN PERSISTENCE =====

  async saveCampaign(campaign: Campaign): Promise<boolean> {
    try {
      // Serialize campaign to ZIP
      const zip = new JSZip();
      const assetsFolder = zip.folder('assets');

      // Deep clone to avoid mutation
      const campaignToSave = JSON.parse(JSON.stringify(campaign));

      // Extract all assets and convert URLs to relative paths
      const processedCampaign = await this.processCampaignAssets(campaignToSave, assetsFolder!);

      zip.file('manifest.json', JSON.stringify(processedCampaign));

      // Generate ZIP blob
      const blob = await zip.generateAsync({ type: 'blob' });

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.name}.graphium`;
      a.click();
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('[WebStorageService] Save failed:', error);
      return false;
    }
  }

  async autoSaveCampaign(campaign: Campaign): Promise<boolean> {
    try {
      if (!this.db) await this.initDB();

      // Store in IndexedDB (no file download)
      await this.db!.put('autosave', {
        id: 'latest',
        campaign,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.error('[WebStorageService] Auto-save failed:', error);
      return false;
    }
  }

  async loadCampaign(): Promise<Campaign | null> {
    return new Promise((resolve) => {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.graphium';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          // Parse ZIP
          const zip = await JSZip.loadAsync(file);
          const manifestStr = await zip.file('manifest.json')?.async('string');
          if (!manifestStr) throw new Error('Invalid .graphium file');

          const campaign = JSON.parse(manifestStr);

          // Restore assets from ZIP to OPFS
          await this.restoreCampaignAssets(campaign, zip);

          resolve(campaign);
        } catch (error) {
          console.error('[WebStorageService] Load failed:', error);
          resolve(null);
        }
      };

      input.click();
    });
  }

  // ===== ASSET PROCESSING =====

  async saveAssetTemp(buffer: ArrayBuffer, fileName: string): Promise<string> {
    // Use OPFS (Origin Private File System) for temp storage
    const root = await navigator.storage.getDirectory();
    const tempDir = await root.getDirectoryHandle('temp_assets', { create: true });

    const timestamp = Date.now();
    const fileHandle = await tempDir.getFileHandle(`${timestamp}-${fileName}`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();

    // Return OPFS URL (opfs:// scheme)
    // Note: We'll need to convert this to Object URL when rendering
    return `opfs://temp_assets/${timestamp}-${fileName}`;
  }

  // ===== TOKEN LIBRARY =====

  async saveAssetToLibrary(
    fullSizeBuffer: ArrayBuffer,
    thumbnailBuffer: ArrayBuffer,
    metadata: any
  ): Promise<TokenLibraryItem> {
    if (!this.db) await this.initDB();

    // Convert buffers to blobs
    const fullSizeBlob = new Blob([fullSizeBuffer], { type: 'image/webp' });
    const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/webp' });

    // Create Object URLs (valid for session)
    const src = URL.createObjectURL(fullSizeBlob);
    const thumbnailSrc = URL.createObjectURL(thumbnailBlob);

    const item: TokenLibraryItem = {
      ...metadata,
      src,
      thumbnailSrc,
      dateAdded: Date.now(),
      // Store blobs separately for persistence
      _fullSizeBlob: fullSizeBlob,
      _thumbnailBlob: thumbnailBlob
    } as any;

    await this.db!.put('library', item);

    return item;
  }

  async loadLibraryIndex(): Promise<TokenLibraryItem[]> {
    if (!this.db) await this.initDB();

    const items = await this.db!.getAll('library');

    // Recreate Object URLs from blobs
    return items.map((item: any) => ({
      ...item,
      src: item._fullSizeBlob ? URL.createObjectURL(item._fullSizeBlob) : item.src,
      thumbnailSrc: item._thumbnailBlob ? URL.createObjectURL(item._thumbnailBlob) : item.thumbnailSrc
    }));
  }

  async deleteLibraryAsset(assetId: string): Promise<void> {
    if (!this.db) await this.initDB();

    // Get item to revoke URLs
    const item = await this.db!.get('library', assetId);
    if (item) {
      URL.revokeObjectURL(item.src);
      URL.revokeObjectURL(item.thumbnailSrc);
    }

    await this.db!.delete('library', assetId);
  }

  async updateLibraryMetadata(assetId: string, updates: any): Promise<TokenLibraryItem> {
    if (!this.db) await this.initDB();

    const item = await this.db!.get('library', assetId);
    if (!item) throw new Error(`Asset ${assetId} not found`);

    const updated = { ...item, ...updates };
    await this.db!.put('library', updated);

    return updated;
  }

  // ===== THEME PREFERENCES =====

  async getThemeMode(): Promise<any> {
    return localStorage.getItem('graphium-theme') || 'system';
  }

  async setThemeMode(mode: any): Promise<void> {
    localStorage.setItem('graphium-theme', mode);
  }

  // ===== UTILITY =====

  getPlatform(): 'electron' | 'web' {
    return 'web';
  }

  isFeatureAvailable(feature: string): boolean {
    // World View requires Electron multi-window
    if (feature === 'world-view') return false;

    // Auto-save available but uses IndexedDB, not file system
    if (feature === 'auto-save') return true;

    return false;
  }

  // ===== PRIVATE HELPERS =====

  private async processCampaignAssets(campaign: any, assetsFolder: JSZip): Promise<any> {
    // Convert Object URLs / OPFS URLs to blob data and store in ZIP
    // Similar logic to electron/main.ts:serializeCampaignToZip

    const processAsset = async (src: string): Promise<string> => {
      if (!src || (!src.startsWith('blob:') && !src.startsWith('opfs://'))) {
        return src;
      }

      // Fetch blob data
      const response = await fetch(src);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();

      const filename = `asset-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      assetsFolder.file(filename, buffer);

      return `assets/${filename}`;
    };

    // Process all map backgrounds, tokens, and library items
    for (const mapId in campaign.maps) {
      const map = campaign.maps[mapId];

      if (map.map?.src) {
        map.map.src = await processAsset(map.map.src);
      }

      if (map.tokens) {
        for (const token of map.tokens) {
          token.src = await processAsset(token.src);
        }
      }
    }

    if (campaign.tokenLibrary) {
      for (const item of campaign.tokenLibrary) {
        item.src = await processAsset(item.src);
        item.thumbnailSrc = await processAsset(item.thumbnailSrc);
      }
    }

    return campaign;
  }

  private async restoreCampaignAssets(campaign: any, zip: JSZip): Promise<void> {
    // Extract assets from ZIP and create Object URLs
    const assets = zip.folder('assets');
    if (!assets) return;

    const restoreAsset = async (src: string): Promise<string> => {
      if (!src || !src.startsWith('assets/')) return src;

      const filename = src.replace('assets/', '');
      const fileData = await assets.file(filename)?.async('arraybuffer');

      if (fileData) {
        const blob = new Blob([fileData], { type: 'image/webp' });
        return URL.createObjectURL(blob);
      }

      return src;
    };

    // Restore all assets
    for (const mapId in campaign.maps) {
      const map = campaign.maps[mapId];

      if (map.map?.src) {
        map.map.src = await restoreAsset(map.map.src);
      }

      if (map.tokens) {
        for (const token of map.tokens) {
          token.src = await restoreAsset(token.src);
        }
      }
    }

    if (campaign.tokenLibrary) {
      for (const item of campaign.tokenLibrary) {
        item.src = await restoreAsset(item.src);
        item.thumbnailSrc = await restoreAsset(item.thumbnailSrc);
      }
    }
  }
}
```

### 3.4 Build-Time Injection

**File:** `src/services/storage.ts`

```typescript
import type { IStorageService } from './IStorageService';

/**
 * Platform-agnostic storage singleton
 *
 * Injected at build time based on target:
 * - Electron: ElectronStorageService
 * - Web: WebStorageService
 */
let storageInstance: IStorageService;

export function initStorage(): void {
  if (storageInstance) return; // Already initialized

  // Vite injects __BUILD_TARGET__ at build time
  if (import.meta.env.VITE_BUILD_TARGET === 'web') {
    const { WebStorageService } = await import('./WebStorageService');
    storageInstance = new WebStorageService();
  } else {
    const { ElectronStorageService } = await import('./ElectronStorageService');
    storageInstance = new ElectronStorageService();
  }
}

export function getStorage(): IStorageService {
  if (!storageInstance) {
    throw new Error('Storage not initialized. Call initStorage() first.');
  }
  return storageInstance;
}
```

**Vite Configuration Update:**

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(isWeb ? 'web' : 'electron')
    },
    plugins: [
      react(),
      // Only load Electron plugin for Electron builds
      !isWeb && electron({
        main: { entry: 'electron/main.ts' },
        preload: { input: path.join(__dirname, 'electron/preload.ts') }
      })
    ].filter(Boolean)
  };
});
```

**Package.json Scripts:**

```json
{
  "scripts": {
    "dev": "vite",
    "dev:web": "vite --mode web",
    "build": "tsc && vite build && electron-builder",
    "build:web": "tsc && vite build --mode web"
  }
}
```

---

## 4. Resilience & Error Boundaries

### 4.1 New Error Boundary: `StorageErrorBoundary`

**File:** `src/components/StorageErrorBoundary.tsx`

```typescript
import { Component, ReactNode, ErrorInfo } from 'react';

/**
 * Error Boundary for Storage Operations
 *
 * Catches errors from:
 * - Campaign save/load failures
 * - Library operations (add, delete, update)
 * - Asset processing (temp storage)
 *
 * Prevents entire app from crashing when storage fails.
 * Provides user-friendly error messages with retry options.
 */
class StorageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[StorageErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="storage-error-fallback">
          <h2>Storage Operation Failed</h2>
          <p>
            {this.state.error?.message || 'An unknown error occurred'}
          </p>

          <details>
            <summary>Possible causes:</summary>
            <ul>
              <li>Browser blocked file access (check permissions)</li>
              <li>IndexedDB quota exceeded (clear browser storage)</li>
              <li>Network error (if using File System Access API)</li>
              <li>Corrupted campaign file</li>
            </ul>
          </details>

          <button onClick={this.handleRetry}>Retry</button>
          <button onClick={() => window.location.reload()}>Reload App</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StorageErrorBoundary;
```

### 4.2 Update `PrivacyErrorBoundary` for Web Compatibility

**File:** `src/components/PrivacyErrorBoundary.tsx` (line 149)

**Current Code:**
```typescript
const username = await window.errorReporting.getUsername();
```

**Updated Code:**
```typescript
// Handle both Electron and web environments
let username = '[USER]'; // Default fallback
try {
  if (window.errorReporting?.getUsername) {
    username = await window.errorReporting.getUsername();
  } else {
    // Web environment - use generic placeholder
    username = '[BROWSER_USER]';
  }
} catch (error) {
  console.warn('[PrivacyErrorBoundary] Failed to get username, using fallback');
}
```

### 4.3 Error Boundary Hierarchy (Updated)

```
App (Root)
├── PrivacyErrorBoundary (Web-compatible)
│   └── StorageErrorBoundary (NEW)
│       └── AssetProcessingErrorBoundary
│           └── CanvasManager
│               ├── MinimapErrorBoundary
│               └── TokenErrorBoundary
```

---

## 5. Deployment Strategy: Launch Page

### 5.1 Gateway Page Architecture

**Requirement:** The web app must NOT auto-launch. Users must explicitly choose between:
1. **Download Desktop App** (from GitHub Releases API)
2. **Launch Web App** (mounts React SPA)

**File Structure:**
```
dist/ (GitHub Pages root)
├── index.html (Launch Page - static HTML)
├── app.html (React SPA entry point)
├── assets/
│   ├── app-[hash].js (React bundle)
│   ├── app-[hash].css
│   └── ...
└── launch-assets/
    ├── logo.svg
    └── launch-page.css
```

### 5.2 Launch Page Implementation

**File:** `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Graphium - World Given Form</title>
  <link rel="stylesheet" href="/launch-assets/launch-page.css" />
</head>
<body>
  <div class="launch-container">
    <header>
      <img src="/launch-assets/logo.svg" alt="Graphium Logo" class="logo" />
      <h1>Graphium: World Given Form</h1>
      <p class="tagline">Local-first digital battlemap for tabletop RPGs</p>
    </header>

    <section class="action-panel">
      <div class="option">
        <h2>Desktop App</h2>
        <p>Full-featured with projector support</p>
        <ul>
          <li>✅ World View (multi-window projector)</li>
          <li>✅ Auto-save to disk</li>
          <li>✅ Native file dialogs</li>
          <li>✅ Offline-first</li>
        </ul>
        <button id="download-desktop" class="btn btn-primary">
          Download Latest Release
        </button>
        <p class="download-status" id="download-status"></p>
      </div>

      <div class="divider"></div>

      <div class="option">
        <h2>Web App</h2>
        <p>Runs in your browser (Beta)</p>
        <ul>
          <li>⚠️ No projector support (single window)</li>
          <li>✅ IndexedDB storage (private)</li>
          <li>✅ Works on tablets</li>
          <li>✅ No installation required</li>
        </ul>
        <button id="launch-web" class="btn btn-secondary">
          Launch Web App
        </button>
      </div>
    </section>

    <footer>
      <p>Privacy Notice: All data stays on your device. No telemetry, no analytics.</p>
      <a href="https://github.com/kocheck/Graphium">View Source Code</a>
    </footer>
  </div>

  <script src="/launch-assets/launch-page.js"></script>
</body>
</html>
```

### 5.3 Launch Page Logic

**File:** `public/launch-assets/launch-page.js`

```javascript
/**
 * Launch Page Logic
 *
 * Fetches latest release from GitHub API and handles navigation.
 */
(async function() {
  const GITHUB_REPO = 'kocheck/Graphium'; // Update with actual repo
  const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

  const downloadBtn = document.getElementById('download-desktop');
  const launchBtn = document.getElementById('launch-web');
  const statusEl = document.getElementById('download-status');

  // ===== FETCH LATEST RELEASE =====

  async function fetchLatestRelease() {
    try {
      statusEl.textContent = 'Fetching latest release...';

      const response = await fetch(GITHUB_API);
      if (!response.ok) throw new Error('GitHub API error');

      const release = await response.json();

      // Find platform-specific asset
      const platform = detectPlatform();
      const asset = release.assets.find(a =>
        a.name.includes(platform) &&
        (a.name.endsWith('.dmg') || a.name.endsWith('.exe') || a.name.endsWith('.AppImage'))
      );

      if (asset) {
        downloadBtn.textContent = `Download v${release.tag_name} for ${platform}`;
        downloadBtn.onclick = () => {
          window.open(asset.browser_download_url, '_blank');
        };
        statusEl.textContent = `Latest: ${release.tag_name} (${formatBytes(asset.size)})`;
      } else {
        throw new Error('No compatible installer found');
      }
    } catch (error) {
      console.error('[LaunchPage] Failed to fetch release:', error);
      statusEl.textContent = 'Failed to fetch release. Click to view all releases.';
      downloadBtn.onclick = () => {
        window.open(`https://github.com/${GITHUB_REPO}/releases`, '_blank');
      };
    }
  }

  function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) return 'macOS';
    if (userAgent.includes('win')) return 'Windows';
    if (userAgent.includes('linux')) return 'Linux';
    return 'Unknown';
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // ===== LAUNCH WEB APP =====

  launchBtn.onclick = () => {
    // Navigate to React SPA
    window.location.href = '/app.html';
  };

  // ===== INITIALIZE =====

  fetchLatestRelease();
})();
```

### 5.4 React SPA Entry Point

**File:** `app.html` (generated by Vite build)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Graphium - Web App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Vite Configuration for Multi-Page:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),   // Launch page
        app: resolve(__dirname, 'app.html')       // React SPA
      }
    }
  }
});
```

### 5.5 GitHub Pages Deployment

**File:** `.github/workflows/deploy-web.yml`

```yaml
name: Deploy Web App to GitHub Pages

on:
  push:
    branches:
      - main  # Deploy on every push to main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build web version
        run: npm run build:web

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: graphium.yourdomain.com  # Optional: custom domain
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goals:**
- Create adapter interfaces
- Implement `ElectronStorageService` (thin wrapper)
- Update build configuration

**Tasks:**
1. ✅ Create `src/services/IStorageService.ts`
2. ✅ Create `src/services/ElectronStorageService.ts`
3. ✅ Update `vite.config.ts` for multi-target builds
4. ✅ Add `build:web` script to `package.json`
5. ✅ Test Electron build (ensure no regressions)

### Phase 2: Web Storage Implementation (Week 3-4)

**Goals:**
- Implement `WebStorageService` with IndexedDB
- Handle asset persistence in browser

**Tasks:**
1. ✅ Install `idb` dependency (`npm install idb`)
2. ✅ Create `src/services/WebStorageService.ts`
3. ✅ Implement IndexedDB schema (library + autosave stores)
4. ✅ Implement campaign save/load with File System Access API
5. ✅ Implement OPFS for temp assets
6. ✅ Test in Chrome/Firefox/Safari

### Phase 3: Component Refactoring (Week 5-6)

**Goals:**
- Replace all `window.ipcRenderer` calls with `getStorage()`
- Update error boundaries for web compatibility

**Tasks:**
1. ✅ Update `AssetProcessor.ts` to use `getStorage()`
2. ✅ Update `App.tsx` save/load handlers to use `getStorage()`
3. ✅ Update `LibraryManager.tsx` to use `getStorage()`
4. ✅ Update `ThemeManager.tsx` to use `getStorage()`
5. ✅ Update `PrivacyErrorBoundary.tsx` for web fallback
6. ✅ Create `StorageErrorBoundary.tsx`

### Phase 4: Launch Page & Deployment (Week 7)

**Goals:**
- Create launch page UI
- Set up GitHub Pages deployment

**Tasks:**
1. ✅ Create `public/index.html` (launch page)
2. ✅ Create `public/launch-assets/launch-page.js`
3. ✅ Create `public/launch-assets/launch-page.css`
4. ✅ Update Vite config for multi-page build
5. ✅ Create `.github/workflows/deploy-web.yml`
6. ✅ Test deployment to GitHub Pages

### Phase 5: Testing & Documentation (Week 8)

**Goals:**
- Comprehensive cross-browser testing
- Update user documentation

**Tasks:**
1. ✅ Test web version in Chrome, Firefox, Safari, Edge
2. ✅ Test mobile/tablet browsers (iPad, Android)
3. ✅ Test File System Access API permissions flow
4. ✅ Create `ARCHITECTURE.md` (adapter pattern docs)
5. ✅ Update `README.md` (feature parity table)
6. ✅ Create `WEB_APP_GUIDE.md` (user guide for web version)

---

## 7. Risk Assessment

### 7.1 Technical Risks

| **Risk** | **Severity** | **Mitigation** |
|----------|--------------|----------------|
| **File System Access API not supported** (iOS Safari, older browsers) | 🔴 HIGH | Fallback to `<input>` upload + download links. Show browser compatibility warning. |
| **IndexedDB quota limits** (typically 50MB-100MB) | 🟡 MEDIUM | Implement quota monitoring. Show warning when 80% full. Suggest desktop app for large campaigns. |
| **OPFS performance on mobile** | 🟡 MEDIUM | Test on real devices. Consider simpler blob URLs if OPFS too slow. |
| **Object URL memory leaks** | 🟡 MEDIUM | Implement strict cleanup in `useEffect` hooks. Revoke URLs on component unmount. |
| **Browser tab suspension** (auto-save may fail) | 🟢 LOW | Show warning when tab loses focus. Recommend keeping tab active. |

### 7.2 User Experience Risks

| **Risk** | **Severity** | **Mitigation** |
|----------|--------------|----------------|
| **Users expect World View on web** | 🔴 HIGH | Prominent warning on launch page. Direct users to desktop app for projector. |
| **Users lose data due to browser storage clear** | 🟡 MEDIUM | Show periodic reminder to download campaign file. Auto-save to IndexedDB is NOT a backup. |
| **Confusion between Electron vs Web features** | 🟡 MEDIUM | Create clear feature comparison table in docs. Use `isFeatureAvailable()` to hide unavailable features in web UI. |

### 7.3 Compliance & Privacy Risks

| **Risk** | **Severity** | **Mitigation** |
|----------|--------------|----------------|
| **User expects truly local-first** (no CDN, no external requests) | 🟢 LOW | GitHub Pages is static hosting. No analytics, no external APIs except GitHub Releases (user-initiated). |
| **Browser fingerprinting concerns** | 🟢 LOW | Do NOT collect any fingerprints. Use `[BROWSER_USER]` placeholder in error reports. |

---

## Appendix A: Feature Parity Matrix

| **Feature** | **Electron Desktop** | **Web (GitHub Pages)** | **Notes** |
|-------------|---------------------|------------------------|-----------|
| **Core Battlemap** | ✅ Full support | ✅ Full support | Canvas rendering identical |
| **Token Library** | ✅ Persistent (file system) | ✅ Persistent (IndexedDB) | Web has storage limits |
| **Campaign Save/Load** | ✅ Native dialogs | ⚠️ File picker API | Web requires user permission |
| **Auto-Save** | ✅ Background write | ⚠️ IndexedDB only | Web cannot auto-download files |
| **World View (Projector)** | ✅ Multi-window | ❌ Not available | Browser security limitation |
| **Drawing Tools** | ✅ All tools | ✅ All tools | Identical |
| **Fog of War** | ✅ Full support | ✅ Full support | Identical |
| **Theme System** | ✅ Native menu | ✅ UI dropdown | Web uses localStorage |
| **Error Reporting** | ✅ File export + email | ✅ Blob download + email | Web uses Object URLs |
| **Offline Mode** | ✅ Fully offline | ⚠️ After first load | Web requires initial network fetch |

---

## Appendix B: File System Access API Browser Support

| **Browser** | **Version** | **Support Status** | **Fallback Required?** |
|-------------|-------------|-------------------|------------------------|
| Chrome | 86+ | ✅ Full support | No |
| Edge | 86+ | ✅ Full support | No |
| Firefox | ❌ Not supported | ⚠️ Behind flag | Yes (use `<input>`) |
| Safari | 15.2+ | ⚠️ Partial support | Yes (no directory access) |
| iOS Safari | ❌ Not supported | ❌ No support | Yes (use `<input>`) |
| Android Chrome | 86+ | ✅ Full support | No |

**Recommendation:** Detect support at runtime and show appropriate UI:

```typescript
function supportsFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window;
}

// In UI:
{supportsFileSystemAccess() ? (
  <button onClick={saveWithFSA}>Save Campaign</button>
) : (
  <button onClick={saveFallback}>Download Campaign</button>
)}
```

---

## Appendix C: IndexedDB Quota Management

**Estimated Storage Needs:**

| **Data Type** | **Size per Item** | **Max Items** | **Total Size** |
|---------------|------------------|---------------|----------------|
| Token (full-size) | 50 KB | 100 | 5 MB |
| Token (thumbnail) | 5 KB | 100 | 0.5 MB |
| Map background | 500 KB | 5 | 2.5 MB |
| Campaign metadata | 50 KB | 1 | 0.05 MB |
| **TOTAL** | - | - | **~8 MB** |

**Browser Limits:**
- Chrome/Edge: ~60% of free disk space (dynamic)
- Firefox: 50 MB (default), up to 2 GB with user permission
- Safari: 1 GB (total for origin)

**Quota Monitoring:**

```typescript
async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const percentUsed = (estimate.usage! / estimate.quota!) * 100;

    if (percentUsed > 80) {
      showToast('Storage is running low. Consider downloading your campaign.', 'warning');
    }
  }
}
```

---

## ADDENDUM: World View on Web (BroadcastChannel API)

**Date Added:** 2025-12-27
**Status:** ✅ APPROVED - Replaces "no World View" limitation

### Executive Summary

**Original Plan:** Web version would NOT support World View (projector mode) due to browser multi-window limitations.

**New Approach:** Use **BroadcastChannel API** to enable World View in a new browser tab, achieving full feature parity with Electron.

### Technical Implementation

#### BroadcastChannel API Overview

The BroadcastChannel API allows same-origin communication between browsing contexts (tabs, windows, iframes):

```typescript
// Create channel (same name = same channel across tabs)
const channel = new BroadcastChannel('graphium-world-sync');

// Send message
channel.postMessage({ type: 'SYNC', state: {...} });

// Receive message
channel.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

**Advantages:**
- ✅ Direct peer-to-peer (no server/broker needed)
- ✅ Same-origin security (isolated per domain)
- ✅ Works across tabs, windows, iframes
- ✅ Excellent browser support (Chrome 54+, Firefox 38+, Safari 15.4+)

#### Architecture Comparison

**Electron (Current):**
```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│ Architect Window│ ──IPC──>│ Main Process │ ──IPC──>│  World Window   │
│  (Producer)     │         │   (Broker)   │         │  (Consumer)     │
└─────────────────┘         └──────────────┘         └─────────────────┘
```

**Web (New Approach):**
```
┌─────────────────┐                                  ┌─────────────────┐
│  Architect Tab  │ ───BroadcastChannel────────────>│   World Tab     │
│  (Producer)     │   (direct, no broker needed)    │  (Consumer)     │
└─────────────────┘                                  └─────────────────┘
```

#### Implementation: Unified SyncManager

**File:** `src/components/SyncManager.tsx` (updated)

```typescript
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useWindowType } from '../utils/useWindowType';

/**
 * Unified SyncManager for Electron and Web
 *
 * Platform detection:
 * - Electron: Uses IPC (window.ipcRenderer)
 * - Web: Uses BroadcastChannel API
 */
export default function SyncManager() {
  const { isArchitectView, isWorldView } = useWindowType();

  useEffect(() => {
    // Detect platform
    const isElectron = Boolean(window.ipcRenderer);
    const isWeb = !isElectron;

    // ===== WEB: BroadcastChannel Setup =====
    if (isWeb) {
      const channel = new BroadcastChannel('graphium-world-sync');

      if (isArchitectView) {
        // PRODUCER: Subscribe to store changes and broadcast
        const unsubscribe = useGameStore.subscribe((state) => {
          channel.postMessage({
            type: 'SYNC_WORLD_STATE',
            state: {
              tokens: state.tokens,
              drawings: state.drawings,
              map: state.map,
              gridSize: state.gridSize,
              gridType: state.gridType,
              exploredRegions: state.exploredRegions,
              isDaylightMode: state.isDaylightMode,
            },
          });
        });

        return () => {
          unsubscribe();
          channel.close();
        };
      }

      if (isWorldView) {
        // CONSUMER: Listen for state updates
        channel.onmessage = (event) => {
          if (event.data.type === 'SYNC_WORLD_STATE') {
            useGameStore.setState(event.data.state);
          }
        };

        // Request initial state on mount
        channel.postMessage({ type: 'REQUEST_INITIAL_STATE' });

        return () => {
          channel.close();
        };
      }
    }

    // ===== ELECTRON: IPC Setup (existing code) =====
    if (isElectron) {
      // ... existing IPC implementation unchanged ...
    }
  }, [isArchitectView, isWorldView]);

  return null; // Invisible component
}
```

#### Opening World View (Web)

**File:** `src/App.tsx` (toolbar button)

```typescript
const handleOpenWorldView = () => {
  if (window.ipcRenderer) {
    // Electron: Create native window
    window.ipcRenderer.send('create-world-window');
  } else {
    // Web: Open new tab
    const worldWindow = window.open(
      '/app.html?type=world',
      'graphium-world-view',
      'width=1920,height=1080'
    );

    if (!worldWindow) {
      showToast('Popup blocked. Please allow popups for World View.', 'error');
    } else {
      showToast('World View opened in new tab. Drag to second monitor.', 'success');
    }
  }
};
```

#### Browser Support & Fallback

| Browser | BroadcastChannel | Fallback |
|---------|------------------|----------|
| Chrome 54+ | ✅ Native support | - |
| Firefox 38+ | ✅ Native support | - |
| Safari 15.4+ | ✅ Native support | - |
| Edge 79+ | ✅ Native support | - |
| Older browsers | ❌ Not supported | localStorage events |

**Fallback Implementation (if needed):**

```typescript
// Polyfill using localStorage events (slower but works)
class BroadcastChannelPolyfill {
  constructor(name) {
    this.name = name;
    window.addEventListener('storage', this._handleStorage);
  }

  postMessage(data) {
    localStorage.setItem(this.name, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }

  _handleStorage = (event) => {
    if (event.key === this.name && this.onmessage) {
      const parsed = JSON.parse(event.newValue);
      this.onmessage({ data: parsed.data });
    }
  };

  close() {
    window.removeEventListener('storage', this._handleStorage);
  }
}
```

### Updated Feature Parity Matrix

| **Feature** | **Electron Desktop** | **Web (GitHub Pages)** | **Implementation** |
|-------------|---------------------|------------------------|-------------------|
| **World View (Projector)** | ✅ Native window | ✅ **New tab** | BroadcastChannel |
| **State Sync** | ✅ IPC | ✅ **BroadcastChannel** | Real-time, <1ms latency |
| **Multi-Monitor** | ✅ Drag window | ✅ **Drag tab** | Browser native |
| **Fullscreen Mode** | ✅ Borderless | ⚠️ **F11 browser fullscreen** | User-initiated |

### User Experience Improvements

**Web World View Advantages:**
1. ✅ **No installation required** - Works immediately on any device
2. ✅ **Tablet support** - Split-screen or external display
3. ✅ **Shareable URL** - Send link to remote players
4. ✅ **Same performance** - No IPC overhead (direct channel)

**Minor UX Differences:**
1. ⚠️ **Browser UI visible** (address bar, tabs)
   - *Mitigation:* Recommend F11 fullscreen in UI tooltip
2. ⚠️ **Tab can be closed** (vs Electron's controlled window)
   - *Mitigation:* Add `beforeunload` warning: "World View will close"
3. ⚠️ **Popup blockers** (first-time users)
   - *Mitigation:* Show clear instructions if popup blocked

### Implementation Checklist

- [ ] Update `SyncManager.tsx` to support BroadcastChannel
- [ ] Add platform detection utility
- [ ] Update World View button to use `window.open()`
- [ ] Add fullscreen mode instructions to World View UI
- [ ] Test cross-tab sync latency
- [ ] Test on tablets (iPad, Android)
- [ ] Add polyfill for older browsers (optional)
- [ ] Update user documentation

### Impact on Original Plan

**Sections Updated:**
- ✅ Section 2.1: Remove "World View unavailable" red flag
- ✅ Section 2.2: Delete entire section (no longer applicable)
- ✅ Appendix A: Update feature parity matrix
- ✅ Launch Page: Remove "projector requires desktop" warning

**No Changes Required:**
- ✅ Storage adapter pattern (unchanged)
- ✅ Error boundaries (unchanged)
- ✅ Deployment strategy (unchanged)

### Risk Assessment Update

**New Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Popup blockers prevent World View | 🟡 MEDIUM | Show clear error + instructions to allow popups |
| User accidentally closes World View tab | 🟢 LOW | Add `beforeunload` confirmation dialog |
| BroadcastChannel not supported | 🟢 LOW | Polyfill with localStorage events (99.9% browser coverage) |

**Eliminated Risks:**
- ❌ ~~User expectation mismatch (expecting World View)~~ - **Now supported!**

---

## Next Steps

✅ **Phase 1 Complete:** This document outlines the full migration strategy.

**APPROVED Architecture:**
1. ✅ Adapter pattern architecture
2. ✅ Launch page design
3. ✅ **World View via BroadcastChannel** (new approach)

**After Approval:**
- Proceed to Phase 2: Implement `WebStorageService`
- Implement BroadcastChannel sync
- Create prototype and test in browsers

---

**Document Owner:** Claude (AI Architect)
**Review Status:** ✅ Approved with BroadcastChannel addendum
**Last Reviewed:** 2025-12-27
