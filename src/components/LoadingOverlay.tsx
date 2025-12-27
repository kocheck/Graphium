/**
 * LoadingOverlay Component
 *
 * Full-screen blocking overlay displayed in World View when game is paused.
 * Prevents players from seeing live updates as the DM prepares the next scene.
 *
 * **Purpose:**
 * When the DM pauses the game (via toolbar button), this overlay appears in the
 * World View window, showing a "Please Wait" message while the DM:
 * - Moves tokens to new positions
 * - Switches to a different map
 * - Adjusts fog of war visibility
 * - Changes grid settings
 *
 * **Critical Behavior:**
 * - **World View Only**: This component is conditionally rendered in App.tsx
 *   with `{isWorldView && <LoadingOverlay />}` to ensure it ONLY appears in
 *   the player-facing window, never in the DM's Architect View
 * - **Highest z-index**: Uses z-[9999] to block all canvas content (tokens,
 *   drawings, map, grid, fog of war, minimap)
 * - **Prevents content flashing**: Blocks view during map changes to prevent
 *   players from seeing mid-transition state
 *
 * **Visual Design:**
 * - Full-screen black overlay (90% opacity)
 * - Backdrop blur for privacy (8px blur prevents seeing through)
 * - Centered spinner animation (rotating border)
 * - Friendly message: "The Dungeon Master is preparing the next scene..."
 * - Smooth fade-in animation (via Tailwind animate-fade-in)
 *
 * **State Management:**
 * - Reads `isGamePaused` from Zustand gameStore
 * - PauseManager keeps this state synchronized with main process
 * - Re-renders automatically when pause state changes
 *
 * **Performance:**
 * - Returns null when not paused (no DOM overhead)
 * - No complex logic or subscriptions
 * - Simple conditional rendering based on single boolean
 *
 * **Accessibility:**
 * - High contrast white text on black background
 * - Large text (3xl heading, xl paragraph) for readability
 * - Clear messaging about current state
 *
 * **Usage:**
 * Automatically included in App.tsx for World View only:
 *
 * @example
 * ```tsx
 * // In App.tsx (World View conditional rendering)
 * {isWorldView && <LoadingOverlay />}
 * ```
 *
 * @example
 * ```
 * DM Workflow:
 * 1. DM clicks "PAUSED" button in Architect View toolbar
 * 2. Main process toggles isGamePaused = true
 * 3. PauseManager receives PAUSE_STATE_CHANGED event
 * 4. gameStore.isGamePaused updates to true
 * 5. LoadingOverlay appears in World View (this component)
 * 6. DM rearranges tokens, changes map, etc.
 * 7. DM clicks "PLAYING" button
 * 8. LoadingOverlay disappears, players see updated state
 * ```
 *
 * @returns {JSX.Element | null} Full-screen overlay or null if not paused
 *
 * @see {@link PauseManager} Synchronizes pause state via IPC
 * @see {@link App.tsx} Contains pause toggle button and conditional rendering
 * @see {@link gameStore.ts} Contains isGamePaused state
 * @see {@link electron/main.ts} Main process IPC handlers for pause state
 */

import { useGameStore } from '../store/gameStore';

export function LoadingOverlay() {
  // Subscribe to pause state from Zustand store
  const isGamePaused = useGameStore((state) => state.isGamePaused);

  // Don't render overlay when game is not paused
  if (!isGamePaused) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] animate-fade-in"
      style={{
        backdropFilter: 'blur(8px)', // Blur canvas content for privacy
      }}
    >
      <div className="text-center">
        {/* Spinner Animation */}
        <div className="mb-6">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
        </div>

        {/* Loading Message */}
        <h2 className="text-3xl font-bold text-white mb-2">Please Wait</h2>
        <p className="text-xl text-gray-300">The Dungeon Master is preparing the next scene...</p>
      </div>
    </div>
  );
}
