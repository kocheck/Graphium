import React, { Component, ReactNode } from 'react';
import { captureErrorContext, logErrorWithContext, type ErrorContext } from '../../utils/errorBoundaryUtils';

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
  errorContext: ErrorContext | null;
  errorTimestamp: number | null;
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
 * - Captures full error context in dev/test mode
 * - Exposes error to window for E2E testing
 * - Canvas continues to function without the overlay
 *
 * **Dev Mode Features:**
 * - Comprehensive error logging with context
 * - Error history tracking
 * - Performance metrics at time of error
 * - Test data attributes
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
 * **Testing:**
 * ```typescript
 * // E2E test: Check if overlay error was caught
 * const overlayError = await page.evaluate(() => {
 *   return (window as any).__LAST_OVERLAY_ERROR__;
 * });
 * expect(overlayError).toBeNull();
 * ```
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
      errorContext: null,
      errorTimestamp: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CanvasOverlayErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorTimestamp: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { overlayName = 'CanvasOverlay' } = this.props;
    const isDev = import.meta.env.DEV;
    const isTest = import.meta.env.MODE === 'test';

    // Capture comprehensive error context
    const context = captureErrorContext(error, errorInfo, {
      componentName: `CanvasOverlayErrorBoundary - ${overlayName}`,
      props: this.props,
      state: this.state,
    });

    // Log with full context
    logErrorWithContext(context);

    // Legacy logging for backward compatibility
    console.error(
      `[CanvasOverlayErrorBoundary] ${overlayName} crashed:`,
      error,
      errorInfo
    );

    // Store context in state for dev mode
    if (isDev || isTest) {
      this.setState({ errorContext: context });
    }

    // Expose to window for E2E testing
    if (isDev || isTest) {
      const previousErrors = Array.isArray(window.__OVERLAY_ERRORS__)
        ? window.__OVERLAY_ERRORS__
        : [];

      const nextErrorEntry = {
        overlayName,
        error: error.message,
        timestamp: Date.now(),
        context,
      };

      // Keep only last 10 errors using an immutable update
      window.__OVERLAY_ERRORS__ = [...previousErrors, nextErrorEntry].slice(-10);

      // Update last error pointer
      window.__LAST_OVERLAY_ERROR__ = {
        overlayName,
        error: error.message,
        timestamp: Date.now(),
        context,
      };
    }
  }

  render() {
    const { hasError } = this.state;
    const { children, overlayName } = this.props;

    if (hasError) {
      // Silent failure - return null to hide broken overlay
      // Canvas continues to function without this enhancement
      // Add data-testid for E2E testing
      const isDev = import.meta.env.DEV;
      const isTest = import.meta.env.MODE === 'test';

      if (isDev || isTest) {
        // Return an invisible marker for testing
        return (
          <div
            data-testid={`overlay-error-${overlayName?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}
            data-error-timestamp={this.state.errorTimestamp}
            style={{ display: 'none' }}
          />
        );
      }

      return null;
    }

    return children;
  }
}

export default CanvasOverlayErrorBoundary;
