/**
 * LoadingOverlay Component
 *
 * Displays a full-screen overlay when the game is paused, blocking all content
 * from the World View while the DM prepares changes in the background.
 *
 * Features:
 * - Highest z-index to block all map content
 * - Full-screen black background with transparency
 * - Loading message for players
 * - Fade-in/fade-out animation for smooth transitions
 */

import { useGameStore } from '../store/gameStore';

export function LoadingOverlay() {
  const isGamePaused = useGameStore((state) => state.isGamePaused);

  if (!isGamePaused) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] animate-fade-in"
      style={{
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="text-center">
        <div className="mb-6">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Please Wait</h2>
        <p className="text-xl text-gray-300">The Dungeon Master is preparing the next scene...</p>
      </div>
    </div>
  );
}
