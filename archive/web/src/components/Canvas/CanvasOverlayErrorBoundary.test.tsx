import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CanvasOverlayErrorBoundary from './CanvasOverlayErrorBoundary';

/**
 * Test Suite for CanvasOverlayErrorBoundary Component
 *
 * Tests the error boundary for canvas overlays (PaperNoiseOverlay, MeasurementOverlay).
 * Covers:
 * - Silent failure behavior (returns null on error)
 * - Console error logging
 * - Normal rendering when no error
 * - Overlay name in error messages
 */

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test canvas overlay error');
  }
  return <div data-testid="overlay-content">Overlay Content</div>;
}

describe('CanvasOverlayErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when there is no error', () => {
    render(
      <CanvasOverlayErrorBoundary overlayName="TestOverlay">
        <div data-testid="child">Child content</div>
      </CanvasOverlayErrorBoundary>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should return null (or error marker) when child throws error', () => {
    render(
      <CanvasOverlayErrorBoundary overlayName="TestOverlay">
        <ThrowError shouldThrow={true} />
      </CanvasOverlayErrorBoundary>,
    );

    // Should not display any error UI visible to user
    expect(screen.queryByTestId('overlay-content')).not.toBeInTheDocument();

    // In verification mode (test/dev), it renders a hidden marker
    const marker = screen.getByTestId('overlay-error-testoverlay');
    expect(marker).toBeInTheDocument();
    expect(marker).not.toBeVisible();
  });

  it('should log error to console with overlay name', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <CanvasOverlayErrorBoundary overlayName="PaperNoiseOverlay">
        <ThrowError shouldThrow={true} />
      </CanvasOverlayErrorBoundary>,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CanvasOverlayErrorBoundary] PaperNoiseOverlay crashed:'),
      expect.any(Error),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  it('should use default overlay name if not provided', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <CanvasOverlayErrorBoundary>
        <ThrowError shouldThrow={true} />
      </CanvasOverlayErrorBoundary>,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CanvasOverlayErrorBoundary] CanvasOverlay crashed:'),
      expect.any(Error),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  it('should not show any UI when error occurs', () => {
    const { container } = render(
      <CanvasOverlayErrorBoundary overlayName="TestOverlay">
        <ThrowError shouldThrow={true} />
      </CanvasOverlayErrorBoundary>,
    );

    // No error message should be visible
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();

    // Container should contain only the hidden marker
    expect(container.firstChild).toHaveAttribute('data-testid', 'overlay-error-testoverlay');
  });

  it('should handle multiple children', () => {
    render(
      <CanvasOverlayErrorBoundary overlayName="MultiOverlay">
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </CanvasOverlayErrorBoundary>,
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

  it('should handle error from one of multiple children', () => {
    render(
      <CanvasOverlayErrorBoundary overlayName="MultiOverlay">
        <div data-testid="child-1">Child 1</div>
        <ThrowError shouldThrow={true} />
        <div data-testid="child-3">Child 3</div>
      </CanvasOverlayErrorBoundary>,
    );

    // When any child throws, entire boundary catches it
    expect(screen.queryByTestId('child-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('child-3')).not.toBeInTheDocument();

    // Expect error marker
    expect(screen.getByTestId('overlay-error-multioverlay')).toBeInTheDocument();
  });

  it('should handle errors in nested components', () => {
    function NestedComponent() {
      return (
        <div>
          <div>Nested level 1</div>
          <ThrowError shouldThrow={true} />
        </div>
      );
    }

    render(
      <CanvasOverlayErrorBoundary overlayName="NestedOverlay">
        <NestedComponent />
      </CanvasOverlayErrorBoundary>,
    );

    expect(screen.getByTestId('overlay-error-nestedoverlay')).toBeInTheDocument();
  });

  it('should not affect other error boundaries', () => {
    render(
      <div>
        <CanvasOverlayErrorBoundary overlayName="Overlay1">
          <ThrowError shouldThrow={true} />
        </CanvasOverlayErrorBoundary>

        <CanvasOverlayErrorBoundary overlayName="Overlay2">
          <div data-testid="working">Working overlay</div>
        </CanvasOverlayErrorBoundary>
      </div>,
    );

    // First boundary should have error marker
    expect(screen.getByTestId('overlay-error-overlay1')).toBeInTheDocument();

    // Second boundary should still work
    expect(screen.getByTestId('working')).toBeInTheDocument();
  });

  it('should handle async errors in effects', () => {
    function AsyncErrorComponent() {
      // Simulate error in useEffect
      React.useEffect(() => {
        throw new Error('Async effect error');
      }, []);

      return <div>Should not render</div>;
    }

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <CanvasOverlayErrorBoundary overlayName="AsyncOverlay">
        <AsyncErrorComponent />
      </CanvasOverlayErrorBoundary>,
    );

    // Error boundary should catch the effect error
    expect(screen.getByTestId('overlay-error-asyncoverlay')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('should handle errors with custom error messages', () => {
    function CustomErrorComponent() {
      throw new Error('Custom error message with special characters: @#$%');
    }

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <CanvasOverlayErrorBoundary overlayName="CustomError">
        <CustomErrorComponent />
      </CanvasOverlayErrorBoundary>,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CanvasOverlayErrorBoundary] CustomError crashed:'),
      expect.objectContaining({
        message: 'Custom error message with special characters: @#$%',
      }),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle TypeError', () => {
    function TypeErrorComponent() {
      const obj: any = null;
      return <div>{obj.foo}</div>;
    }

    render(
      <CanvasOverlayErrorBoundary overlayName="TypeError">
        <TypeErrorComponent />
      </CanvasOverlayErrorBoundary>,
    );

    expect(screen.getByTestId('overlay-error-typeerror')).toBeInTheDocument();
  });

  it('should handle ReferenceError', () => {
    function ReferenceErrorComponent() {
      // @ts-expect-error - intentionally using undefined variable
      return <div>{undefinedVariable}</div>;
    }

    render(
      <CanvasOverlayErrorBoundary overlayName="ReferenceError">
        <ReferenceErrorComponent />
      </CanvasOverlayErrorBoundary>,
    );

    expect(screen.getByTestId('overlay-error-referenceerror')).toBeInTheDocument();
  });
});
