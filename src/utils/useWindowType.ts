/**
 * Hook for detecting the current window type in the dual-window architecture
 *
 * Hyle uses a dual-window pattern where the same React application renders
 * in two different modes:
 * - **Architect View** (Main Window): DM's control panel with full UI and editing tools
 * - **World View** (Player Window): Sanitized display for projection/screen sharing
 *
 * Window type is determined by the `?type=world` URL query parameter, which is set
 * by the main process when creating the World Window (see electron/main.ts:259).
 *
 * **Usage Pattern:**
 * ```typescript
 * const { isWorldView, isArchitectView } = useWindowType();
 *
 * // Conditional UI rendering
 * {isArchitectView && <Sidebar />}
 *
 * // Conditional feature logic
 * if (isWorldView) {
 *   // Disable editing features
 * }
 * ```
 *
 * **Architecture Context:**
 * - Main process creates World Window with `?type=world` query parameter
 * - SyncManager uses this detection for state synchronization mode (producer/consumer)
 * - App.tsx uses this for UI sanitization (hide DM tools in World View)
 * - CanvasManager uses this for interaction restrictions (disable editing in World View)
 *
 * @returns Object with boolean flags for window type detection
 * @returns {boolean} isWorldView - True if this is the player-facing World Window
 * @returns {boolean} isArchitectView - True if this is the DM's Architect Window
 *
 * @example
 * // Hide DM-only UI components in World View
 * function App() {
 *   const { isArchitectView } = useWindowType();
 *   return (
 *     <>
 *       {isArchitectView && <Sidebar />}
 *       <CanvasManager />
 *     </>
 *   );
 * }
 *
 * @example
 * // Disable editing features in World View
 * function CanvasManager() {
 *   const { isWorldView } = useWindowType();
 *
 *   const handleDrop = (e) => {
 *     if (isWorldView) return; // Block file drops in World View
 *     // ... process drop
 *   };
 * }
 *
 * @see {@link file://./src/components/SyncManager.tsx SyncManager.tsx} for state sync usage
 * @see {@link file://./src/App.tsx App.tsx} for UI sanitization usage
 * @see {@link file://./src/components/Canvas/CanvasManager.tsx CanvasManager.tsx} for interaction restrictions
 * @see {@link file://../electron/main.ts electron/main.ts:243-263} for World Window creation
 */
export const useWindowType = () => {
  const params = new URLSearchParams(window.location.search);
  const isWorldView = params.get('type') === 'world';

  return {
    /**
     * True if this is the World View (player-facing projection window)
     * - UI should be sanitized (no DM tools)
     * - Editing interactions should be disabled
     * - State updates received via IPC (consumer mode)
     */
    isWorldView,

    /**
     * True if this is the Architect View (DM's control panel)
     * - Full UI with toolbars, sidebar, and editing tools
     * - All interactions enabled
     * - State changes broadcast via IPC (producer mode)
     */
    isArchitectView: !isWorldView,
  };
};
