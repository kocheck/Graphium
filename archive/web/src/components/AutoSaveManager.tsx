import { useEffect } from 'react';

import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';

/**
 * AutoSaveManager Component
 *
 * Automatically saves the campaign state at a regular interval (every 60 seconds).
 *
 * **Platform Behavior:**
 * - Electron: Saves to last known file path (atomic write)
 * - Web: Saves to IndexedDB (no file download)
 *
 * **Note:** This only runs if auto-save feature is available on the platform.
 * Check storage.isFeatureAvailable('auto-save') for availability.
 */
function AutoSaveManager(): null {
  useEffect(() => {
    // Check if auto-save is supported on this platform
    const storage = getStorage();
    if (!storage.isFeatureAvailable('auto-save')) {
      return;
    }

    let isSaving = false;

    const runAutoSave = async (): Promise<void> => {
      if (isSaving) {
        return;
      }
      isSaving = true;
      try {
        // Ensure latest map state is in campaign object
        useGameStore.getState().syncActiveMapToCampaign();

        // Get latest campaign data
        const campaign = useGameStore.getState().campaign;

        // Attempt auto-save
        // Returns true if saved, false if error
        await storage.autoSaveCampaign(campaign);
      } catch {
        // Auto-save failures are silent to avoid disrupting gameplay
      } finally {
        isSaving = false;
      }
    };

    const intervalId = setInterval(() => {
      void runAutoSave();
    }, 60 * 1000); // 60 seconds

    return () => clearInterval(intervalId);
  }, []);

  return null; // Invisible component
}

export default AutoSaveManager;
