import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * SyncManager handles real-time state synchronization between windows
 *
 * This component is the backbone of Hyle's dual-window architecture. It enables
 * the Dungeon Master's control panel (Architect View) to broadcast state changes
 * to the player-facing display (World View) in real-time via Electron IPC.
 *
 * **Architecture:**
 * - **Architect View (Main Window)**: PRODUCER - Subscribes to store changes and
 *   sends IPC messages to the main process when state updates occur
 * - **World View (Projector Window)**: CONSUMER - Listens for IPC messages and
 *   updates its local store copy (read-only, never modifies state)
 *
 * **Data Flow:**
 * ```
 * User action in Architect View
 *   ↓
 * Store update (addToken, addDrawing, etc.)
 *   ↓
 * SyncManager subscription fires
 *   ↓
 * IPC send 'SYNC_WORLD_STATE' to main process
 *   ↓
 * Main process broadcasts to World Window
 *   ↓
 * World Window SyncManager receives IPC event
 *   ↓
 * World Window store updated
 *   ↓
 * World Window re-renders with new state
 * ```
 *
 * **Window Detection:**
 * Uses URL query parameter `?type=world` to determine window type. World Window
 * is created with this parameter by electron/main.ts `createWorldWindow()`.
 *
 * **Critical Pattern:**
 * - Architect View is the ONLY source of truth (single direction sync)
 * - World View NEVER modifies state (prevents sync conflicts)
 * - Full state is broadcast on every change (not delta updates)
 *
 * **Performance Note:**
 * Currently broadcasts entire state on every change. For large campaigns (1000+ tokens),
 * consider implementing delta/diff updates or throttling to max 10 updates/sec.
 *
 * @returns null - This component renders nothing (side effects only)
 *
 * @example
 * // In App.tsx (rendered in both windows)
 * <SyncManager />
 *
 * @example
 * // Architect View behavior (Main Window)
 * // When user adds a token:
 * addToken(newToken)
 *   → Store updates
 *   → SyncManager.subscribe fires
 *   → IPC send to main process
 *   → Main process → World Window
 *
 * @example
 * // World View behavior (Projector Window)
 * // When IPC message received:
 * IPC 'SYNC_WORLD_STATE' received
 *   → SyncManager.on handler fires
 *   → useGameStore.setState(newState)
 *   → React re-renders canvas
 */
const SyncManager = () => {
  useEffect(() => {
    // Skip if ipcRenderer is not available (e.g., in browser testing)
    if (!window.ipcRenderer) {
      console.warn('[SyncManager] ipcRenderer not available, sync disabled');
      return;
    }

    // Detect window type from URL parameter
    // World Window URL: http://localhost:5173?type=world
    // Architect Window URL: http://localhost:5173 (no params)
    const params = new URLSearchParams(window.location.search);
    const isWorldView = params.get('type') === 'world';

    if (isWorldView) {
      // CONSUMER MODE: World View receives state updates from Architect View

      // Listen for IPC messages from main process
      // @ts-ignore - ipcRenderer types not available, will be fixed with proper type declarations
      const removeListener = window.ipcRenderer.on('SYNC_WORLD_STATE', (_event, state) => {
        // Update local store with received state (replaces all data)
        useGameStore.setState(state);
      });

      // Cleanup function (remove IPC listener on unmount)
      // Note: Current preload implementation doesn't return proper cleanup function
      // TODO: Implement proper IPC listener cleanup
      return () => {
        // IPC listener cleanup would go here if preload.ts exposed proper off() method
        // For now, listeners are cleaned up when window closes
      };
    } else {
      // PRODUCER MODE: Architect View broadcasts state changes

      // Subscribe to ALL store changes
      const unsub = useGameStore.subscribe((state) => {
        // Extract only the data we want to sync (exclude actions)
        const syncState = {
          tokens: state.tokens,
          drawings: state.drawings,
          gridSize: state.gridSize
        };

        // Send to main process for broadcast to World Window
        // @ts-ignore - ipcRenderer types not available, will be fixed with proper type declarations
        window.ipcRenderer.send('SYNC_WORLD_STATE', syncState);
      });

      // Cleanup function (unsubscribe on unmount)
      return () => unsub();
    }
  }, []); // Empty deps = run once on mount

  // This component has no UI (returns null)
  return null;
};

export default SyncManager;
