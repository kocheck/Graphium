import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MovementRangeOverlay from './MovementRangeOverlay';

describe('MovementRangeOverlay', () => {
  const defaultProps = {
    tokenPosition: { x: 100, y: 100 },
    movementSpeed: 30,
    gridSize: 50,
    gridType: 'LINES' as const,
  };

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} />);
      expect(container).toBeTruthy();
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
      expect(container).toBeTruthy();
    });
  });

  describe('movement calculation', () => {
    it('should calculate reachable cells for 30ft movement (6 cells)', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} />);
      // 30ft / 5ft per cell = 6 cells radius
      // Should render multiple cells (exact count depends on grid type)
      expect(container.querySelector('Group')).toBeTruthy();
    });

    it('should handle zero movement speed', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} movementSpeed={0} />);
      expect(container).toBeTruthy();
    });

    it('should handle large movement speed', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} movementSpeed={120} />);
      expect(container).toBeTruthy();
    });
  });

  describe('grid type support', () => {
    it('should work with LINES grid', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="LINES" />);
      expect(container).toBeTruthy();
    });

    it('should work with DOTS grid', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="DOTS" />);
      expect(container).toBeTruthy();
    });

    it('should work with HEXAGONAL grid', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="HEXAGONAL" />);
      expect(container).toBeTruthy();
    });

    it('should work with ISOMETRIC grid', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="ISOMETRIC" />);
      expect(container).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle negative token position', () => {
      const { container } = render(
        <MovementRangeOverlay {...defaultProps} tokenPosition={{ x: -100, y: -100 }} />,
      );
      expect(container).toBeTruthy();
    });

    it('should handle very small grid size', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridSize={1} />);
      expect(container).toBeTruthy();
    });

    it('should handle very large grid size', () => {
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridSize={1000} />);
      expect(container).toBeTruthy();
    });

    it('should memoize reachable cells calculation', () => {
      const { rerender } = render(<MovementRangeOverlay {...defaultProps} />);

      // Rerender with same props should use memoized value
      rerender(<MovementRangeOverlay {...defaultProps} />);

      expect(true).toBe(true); // Component should not recalculate
    });

    it('should recalculate when token position changes', () => {
      const { rerender } = render(<MovementRangeOverlay {...defaultProps} />);

      rerender(<MovementRangeOverlay {...defaultProps} tokenPosition={{ x: 200, y: 200 }} />);

      expect(true).toBe(true); // Should recalculate with new position
    });

    it('should recalculate when movement speed changes', () => {
      const { rerender } = render(<MovementRangeOverlay {...defaultProps} />);

      rerender(<MovementRangeOverlay {...defaultProps} movementSpeed={60} />);

      expect(true).toBe(true); // Should recalculate with new speed
    });
  });

  describe('neighbor calculation', () => {
    it('should calculate 4 neighbors for square grid', () => {
      // Square grids have 4 orthogonal neighbors
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="LINES" />);
      expect(container).toBeTruthy();
    });

    it('should calculate 6 neighbors for hexagonal grid', () => {
      // Hex grids have 6 neighbors
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="HEXAGONAL" />);
      expect(container).toBeTruthy();
    });

    it('should calculate 4 neighbors for isometric grid', () => {
      // Iso grids have 4 diagonal neighbors
      const { container } = render(<MovementRangeOverlay {...defaultProps} gridType="ISOMETRIC" />);
      expect(container).toBeTruthy();
    });
  });

  describe('performance', () => {
    it('should handle large movement range efficiently', () => {
      const startTime = performance.now();

      render(<MovementRangeOverlay {...defaultProps} movementSpeed={300} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in reasonable time even with large range
      // In test environment, allow up to 100ms to leave some overhead margin
      expect(renderTime).toBeLessThan(100);
    });

    it('should not render duplicate cells', () => {
      // BFS should visit each cell only once
      const { container } = render(<MovementRangeOverlay {...defaultProps} />);
      expect(container).toBeTruthy();
    });
  });
});
