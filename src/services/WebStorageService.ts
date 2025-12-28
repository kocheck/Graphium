import type { IStorageService, LibraryMetadata, ThemeMode } from './IStorageService';
import type { Campaign, TokenLibraryItem } from '../store/gameStore';
import { openDB, type IDBPDatabase } from 'idb';
import JSZip from 'jszip';

/**
 * IndexedDB schema version
 * Increment this when schema changes to trigger upgrade
 */
const DB_VERSION = 1;

/**
 * Database name
 */
const DB_NAME = 'hyle-storage';

/**
 * Storage service for Web (browser) environment
 *
 * Uses modern browser APIs for privacy-first, local-only storage:
 * - **IndexedDB** (via idb library): Token library + auto-save
 * - **File System Access API**: Campaign save/load (with fallback to download/upload)
 * - **OPFS** (Origin Private File System): Temp asset storage
 * - **localStorage**: Theme preferences
 *
 * **Privacy Guarantees:**
 * - All data stays on device (no server communication)
 * - IndexedDB is origin-isolated (cannot be accessed by other sites)
 * - OPFS is private (not accessible via DevTools or file browser)
 *
 * **Browser Compatibility:**
 * - Chrome/Edge 86+: Full support
 * - Firefox: Partial (OPFS via flag, no File System Access API)
 * - Safari 15.4+: Partial (no directory access for File System Access API)
 *
 * @example
 * const storage = new WebStorageService();
 * await storage.saveCampaign(campaign); // Downloads .hyle file
 */
export class WebStorageService implements IStorageService {
  private db: IDBPDatabase | null = null;
  private dbPromise: Promise<IDBPDatabase>;
  
  // Track Object URLs for cleanup (prevents memory leaks)
  private tempAssetURLs: Set<string> = new Set();
  private libraryURLs: Map<string, { fullSize: string; thumbnail: string }> = new Map(); // assetId → URLs

