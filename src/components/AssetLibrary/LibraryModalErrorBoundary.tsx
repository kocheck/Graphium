import React, { Component, ReactNode } from 'react';

/**
 * Props for LibraryModalErrorBoundary
 */
interface LibraryModalErrorBoundaryProps {
  children: ReactNode;
  /** Callback when modal should close due to error */
  onClose?: () => void;
}

/**
 * State for LibraryModalErrorBoundary
 */
interface LibraryModalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * LibraryModalErrorBoundary - Error boundary for library modal components
 *
 * Wraps modal components in the Asset Library (TokenMetadataEditor) to prevent
 * a modal crash from breaking the entire library interface.
 *
 * **Behavior on Error:**
 * - Shows user-friendly error message in modal overlay
 * - Provides "Close" button to dismiss broken modal
 * - Logs error details to console
 * - Calls onClose callback to reset parent state
 *
 * **Usage:**
 * ```tsx
 * <LibraryModalErrorBoundary onClose={handleModalClose}>
 *   <TokenMetadataEditor {...props} />
 * </LibraryModalErrorBoundary>
 * ```
 *
 * **Design Rationale:**
 * Unlike CanvasOverlayErrorBoundary (which silently fails), modals need to inform
 * the user that something went wrong since they're blocking UI interactions.
 * Users need a way to dismiss the broken modal and return to normal operation.
 *
 * @see DungeonGeneratorErrorBoundary for similar modal error pattern
 */
class LibraryModalErrorBoundary extends Component<
  LibraryModalErrorBoundaryProps,
  LibraryModalErrorBoundaryState
> {
  constructor(props: LibraryModalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): LibraryModalErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[LibraryModalErrorBoundary] Modal component crashed:', error, errorInfo);

    // Optional: Send error to monitoring service
    // ErrorReportingService.captureException(error, {
    //   context: 'library-modal',
    //   componentStack: errorInfo.componentStack,
    // });
  }

  handleClose = () => {
    const { onClose } = this.props;

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
    });

    // Call parent's onClose to dismiss modal
    if (onClose) {
      onClose();
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={this.handleClose}
        >
          <div
            className="max-w-md w-full rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--app-bg-base)',
            }}
          >
            {/* Header */}
            <div className="p-4 border-b border-neutral-700 bg-neutral-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Something went wrong</h2>
                <button
                  onClick={this.handleClose}
                  className="p-2 hover:bg-neutral-700 rounded text-white"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-neutral-300">
                An error occurred while loading this modal. This has been logged for investigation.
              </p>

              {error && (
                <details className="mt-4">
                  <summary className="text-neutral-400 text-sm cursor-pointer hover:text-neutral-300">
                    Error Details
                  </summary>
                  <pre className="mt-2 p-3 bg-neutral-900 text-red-400 text-xs rounded overflow-x-auto">
                    {error.toString()}
                  </pre>
                </details>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-700 bg-neutral-800 flex justify-end">
              <button
                onClick={this.handleClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default LibraryModalErrorBoundary;
