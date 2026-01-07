import { Component, ReactNode, ErrorInfo } from 'react';
import { rollForMessage } from '../utils/systemMessages';
import { captureErrorContext, logErrorWithContext } from '../utils/errorBoundaryUtils';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorTitle?: string;
  errorDesc?: string;
}

/**
 * Error Boundary for Asset Processing Operations
 *
 * Catches errors during image upload, processing, and Web Worker operations.
 * Prevents the entire app from crashing when asset processing fails.
 *
 * **Why This Matters:**
 * - Web Worker errors can be asynchronous and hard to catch
 * - File upload errors (corrupt files, unsupported formats) shouldn't crash the UI
 * - IPC errors during asset storage should be handled gracefully
 *
 * **Usage:**
 * Wrap components that handle file uploads or asset processing:
 *
 * @example
 * <AssetProcessingErrorBoundary>
 *   <ImageCropper onConfirm={handleCropConfirm} />
 * </AssetProcessingErrorBoundary>
 *
 * **Recovery:**
 * - Shows user-friendly error message
 * - Allows retry without refreshing the page
 * - Logs detailed error info to console for debugging
 */
class AssetProcessingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorTitle: undefined,
      errorDesc: undefined,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isDev = import.meta.env.DEV;
    const isTest = import.meta.env.MODE === 'test';

    // Capture comprehensive error context
    const context = captureErrorContext(error, errorInfo, {
      componentName: 'AssetProcessingErrorBoundary',
      props: this.props,
      state: this.state,
    });

    // Log with full context
    logErrorWithContext(context);

    // Expose to window for E2E testing
    if (isDev || isTest) {
      window.__LAST_ASSET_PROCESSING_ERROR__ = {
        error: error.message,
        timestamp: Date.now(),
        context,
      };
    }

    // Legacy logging for backward compatibility
    console.error('[AssetProcessingErrorBoundary] Caught error:', error);
    console.error('[AssetProcessingErrorBoundary] Error info:', errorInfo);

    // Roll for error messages once when error occurs to keep them stable across re-renders
    const errorTitle = rollForMessage('ERROR_ASSET_PROCESSING_TITLE');
    const errorDesc = rollForMessage('ERROR_ASSET_PROCESSING_DESC');

    // Update state with full error info and rolled messages
    this.setState({
      error,
      errorInfo,
      errorTitle,
      errorDesc,
    });
  }

  handleRetry = () => {
    // Reset error state to dismiss the error message
    // Note: This does not retry the failed operation. The user must
    // manually re-upload or re-crop the image after dismissing.
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorTitle: undefined,
      errorDesc: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            margin: '20px',
            backgroundColor: '#fee',
            border: '2px solid #c33',
            borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h3 style={{ color: '#c33', margin: '0 0 10px 0' }}>{this.state.errorTitle}</h3>
          <p style={{ margin: '10px 0' }}>{this.state.errorDesc}</p>
          <ul style={{ margin: '10px 0 10px 20px' }}>
            <li>The file is corrupt or unsupported</li>
            <li>The file is too large</li>
            <li>Web Worker encountered an error</li>
            <li>Storage operation failed</li>
          </ul>

          {this.state.error && (
            <details style={{ margin: '10px 0', cursor: 'pointer' }}>
              <summary style={{ fontWeight: 'bold', color: '#c33' }}>
                Error Details (for debugging)
              </summary>
              <pre
                style={{
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px',
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div style={{ marginTop: '15px' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#45a049')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4CAF50')}
            >
              Dismiss
            </button>
            <span style={{ marginLeft: '10px', color: '#666', fontSize: '14px' }}>
              Please re-upload or re-crop your image to try again
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AssetProcessingErrorBoundary;
