import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test Error');
  }
  return <div>No Error</div>;
};

describe('GlobalErrorBoundary', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: vi.fn() },
    });

    // Suppress console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <GlobalErrorBoundary>
        <div>Safe Content</div>
      </GlobalErrorBoundary>,
    );
    expect(screen.getByText('Safe Content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <GlobalErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GlobalErrorBoundary>,
    );

    expect(screen.getByText('Critical System Error')).toBeInTheDocument();
    expect(screen.getByText('Error: Test Error')).toBeInTheDocument();
  });

  it('calls window.location.reload on reload button click', () => {
    render(
      <GlobalErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GlobalErrorBoundary>,
    );

    const reloadBtn = screen.getByText('Reload Application');
    fireEvent.click(reloadBtn);

    expect(window.location.reload).toHaveBeenCalled();
  });

  it('renders custom fallback if provided', () => {
    render(
      <GlobalErrorBoundary fallback={<div>Custom Fallback</div>}>
        <ThrowError shouldThrow={true} />
      </GlobalErrorBoundary>,
    );

    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
  });
});
