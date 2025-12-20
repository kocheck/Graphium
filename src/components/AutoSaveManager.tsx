import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * AutoSaveManager Component
 *
 * Automatically saves the campaign state to the last known file path
 * at a regular interval (every 60 seconds).
 *
 * It runs only if IPC is available (Electron) and silently fails if
 * no file path has been established (handled by main process).
 */
const AutoSaveManager = () => {
    useEffect(() => {
        if (!window.ipcRenderer) return;

        let isSaving = false;

        const intervalId = setInterval(async () => {
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
                // Returns true if saved, false if no path set or error
                const saved = await window.ipcRenderer.invoke('AUTO_SAVE', campaign);

                if (saved) {
                    console.log('[AutoSave] Campaign saved successfully');
                }
            } catch (err) {
                console.error('[AutoSave] Failed:', err);
            } finally {
                isSaving = false;
            }
        }, 60 * 1000); // 60 seconds

        return () => clearInterval(intervalId);
    }, []);

    return null; // Invisible component
};

export default AutoSaveManager;
