import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary
 *
 * Catches unhandled errors in the component tree and displays a friendly
 * fallback UI instead of a white screen. It also logs errors to the console
 * and provides options for the user to reload the app.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `Error: ${error?.message}\n\nStack:\n${errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorText);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-200 p-8 font-sans">
          <div className="max-w-xl w-full bg-neutral-800 border border-red-900 rounded-lg shadow-2xl overflow-hidden">
            <div className="bg-red-900/30 p-6 border-b border-red-900/50 flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-red-400">Critical System Error</h1>
                <p className="text-red-200/70 text-sm">
                  The application encountered an unexpected problem.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-black/50 rounded p-4 font-mono text-xs text-red-300 overflow-auto max-h-64 border border-red-900/30">
                <p className="font-bold mb-2">{this.state.error?.toString()}</p>
                <pre className="whitespace-pre-wrap opacity-70">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={this.handleReload}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  Reload Application
                </button>
                <button
                  onClick={this.handleCopyError}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded font-medium transition-colors"
                >
                  Copy Details
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
