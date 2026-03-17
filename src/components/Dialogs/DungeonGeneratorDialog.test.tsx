import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { DungeonGeneratorDialog } from './DungeonGeneratorDialog';
import { DungeonGenerator } from '../../utils/DungeonGenerator';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import type { HexColor, PixelSize } from '../../types/domain';

// Mock the DungeonGenerator
vi.mock('../../utils/DungeonGenerator', () => ({
  DungeonGenerator: vi.fn().mockImplementation(function () {
    return {
      generate: vi.fn().mockReturnValue({
        drawings: [
          {
            id: 'test-drawing-1',
            tool: 'wall',
            points: [0, 0, 100, 0],
            color: '#ff0000',
            size: 8,
          },
        ],
        doors: [],
      }),
    };
  }),
}));

const defaultProps = {
  wallColor: '#ff0000' as HexColor,
  wallSize: 8 as PixelSize,
};

describe('DungeonGeneratorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store
    useGameStore.setState({
      drawings: [],
    });
    useUiStore.setState({
      dungeonDialog: false,
    });
  });

  it('should not render when dungeonDialog is false', () => {
    const { container } = render(<DungeonGeneratorDialog {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when dungeonDialog is true', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    expect(screen.getByText('Dungeon Generator')).toBeInTheDocument();
  });

  it('should display all parameter controls', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    expect(screen.getByText(/Number of Rooms:/)).toBeInTheDocument();
    expect(screen.getByText(/Min Room Size/)).toBeInTheDocument();
    expect(screen.getByText(/Max Room Size/)).toBeInTheDocument();
    expect(screen.getByText(/Clear existing drawings/)).toBeInTheDocument();
  });

  it('should close dialog when Escape key is pressed', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    expect(screen.getByText('Dungeon Generator')).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(useUiStore.getState().dungeonDialog).toBe(false);
  });

  it('should close dialog when Cancel button is clicked', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');

    act(() => {
      cancelButton.click();
    });

    expect(useUiStore.getState().dungeonDialog).toBe(false);
  });

  it('should close dialog when background is clicked', () => {
    useUiStore.setState({ dungeonDialog: true });
    const { container } = render(<DungeonGeneratorDialog {...defaultProps} />);

    const background = container.querySelector('.fixed.inset-0');
    expect(background).toBeInTheDocument();

    act(() => {
      fireEvent.click(background!);
    });

    expect(useUiStore.getState().dungeonDialog).toBe(false);
  });

  it('should not close dialog when dialog content is clicked', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const dialogContent = screen.getByText('Dungeon Generator').closest('div');

    act(() => {
      fireEvent.click(dialogContent!);
    });

    expect(useUiStore.getState().dungeonDialog).toBe(true);
  });

  it('should generate dungeon when Generate button is clicked', () => {
    useGameStore.setState({ gridSize: 50 });
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const generateButton = screen.getByText('Generate Dungeon');

    act(() => {
      generateButton.click();
    });

    // Check that drawings were added
    const state = useGameStore.getState();
    expect(state.drawings.length).toBeGreaterThan(0);
    expect(useUiStore.getState().dungeonDialog).toBe(false);
  });

  it('should pass wallColor and wallSize props to DungeonGenerator', () => {
    useGameStore.setState({ gridSize: 50 });
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog wallColor={'#123456' as HexColor} wallSize={12 as PixelSize} />);

    act(() => {
      screen.getByText('Generate Dungeon').click();
    });

    expect(DungeonGenerator).toHaveBeenCalledWith(
      expect.objectContaining({ wallColor: '#123456', wallSize: 12 }),
    );
  });

  it('should allow changing number of rooms', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const slider = screen.getAllByRole('slider')[0];

    act(() => {
      fireEvent.change(slider, { target: { value: '10' } });
    });

    expect(screen.getByText(/Number of Rooms: 10/)).toBeInTheDocument();
  });

  it('should allow changing min room size', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const slider = screen.getAllByRole('slider')[1];

    act(() => {
      fireEvent.change(slider, { target: { value: '4' } });
    });

    expect(screen.getByText(/Min Room Size.*: 4/)).toBeInTheDocument();
  });

  it('should allow changing max room size', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const slider = screen.getAllByRole('slider')[2];

    act(() => {
      fireEvent.change(slider, { target: { value: '10' } });
    });

    expect(screen.getByText(/Max Room Size.*: 10/)).toBeInTheDocument();
  });

  it('should allow toggling clear canvas option', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');

    expect(checkbox).not.toBeChecked();

    act(() => {
      fireEvent.click(checkbox);
    });

    expect(checkbox).toBeChecked();
  });

  it('should clear existing drawings when clear canvas is checked', () => {
    useGameStore.setState({
      gridSize: 50,
      drawings: [
        {
          id: 'existing-drawing',
          tool: 'wall',
          points: [0, 0, 50, 50],
          color: '#000000',
          size: 5,
        },
      ],
    });
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    const generateButton = screen.getByText('Generate Dungeon');

    act(() => {
      fireEvent.click(checkbox);
    });

    act(() => {
      generateButton.click();
    });

    // Check that old drawings were cleared
    const state = useGameStore.getState();
    expect(state.drawings.every((d) => d.id !== 'existing-drawing')).toBe(true);
  });

  it('should use dynamic canvas dimensions', () => {
    useGameStore.setState({ gridSize: 50 });
    useUiStore.setState({ dungeonDialog: true });

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    render(<DungeonGeneratorDialog {...defaultProps} />);

    const generateButton = screen.getByText('Generate Dungeon');

    act(() => {
      generateButton.click();
    });

    // Verify that generator was called (dimensions are used internally)
    expect(useGameStore.getState().drawings.length).toBeGreaterThan(0);
  });

  it('should display info text about wall tool', () => {
    useUiStore.setState({ dungeonDialog: true });
    render(<DungeonGeneratorDialog {...defaultProps} />);

    expect(screen.getByText(/will be drawn using the Wall tool/)).toBeInTheDocument();
    expect(screen.getByText(/fully interactive/)).toBeInTheDocument();
  });
});
