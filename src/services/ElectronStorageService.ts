import type { IStorageService, LibraryMetadata, ThemeMode } from './IStorageService';
import type { Campaign, TokenLibraryItem } from '../store/gameStore';

/**
 * Storage service for Electron environment
 *
 * This is a thin wrapper around existing IPC handlers in electron/main.ts.
 * It delegates all operations to the main process, which handles file I/O
 * using Node.js fs APIs.
 *
 * **IPC Mapping:**
 * - saveCampaign() → 'SAVE_CAMPAIGN'
 * - autoSaveCampaign() → 'AUTO_SAVE'
 * - loadCampaign() → 'LOAD_CAMPAIGN'
 * - saveAssetTemp() → 'SAVE_ASSET_TEMP'
 * - saveAssetToLibrary() → 'SAVE_ASSET_TO_LIBRARY'
 * - loadLibraryIndex() → 'LOAD_LIBRARY_INDEX'
 * - deleteLibraryAsset() → 'DELETE_LIBRARY_ASSET'
 * - updateLibraryMetadata() → 'UPDATE_LIBRARY_METADATA'
 * - getThemeMode() → 'get-theme-state'
 * - setThemeMode() → 'set-theme-mode'
 *
 * **Error Handling:**
 * All errors from IPC handlers are propagated to the caller.
 * The caller should wrap in try/catch or use error boundaries.
 *
 * @example
 * const storage = new ElectronStorageService();
 * try {
 *   await storage.saveCampaign(campaign);
 * } catch (error) {
 *   showToast('Failed to save campaign', 'error');
 * }
 */
export class ElectronStorageService implements IStorageService {
  /**
   * Check if IPC is available
   * @throws {Error} If running in non-Electron environment
   */
  private ensureIPC(): void {
    if (!window.ipcRenderer) {
      throw new Error(
        'ElectronStorageService requires Electron IPC. ' +
          'Are you running in Electron? Use WebStorageService for browser.',
      );
    }
  }

  // ===== CAMPAIGN PERSISTENCE =====

  async saveCampaign(campaign: Campaign): Promise<boolean> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    return await window.ipcRenderer.invoke('SAVE_CAMPAIGN', campaign);
  }

  async autoSaveCampaign(campaign: Campaign): Promise<boolean> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    return await window.ipcRenderer.invoke('AUTO_SAVE', campaign);
  }

  async loadCampaign(): Promise<Campaign | null> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    return await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
  }

  // ===== ASSET PROCESSING =====

  async saveAssetTemp(buffer: ArrayBuffer, fileName: string): Promise<string> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    const filePath = await window.ipcRenderer.invoke('SAVE_ASSET_TEMP', buffer, fileName);
    return filePath as string;
  }

  // ===== TOKEN LIBRARY =====

  async saveAssetToLibrary(
    fullSizeBuffer: ArrayBuffer,
    thumbnailBuffer: ArrayBuffer,
    metadata: LibraryMetadata,
  ): Promise<TokenLibraryItem> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    return await window.ipcRenderer.invoke('SAVE_ASSET_TO_LIBRARY', {
      fullSizeBuffer,
      thumbnailBuffer,
      metadata,
    });
  }

  async loadLibraryIndex(): Promise<TokenLibraryItem[]> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    const items = await window.ipcRenderer.invoke('LOAD_LIBRARY_INDEX');
    return items || [];
  }

  async deleteLibraryAsset(assetId: string): Promise<void> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    await window.ipcRenderer.invoke('DELETE_LIBRARY_ASSET', assetId);
  }

  async updateLibraryMetadata(
    assetId: string,
    updates: Partial<LibraryMetadata>,
  ): Promise<TokenLibraryItem> {
    this.ensureIPC();
    // @ts-expect-error - IPC types not available in renderer
    return await window.ipcRenderer.invoke('UPDATE_LIBRARY_METADATA', assetId, updates);
  }

  // ===== THEME PREFERENCES =====

  async getThemeMode(): Promise<ThemeMode> {
    // Theme API is separate from ipcRenderer
    if (!window.themeAPI) {
      console.warn('[ElectronStorageService] themeAPI not available, defaulting to system');
      return 'system';
    }

    try {
      const state = await window.themeAPI.getThemeState();
      return state.mode as ThemeMode;
    } catch (error) {
      console.error('[ElectronStorageService] Failed to get theme mode:', error);
      return 'system';
    }
  }

  async setThemeMode(mode: ThemeMode): Promise<void> {
    if (!window.themeAPI) {
      console.warn('[ElectronStorageService] themeAPI not available, cannot set theme');
      return;
    }

    try {
      await window.themeAPI.setThemeMode(mode);
    } catch (error) {
      console.error('[ElectronStorageService] Failed to set theme mode:', error);
      throw error;
    }
  }

  // ===== UTILITY =====

  getPlatform(): 'electron' | 'web' {
    return 'electron';
  }

  isFeatureAvailable(feature: 'world-view' | 'auto-save' | 'native-dialogs'): boolean {
    // All features available in Electron
    switch (feature) {
      case 'world-view':
        return true; // Multi-window via BrowserWindow
      case 'auto-save':
        return true; // Background file writes
      case 'native-dialogs':
        return true; // dialog.showSaveDialog, dialog.showOpenDialog
      default:
        return false;
    }
  }
}
