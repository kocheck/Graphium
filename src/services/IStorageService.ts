import type { Campaign, TokenLibraryItem } from '../store/gameStore';

/**
 * Metadata for a library asset (before URLs are assigned)
 */
export interface LibraryMetadata {
  id: string;
  name: string;
  category: string;
  tags: string[];
  defaultScale?: number;
  defaultVisionRadius?: number;
  defaultType?: 'PC' | 'NPC';
}

/**
 * Theme mode setting
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Platform-agnostic storage interface
 *
 * This interface abstracts all storage operations to enable the same codebase
 * to run on both Electron (file system) and Web (IndexedDB + File System Access API).
 *
 * **Implementations:**
 * - `ElectronStorageService`: Uses IPC to Node.js fs APIs
 * - `WebStorageService`: Uses IndexedDB + File System Access API + OPFS
 *
 * **Design Principles:**
 * 1. All methods are async (even if implementation is sync)
 * 2. Errors are thrown (caller handles via try/catch or error boundaries)
 * 3. No platform-specific types leak into interface
 * 4. Feature detection via `isFeatureAvailable()`
 *
 * @example
 * // Platform-agnostic usage
 * const storage = getStorage();
 * await storage.saveCampaign(campaign);
 *
 * // Feature detection
 * if (storage.isFeatureAvailable('auto-save')) {
 *   await storage.autoSaveCampaign(campaign);
 * }
 */
export interface IStorageService {
  // ===== CAMPAIGN PERSISTENCE =====

  /**
   * Save campaign to file
   *
   * **Electron:** Shows native save dialog, writes .graphium ZIP to disk
   * **Web:** Triggers browser download of .graphium ZIP
   *
   * @param campaign - Campaign data to serialize
   * @returns Success status (false if user cancelled)
   * @throws {Error} If serialization or write fails
   *
   * @example
   * const success = await storage.saveCampaign(campaign);
   * if (success) {
   *   showToast('Campaign saved!', 'success');
   * }
   */
  saveCampaign(campaign: Campaign): Promise<boolean>;

  /**
   * Auto-save campaign (background, no UI dialogs)
   *
   * **Electron:** Atomic write to last save path (no dialog)
   * **Web:** Persist to IndexedDB (no file download)
   *
   * @param campaign - Campaign data to serialize
   * @returns Success status
   * @throws {Error} If no previous save path (Electron) or IndexedDB error (Web)
   *
   * @example
   * // Called by AutoSaveManager every 30 seconds
   * try {
   *   await storage.autoSaveCampaign(campaign);
   * } catch (error) {
   *   console.warn('Auto-save failed:', error);
   * }
   */
  autoSaveCampaign(campaign: Campaign): Promise<boolean>;

  /**
   * Load campaign from file
   *
   * **Electron:** Shows native open dialog
   * **Web:** Shows <input type="file"> picker or File System Access API
   *
   * @returns Campaign data or null if user cancelled
   * @throws {Error} If file is invalid or parsing fails
   *
   * @example
   * const campaign = await storage.loadCampaign();
   * if (campaign) {
   *   loadCampaign(campaign);
   * }
   */
  loadCampaign(): Promise<Campaign | null>;

  // ===== ASSET PROCESSING =====

  /**
   * Save processed asset to temp storage
   *
   * **Electron:** Writes to app.getPath('userData')/temp_assets/, returns file:// URL
   * **Web:** Writes to OPFS (Origin Private File System), returns opfs:// URL or Object URL
   *
   * @param buffer - WebP image data
   * @param fileName - Original filename (e.g., "goblin.webp")
   * @returns URL to access the asset (file://, opfs://, or blob:)
   * @throws {Error} If write fails
   *
   * @example
   * const url = await storage.saveAssetTemp(webpBuffer, 'token.webp');
   * addToken({ id: uuid(), x: 0, y: 0, src: url, scale: 1 });
   */
  saveAssetTemp(buffer: ArrayBuffer, fileName: string): Promise<string>;

  // ===== TOKEN LIBRARY =====

