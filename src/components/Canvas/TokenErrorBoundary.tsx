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
import { captureErrorContext, logErrorWithContext, exportErrorToClipboard, type ErrorContext } from '../../utils/errorBoundaryUtils';

/**
 * Props for TokenErrorBoundary
 *
 * @property children - Token component to protect
 * @property tokenId - Optional token ID for error logging/debugging
 * @property tokenData - Optional token data for debugging context
 */
interface Props {
  children: ReactNode;
  tokenId?: string;
  tokenData?: Record<string, any>;
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
      errorCount: 1,
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

    // Capture comprehensive error context
    const context = captureErrorContext(error, errorInfo, {
      componentName: 'TokenErrorBoundary',
      props: { tokenId, tokenData },
      state: this.state,
    });

    // Log with full context
    logErrorWithContext(context);

    // Additional token-specific logging
    console.error('Token rendering error:', error, errorInfo);
    console.error('Token ID:', tokenId);
    if (tokenData) {
      console.error('Token Data:', tokenData);
    }

    // Store context in state for dev mode debugging
    if (isDev) {
      this.setState({ errorContext: context });
    }

    // Expose to window for E2E testing
    if (isDev || import.meta.env.MODE === 'test') {
      (window as any).__LAST_TOKEN_ERROR__ = {
        tokenId,
        error: error.message,
        timestamp: Date.now(),
        context,
      };
    }
  }

  /**
   * Toggle debug overlay visibility
   */
  handleToggleDebug = () => {
    this.setState((prev) => ({ showDebugOverlay: !prev.showDebugOverlay }));
  };

  /**
   * Copy error to clipboard
   */
  handleCopyError = async () => {
    const { errorContext } = this.state;
    if (errorContext) {
      const success = await exportErrorToClipboard(errorContext);
      if (success) {
        alert('Error details copied to clipboard!');
      } else {
        alert('Failed to copy error details');
      }
    }
  };

  /**
   * Renders children if no error, null if error occurred (production)
   * In dev mode, shows a debug error indicator that can be clicked
   *
   * @returns {ReactNode | null} Children, debug overlay, or null
   */
  render() {
    const { hasError, errorContext, showDebugOverlay } = this.state;
    const { children, tokenId } = this.props;
    const isDev = import.meta.env.DEV;

    if (hasError) {
      // In production: Return null to hide the broken token
      if (!isDev) {
        return null;
      }

      // In dev mode: Show debug error indicator
      return (
        <div
          data-testid={`token-error-${tokenId || 'unknown'}`}
          style={{
            position: 'absolute',
            width: '50px',
            height: '50px',
            backgroundColor: 'rgba(255, 0, 0, 0.7)',
            border: '2px solid red',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '24px',
            zIndex: 9999,
          }}
          onClick={this.handleToggleDebug}
          title={`Token Error: ${tokenId || 'unknown'}\nClick to view details`}
        >
          ⚠
          {showDebugOverlay && errorContext && (
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                padding: '20px',
                borderRadius: '8px',
                border: '2px solid #f00',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflow: 'auto',
                zIndex: 10000,
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 15px 0', color: '#f00' }}>
                Token Error Debug Info
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <strong>Token ID:</strong> {tokenId || 'N/A'}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong>Error:</strong> {errorContext.error.name}
                <br />
                <strong>Message:</strong> {errorContext.error.message}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong>Timestamp:</strong> {new Date(errorContext.timestamp).toLocaleString()}
              </div>

              {errorContext.error.stack && (
                <details style={{ marginBottom: '15px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                    Stack Trace
                  </summary>
                  <pre
                    style={{
                      backgroundColor: '#000',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      overflow: 'auto',
                      maxHeight: '200px',
                    }}
                  >
                    {errorContext.error.stack}
                  </pre>
                </details>
              )}

              {errorContext.componentStack && (
                <details style={{ marginBottom: '15px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                    Component Stack
                  </summary>
                  <pre
                    style={{
                      backgroundColor: '#000',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      overflow: 'auto',
                      maxHeight: '200px',
                    }}
                  >
                    {errorContext.componentStack}
                  </pre>
                </details>
              )}

              {errorContext.props && (
                <details style={{ marginBottom: '15px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                    Component Props
                  </summary>
                  <pre
                    style={{
                      backgroundColor: '#000',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      overflow: 'auto',
                      maxHeight: '200px',
                    }}
                  >
                    {JSON.stringify(errorContext.props, null, 2)}
                  </pre>
                </details>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button
                  onClick={this.handleCopyError}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Copy Error
                </button>
                <button
                  onClick={this.handleToggleDebug}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return children;
  }
}

export default TokenErrorBoundary;
