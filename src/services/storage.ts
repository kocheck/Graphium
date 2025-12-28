import type { IStorageService } from './IStorageService';

/**
 * Storage service singleton instance
 * Initialized by initStorage() call in main.tsx
 */
let storageInstance: IStorageService | null = null;

/**
 * Initialize storage service based on build target
 *
 * This function dynamically imports the correct storage service implementation
 * based on the environment. It should be called ONCE at app startup (in main.tsx).
 *
 * **Build-time detection:**
 * - Electron: Uses window.ipcRenderer presence to detect Electron
 * - Web: No ipcRenderer available
 *
 * **Why not use import.meta.env?**
 * We need runtime detection because the same build might run in both environments
 * during development (Vite dev server with Electron).
 *
 * Note: If storage is already initialized, logs a warning and returns early.
 *
 * @example
 * // In src/main.tsx (before rendering React)
 * import { initStorage } from './services/storage';
 *
 * await initStorage();
 * ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
 */
export async function initStorage(): Promise<void> {
  if (storageInstance) {
    console.warn('[Storage] Storage already initialized, skipping');
    return;
  }

  // Runtime detection: Check for Electron IPC
  const isElectron = typeof window !== 'undefined' && Boolean(window.ipcRenderer);

  if (isElectron) {
    console.log('[Storage] Detected Electron environment, using ElectronStorageService');
    const { ElectronStorageService } = await import('./ElectronStorageService');
    storageInstance = new ElectronStorageService();
  } else {
    console.log('[Storage] Detected Web environment, using WebStorageService');
    const { WebStorageService } = await import('./WebStorageService');
    storageInstance = new WebStorageService();
  }

  console.log(`[Storage] Initialized: platform=${storageInstance.getPlatform()}`);
}

/**
 * Get the initialized storage service instance
 *
 * @throws {Error} If storage not initialized (call initStorage() first)
 * @returns Storage service instance
 *
 * @example
 * import { getStorage } from './services/storage';
 *
 * const storage = getStorage();
 * await storage.saveCampaign(campaign);
 */
export function getStorage(): IStorageService {
  if (!storageInstance) {
    throw new Error(
      'Storage not initialized. Call initStorage() in main.tsx before using storage.'
    );
  }
  return storageInstance;
}

/**
 * Check if storage is initialized
 * Useful for conditional logic during app startup
 *
 * @returns true if storage initialized
 *
 * @example
 * if (isStorageInitialized()) {
 *   const storage = getStorage();
 * }
 */
export function isStorageInitialized(): boolean {
  return storageInstance !== null;
}
