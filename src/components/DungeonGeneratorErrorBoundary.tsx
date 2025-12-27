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

import { ErrorFallbackUI } from './ErrorFallbackUI';

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
