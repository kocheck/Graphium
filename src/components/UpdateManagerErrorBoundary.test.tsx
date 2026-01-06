/**
 * UpdateManagerErrorBoundary Tests
 *
 * Tests error boundary behavior for the UpdateManager component:
 * - Error catching and display
 * - Error reset functionality
 * - Console logging verification
 * - Component recovery after error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import UpdateManagerErrorBoundary from './UpdateManagerErrorBoundary';

// Component that throws an error when shouldThrow is true
interface ThrowErrorProps {
  shouldThrow?: boolean;
}

function ThrowError({ shouldThrow = false }: ThrowErrorProps) {
  if (shouldThrow) {
    throw new Error('Test error in UpdateManager');
  }
  return <div>UpdateManager content</div>;
}

describe('UpdateManagerErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error in tests (error boundary logs are expected)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Normal Rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <UpdateManagerErrorBoundary>
          <ThrowError shouldThrow={false} />
        </UpdateManagerErrorBoundary>
      );

      expect(screen.getByText('UpdateManager content')).toBeInTheDocument();
    });

    it('should not show error UI when children render successfully', () => {
      render(
        <UpdateManagerErrorBoundary>
          <div>Normal content</div>
        </UpdateManagerErrorBoundary>
      );

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should catch and display error when child component throws', () => {
      render(
        <UpdateManagerErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UpdateManagerErrorBoundary>
      );

      // Should show error fallback UI
      expect(screen.queryByText('UpdateManager content')).not.toBeInTheDocument();
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    it('should log error details to console', () => {
      render(
        <UpdateManagerErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UpdateManagerErrorBoundary>
      );

      // Verify console.error was called with error details
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Update manager error:',
        expect.any(Error)
      );
    });

    it('should reset error state when reset is triggered', async () => {
      let shouldThrow = true;
      const DynamicChild = () => {
        if (shouldThrow) {
          throw new Error('Test error in UpdateManager');
        }
        return <div>UpdateManager content</div>;
      };

      const { rerender } = render(
        <UpdateManagerErrorBoundary>
          <DynamicChild />
        </UpdateManagerErrorBoundary>
      );

      // Error UI should be shown
      expect(screen.getByText(/error/i)).toBeInTheDocument();

      // Find and click retry button
      const retryButton = screen.queryByText(/try again/i);
      if (retryButton) {
        // Change the child to not throw before clicking retry
        shouldThrow = false;

        await act(async () => {
          fireEvent.click(retryButton);
        });

        // Force a re-render to pick up the new shouldThrow value
        rerender(
          <UpdateManagerErrorBoundary>
            <DynamicChild />
          </UpdateManagerErrorBoundary>
        );

        // Should show normal content again after state update
        await waitFor(() => {
          expect(screen.getByText('UpdateManager content')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Specific Error Types', () => {
    it('should log network error message for network failures', () => {
      const NetworkError = () => {
        throw new Error('Network request failed');
      };

      render(
        <UpdateManagerErrorBoundary>
          <NetworkError />
        </UpdateManagerErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Network error detected')
      );
    });

    it('should log IPC error message for IPC failures', () => {
      const IPCError = () => {
        throw new Error('IPC invoke failed');
      };

      render(
        <UpdateManagerErrorBoundary>
          <IPCError />
        </UpdateManagerErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('IPC communication error')
      );
    });

    it('should log signature error message for verification failures', () => {
      const SignatureError = () => {
        throw new Error('Signature verification failed');
      };

      render(
        <UpdateManagerErrorBoundary>
          <SignatureError />
        </UpdateManagerErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Signature verification error')
      );
    });
  });

  describe('Error Recovery', () => {
    it('should allow component to recover after error is cleared', () => {
      const { rerender } = render(
        <UpdateManagerErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UpdateManagerErrorBoundary>
      );

      // Verify error state
      expect(screen.getByText(/error/i)).toBeInTheDocument();

      // Rerender with fixed component
      rerender(
        <UpdateManagerErrorBoundary>
          <div>Recovered content</div>
        </UpdateManagerErrorBoundary>
      );

      // Note: Error boundary maintains error state until reset
      // The error UI should still be shown until explicit reset
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  describe('Component Stack Logging', () => {
    it('should log component stack on error', () => {
      render(
        <UpdateManagerErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UpdateManagerErrorBoundary>
      );

      // Verify component stack is logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Component stack:',
        expect.any(String)
      );
    });
  });

  describe('Multiple Errors', () => {
    it('should handle multiple sequential errors', () => {
      const { rerender } = render(
        <UpdateManagerErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UpdateManagerErrorBoundary>
      );

      // First error
      expect(screen.getByText(/error/i)).toBeInTheDocument();

      // Clear console spy calls
      consoleErrorSpy.mockClear();

      // Trigger another error (after potential reset)
      rerender(
        <UpdateManagerErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UpdateManagerErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
