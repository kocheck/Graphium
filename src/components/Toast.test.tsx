import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import Toast from './Toast';
import { useUiStore } from '../store/uiStore';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset store
    useUiStore.setState({ toast: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should not render when there is no toast message', () => {
    const { container } = render(<Toast />);
    expect(container.firstChild).toBeNull();
  });

  it('should render error toast with message', () => {
    useUiStore.setState({
      toast: { message: 'Test error message', type: 'error' },
    });

    render(<Toast />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('should render success toast with message', () => {
    useUiStore.setState({
      toast: { message: 'Success message', type: 'success' },
    });

    render(<Toast />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should render info toast with message', () => {
    useUiStore.setState({
      toast: { message: 'Info message', type: 'info' },
    });

    render(<Toast />);
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('should auto-dismiss after 5 seconds', async () => {
    useUiStore.setState({
      toast: { message: 'Auto dismiss test', type: 'info' },
    });

    render(<Toast />);
    expect(screen.getByText('Auto dismiss test')).toBeInTheDocument();

    // Fast-forward all timers
    await act(async () => {
      vi.runAllTimers();
    });

    // Check that toast is cleared
    expect(useUiStore.getState().toast).toBeNull();
  });

  it('should clear toast when close button is clicked', () => {
    useUiStore.setState({
      toast: { message: 'Closeable message', type: 'error' },
    });

    render(<Toast />);
    const closeButton = screen.getByLabelText('Close notification');

    act(() => {
      closeButton.click();
    });

    expect(useUiStore.getState().toast).toBeNull();
  });
});
