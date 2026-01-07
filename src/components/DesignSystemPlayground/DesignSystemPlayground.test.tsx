import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesignSystemPlayground } from './DesignSystemPlayground';
import { componentExamples } from './playground-registry';

// Mock getStorage
vi.mock('../../services/storage', () => ({
  getStorage: vi.fn(() => ({
    getThemeMode: vi.fn().mockResolvedValue('dark'),
    setThemeMode: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock useGameStore
const mockShowToast = vi.fn();
const mockShowConfirmDialog = vi.fn();

vi.mock('../../store/gameStore', () => ({
  useGameStore: vi.fn(() => ({
    toast: null,
    confirmDialog: null,
    clearToast: vi.fn(),
    clearConfirmDialog: vi.fn(),
    showToast: mockShowToast,
    showConfirmDialog: mockShowConfirmDialog,
  })),
}));

describe('DesignSystemPlayground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the playground with header and version', () => {
    render(<DesignSystemPlayground />);

    expect(screen.getByText('Design System')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search components/i)).toBeInTheDocument();
  });

  it('should display all components by default', () => {
    render(<DesignSystemPlayground />);

    const totalCount = componentExamples.length;
    expect(screen.getByText(`Showing all ${totalCount} components`)).toBeInTheDocument();
  });

  it('should filter components based on search query', async () => {
    render(<DesignSystemPlayground />);

    const searchInput = screen.getByPlaceholderText(/Search components/i);

    // Search for "Toggle"
    fireEvent.change(searchInput, { target: { value: 'Toggle' } });

    // Should show filtered results
    await waitFor(() => {
      expect(screen.getByText('Toggle Switch')).toBeInTheDocument();
      // Primary Button should NOT be visible when searching for Toggle
      expect(screen.queryByText('Primary Button')).not.toBeInTheDocument();
    });
  });

  it('should show "no results" message when search returns nothing', () => {
    render(<DesignSystemPlayground />);

    const searchInput = screen.getByPlaceholderText(/Search components/i);

    // Search for something that doesn't exist
    fireEvent.change(searchInput, { target: { value: 'xyzabc123' } });

    expect(screen.getByText('No components found')).toBeInTheDocument();
  });

  it('should toggle code visibility when clicking "View Code"', () => {
    render(<DesignSystemPlayground />);

    // Find first "View Code" button
    const viewCodeButtons = screen.getAllByText('View Code');
    const firstButton = viewCodeButtons[0];

    // Initially code should not be visible
    expect(firstButton).toBeInTheDocument();

    // Click to show code
    fireEvent.click(firstButton);

    // Button text should change
    expect(screen.getByText('Hide Code')).toBeInTheDocument();

    // Code should be visible
    expect(screen.getByText(/Copy/i)).toBeInTheDocument();
  });

  it('should render component categories', () => {
    render(<DesignSystemPlayground />);

    // Should have category headings
    expect(screen.getByText('Buttons')).toBeInTheDocument();
    expect(screen.getByText('Typography')).toBeInTheDocument();
    expect(screen.getByText('Colors')).toBeInTheDocument();
  });

  it('should have Exit link', () => {
    render(<DesignSystemPlayground />);

    const exitLink = screen.getByText('Exit');
    expect(exitLink).toBeInTheDocument();
    expect(exitLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('should have a theme toggle button', async () => {
    render(<DesignSystemPlayground />);
    // Wait for the async load
    await waitFor(() => {
      const toggleBtn = screen.getByTitle(/Switch to/i);
      expect(toggleBtn).toBeInTheDocument();
    });
  });

  it('should toggle theme when clicking theme button', async () => {
    const mockSetThemeMode = vi.fn().mockResolvedValue(undefined);
    const { getStorage } = await import('../../services/storage');
    vi.mocked(getStorage).mockReturnValue({
      getThemeMode: vi.fn().mockResolvedValue('dark'),
      setThemeMode: mockSetThemeMode,
    } as Partial<ReturnType<typeof getStorage>> as ReturnType<typeof getStorage>);

    render(<DesignSystemPlayground />);

    await waitFor(() => {
      const toggleBtn = screen.getByTitle(/Switch to Light Mode/i);
      expect(toggleBtn).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTitle(/Switch to Light Mode/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(mockSetThemeMode).toHaveBeenCalledWith('light');
    });
  });

  it('should show error toast when theme toggle fails', async () => {
    const mockSetThemeMode = vi.fn().mockRejectedValue(new Error('Theme error'));
    const { getStorage } = await import('../../services/storage');
    vi.mocked(getStorage).mockReturnValue({
      getThemeMode: vi.fn().mockResolvedValue('dark'),
      setThemeMode: mockSetThemeMode,
    } as Partial<ReturnType<typeof getStorage>> as ReturnType<typeof getStorage>);

    render(<DesignSystemPlayground />);

    await waitFor(() => {
      const toggleBtn = screen.getByTitle(/Switch to/i);
      expect(toggleBtn).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTitle(/Switch to/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to switch theme', 'error');
    });
  });

  it('should copy code to clipboard and show success toast', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<DesignSystemPlayground />);

    // Find first "View Code" button and click it
    const viewCodeButtons = screen.getAllByText('View Code');
    fireEvent.click(viewCodeButtons[0]);

    // Find and click the copy button
    const copyButton = await screen.findByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('Code copied to clipboard', 'success');
    });
  });

  it('should show error toast when copy fails', async () => {
    // Mock clipboard API to fail
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard error')),
      },
    });

    render(<DesignSystemPlayground />);

    // Find first "View Code" button and click it
    const viewCodeButtons = screen.getAllByText('View Code');
    fireEvent.click(viewCodeButtons[0]);

    // Find and click the copy button
    const copyButton = await screen.findByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to copy code to clipboard', 'error');
    });
  });

  it('should focus search input when "/" key is pressed', async () => {
    render(<DesignSystemPlayground />);

    const searchInput = screen.getByPlaceholderText(/Search components/i);

    // Blur the input first
    searchInput.blur();
    expect(document.activeElement).not.toBe(searchInput);

    // Simulate "/" key press
    fireEvent.keyDown(document, { key: '/' });

    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });
  });

  it('should have accessible aria-label on theme toggle button', async () => {
    render(<DesignSystemPlayground />);

    await waitFor(() => {
      const toggleBtn = screen.getByLabelText(/Switch to/i);
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-label');
    });
  });
});
