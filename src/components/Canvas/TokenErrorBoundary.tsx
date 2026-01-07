/**
 * Token-Level React Error Boundary
 *
 * Wraps individual token components to prevent one broken token from
 * crashing the entire canvas. Part of defensive error handling strategy.
 *
 * **Purpose:**
 * When rendering hundreds of tokens on the canvas, a single corrupted
 * token (e.g., invalid image data, malformed state) could crash the entire
 * game board without this boundary. This component isolates failures.
 *
 * **Behavior:**
 * - Catches errors during token rendering
 * - Returns null (hides broken token) instead of showing error UI in production
 * - In dev mode: Shows debug overlay with error details
 * - Logs error to console with token ID for debugging
 * - Tracks error history for QA and debugging
 * - Other tokens continue rendering normally
 *
 * **Dev Mode Features:**
 * - Visual error indicator on canvas
 * - Click to view full error details
 * - Copy error to clipboard
 * - View component state at time of error
 * - Test data attributes for E2E testing
 *
 * **Difference from PrivacyErrorBoundary:**
 * - PrivacyErrorBoundary: App-level, shows error UI, sanitizes for reporting
 * - TokenErrorBoundary: Token-level, silently hides broken tokens (prod), logs only
 *
 * **Error handling architecture:**
 * - Canvas wraps entire board with PrivacyErrorBoundary (app-level errors)
 * - Each token wrapped with TokenErrorBoundary (token-level errors)
 * - Token errors logged but don't break the game
 *
 * @example
 * // Wrap each token in Canvas component
 * {tokens.map(token => (
 *   <TokenErrorBoundary key={token.id} tokenId={token.id} tokenData={token}>
 *     <Token data={token} />
 *   </TokenErrorBoundary>
 * ))}
 *
 * @example
 * // Debugging: Check console for token errors
 * // Look for "Token rendering error:" with token ID
 * // In dev mode, click the red error marker on canvas
 *
 * @component
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Group, Circle, Text } from 'react-konva';
import {
  captureErrorContext,
  logErrorWithContext,
  exportErrorToClipboard,
  type ErrorContext,
} from '../../utils/errorBoundaryUtils';
import { useGameStore } from '../../store/gameStore';

/**
 * Props for TokenErrorBoundary
 *
 * @property children - Token component to protect
 * @property tokenId - Optional token ID for error logging/debugging
 * @property tokenData - Optional token data for debugging context
 * @property onShowToast - Optional callback to show toast notifications (improves testability and reusability)
 */