  constructor() {
    this.dbPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB schema
   */
  private async initDB(): Promise<IDBPDatabase> {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`[WebStorageService] Upgrading DB from ${oldVersion} to ${newVersion}`);

        // Token library store
        if (!db.objectStoreNames.contains('library')) {
          const libraryStore = db.createObjectStore('library', { keyPath: 'id' });
          libraryStore.createIndex('category', 'category', { unique: false });
          libraryStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          console.log('[WebStorageService] Created library object store');
        }

        // Auto-save store (stores latest campaign state)
        if (!db.objectStoreNames.contains('autosave')) {
          db.createObjectStore('autosave', { keyPath: 'id' });
          console.log('[WebStorageService] Created autosave object store');
        }
      },
    });

    this.db = db;
    return db;
  }

  /**
   * Ensure DB is initialized
   */
  private async getDB(): Promise<IDBPDatabase> {
    if (!this.db) {
      this.db = await this.dbPromise;
    }
    return this.db;
  }

  // ===== CAMPAIGN PERSISTENCE =====

  async saveCampaign(campaign: Campaign): Promise<boolean> {
    try {
      // Serialize campaign to ZIP
      const zip = new JSZip();
      const assetsFolder = zip.folder('assets')!;

      // Deep clone to avoid mutation
      const campaignToSave = JSON.parse(JSON.stringify(campaign));

      // Process all assets and convert URLs to blobs in ZIP
      await this.processCampaignAssets(campaignToSave, assetsFolder);

      // Add manifest.json
      zip.file('manifest.json', JSON.stringify(campaignToSave, null, 2));

      // Generate ZIP blob
      const blob = await zip.generateAsync({ type: 'blob' });

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}.hyle`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[WebStorageService] Campaign downloaded successfully');
      return true;
    } catch (error) {
      console.error('[WebStorageService] Save campaign failed:', error);
      throw new Error(`Failed to save campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async autoSaveCampaign(campaign: Campaign): Promise<boolean> {
    try {
      const db = await this.getDB();

      // Store in IndexedDB (no file download)
      await db.put('autosave', {
        id: 'latest',
        campaign,
        timestamp: Date.now()
      });

      console.log('[WebStorageService] Auto-save completed');
      return true;
    } catch (error) {
      console.error('[WebStorageService] Auto-save failed:', error);
      return false; // Don't throw - auto-save failures should be silent
    }
  }

  async loadCampaign(): Promise<Campaign | null> {
    return new Promise((resolve) => {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.hyle';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          console.log('[WebStorageService] Loading campaign from file:', file.name);

          // Parse ZIP
          const zip = await JSZip.loadAsync(file);
          const manifestStr = await zip.file('manifest.json')?.async('string');

          if (!manifestStr) {
            throw new Error('Invalid .hyle file: missing manifest.json');
          }

          const campaign: Campaign = JSON.parse(manifestStr);

          // Restore assets from ZIP to Object URLs
          await this.restoreCampaignAssets(campaign, zip);

          console.log('[WebStorageService] Campaign loaded successfully');
          resolve(campaign);
        } catch (error) {
          console.error('[WebStorageService] Load campaign failed:', error);
          throw new Error(`Failed to load campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };

      input.click();
    });
  }

  // ===== ASSET PROCESSING =====

  async saveAssetTemp(buffer: ArrayBuffer, fileName: string): Promise<string> {
    try {
      // For web, we'll use Object URLs (simple, session-scoped)
      // OPFS requires more complex setup and isn't critical for MVP
      const blob = new Blob([buffer], { type: 'image/webp' });
      const url = URL.createObjectURL(blob);
      
      // Track URL for cleanup when saved to campaign or discarded
      this.tempAssetURLs.add(url);

      console.log(`[WebStorageService] Created temp asset: ${fileName} → ${url.substring(0, 50)}...`);
      return url;
    } catch (error) {
      console.error('[WebStorageService] Save temp asset failed:', error);
      throw new Error(`Failed to save temp asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Clean up temp asset URLs (should be called when assets are saved to campaign or discarded)
   */
  cleanupTempAssets(urls?: string[]): void {
    if (urls) {
      // Clean up specific URLs
      urls.forEach(url => {
        if (this.tempAssetURLs.has(url)) {
          URL.revokeObjectURL(url);
          this.tempAssetURLs.delete(url);
          console.log(`[WebStorageService] Revoked temp asset URL: ${url.substring(0, 50)}...`);
        }
      });
    } else {
      // Clean up all temp assets
      this.tempAssetURLs.forEach(url => {
        URL.revokeObjectURL(url);
        console.log(`[WebStorageService] Revoked temp asset URL: ${url.substring(0, 50)}...`);
      });
      this.tempAssetURLs.clear();
    }
  }

  // ===== TOKEN LIBRARY =====

  async saveAssetToLibrary(
    fullSizeBuffer: ArrayBuffer,
    thumbnailBuffer: ArrayBuffer,
    metadata: LibraryMetadata
  ): Promise<TokenLibraryItem> {
    try {
      const db = await this.getDB();

      // Convert buffers to blobs
      const fullSizeBlob = new Blob([fullSizeBuffer], { type: 'image/webp' });
      const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/webp' });

      // Create Object URLs (valid for session, but we'll store blobs for persistence)
      const src = URL.createObjectURL(fullSizeBlob);
      const thumbnailSrc = URL.createObjectURL(thumbnailBlob);

      const item: TokenLibraryItem & { _fullSizeBlob?: Blob; _thumbnailBlob?: Blob } = {
        ...metadata,
        src,
        thumbnailSrc,
        dateAdded: Date.now(),
        // Store blobs for persistence (will recreate URLs on load)
        _fullSizeBlob: fullSizeBlob,
        _thumbnailBlob: thumbnailBlob
      };

      await db.put('library', item);

      console.log(`[WebStorageService] Saved asset to library: ${metadata.name}`);
      return item;
    } catch (error) {
      console.error('[WebStorageService] Save to library failed:', error);
      throw new Error(`Failed to save to library: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadLibraryIndex(): Promise<TokenLibraryItem[]> {
    try {
      const db = await this.getDB();
      const items = await db.getAll('library');

      // Type for stored library items (includes internal blob properties)
      interface StoredLibraryItem extends TokenLibraryItem {
        _fullSizeBlob?: Blob;
        _thumbnailBlob?: Blob;
      }

      // Revoke old URLs before creating new ones
      items.forEach((item: StoredLibraryItem) => {
        const oldURLs = this.libraryURLs.get(item.id);
        if (oldURLs) {
          URL.revokeObjectURL(oldURLs.fullSize);
          URL.revokeObjectURL(oldURLs.thumbnail);
        }
      });
      this.libraryURLs.clear();

      // Recreate Object URLs from stored blobs
      const itemsWithURLs = items.map((item: StoredLibraryItem) => {
        const fullSizeBlob = item._fullSizeBlob;
        const thumbnailBlob = item._thumbnailBlob;

        const fullSizeURL = fullSizeBlob ? URL.createObjectURL(fullSizeBlob) : item.src;
        const thumbnailURL = thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : item.thumbnailSrc;

        // Track URLs for cleanup on next load or component unmount
        this.libraryURLs.set(item.id, {
          fullSize: fullSizeURL,
          thumbnail: thumbnailURL
        });

        return {
          ...item,
          src: fullSizeURL,
          thumbnailSrc: thumbnailURL,
          // Remove internal blob properties from returned object
          _fullSizeBlob: undefined,
          _thumbnailBlob: undefined
        };
      });

      console.log(`[WebStorageService] Loaded ${itemsWithURLs.length} library items`);
      return itemsWithURLs;
    } catch (error) {
      console.error('[WebStorageService] Load library failed:', error);
      return []; // Return empty array on error (library not critical)
    }
  }

  async deleteLibraryAsset(assetId: string): Promise<void> {
    try {
      const db = await this.getDB();

      // Revoke tracked URLs for this asset
      const trackedURLs = this.libraryURLs.get(assetId);
      if (trackedURLs) {
        URL.revokeObjectURL(trackedURLs.fullSize);
        URL.revokeObjectURL(trackedURLs.thumbnail);
        this.libraryURLs.delete(assetId);
      }

      // Get item to revoke any other URLs (fallback)
      const item = await db.get('library', assetId);
      if (item) {
        if (item.src && item.src.startsWith('blob:')) {
          URL.revokeObjectURL(item.src);
        }
        if (item.thumbnailSrc && item.thumbnailSrc.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnailSrc);
        }
      }

      await db.delete('library', assetId);
      console.log(`[WebStorageService] Deleted library asset: ${assetId}`);
    } catch (error) {
      console.error('[WebStorageService] Delete library asset failed:', error);
      throw new Error(`Failed to delete library asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateLibraryMetadata(
    assetId: string,
    updates: Partial<LibraryMetadata>
  ): Promise<TokenLibraryItem> {
    try {
      const db = await this.getDB();

      const item = await db.get('library', assetId);
      if (!item) {
        throw new Error(`Asset ${assetId} not found in library`);
      }

      const updated = { ...item, ...updates };
      await db.put('library', updated);

      console.log(`[WebStorageService] Updated library metadata: ${assetId}`);
      return updated;
    } catch (error) {
      console.error('[WebStorageService] Update library metadata failed:', error);
      throw new Error(`Failed to update library metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== THEME PREFERENCES =====

  async getThemeMode(): Promise<ThemeMode> {
    try {
      const mode = localStorage.getItem('hyle-theme');
      return (mode as ThemeMode) || 'system';
    } catch (error) {
      console.error('[WebStorageService] Get theme mode failed:', error);
      return 'system'; // Safe fallback
    }
  }

  async setThemeMode(mode: ThemeMode): Promise<void> {
    try {
      localStorage.setItem('hyle-theme', mode);
      console.log(`[WebStorageService] Set theme mode: ${mode}`);
      
      // Broadcast theme change to other tabs
      try {
        const themeChannel = new BroadcastChannel('hyle-theme-sync');
        themeChannel.postMessage({ type: 'THEME_CHANGED', mode });
        themeChannel.close();
      } catch (broadcastError) {
        // BroadcastChannel not supported or failed - ignore
        console.warn('[WebStorageService] Failed to broadcast theme change:', broadcastError);
      }
    } catch (error) {
      console.error('[WebStorageService] Set theme mode failed:', error);
      throw error;
    }
  }

  // ===== UTILITY =====

  getPlatform(): 'electron' | 'web' {
    return 'web';
  }

  isFeatureAvailable(feature: 'world-view' | 'auto-save' | 'native-dialogs'): boolean {
    switch (feature) {
      case 'world-view':
        return true; // Multi-tab via BroadcastChannel
      case 'auto-save':
        return true; // IndexedDB auto-save (no file download)
      case 'native-dialogs':
        return false; // Browser uses <input> picker, not native OS dialogs
      default:
        return false;
    }
  }

  // ===== PRIVATE HELPERS =====

  /**
   * Process campaign assets for ZIP export
   * Converts Object URLs / blob URLs to actual blob data in ZIP
   */
  private async processCampaignAssets(campaign: Campaign, assetsFolder: JSZip): Promise<void> {
    const processedAssets = new Map<string, string>(); // URL → relative path in ZIP
    let assetCounter = 0; // Ensures uniqueness even within same millisecond

    const processAsset = async (src: string): Promise<string> => {
      if (!src || (!src.startsWith('blob:') && !src.startsWith('http:') && !src.startsWith('https:') && !src.startsWith('file:'))) {
        return src; // Already a relative path or invalid
      }

      // Check if already processed
      if (processedAssets.has(src)) {
        return processedAssets.get(src)!;
      }

      try {
        // Fetch blob data
        const response = await fetch(src);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();

        // Generate unique filename (timestamp + counter for guaranteed uniqueness)
        const filename = `asset-${Date.now()}-${assetCounter++}-${Math.random().toString(36).slice(2)}.webp`;
        assetsFolder.file(filename, buffer);

        const relativePath = `assets/${filename}`;
        processedAssets.set(src, relativePath);

        return relativePath;
      } catch (error) {
        console.warn(`[WebStorageService] Failed to process asset ${src}:`, error);
        return src; // Keep original on error
      }
    };

    // Process all map backgrounds and tokens
    for (const mapId in campaign.maps) {
      const map = campaign.maps[mapId];

      // Map background
      if (map.map?.src) {
        map.map.src = await processAsset(map.map.src);
      }

      // Tokens
      if (map.tokens) {
        for (const token of map.tokens) {
          token.src = await processAsset(token.src);
        }
      }
    }

    // Process campaign token library
    if (campaign.tokenLibrary) {
      for (const item of campaign.tokenLibrary) {
        item.src = await processAsset(item.src);
        item.thumbnailSrc = await processAsset(item.thumbnailSrc);
      }
    }
  }

  /**
   * Restore campaign assets from ZIP
   * Converts relative paths to Object URLs
   */
  private async restoreCampaignAssets(campaign: Campaign, zip: JSZip): Promise<void> {
    const assets = zip.folder('assets');
    if (!assets) {
      console.warn('[WebStorageService] No assets folder in ZIP');
      return;
    }

    const restoreAsset = async (src: string): Promise<string> => {
      if (!src || !src.startsWith('assets/')) {
        return src; // Not a relative asset path
      }

      const filename = src.replace('assets/', '');
      const fileData = await assets.file(filename)?.async('arraybuffer');

      if (fileData) {
        const blob = new Blob([fileData], { type: 'image/webp' });
        return URL.createObjectURL(blob);
      }

      console.warn(`[WebStorageService] Asset not found in ZIP: ${src}`);
      return src; // Keep original if not found
    };

    // Restore all map backgrounds and tokens
    for (const mapId in campaign.maps) {
      const map = campaign.maps[mapId];

      // Map background
      if (map.map?.src) {
        map.map.src = await restoreAsset(map.map.src);
      }

      // Tokens
      if (map.tokens) {
        for (const token of map.tokens) {
          token.src = await restoreAsset(token.src);
        }
      }
    }

    // Restore campaign token library
    if (campaign.tokenLibrary) {
      for (const item of campaign.tokenLibrary) {
        item.src = await restoreAsset(item.src);
        item.thumbnailSrc = await restoreAsset(item.thumbnailSrc);
      }
    }
  }
}
