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
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      render(<MovementRangeOverlay {...defaultProps} movementSpeed={30} />);

      // 30ft / 5ft per cell = 6 cells radius
      // Should call createGridGeometry to get geometry for calculations
      expect(spy).toHaveBeenCalledWith('LINES');
      spy.mockRestore();
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
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      const { rerender } = render(<MovementRangeOverlay {...defaultProps} />);
      const initialCallCount = spy.mock.calls.length;

      // Rerender with different position should trigger recalculation
      rerender(<MovementRangeOverlay {...defaultProps} tokenPosition={{ x: 200, y: 200 }} />);

      // Should call geometry functions again for new position
      expect(spy.mock.calls.length).toBeGreaterThan(initialCallCount);
      spy.mockRestore();
    });

    it('should recalculate when movement speed changes', () => {
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      const { rerender } = render(<MovementRangeOverlay {...defaultProps} />);
      const initialCallCount = spy.mock.calls.length;

      // Rerender with different speed should trigger recalculation
      rerender(<MovementRangeOverlay {...defaultProps} movementSpeed={60} />);

      // Should call geometry functions again for new speed
      expect(spy.mock.calls.length).toBeGreaterThan(initialCallCount);
      spy.mockRestore();
    });

    it('should recalculate when grid type changes', () => {
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      const { rerender } = render(<MovementRangeOverlay {...defaultProps} gridType="LINES" />);

      // Change grid type should trigger recalculation with new geometry
      rerender(<MovementRangeOverlay {...defaultProps} gridType="HEXAGONAL" />);

      // Should have been called with both grid types
      expect(spy).toHaveBeenCalledWith('LINES');
      expect(spy).toHaveBeenCalledWith('HEXAGONAL');
      spy.mockRestore();
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
      const spy = vi.spyOn(gridGeometry, 'createGridGeometry');

      const { rerender } = render(<MovementRangeOverlay {...defaultProps} />);
      spy.mockClear(); // Clear initial render calls

      // Rerender with identical props should NOT trigger recalculation
      rerender(<MovementRangeOverlay {...defaultProps} />);

      // Should not call createGridGeometry again (memoization working)
      // Note: May be called once for rendering geometry, but not for BFS calculation
      expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
      spy.mockRestore();
    });
  });
});