interface Props {
  children: ReactNode;
  tokenId?: string;
  tokenData?: Record<string, unknown>;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * State for TokenErrorBoundary
 *
 * @property hasError - Whether an error has been caught
 * @property errorContext - Full error context for debugging (dev mode only)
 * @property showDebugOverlay - Whether to show debug overlay (dev mode only)
 * @property errorCount - Number of errors caught (for tracking flaky errors)
 */
interface State {
  hasError: boolean;
  errorContext: ErrorContext | null;
  showDebugOverlay: boolean;
  errorCount: number;
}

/**
 * Token-level error boundary that silently hides broken tokens in production
 * and shows debug information in development mode
 */
class TokenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorContext: null,
      showDebugOverlay: false,
      errorCount: 0,
    };
  }

  /**
   * React lifecycle method called when error is caught
   * Immediately sets hasError to trigger null render
   */
  static getDerivedStateFromError(): Partial<State> {
    return {
      hasError: true,
    };
  }

  /**
   * React lifecycle method called after error is caught
   * Logs error details with token ID for debugging
   * Captures comprehensive error context in dev mode
   *
   * @param error - The error that was thrown during token rendering
   * @param errorInfo - React error info including component stack
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { tokenId, tokenData } = this.props;
    const isDev = import.meta.env.DEV;

    // Update state using functional form to handle rapid error occurrences safely
    // This ensures we get the latest error count even if multiple errors occur rapidly
    this.setState((prevState) => {
      const nextErrorCount = prevState.errorCount + 1;

      // Capture comprehensive error context with updated error count
      const context = captureErrorContext(error, errorInfo, {
        componentName: 'TokenErrorBoundary',
        props: { tokenId, tokenData },
        state: { ...prevState, errorCount: nextErrorCount },
      });

      // Log with full context
      logErrorWithContext(context);

      // Additional token-specific logging
      console.error('Token rendering error:', error, errorInfo);
      console.error('Token ID:', tokenId);
      if (tokenData) {
        console.error('Token Data:', tokenData);
      }

      // Expose to window for E2E testing
      if (isDev || import.meta.env.MODE === 'test') {
        window.__LAST_TOKEN_ERROR__ = {
          tokenId,
          error: error.message,
          timestamp: Date.now(),
          context,
        };
      }

      return {
        errorCount: nextErrorCount,
        errorContext: isDev ? context : prevState.errorContext,
      };
    });
  }

  /**
   * Toggle debug overlay visibility
   */
  handleToggleDebug = () => {
    this.setState((prev) => ({ showDebugOverlay: !prev.showDebugOverlay }));
  };

  /**
   * Copy error details to the clipboard and show a toast notification
   */
  handleCopyError = async () => {
    const { errorContext } = this.state;
    const { onShowToast } = this.props;

    if (errorContext) {
      const success = await exportErrorToClipboard(errorContext);

      // Use callback if provided, otherwise fall back to direct store access
      // Note: Direct store access via getState() is acceptable in class components
      // where hooks cannot be used. While this creates coupling to the game store,
      // it provides a fallback when the parent component doesn't provide the callback.
      // Consider making onShowToast mandatory if this coupling becomes problematic.
      const showToast = onShowToast || useGameStore.getState().showToast;

      if (success) {
        showToast('Error details copied to clipboard!', 'success');
      } else {
        showToast('Failed to copy error details', 'error');
      }
    }
  };

  /**
   * Renders children if no error, null if error occurred (production)
   * In dev mode, shows a Konva-based debug error indicator with Portal-based overlay
   *
   * @returns {ReactNode | null} Children, debug indicator + overlay, or null
   */
  render() {
    const { hasError, errorContext, showDebugOverlay } = this.state;
    const { children, tokenId, tokenData } = this.props;
    const isDev = import.meta.env.DEV;

    if (hasError) {
      // In production: Return null to hide the broken token
      if (!isDev) {
        return null;
      }

      // In dev mode: Show Konva-based error indicator with Portal overlay
      // Get token position from tokenData, fallback to origin if not available
      const tokenX = (tokenData as { x?: number })?.x ?? 0;
      const tokenY = (tokenData as { y?: number })?.y ?? 0;

      return (
        <>
          {/* Konva error indicator on canvas */}
          <Group x={tokenX} y={tokenY} onClick={this.handleToggleDebug}>
            {/* Red circle with warning icon */}
            <Circle radius={25} fill="rgba(220, 38, 38, 0.7)" stroke="#ef4444" strokeWidth={2} />
            <Text text="⚠" fontSize={28} fill="white" offsetX={9} offsetY={14} />
          </Group>

          {/* Portal for debug overlay in DOM */}
          {showDebugOverlay &&
            errorContext &&
            createPortal(
              <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-neutral-900 text-white p-5 rounded-lg border-2 border-red-500 max-w-[600px] max-h-[80vh] overflow-auto z-[10000] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                data-testid={`token-error-overlay-${tokenId || 'unknown'}`}
              >
                <h3 className="m-0 mb-4 text-red-500">Token Error Debug Info</h3>

                <div className="mb-4">
                  <strong>Token ID:</strong> {tokenId || 'N/A'}
                </div>

                <div className="mb-4">
                  <strong>Error:</strong> {errorContext.error.name}
                  <br />
                  <strong>Message:</strong> {errorContext.error.message}
                </div>

                <div className="mb-4">
                  <strong>Timestamp:</strong> {new Date(errorContext.timestamp).toLocaleString()}
                </div>

                {errorContext.error.stack && (
                  <details className="mb-4">
                    <summary className="cursor-pointer font-bold">Stack Trace</summary>
                    <pre className="bg-black p-2.5 rounded text-[11px] overflow-auto max-h-[200px]">
                      {errorContext.error.stack}
                    </pre>
                  </details>
                )}

                {errorContext.componentStack && (
                  <details className="mb-4">
                    <summary className="cursor-pointer font-bold">Component Stack</summary>
                    <pre className="bg-black p-2.5 rounded text-[11px] overflow-auto max-h-[200px]">
                      {errorContext.componentStack}
                    </pre>
                  </details>
                )}

                {errorContext.props && (
                  <details className="mb-4">
                    <summary className="cursor-pointer font-bold">Component Props</summary>
                    <pre className="bg-black p-2.5 rounded text-[11px] overflow-auto max-h-[200px]">
                      {JSON.stringify(errorContext.props, null, 2)}
                    </pre>
                  </details>
                )}

                <div className="flex gap-2.5 mt-4">
                  <button
                    onClick={this.handleCopyError}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white border-none rounded cursor-pointer text-sm"
                  >
                    Copy Error
                  </button>
                  <button
                    onClick={this.handleToggleDebug}
                    className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white border-none rounded cursor-pointer text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>,
              document.body,
            )}
        </>
      );
    }

    return children;
  }
}

export default TokenErrorBoundary;
