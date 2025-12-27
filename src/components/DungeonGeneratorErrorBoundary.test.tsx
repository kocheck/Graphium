import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import DungeonGeneratorErrorBoundary from './DungeonGeneratorErrorBoundary';
import { useGameStore } from '../store/gameStore';

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Dungeon generation failed');
  }
  return <div>No error</div>;
}

// Wrapper to control when error is thrown
function ErrorTrigger() {
  return <ThrowError shouldThrow={true} />;
}

describe('DungeonGeneratorErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Reset store
    useGameStore.setState({ dungeonDialog: true });
  });

  it('should render children when there is no error', () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <div data-testid="child">Child content</div>
      </DungeonGeneratorErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render error UI when child throws', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Dungeon Generation Error')).toBeInTheDocument();
    });
  });

  it('should display error message explaining possible causes', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong while generating the dungeon/)).toBeInTheDocument();
      expect(screen.getByText(/Room size constraints are too restrictive/)).toBeInTheDocument();
      expect(screen.getByText(/Requesting too many rooms/)).toBeInTheDocument();
      expect(screen.getByText(/Collision detection prevented valid placements/)).toBeInTheDocument();
    });
  });

  it('should display Close button', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  it('should display Try Again button', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('should show technical details in collapsible section', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Technical details')).toBeInTheDocument();
    });
  });

  it('should display error message in technical details', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      const details = screen.getByText('Technical details');
      act(() => {
        details.click();
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Dungeon generation failed')).toBeInTheDocument();
    });
  });

  it('should reset error state when Try Again is clicked', async () => {
    let shouldThrow = true;
    
    function ConditionalErrorTrigger() {
      return <ThrowError shouldThrow={shouldThrow} />;
    }

    const { rerender } = render(
      <DungeonGeneratorErrorBoundary>
        <ConditionalErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Dungeon Generation Error')).toBeInTheDocument();
    });

    const tryAgainButton = screen.getByText('Try Again');

    // Stop throwing error before clicking Try Again
    shouldThrow = false;

    act(() => {
      tryAgainButton.click();
    });

    // Re-render with a non-throwing child to verify error is cleared
    rerender(
      <DungeonGeneratorErrorBoundary>
        <div data-testid="success">Success</div>
      </DungeonGeneratorErrorBoundary>
    );

    expect(screen.getByTestId('success')).toBeInTheDocument();
    expect(screen.queryByText('Dungeon Generation Error')).not.toBeInTheDocument();
  });

  it('should close dialog when Close button is clicked', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('Close');

    act(() => {
      closeButton.click();
    });

    // Verify that dungeonDialog was cleared
    expect(useGameStore.getState().dungeonDialog).toBe(false);
  });

  it('should log error to console', async () => {
    const consoleSpy = vi.spyOn(console, 'error');

    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  it('should have proper ARIA attributes for accessibility', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'error-dialog-title');
    });
  });

  it('should display error icon', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('!')).toBeInTheDocument();
    });
  });

  it('should prevent dialog content clicks from closing the dialog', async () => {
    render(
      <DungeonGeneratorErrorBoundary>
        <ErrorTrigger />
      </DungeonGeneratorErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Dungeon Generation Error')).toBeInTheDocument();
    });

    const dialogContent = screen.getByText('Dungeon Generation Error').closest('div');

    act(() => {
      if (dialogContent) {
        dialogContent.click();
      }
    });

    // Dialog should still be visible
    expect(screen.getByText('Dungeon Generation Error')).toBeInTheDocument();
  });
});
