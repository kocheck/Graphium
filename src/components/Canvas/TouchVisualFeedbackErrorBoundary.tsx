/**
 * TouchVisualFeedbackErrorBoundary
 *
 * Error boundary specifically for TouchVisualFeedback component.
 * Prevents visual feedback rendering errors from crashing the entire canvas.
 *
 * If TouchVisualFeedback fails, the boundary catches the error and:
 * 1. Logs detailed error info to console (dev mode)
 * 2. Returns null to hide visual feedback without disrupting canvas
 * 3. Allows core canvas functionality to continue working
 *
 * This is critical because visual feedback is a nice-to-have feature,
 * not core functionality - drawing/dragging must work even if feedback breaks.
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class TouchVisualFeedbackErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details in development mode
    if (import.meta.env.DEV) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ TouchVisualFeedback Error Boundary Caught Error');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Error:', error);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('💡 Tip: Visual feedback is disabled. Core canvas functionality unaffected.');
      console.error('💡 Check TouchVisualFeedback component props and state.');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Optional: Send error to error tracking service
    // if (window.errorTracker) {
    //   window.errorTracker.captureException(error, {
    //     context: 'TouchVisualFeedback',
    //     componentStack: errorInfo.componentStack,
    //   });
    // }
  }

  render() {
    if (this.state.hasError) {
      // Render nothing - visual feedback is optional
      // Canvas continues to work without visual indicators
      return null;
    }

    return this.props.children;
  }
}

export default TouchVisualFeedbackErrorBoundary;
