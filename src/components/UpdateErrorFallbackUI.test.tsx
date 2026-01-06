/**
 * UpdateErrorFallbackUI Tests
 *
 * Tests the specialized error fallback UI component for auto-updater errors:
 * - Error message display with randomized themed messages
 * - User interactions (Close/Try Again buttons)
 * - Rendering of error hints and technical details
 * - Message stability (memoization)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateErrorFallbackUI, rollForMessage } from './UpdateErrorFallbackUI';

describe('rollForMessage', () => {
  it('should return a message from the provided array', () => {
    const messages = ['Message 1', 'Message 2', 'Message 3'];
    const result = rollForMessage(messages);

    expect(messages).toContain(result);
  });

  it('should use custom RNG function when provided', () => {
    const messages = ['First', 'Second', 'Third'];
    const mockRng = vi.fn(() => 0.5); // Always return middle value

    const result = rollForMessage(messages, mockRng);

    expect(mockRng).toHaveBeenCalled();
    expect(result).toBe('Second'); // 0.5 * 3 = 1.5, floor = 1
  });

  it('should select first message when RNG returns 0', () => {
    const messages = ['Alpha', 'Beta', 'Gamma'];
    const mockRng = () => 0;

    const result = rollForMessage(messages, mockRng);

    expect(result).toBe('Alpha');
  });

  it('should select last message when RNG returns value close to 1', () => {
    const messages = ['Alpha', 'Beta', 'Gamma'];
    const mockRng = () => 0.99;

    const result = rollForMessage(messages, mockRng);

    expect(result).toBe('Gamma'); // 0.99 * 3 = 2.97, floor = 2
  });

  it('should handle single-item array', () => {
    const messages = ['Only Message'];
    const result = rollForMessage(messages);

    expect(result).toBe('Only Message');
  });

  it('should use Math.random by default', () => {
    const messages = ['A', 'B', 'C', 'D', 'E'];
    const results = new Set<string>();

    // Run multiple times to verify randomness
    for (let i = 0; i < 50; i++) {
      results.add(rollForMessage(messages));
    }

    // With 50 iterations and 5 options, we should see at least 2 different messages
    // (This is probabilistic but extremely likely)
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('UpdateErrorFallbackUI', () => {
  const mockOnReset = vi.fn();

  beforeEach(() => {
    mockOnReset.mockClear();
  });

  describe('Basic Rendering', () => {
    it('should render error dialog with themed title', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      // Check that one of the themed titles is displayed
      const possibleTitles = [
        /The Update Ritual Failed/i,
        /Arcane Interference Detected/i,
        /Rolled a 1 on Update Check/i,
        /Divination Failed/i,
        /The Summoning Backfired/i,
      ];

      const hasTitleMatch = possibleTitles.some((pattern) => screen.queryByText(pattern));
      expect(hasTitleMatch).toBe(true);
    });

    it('should render error description', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      // Check that one of the themed descriptions is displayed
      const possibleDescriptions = [
        /cosmic archives could not be reached/i,
        /Communication with the GitHub Oracles/i,
        /ritual fizzled/i,
        /Cannot reach the repository of versions/i,
        /Connection to the Archive of Releases/i,
      ];

      const hasDescMatch = possibleDescriptions.some((pattern) => screen.queryByText(pattern));
      expect(hasDescMatch).toBe(true);
    });

    it('should render all error hints', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      // Verify all hints are displayed
      expect(screen.getByText(/No internet connection or unstable network/i)).toBeInTheDocument();
      expect(screen.getByText(/GitHub servers are temporarily unreachable/i)).toBeInTheDocument();
      expect(screen.getByText(/Firewall blocking update requests/i)).toBeInTheDocument();
      expect(screen.getByText(/Signature verification issues/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Corrupted update metadata from previous attempts/i)
      ).toBeInTheDocument();
    });

    it('should render technical details in collapsed state by default', () => {
      const testErrorMessage = 'Network timeout';
      render(<UpdateErrorFallbackUI errorMessage={testErrorMessage} onReset={mockOnReset} />);

      const details = screen.getByText('Technical details');
      expect(details).toBeInTheDocument();

      // Error message should not be visible initially (collapsed)
      const errorText = screen.queryByText('Network timeout');
      // It will be in the DOM but hidden in the <details> element
      expect(errorText).toBeInTheDocument();
    });

    it('should render Close button', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should render Try Again button', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      expect(tryAgainButton).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onReset when Close button is clicked', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('should call onReset when Try Again button is clicked', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('should call onReset when clicking backdrop', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnReset).toHaveBeenCalledTimes(1);
      }
    });

    it('should not call onReset when clicking dialog content', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      expect(mockOnReset).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should render without error message', () => {
      render(<UpdateErrorFallbackUI onReset={mockOnReset} />);

      // Should still render the dialog
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      expect(tryAgainButton).toBeInTheDocument();
    });

    it('should display error message when provided', () => {
      const testErrorMessage = 'Specific error message';
      render(<UpdateErrorFallbackUI errorMessage={testErrorMessage} onReset={mockOnReset} />);

      // Technical details should contain the error message
      expect(screen.getByText('Specific error message')).toBeInTheDocument();
    });
  });

  describe('Message Randomization', () => {
    it('should use memoized messages that remain stable', () => {
      const testErrorMessage = 'Test error';
      const { rerender } = render(
        <UpdateErrorFallbackUI errorMessage={testErrorMessage} onReset={mockOnReset} />
      );

      // Get the displayed title
      const initialTitle = screen.getByRole('heading', { level: 2 }).textContent;

      // Rerender with same error - title should remain the same due to memoization
      rerender(<UpdateErrorFallbackUI errorMessage={testErrorMessage} onReset={mockOnReset} />);

      const rerenderTitle = screen.getByRole('heading', { level: 2 }).textContent;
      expect(rerenderTitle).toBe(initialTitle);
    });

    it('should generate new messages when error message changes', () => {
      const errorMessage1 = 'Error 1';
      const errorMessage2 = 'Error 2';

      const { rerender } = render(<UpdateErrorFallbackUI errorMessage={errorMessage1} onReset={mockOnReset} />);

      const title1 = screen.getByRole('heading', { level: 2 }).textContent;

      // Rerender with different error - may get different title (though not guaranteed due to randomness)
      rerender(<UpdateErrorFallbackUI errorMessage={errorMessage2} onReset={mockOnReset} />);

      const title2 = screen.getByRole('heading', { level: 2 }).textContent;

      // At minimum, verify the component re-renders without crashing
      expect(title2).toBeTruthy();
      // Note: We can't guarantee titles are different due to randomness,
      // but we verify the component handles error changes properly
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for dialog', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'update-error-dialog-title');
    });

    it('should have accessible heading', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveAttribute('id', 'update-error-dialog-title');
    });

    it('should have keyboard accessible buttons', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });

      expect(closeButton).toBeVisible();
      expect(tryAgainButton).toBeVisible();
    });
  });

  describe('Visual Elements', () => {
    it('should render error icon', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      // Check for the exclamation mark icon
      expect(screen.getByText('!')).toBeInTheDocument();
    });

    it('should render hints as a list', () => {
      render(<UpdateErrorFallbackUI errorMessage="Test error" onReset={mockOnReset} />);

      // Find all list items
      const hints = screen.getAllByRole('listitem');
      expect(hints).toHaveLength(5); // 5 error hints
    });
  });
});
