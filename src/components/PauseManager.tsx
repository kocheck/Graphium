/**
 * PauseManager Component
 *
 * Manages game pause state synchronization between main process and renderer.
 * Similar to ThemeManager, this component:
 * - Fetches initial pause state on mount
 * - Listens for pause state changes from main process
 * - Updates the gameStore when pause state changes
 *
 * This ensures both Architect View and World View stay in sync with the
 * global pause state maintained in the main process.
 */

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function PauseManager() {
  const setIsGamePaused = useGameStore((state) => state.setIsGamePaused);

  useEffect(() => {
    if (!window.ipcRenderer) return;

    // Fetch initial pause state from main process
    // @ts-ignore
    window.ipcRenderer.invoke('GET_PAUSE_STATE').then((isPaused: boolean) => {
      setIsGamePaused(isPaused);
    });

    // Listen for pause state changes
    const handlePauseStateChanged = (_event: unknown, isPaused: boolean) => {
      setIsGamePaused(isPaused);
    };

    // @ts-ignore
    window.ipcRenderer.on('PAUSE_STATE_CHANGED', handlePauseStateChanged);

    return () => {
      // @ts-ignore
      window.ipcRenderer.off('PAUSE_STATE_CHANGED', handlePauseStateChanged);
    };
  }, [setIsGamePaused]);

  // This is an invisible component (no rendering)
  return null;
}
