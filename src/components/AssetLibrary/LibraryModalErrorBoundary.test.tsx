import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LibraryModalErrorBoundary from './LibraryModalErrorBoundary';

/**
 * Test Suite for LibraryModalErrorBoundary Component
 *
 * Tests the error boundary for library modal components (TokenMetadataEditor).
 * Covers:
 * - Error UI display with modal overlay
 * - Close button functionality
 * - onClose callback invocation
 * - Console error logging
 * - Normal rendering when no error
 * - Error details expansion
 */

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test modal error');
  }
  return <div data-testid="modal-content">Modal Content</div>;
}

describe('LibraryModalErrorBoundary', () => {
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClose = vi.fn();
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when there is no error', () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <div data-testid="child">Child content</div>
      </LibraryModalErrorBoundary>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should display error UI when child throws', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should show error message in modal', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText(/An error occurred while loading this modal/i)).toBeInTheDocument();
    });
  });

  it('should log error to console', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LibraryModalErrorBoundary] Modal component crashed:'),
        expect.any(Error),
        expect.anything(),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('should display Close button', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      const closeButtons = screen.getAllByText('Close');
      expect(closeButtons.length).toBeGreaterThan(0);
    });
  });

  it('should call onClose when close button is clicked', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking backdrop', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    const backdrop = screen.getByText('Something went wrong').closest('.fixed');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should not close when clicking modal content', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    const modalContent = screen.getByText('Something went wrong').closest('div');
    if (modalContent && modalContent.parentElement) {
      fireEvent.click(modalContent.parentElement);
      // onClose should not be called when clicking inside modal
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should display error details in expandable section', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Error Details')).toBeInTheDocument();
    });

    // Error details should be collapsible
    const detailsSummary = screen.getByText('Error Details');
    expect(detailsSummary.tagName).toBe('SUMMARY');
  });

  it('should show error message in details when expanded', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Test modal error/i)).toBeInTheDocument();
    });
  });

  it('should handle onClose being undefined', async () => {
    render(
      <LibraryModalErrorBoundary>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByText('Close');
    // Should not throw when clicking close without onClose prop
    expect(() => fireEvent.click(closeButtons[0])).not.toThrow();
  });

  it('should reset error state after closing', async () => {
    function TestWrapper() {
      const [hasError, setHasError] = React.useState(true);
      return (
        <LibraryModalErrorBoundary onClose={() => setHasError(false)}>
          {hasError ? (
            <ThrowError shouldThrow={true} />
          ) : (
            <div data-testid="valid-child">Valid Content</div>
          )}
        </LibraryModalErrorBoundary>
      );
    }

    render(<TestWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    // Click close button
    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]);

    // Should show valid children now
    await waitFor(() => {
      expect(screen.getByTestId('valid-child')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  it('should display close icon button in header', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    const closeIconButton = screen.getByLabelText('Close');
    fireEvent.click(closeIconButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle errors with detailed stack traces', async () => {
    function DeepErrorComponent() {
      function level1() {
        function level2() {
          function level3() {
            throw new Error('Deep error with stack trace');
          }
          level3();
        }
        level2();
      }
      level1();
      return null;
    }

    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <DeepErrorComponent />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Deep error with stack trace/i)).toBeInTheDocument();
    });
  });

  it('should handle TypeError from modal', async () => {
    function TypeErrorModal() {
      const obj: any = null;
      return <div>{obj.property}</div>;
    }

    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <TypeErrorModal />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should handle multiple consecutive errors', async () => {
    const { rerender } = render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    // Close the error modal
    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]);

    // Trigger another error
    rerender(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    // Should show error UI again
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should apply correct modal styling', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      const backdrop = screen.getByText('Something went wrong').closest('.fixed');
      expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-50');
    });
  });

  it('should show that error has been logged', async () => {
    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <ThrowError shouldThrow={true} />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText(/This has been logged for investigation/i)).toBeInTheDocument();
    });
  });

  it('should handle async errors in useEffect', async () => {
    function AsyncErrorModal() {
      React.useEffect(() => {
        throw new Error('Async modal error');
      }, []);

      return <div>Should not render</div>;
    }

    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <AsyncErrorModal />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should handle errors with special characters in message', async () => {
    function SpecialCharErrorModal() {
      throw new Error('Error with special chars: <>&"\'@#$%');
    }

    render(
      <LibraryModalErrorBoundary onClose={mockOnClose}>
        <SpecialCharErrorModal />
      </LibraryModalErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Error with special chars/i)).toBeInTheDocument();
    });
  });
});
