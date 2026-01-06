/**
 * Update Error Fallback UI Component
 *
 * Specialized error display component for auto-updater errors.
 * Shows user-friendly error messages with retry and close options.
 * Themed for update-related errors (network, signature, download failures).
 *
 * @component
 */

import { useMemo } from 'react';

interface UpdateErrorFallbackUIProps {
  error?: Error;
  onReset: () => void;
}

/**
 * Update-specific error messages
 */
const updateErrorMessages = {
  title: [
    '💀 The Update Ritual Failed',
    '⚠️ Arcane Interference Detected',
    '🎲 Rolled a 1 on Update Check',
    '❌ Divination Failed',
    '🔥 The Summoning Backfired',
  ],
  description: [
    'The cosmic archives could not be reached. This mystical mishap may occur when:',
    'Communication with the GitHub Oracles has faltered. Common causes include:',
    'The ritual fizzled due to interference. This can happen when:',
    'Cannot reach the repository of versions. Potential reasons:',
    'Connection to the Archive of Releases was severed. Check for:',
  ],
  hints: [
    'No internet connection or unstable network',
    'GitHub servers are temporarily unreachable',
    'Firewall blocking update requests',
    'Signature verification issues (requires code signing)',
    'Corrupted update metadata from previous attempts',
  ],
};

/**
 * Randomly selects a message from an array
 */
const rollForMessage = (messages: string[]): string => {
  return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * Update error fallback UI component
 * Displays user-friendly error message with retry and close options
 */
export function UpdateErrorFallbackUI({ error, onReset }: UpdateErrorFallbackUIProps) {
  // Roll for random error messages (memoized per error instance to keep them stable)
  const errorTitle = useMemo(() => rollForMessage(updateErrorMessages.title), [error]);
  const errorDesc = useMemo(() => rollForMessage(updateErrorMessages.description), [error]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={onReset}
    >
      <div
        className="bg-[var(--app-bg)] border border-red-500 rounded-lg shadow-2xl p-6 max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-error-dialog-title"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-red-500 text-sm">!</span>
          </div>
          <div className="flex-1">
            <h2
              id="update-error-dialog-title"
              className="text-lg font-semibold mb-2"
              style={{ color: 'var(--app-text)' }}
            >
              {errorTitle}
            </h2>
            <p className="text-sm mb-3" style={{ color: 'var(--app-text-muted)' }}>
              {errorDesc}
            </p>
            <ul className="text-sm space-y-1 mb-3 ml-4 list-disc" style={{ color: 'var(--app-text-muted)' }}>
              {updateErrorMessages.hints.map((hint, index) => (
                <li key={index}>{hint}</li>
              ))}
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
            onClick={onReset}
            className="px-4 py-2 rounded bg-[var(--app-bg-subtle)] hover:bg-[var(--app-bg-hover)] transition"
            style={{ color: 'var(--app-text)' }}
          >
            Close
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
