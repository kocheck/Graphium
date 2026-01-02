/**
 * QuickTokenSidebarErrorBoundary
 *
 * Error boundary specifically for the QuickTokenSidebar component.
 * Prevents errors in token rendering from crashing the entire sidebar.
 * Shows a minimal, inline error message that fits within the sidebar layout.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { RiErrorWarningLine } from '@remixicon/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class QuickTokenSidebarErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[QuickTokenSidebarErrorBoundary] Token sidebar crashed:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-red-900/10 border border-red-900/30 rounded text-sm">
          <div className="flex items-start gap-2" data-testid="error-icon-container">
            <RiErrorWarningLine className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 font-medium mb-1">Quick Access Error</p>
              <p className="text-xs text-red-300/70 mb-2">
                Unable to load token shortcuts. The rest of your sidebar still works.
              </p>
              <button
                onClick={this.handleReset}
                className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default QuickTokenSidebarErrorBoundary;
