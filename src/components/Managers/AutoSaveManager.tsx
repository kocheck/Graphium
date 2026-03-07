import { useEffect } from 'react';

import { getStorage } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';

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
      // eslint-disable-next-line no-console
      console.log('[AutoSave] Auto-save not available on this platform');
      return;
    }

    let isSaving = false;

    const intervalId = setInterval(
      () =>
        void (async () => {
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
            const saved = await storage.autoSaveCampaign(campaign);

            if (saved) {
              // eslint-disable-next-line no-console
              console.log('[AutoSave] Campaign saved successfully');
            } else {
              useUiStore
                .getState()
                .showToast('Auto-save failed — your progress may not be saved', 'error');
            }
          } catch (err) {
            console.error('[AutoSave] Failed:', err);
          } finally {
            isSaving = false;
          }
        })(),
      60 * 1000,
    ); // 60 seconds

    return () => clearInterval(intervalId);
  }, []);

  return null; // Invisible component
}

export default AutoSaveManager;
