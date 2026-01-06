/**
 * Update Manager Error Boundary
 *
 * Wraps the UpdateManager component to gracefully handle update-related errors
 * without crashing the entire application.
 *
 * **Purpose:**
 * When checking for or downloading updates, various errors can occur:
 * - Network failures during GitHub Release API calls
 * - Malformed update metadata (invalid latest.yml)
 * - Signature verification failures
 * - Download interruptions or corrupted files
 * - IPC communication failures with main process
 *
 * This boundary catches these errors and provides user-friendly feedback.
 *
 * **Behavior:**
 * - Catches errors during update checking, downloading, or UI rendering
 * - Shows user-friendly error message with retry option
 * - Logs detailed error info to console for debugging
 * - Allows user to close dialog and try again
 * - Clears error state when dialog is reopened
 *
 * **Error Handling Strategy:**
 * - Network errors: Show message, allow retry
 * - Update metadata errors: Show message with guidance
 * - IPC errors: Log to console, show generic message
 * - All errors logged with stack traces for development
 *
 * **Common Error Scenarios:**
 * 1. No internet connection → "Cannot check for updates. Please check your connection."
 * 2. GitHub API rate limit → "Too many requests. Please try again later."
 * 3. Invalid release metadata → "Update information is corrupted. Please try again."
 * 4. Download interrupted → "Download failed. Please retry."
 *
 * @example
 * // Wrap UpdateManager in App.tsx
 * <UpdateManagerErrorBoundary>
 *   <UpdateManager isOpen={isOpen} onClose={onClose} />
 * </UpdateManagerErrorBoundary>
 *
 * @example
 * // Debugging: Check console for detailed error info
 * // Look for "Update manager error:" with full stack trace
 *
 * @component
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { UpdateErrorFallbackUI } from './UpdateErrorFallbackUI';

/**
 * Props for UpdateManagerErrorBoundary
 *
 * @property children - UpdateManager component to protect
 */
interface Props {
  children: ReactNode;
}

/**
 * State for UpdateManagerErrorBoundary
 *
 * @property hasError - Whether an error has been caught
 * @property errorMessage - The error message (for display)
 * @property errorStack - The error stack trace (for debugging)
 */
interface State {
  hasError: boolean;
  errorMessage?: string;
  errorStack?: string;
}

/**
 * Error boundary that catches update manager errors
 *
 * Prevents update-related errors from crashing the main application.
 * Users can retry the update check or close the dialog to continue using the app.
 */
class UpdateManagerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: undefined, errorStack: undefined };
  }

  /**
   * React lifecycle method called when error is caught
   * Sets hasError to trigger error UI display
   *
   * Stores only error.message and error.stack as strings to avoid
   * storing non-serializable Error objects or circular references.
   *
   * @param error - The error thrown during update operations
   * @returns New state with error flag and serializable error data
   */
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  /**
   * React lifecycle method called after error is caught
   * Logs comprehensive error details for debugging
   *
   * **Logged Information:**
   * - Error message and stack trace
   * - Component stack where error occurred
   * - React error info object
   *
   * **Production Logging:**
   * These logs are helpful for:
   * - Debugging update issues reported by users
   * - Identifying GitHub API problems
   * - Tracking IPC communication failures
   *
   * @param error - The error thrown during update operations
   * @param errorInfo - React error info including component stack
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Update manager error:', error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);

    // Log specific error types for better debugging
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      console.error(
        '[UpdateManager] Network error detected. Check internet connection and GitHub status.'
      );
    } else if (error.message.includes('IPC') || error.message.includes('invoke')) {
      console.error(
        '[UpdateManager] IPC communication error. Check main process autoUpdater handlers.'
      );
    } else if (
      error.message.toLowerCase().includes('signature') ||
      error.message.toLowerCase().includes('verify')
    ) {
      console.error(
        '[UpdateManager] Signature verification error. Ensure app is properly code-signed.'
      );
    }
  }

  /**
   * Resets error state to allow retry
   *
   * Called when user clicks "Try Again" or reopens the dialog.
   * Clears the error state so UpdateManager can render normally.
   */
  resetError = () => {
    this.setState({ hasError: false, errorMessage: undefined, errorStack: undefined });
  };

  /**
   * Renders children if no error, error UI if error occurred
   *
   * @returns {ReactNode} UpdateManager component or error fallback UI
   */
  render() {
    if (this.state.hasError) {
      return <UpdateErrorFallbackUI errorMessage={this.state.errorMessage} onReset={this.resetError} />;
    }

    return this.props.children;
  }
}

export default UpdateManagerErrorBoundary;
