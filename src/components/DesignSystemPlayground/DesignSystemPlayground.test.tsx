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
  useGameStore: Object.assign(
    vi.fn(() => ({
        toast: null,
        confirmDialog: null,
        clearToast: vi.fn(),
        clearConfirmDialog: vi.fn(),
    })),
    {
        getState: () => ({
            showToast: mockShowToast,
            showConfirmDialog: mockShowConfirmDialog,
        }),
    }
  ),
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
});
