/**
 * PauseManager Component
 *
 * Invisible system component that synchronizes game pause state between the main
 * Electron process and renderer processes (Architect View and World View).
 *
 * **Purpose:**
 * Enables the Dungeon Master to freeze the player-facing World View while preparing
 * the next scene (moving tokens, changing maps, adjusting fog of war) without
 * players seeing the changes in real-time.
 *
 * **Architecture:**
 * - Main process maintains global `isGamePaused` state
 * - This component fetches initial state on mount
 * - Listens for `PAUSE_STATE_CHANGED` IPC events
 * - Updates Zustand store to trigger UI updates
 * - Both Architect and World View instances stay synchronized
 *
 * **IPC Channels Used:**
 * - `GET_PAUSE_STATE`: Request-response, fetches initial pause state
 * - `PAUSE_STATE_CHANGED`: Event listener, receives pause state updates
 *
 * **Data Flow:**
 * ```
 * DM clicks pause → App.tsx invokes TOGGLE_PAUSE → Main process updates state
 *   → Main broadcasts PAUSE_STATE_CHANGED → PauseManager receives event
 *   → Updates gameStore → LoadingOverlay shows/hides
 * ```
 *
 * **Error Handling:**
 * - Gracefully handles missing IPC (returns early)
 * - Shows toast notification if initial fetch fails
 * - Logs errors without breaking app functionality
 *
 * **Usage:**
 * Automatically included in App.tsx as a global component (like ThemeManager).
 * No props required - operates entirely via IPC and Zustand store.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <PauseManager />
 * ```
 *
 * @returns {null} Invisible component, no rendering
 *
 * @see {@link electron/main.ts} Main process IPC handlers (TOGGLE_PAUSE, GET_PAUSE_STATE)
 * @see {@link LoadingOverlay} Component that displays when paused (World View only)
 * @see {@link App.tsx} Contains pause toggle button (Architect View only)
 * @see {@link gameStore.ts} Contains isGamePaused state
 */

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { rollForMessage } from '../utils/systemMessages';

export function PauseManager() {
  const setIsGamePaused = useGameStore((state) => state.setIsGamePaused);
  const showToast = useGameStore((state) => state.showToast);

  useEffect(() => {
    // Early return if IPC is not available (e.g., running in browser mode for tests)
    if (!window.ipcRenderer) return;

    /**
     * Fetch initial pause state from main process
     * This ensures windows opened after pause was toggled start in correct state
     */
    // @ts-ignore - Window IPC types not available in renderer
    window.ipcRenderer.invoke('GET_PAUSE_STATE')
      .then((isPaused: boolean) => {
        setIsGamePaused(isPaused);
      })
      .catch((error: Error) => {
        console.error('[PauseManager] Failed to fetch initial pause state:', error);
        showToast(rollForMessage('PAUSE_STATE_SYNC_FAILED'), 'error');
      });

    /**
     * Handle pause state changes from main process
     * Triggered when DM clicks pause/play button or another window toggles state
     *
     * @param _event - IPC event object (unused)
     * @param isPaused - New pause state from main process
     */
    const handlePauseStateChanged = (_event: unknown, isPaused: boolean) => {
      setIsGamePaused(isPaused);
    };

    // Subscribe to pause state changes
    // @ts-ignore - Window IPC types not available in renderer
    window.ipcRenderer.on('PAUSE_STATE_CHANGED', handlePauseStateChanged);

    // Cleanup: Remove event listener when component unmounts
    return () => {
      // @ts-ignore - Window IPC types not available in renderer
      window.ipcRenderer.off('PAUSE_STATE_CHANGED', handlePauseStateChanged);
    };
  }, [setIsGamePaused, showToast]);

  // This is an invisible system component (no UI rendering)
  return null;
}
