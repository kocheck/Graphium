/**
 * Error Fallback UI Component
 *
 * Reusable error display component for error boundaries.
 * Shows user-friendly error messages with retry and close options.
 *
 * @component
 */

import { useGameStore } from '../store/gameStore';

interface ErrorFallbackUIProps {
  error?: Error;
  onReset: () => void;
}

/**
 * Error fallback UI component
 * Displays user-friendly error message with retry and close options
 */
export function ErrorFallbackUI({ error, onReset }: ErrorFallbackUIProps) {
  const clearDungeonDialog = useGameStore((state) => state.clearDungeonDialog);

  const handleClose = () => {
    onReset();
    clearDungeonDialog();
  };

  const handleRetry = () => {
    onReset();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-dialog-title"
    >
      <div
        className="bg-[var(--app-bg)] border border-red-500 rounded-lg shadow-2xl p-6 max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-red-500 text-sm">!</span>
          </div>
          <div className="flex-1">
            <h2
              id="error-dialog-title"
              className="text-lg font-semibold mb-2"
              style={{ color: 'var(--app-text)' }}
            >
              Dungeon Generation Error
            </h2>
            <p className="text-sm mb-3" style={{ color: 'var(--app-text-muted)' }}>
              Something went wrong while generating the dungeon. This can happen if:
            </p>
            <ul className="text-sm space-y-1 mb-3 ml-4 list-disc" style={{ color: 'var(--app-text-muted)' }}>
              <li>Room size constraints are too restrictive</li>
              <li>Requesting too many rooms for the available space</li>
              <li>Collision detection prevented valid placements</li>
            </ul>
            {error && (
              <details className="text-xs mb-3">
                <summary className="cursor-pointer" style={{ color: 'var(--app-text-muted)' }}>
                  Technical details
                </summary>
                <pre
                  className="mt-2 p-2 rounded overflow-auto max-h-32"
                  style={{ backgroundColor: 'var(--app-bg-subtle)', color: 'var(--app-text-muted)' }}
                >
                  {error.message}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded bg-[var(--app-bg-subtle)] hover:bg-[var(--app-bg-hover)] transition"
            style={{ color: 'var(--app-text)' }}
          >
            Close
          </button>
          <button
            onClick={handleRetry}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
