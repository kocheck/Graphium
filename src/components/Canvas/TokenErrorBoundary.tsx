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
 * - Returns null (hides broken token) instead of showing error UI
 * - Logs error to console with token ID for debugging
 * - Other tokens continue rendering normally
 *
 * **Difference from PrivacyErrorBoundary:**
 * - PrivacyErrorBoundary: App-level, shows error UI, sanitizes for reporting
 * - TokenErrorBoundary: Token-level, silently hides broken tokens, logs only
 *
 * **Error handling architecture:**
 * - Canvas wraps entire board with PrivacyErrorBoundary (app-level errors)
 * - Each token wrapped with TokenErrorBoundary (token-level errors)
 * - Token errors logged but don't break the game
 *
 * @example
 * // Wrap each token in Canvas component
 * {tokens.map(token => (
 *   <TokenErrorBoundary key={token.id} tokenId={token.id}>
 *     <Token data={token} />
 *   </TokenErrorBoundary>
 * ))}
 *
 * @example
 * // Debugging: Check console for token errors
 * // Look for "Token rendering error:" with token ID
 *
 * @component
 */

import { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Props for TokenErrorBoundary
 *
 * @property children - Token component to protect
 * @property tokenId - Optional token ID for error logging/debugging
 */
interface Props {
  children: ReactNode;
  tokenId?: string;
}

/**
 * State for TokenErrorBoundary
 *
 * @property hasError - Whether an error has been caught
 */
interface State {
  hasError: boolean;
}

/**
 * Token-level error boundary that silently hides broken tokens
 */
class TokenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * React lifecycle method called when error is caught
   * Immediately sets hasError to trigger null render
   */
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  /**
   * React lifecycle method called after error is caught
   * Logs error details with token ID for debugging
   *
   * @param error - The error that was thrown during token rendering
   * @param errorInfo - React error info including component stack
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Token rendering error:', error, errorInfo);
    console.error('Token ID:', this.props.tokenId);
  }

  /**
   * Renders children if no error, null if error occurred
   * Returning null hides broken token without UI indication
   *
   * @returns {ReactNode | null} Children or null
   */
  render() {
    if (this.state.hasError) {
      // Return null to hide the broken token instead of showing an error UI
      // This prevents the entire canvas from breaking if one token fails
      return null;
    }

    return this.props.children;
  }
}

export default TokenErrorBoundary;
