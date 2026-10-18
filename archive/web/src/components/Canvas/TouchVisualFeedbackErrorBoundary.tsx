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

import type { ReactNode } from 'react';
import type React from 'react';
import { Component } from 'react';

import { captureErrorContext, logErrorWithContext } from '../../utils/errorBoundaryUtils';

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

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logErrorWithContext(
      captureErrorContext(error, errorInfo, { componentName: 'TouchVisualFeedback' }),
    );
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      // Render nothing - visual feedback is optional
      // Canvas continues to work without visual indicators
      return null;
    }

    return this.props.children;
  }
}

// eslint-disable-next-line import/no-unused-modules
export default TouchVisualFeedbackErrorBoundary;
