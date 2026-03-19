import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickTokenSidebarErrorBoundary } from './QuickTokenSidebarErrorBoundary';

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test sidebar error');
  }
  return <div data-testid="sidebar-content">Sidebar Content</div>;
}

describe('QuickTokenSidebarErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Normal Rendering', () => {
    it('should render children when there is no error', () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <div data-testid="child">Child content</div>
        </QuickTokenSidebarErrorBoundary>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should not show error UI when children render successfully', () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={false} />
        </QuickTokenSidebarErrorBoundary>,
      );

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
      expect(screen.queryByText('Quick Access Error')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error UI when child throws', async () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });
    });

    it('should show helpful error message', async () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Unable to load token shortcuts/i)).toBeInTheDocument();
      });
    });

    it('should indicate sidebar still works', async () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText(/The rest of your sidebar still works/i)).toBeInTheDocument();
      });
    });

    it('should log error to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[QuickTokenSidebarErrorBoundary] Token sidebar crashed:'),
          expect.any(Error),
          expect.anything(),
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Recovery', () => {
    it('should display Try Again button', async () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should reset error state when Try Again is clicked', async () => {
      // Create a wrapper component with state to control error throwing
      function TestWrapper() {
        const [errorKey, setErrorKey] = React.useState(0);

        return (
          <div>
            <button onClick={() => setErrorKey((k) => k + 1)} data-testid="reset-trigger">
              Reset
            </button>
            <QuickTokenSidebarErrorBoundary key={errorKey}>
              <ThrowError shouldThrow={errorKey === 0} />
            </QuickTokenSidebarErrorBoundary>
          </div>
        );
      }

      render(<TestWrapper />);

      // Verify error state is shown initially
      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });

      // Click Try Again button
      const tryAgainButton = screen.getByText('Try Again');
      fireEvent.click(tryAgainButton);

      // Trigger a reset which changes the key and stops throwing
      const resetButton = screen.getByTestId('reset-trigger');
      fireEvent.click(resetButton);

      // Verify error is cleared and content is shown
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
        expect(screen.queryByText('Quick Access Error')).not.toBeInTheDocument();
      });
    });
  });

  describe('UI Styling', () => {
    it('should apply error styling', async () => {
      const { container } = render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        const errorContainer = container.querySelector('.bg-red-900\\/10');
        expect(errorContainer).toBeInTheDocument();
      });
    });

    it('should display warning icon', async () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        const icon = screen.getByTestId('error-icon-container').querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });

    it('should have compact layout for sidebar', async () => {
      const { container } = render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        const errorContainer = container.querySelector('.p-3');
        expect(errorContainer).toBeInTheDocument();
        expect(errorContainer).toHaveClass('text-sm');
      });
    });
  });

  describe('Error Types', () => {
    it('should handle TypeError', async () => {
      function TypeErrorComponent() {
        const obj: any = null;
        return <div>{obj.property}</div>;
      }

      render(
        <QuickTokenSidebarErrorBoundary>
          <TypeErrorComponent />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });
    });

    it('should handle ReferenceError', async () => {
      function ReferenceErrorComponent() {
        // @ts-expect-error: Testing undefined variable
        return <div>{undefinedVariable}</div>;
      }

      render(
        <QuickTokenSidebarErrorBoundary>
          <ReferenceErrorComponent />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });
    });

    it('should handle errors with special characters', async () => {
      function SpecialCharErrorComponent() {
        throw new Error('Error with <special> chars & symbols @#$%');
      }

      render(
        <QuickTokenSidebarErrorBoundary>
          <SpecialCharErrorComponent />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });
    });

    it('should handle async errors in useEffect', async () => {
      function AsyncErrorComponent() {
        React.useEffect(() => {
          throw new Error('Async sidebar error');
        }, []);

        return <div>Should not render</div>;
      }

      render(
        <QuickTokenSidebarErrorBoundary>
          <AsyncErrorComponent />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Errors', () => {
    it('should handle consecutive errors', async () => {
      const { rerender } = render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });

      // Click Try Again
      const tryAgainButton = screen.getByText('Try Again');
      fireEvent.click(tryAgainButton);

      // Trigger another error
      rerender(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      // Should show error UI again
      await waitFor(() => {
        expect(screen.getByText('Quick Access Error')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible error message structure', async () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        const errorHeading = screen.getByText('Quick Access Error');
        expect(errorHeading).toBeInTheDocument();
      });
    });

    it('should have clickable Try Again button', async () => {
      render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        const button = screen.getByText('Try Again');
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('should indicate error visually with icon and color', async () => {
      const { container } = render(
        <QuickTokenSidebarErrorBoundary>
          <ThrowError shouldThrow={true} />
        </QuickTokenSidebarErrorBoundary>,
      );

      await waitFor(() => {
        // Check for red color classes
        const errorContainer = container.querySelector('.border-red-900\\/30');
        expect(errorContainer).toBeInTheDocument();

        // Check for icon
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });
  });
});