  /**
   * Save asset to persistent library
   *
   * **Electron:** Writes to userData/library/, updates index.json
   * **Web:** Stores in IndexedDB with blob references
   *
   * @param fullSizeBuffer - Full-resolution WebP
   * @param thumbnailBuffer - 128x128 thumbnail WebP
   * @param metadata - Asset metadata
   * @returns Complete library item with URLs
   * @throws {Error} If write fails or quota exceeded (Web)
   *
   * @example
   * const item = await storage.saveAssetToLibrary(
   *   fullSizeBuffer,
   *   thumbnailBuffer,
   *   { id: uuid(), name: 'Goblin', category: 'Monsters', tags: ['goblin', 'small'] }
   * );
   * addTokenToLibrary(item);
   */
  saveAssetToLibrary(
    fullSizeBuffer: ArrayBuffer,
    thumbnailBuffer: ArrayBuffer,
    metadata: LibraryMetadata
  ): Promise<TokenLibraryItem>;

  /**
   * Load library index
   *
   * **Electron:** Reads index.json from disk
   * **Web:** Queries IndexedDB
   *
   * @returns Array of library items (empty array if none exist)
   * @throws {Error} If read fails or data corrupted
   *
   * @example
   * const libraryItems = await storage.loadLibraryIndex();
   * setState({ campaign: { ...campaign, tokenLibrary: libraryItems } });
   */
  loadLibraryIndex(): Promise<TokenLibraryItem[]>;

  /**
   * Delete asset from library
   *
   * **Electron:** Deletes files + updates index.json
   * **Web:** Deletes IndexedDB record, revokes Object URLs
   *
   * @param assetId - UUID of asset to delete
   * @throws {Error} If delete fails
   *
   * @example
   * await storage.deleteLibraryAsset(assetId);
   * removeTokenFromLibrary(assetId);
   */
  deleteLibraryAsset(assetId: string): Promise<void>;

  /**
   * Update library asset metadata (does not modify images)
   *
   * **Electron:** Reads, mutates, writes index.json
   * **Web:** Updates IndexedDB record
   *
   * @param assetId - UUID of asset
   * @param updates - Partial metadata updates
   * @returns Updated library item
   * @throws {Error} If asset not found or update fails
   *
   * @example
   * const updated = await storage.updateLibraryMetadata(assetId, {
   *   name: 'Goblin Archer',
   *   tags: ['goblin', 'small', 'archer']
   * });
   * updateLibraryToken(assetId, updated);
   */
  updateLibraryMetadata(
    assetId: string,
    updates: Partial<LibraryMetadata>
  ): Promise<TokenLibraryItem>;

  // ===== THEME PREFERENCES =====

  /**
   * Get theme preference
   *
   * **Electron:** Reads from electron-store
   * **Web:** Reads from localStorage
   *
   * @returns Theme mode setting
   * @throws {Error} If read fails (fallback to 'system')
   *
   * @example
   * const mode = await storage.getThemeMode();
   * applyTheme(mode);
   */
  getThemeMode(): Promise<ThemeMode>;

  /**
   * Set theme preference
   *
   * **Electron:** Writes to electron-store, broadcasts to all windows
   * **Web:** Writes to localStorage
   *
   * @param mode - Theme mode to save
   * @throws {Error} If write fails
   *
   * @example
   * await storage.setThemeMode('dark');
   */
  setThemeMode(mode: ThemeMode): Promise<void>;

  // ===== UTILITY =====

  /**
   * Get platform identifier
   *
   * @returns 'electron' | 'web'
   *
   * @example
   * if (storage.getPlatform() === 'electron') {
   *   // Show native menu option
   * }
   */
  getPlatform(): 'electron' | 'web';

  /**
   * Check if feature is available on current platform
   *
   * **Features:**
   * - 'world-view': Multi-window/tab projector mode (both platforms)
   * - 'auto-save': Background campaign persistence (both platforms, different impl)
   * - 'native-dialogs': OS file picker dialogs (Electron only)
   *
   * @param feature - Feature identifier
   * @returns Availability status
   *
   * @example
   * if (storage.isFeatureAvailable('native-dialogs')) {
   *   showToast('Use File > Open to load campaign', 'info');
   * } else {
   *   showToast('Click to select .graphium file', 'info');
   * }
   */
  isFeatureAvailable(feature: 'world-view' | 'auto-save' | 'native-dialogs'): boolean;
}
