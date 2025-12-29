import React, { Component, ReactNode } from 'react';

/**
 * Props for CanvasOverlayErrorBoundary
 */
interface CanvasOverlayErrorBoundaryProps {
  children: ReactNode;
  /** Name of the overlay component for error logging */
  overlayName?: string;
}

/**
 * State for CanvasOverlayErrorBoundary
 */
interface CanvasOverlayErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * CanvasOverlayErrorBoundary - Error boundary for canvas overlay components
 *
 * Wraps non-critical canvas overlay components (PaperNoiseOverlay, MeasurementOverlay)
 * to prevent a single overlay failure from crashing the entire canvas.
 *
 * **Behavior on Error:**
 * - Silently hides the broken overlay (returns null)
 * - Logs error details to console with overlay name
 * - Canvas continues to function without the overlay
 *
 * **Usage:**
 * ```tsx
 * <CanvasOverlayErrorBoundary overlayName="PaperNoiseOverlay">
 *   <PaperNoiseOverlay {...props} />
 * </CanvasOverlayErrorBoundary>
 * ```
 *
 * **Why Silent Failure:**
 * Overlays are visual enhancements, not critical functionality. If paper texture
 * or measurement tools fail, the canvas should still be usable for core features
 * (token placement, map viewing).
 *
 * @see TokenErrorBoundary for similar pattern with tokens
 * @see MinimapErrorBoundary for similar pattern with minimap
 */
class CanvasOverlayErrorBoundary extends Component<
  CanvasOverlayErrorBoundaryProps,
  CanvasOverlayErrorBoundaryState
> {
  constructor(props: CanvasOverlayErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): CanvasOverlayErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { overlayName = 'CanvasOverlay' } = this.props;

    console.error(
      `[CanvasOverlayErrorBoundary] ${overlayName} crashed:`,
      error,
      errorInfo
    );

    // Optional: Send error to monitoring service
    // ErrorReportingService.captureException(error, {
    //   context: 'canvas-overlay',
    //   overlayName,
    //   componentStack: errorInfo.componentStack,
    // });
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      // Silent failure - return null to hide broken overlay
      // Canvas continues to function without this enhancement
      return null;
    }

    return children;
  }
}

export default CanvasOverlayErrorBoundary;
