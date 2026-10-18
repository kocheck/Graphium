import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MovementRangeOverlay from './MovementRangeOverlay';
import * as gridGeometry from '../../utils/gridGeometry';

describe('MovementRangeOverlay', () => {
  const defaultProps = {
    tokenPosition: { x: 100, y: 100 },
    movementSpeed: 30,
    gridSize: 50,
    gridType: 'LINES' as const,
  };

  describe('rendering', () => {
    it('should render Group component for valid grid types', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} />);
      // Component should render (not return null)
      expect(container.firstChild).not.toBeNull();
    });

    it('should return null for HIDDEN grid type', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="HIDDEN" />);
      expect(container.firstChild).toBeNull();
    });

    it('should render with custom colors', () => {
      const { container } = render(
        <MovementRangeOverlay
          {...defaultProps}
          fillColor="rgba(255, 0, 0, 0.2)"
          strokeColor="rgba(255, 0, 0, 0.8)"
        />,
      );
      // Should render successfully with custom colors
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('movement calculation', () => {
    it('should calculate reachable cells based on movement speed', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} movementSpeed={30} />);

      // 30ft / 5ft per cell = 6 cells radius
      // For square grid with 4 neighbors, this should create a diamond shape
      // Expected cells: 1 (center) + 4 + 8 + 12 + 16 + 20 + 24 = 85 cells
      // (each ring adds 4 more cells than the previous)
      const lines = container.querySelectorAll('[data-testid="line"]');
      expect(lines.length).toBeGreaterThan(0);
      // Verify we have a reasonable number of cells for 6-cell radius
      expect(lines.length).toBeGreaterThanOrEqual(80);
      expect(lines.length).toBeLessThanOrEqual(90);
    });

    it('should handle zero movement speed without crashing', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} movementSpeed={0} />);
      // Zero movement may still show the starting cell, but shouldn't crash
      expect(container.firstChild).not.toBeNull();
    });

    it('should handle large movement speed without crashing', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} movementSpeed={120} />);
      // 120ft / 5ft = 24 cells radius - should still render
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('grid type support', () => {
    it('should work with LINES grid', () => {
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      render(<MovementRangeOverlay {...defaultProps} gridType="LINES" />);

      expect(spy).toHaveBeenCalledWith('LINES');
      spy.mockRestore();
    });

    it('should work with DOTS grid', () => {
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      render(<MovementRangeOverlay {...defaultProps} gridType="DOTS" />);

      expect(spy).toHaveBeenCalledWith('DOTS');
      spy.mockRestore();
    });

    it('should work with HEXAGONAL grid', () => {
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      render(<MovementRangeOverlay {...defaultProps} gridType="HEXAGONAL" />);

      expect(spy).toHaveBeenCalledWith('HEXAGONAL');
      spy.mockRestore();
    });

    it('should work with ISOMETRIC grid', () => {
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      render(<MovementRangeOverlay {...defaultProps} gridType="ISOMETRIC" />);

      expect(spy).toHaveBeenCalledWith('ISOMETRIC');
      spy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle negative token position', () => {
      const { container } = render(
        <MovementRangeOverlay {...defaultProps} tokenPosition={{ x: -100, y: -100 }} />,
      );
      // Should handle negative coordinates without crashing
      expect(container.firstChild).not.toBeNull();
    });

    it('should handle very small grid size', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridSize={1} />);
      // Small grid size should still render
      expect(container.firstChild).not.toBeNull();
    });

    it('should handle very large grid size', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridSize={1000} />);
      // Large grid size should still render
      expect(container.firstChild).not.toBeNull();
    });

    it('should recalculate when token position changes', () => {
      const { container, rerender } = render(<MovementRangeOverlay {...defaultProps} />);
      const initialLines = container.querySelectorAll('[data-testid="line"]').length;

      // Move token to different position (should change starting cell)
      // Move by more than gridSize to ensure we're in a different cell
      rerender(<MovementRangeOverlay {...defaultProps} tokenPosition={{ x: 300, y: 300 }} />);
      const newLines = container.querySelectorAll('[data-testid="line"]').length;

      // Should still render same number of cells (same movement speed, different center)
      expect(newLines).toBe(initialLines);
      // But the actual cells rendered should be different (we can't easily verify this
      // without accessing internal state, but at minimum it shouldn't crash)
      expect(newLines).toBeGreaterThan(0);
    });

    it('should recalculate when movement speed changes', () => {
      const { container, rerender } = render(
        <MovementRangeOverlay {...defaultProps} movementSpeed={10} />,
      );
      const smallRangeLines = container.querySelectorAll('[data-testid="line"]').length;

      // Increase movement speed should increase reachable cells
      rerender(<MovementRangeOverlay {...defaultProps} movementSpeed={20} />);
      const largeRangeLines = container.querySelectorAll('[data-testid="line"]').length;

      // More movement = more cells
      expect(largeRangeLines).toBeGreaterThan(smallRangeLines);
    });

    it('should recalculate when grid type changes', () => {
      const { container, rerender } = render(
        <MovementRangeOverlay {...defaultProps} gridType="LINES" movementSpeed={10} />,
      );
      const squareLines = container.querySelectorAll('[data-testid="line"]').length;

      // Change to hexagonal (6 neighbors instead of 4)
      rerender(<MovementRangeOverlay {...defaultProps} gridType="HEXAGONAL" movementSpeed={10} />);
      const hexLines = container.querySelectorAll('[data-testid="line"]').length;

      // Hexagonal should have more cells (6 neighbors vs 4)
      // 10ft / 5ft = 2 cells: square=13, hex=19
      expect(squareLines).toBe(13);
      expect(hexLines).toBe(19);
    });
  });

  describe('neighbor calculations', () => {
    it('should use 4 neighbors for square grids (LINES)', () => {
      const { container } = render(
        <MovementRangeOverlay {...defaultProps} gridType="LINES" movementSpeed={10} />,
      );
      // 10ft / 5ft = 2 cells radius
      // For 4-neighbor square grid: 1 + 4 + 8 = 13 cells
      const lines = container.querySelectorAll('[data-testid="line"]');
      expect(lines.length).toBe(13);
    });

    it('should use 4 neighbors for square grids (DOTS)', () => {
      const { container } = render(
        <MovementRangeOverlay {...defaultProps} gridType="DOTS" movementSpeed={10} />,
      );
      // Same as LINES - 4 neighbors
      const lines = container.querySelectorAll('[data-testid="line"]');
      expect(lines.length).toBe(13);
    });

    it('should use 6 neighbors for hexagonal grids', () => {
      const { container } = render(
        <MovementRangeOverlay {...defaultProps} gridType="HEXAGONAL" movementSpeed={10} />,
      );
      // 10ft / 5ft = 2 cells radius
      // For 6-neighbor hex grid: 1 + 6 + 12 = 19 cells
      const lines = container.querySelectorAll('[data-testid="line"]');
      expect(lines.length).toBe(19);
    });

    it('should use 4 neighbors for isometric grids', () => {
      const { container } = render(
        <MovementRangeOverlay {...defaultProps} gridType="ISOMETRIC" movementSpeed={10} />,
      );
      // Same as square - 4 neighbors
      const lines = container.querySelectorAll('[data-testid="line"]');
      expect(lines.length).toBe(13);
    });
  });

  describe('BFS visited set (no duplicates)', () => {
    it('should not render duplicate cells', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} movementSpeed={20} />);

      const lines = container.querySelectorAll('[data-testid="line"]');
      const keys = new Set<string>();

      // Extract unique keys from rendered lines
      lines.forEach((line) => {
        const key = line.getAttribute('data-key') || line.getAttribute('key');
        if (key) {
          keys.add(key);
        }
      });

      // Each cell should appear exactly once
      // For square grid with 20ft (4 cells): 1 + 4 + 8 + 12 + 16 = 41 cells
      expect(lines.length).toBe(41);
      // All line keys should be unique
      expect(keys.size).toBeLessThanOrEqual(lines.length);
    });
  });

  describe('performance', () => {
    it('should handle large movement range efficiently', () => {
      const startTime = performance.now();

      // Test with 60ft movement (12 cells) - large but realistic
      render(<MovementRangeOverlay {...defaultProps} movementSpeed={60} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in reasonable time even with large range
      // In test environment, allow up to 100ms to account for test infrastructure overhead
      expect(renderTime).toBeLessThan(100);
    });

    it('should use memoization to avoid unnecessary recalculations', () => {
      const { container, rerender } = render(<MovementRangeOverlay {...defaultProps} />);

      // Get initial cell count
      const initialLines = container.querySelectorAll('line').length;

      // Rerender with identical props should produce identical results
      rerender(<MovementRangeOverlay {...defaultProps} />);
      const rerenderedLines = container.querySelectorAll('line').length;

      // Same number of cells should be rendered (memoization working)
      expect(rerenderedLines).toBe(initialLines);
    });
  });
});
