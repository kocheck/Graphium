/**
 * Dungeon Generator Error Boundary
 *
 * Wraps the dungeon generator dialog to gracefully handle generation errors
 * without crashing the entire application.
 *
 * **Purpose:**
 * When generating dungeons with random algorithms, edge cases can occur:
 * - Invalid room placements causing infinite collision loops
 * - Room size constraints creating impossible layouts
 * - Arithmetic errors in positioning calculations
 *
 * This boundary catches these errors and provides user-friendly feedback.
 *
 * **Behavior:**
 * - Catches errors during dungeon generation or dialog rendering
 * - Shows user-friendly error message with retry option
 * - Logs detailed error info to console for debugging
 * - Allows user to close dialog and try again
 * - Clears error state when dialog is reopened
 *
 * **Error Handling Strategy:**
 * - Generation errors: Show message, allow retry with different parameters
 * - Dialog errors: Close dialog, user can reopen
 * - All errors logged with stack traces for development
 *
 * @example
 * // Wrap DungeonGeneratorDialog in App.tsx
 * <DungeonGeneratorErrorBoundary>
 *   <DungeonGeneratorDialog />
 * </DungeonGeneratorErrorBoundary>
 *
 * @example
 * // Debugging: Check console for detailed error info
 * // Look for "Dungeon generator error:" with full stack trace
 *
 * @component
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * Props for DungeonGeneratorErrorBoundary
 *
 * @property children - DungeonGeneratorDialog component to protect
 */
interface Props {
  children: ReactNode;
}

/**
 * State for DungeonGeneratorErrorBoundary
 *
 * @property hasError - Whether an error has been caught
 * @property error - The error that was caught (for display)
 */
interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error fallback UI component
 * Displays user-friendly error message with retry and close options
 */
function ErrorFallbackUI({ error, onReset }: { error?: Error; onReset: () => void }) {
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

/**
 * Error boundary that catches dungeon generation errors
 */
class DungeonGeneratorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  /**
   * React lifecycle method called when error is caught
   * Sets hasError to trigger error UI display
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * React lifecycle method called after error is caught
   * Logs comprehensive error details for debugging
   *
   * @param error - The error thrown during generation
   * @param errorInfo - React error info including component stack
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dungeon generator error:', error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);
  }

  /**
   * Resets error state to allow retry
   */
  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  /**
   * Renders children if no error, error UI if error occurred
   *
   * @returns {ReactNode} Children or error UI
   */
  render() {
    if (this.state.hasError) {
      return <ErrorFallbackUI error={this.state.error} onReset={this.resetError} />;
    }

    return this.props.children;
  }
}

export default DungeonGeneratorErrorBoundary;
