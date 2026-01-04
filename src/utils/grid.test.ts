import { describe, it, expect } from 'vitest';
import { snapToGrid } from './grid';

describe('snapToGrid', () => {
  const gridSize = 50;
  const gridType = 'LINES'; // Square grid tests

  describe('legacy behavior (no dimensions provided)', () => {
    it('should snap to top-left corner when dimensions are undefined', () => {
      const result = snapToGrid(27, 33, gridSize, gridType);
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should snap to nearest grid intersection', () => {
      const result = snapToGrid(73, 98, gridSize, gridType);
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('should handle negative coordinates', () => {
      const result = snapToGrid(-27, -33, gridSize, gridType);
      expect(result).toEqual({ x: -50, y: -50 });
    });

    it('should handle zero dimensions (zero-sized tokens)', () => {
      // Zero dimensions are valid and should be processed normally
      // 0x0 token (0 cells, even) => snap to intersection
      const result = snapToGrid(27, 33, gridSize, gridType, 0, 0);
      // Center: (27 + 0, 33 + 0) = (27, 33)
      // Intersection: round(27/50)*50 = 50, round(33/50)*50 = 50
      // Top-left: (50 - 0, 50 - 0) = (50, 50)
      expect(result).toEqual({ x: 50, y: 50 });
    });
  });

  describe('dimension-aware snapping', () => {
    describe('odd cell count tokens (snap to cell center)', () => {
      it('should snap 1x1 token (odd) to cell center', () => {
        // Token center at (25, 25) should snap to cell center at (25, 25)
        // Token top-left would be at (0, 0)
        const result = snapToGrid(0, 0, gridSize, gridType, gridSize, gridSize);
        expect(result).toEqual({ x: 0, y: 0 });
      });

      it('should snap 3x3 token (odd) to cell center', () => {
        // 3x3 grid cells = 150x150 pixels
        // Token center at (175, 175) should snap to cell center at (175, 175)
        // Top-left would be at (100, 100)
        const tokenSize = gridSize * 3;
        const result = snapToGrid(90, 95, gridSize, gridType, tokenSize, tokenSize);
        // Center at (90 + 75, 95 + 75) = (165, 170)
        // Nearest cell center: (175, 175) for cell index 3
        // Top-left: (175 - 75, 175 - 75) = (100, 100)
        expect(result).toEqual({ x: 100, y: 100 });
      });

      it('should snap 5x5 token (odd) to cell center', () => {
        const tokenSize = gridSize * 5;
        // Center at (127, 127) should snap to nearest cell center
        const result = snapToGrid(2, 2, gridSize, gridType, tokenSize, tokenSize);
        // Center: (2 + 125, 2 + 125) = (127, 127)
        // Cell index: floor(127/50) = 2, center at (2.5 * 50) = 125
        // Top-left: (125 - 125, 125 - 125) = (0, 0)
        expect(result).toEqual({ x: 0, y: 0 });
      });
    });

    describe('even cell count tokens (snap to intersection)', () => {
      it('should snap 2x2 token (even) to grid intersection', () => {
        // 2x2 grid cells = 100x100 pixels
        // Token center at (148, 152) should snap to intersection at (150, 150)
        // Top-left would be at (100, 100)
        const tokenSize = gridSize * 2;
        const result = snapToGrid(95, 98, gridSize, gridType, tokenSize, tokenSize);
        // Center: (95 + 50, 98 + 50) = (145, 148)
        // Nearest intersection: round(145/50)*50 = 3*50 = 150, round(148/50)*50 = 3*50 = 150
        // Top-left: (150 - 50, 150 - 50) = (100, 100)
        expect(result).toEqual({ x: 100, y: 100 });
      });

      it('should snap 4x4 token (even) to grid intersection', () => {
        const tokenSize = gridSize * 4;
        const result = snapToGrid(10, 15, gridSize, gridType, tokenSize, tokenSize);
        // Center: (10 + 100, 15 + 100) = (110, 115)
        // Nearest intersection: round(110/50)*50 = 100, round(115/50)*50 = 100
        // Top-left: (100 - 100, 100 - 100) = (0, 0)
        expect(result).toEqual({ x: 0, y: 0 });
      });
    });

    describe('non-square tokens', () => {
      it('should handle different width and height (odd x even)', () => {
        // 1x2 token: width=50 (1 cell, odd), height=100 (2 cells, even)
        const result = snapToGrid(20, 20, gridSize, gridType, gridSize, gridSize * 2);
        // X: center at (20 + 25) = 45, odd => cell center at 25, top-left at (25 - 25) = 0
        // Y: center at (20 + 50) = 70, even => intersection at round(70/50)*50 = 50, top-left at (50 - 50) = 0
        expect(result).toEqual({ x: 0, y: 0 });
      });

      it('should handle different width and height (even x odd)', () => {
        // 2x1 token: width=100 (2 cells, even), height=50 (1 cell, odd)
        const result = snapToGrid(70, 70, gridSize, gridType, gridSize * 2, gridSize);
        // X: center at (70 + 50) = 120, even => intersection at round(120/50)*50 = 100, top-left at (100 - 50) = 50
        // Y: center at (70 + 25) = 95, odd => cell center at floor(95/50)+0.5)*50 = 75, top-left at (75 - 25) = 50
        expect(result).toEqual({ x: 50, y: 50 });
      });
    });

    describe('edge cases', () => {
      it('should handle tokens already perfectly aligned (odd)', () => {
        const tokenSize = gridSize * 3;
        const result = snapToGrid(25, 25, gridSize, gridType, tokenSize, tokenSize);
        // Center: (25 + 75, 25 + 75) = (100, 100)
        // Cell center for index 2: (2 + 0.5) * 50 = 125... wait floor(100/50) = 2, center = 125
        // Top-left: (125 - 75, 125 - 75) = (50, 50)
        expect(result).toEqual({ x: 50, y: 50 });
      });

      it('should handle tokens already perfectly aligned (even)', () => {
        const tokenSize = gridSize * 2;
        const result = snapToGrid(50, 50, gridSize, gridType, tokenSize, tokenSize);
        // Center: (50 + 50, 50 + 50) = (100, 100)
        // Intersection: round(100/50)*50 = 100
        // Top-left: (100 - 50, 100 - 50) = (50, 50)
        expect(result).toEqual({ x: 50, y: 50 });
      });

      it('should handle very small tokens (less than grid size)', () => {
        const tokenSize = 25; // 0.5 cells
        const result = snapToGrid(37, 62, gridSize, gridType, tokenSize, tokenSize);
        // Center: (37 + 12.5, 62 + 12.5) = (49.5, 74.5)
        // Cell count: round(25/50) = 1 (rounds up to 1 cell)
        // 1 is odd, so snaps to cell center
        // X: floor(49.5/50) + 0.5)*50 = 25, top-left = 25 - 12.5 = 12.5
        // Y: floor(74.5/50) + 0.5)*50 = 75, top-left = 75 - 12.5 = 62.5
        expect(result).toEqual({ x: 12.5, y: 62.5 });
      });

      it('should handle negative coordinates with dimensions', () => {
        const tokenSize = gridSize;
        const result = snapToGrid(-60, -40, gridSize, gridType, tokenSize, tokenSize);
        // Center: (-60 + 25, -40 + 25) = (-35, -15)
        // Odd => cell center: floor(-35/50) + 0.5)*50 = (-1 + 0.5)*50 = -25
        // Top-left: (-25 - 25, -25 - 25) = (-50, -50)
        expect(result).toEqual({ x: -50, y: -50 });
      });
    });
  });

  describe('grid size variations', () => {
    it('should work with different grid sizes', () => {
      const result = snapToGrid(35, 40, 100, gridType, 100, 100);
      // Center: (35 + 50, 40 + 50) = (85, 90)
      // 1 cell (odd) => cell center: floor(85/100) + 0.5)*100 = 50
      // Top-left: (50 - 50, 50 - 50) = (0, 0)
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should work with very small grid sizes', () => {
      const result = snapToGrid(13, 17, 10, gridType, 20, 20);
      // Center: (13 + 10, 17 + 10) = (23, 27)
      // 2 cells (even) => intersection: round(23/10)*10 = 20, round(27/10)*10 = 30
      // Top-left: (20 - 10, 30 - 10) = (10, 20)
      expect(result).toEqual({ x: 10, y: 20 });
    });
  });

  describe('grid type parameter', () => {
    it('should default to LINES (square grid) when gridType not provided', () => {
      // Test backward compatibility - should work without gridType parameter
      const result = snapToGrid(27, 33, gridSize);
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should work with explicit DOTS grid type (same as square)', () => {
      const result = snapToGrid(27, 33, gridSize, 'DOTS', gridSize, gridSize);
      // DOTS uses square grid geometry, should snap to cell center (odd size)
      const resultLines = snapToGrid(27, 33, gridSize, 'LINES', gridSize, gridSize);
      expect(result).toEqual(resultLines);
    });

    it('should work with HIDDEN grid type (same as square)', () => {
      const result = snapToGrid(27, 33, gridSize, 'HIDDEN', gridSize, gridSize);
      // HIDDEN uses square grid geometry, should snap to cell center (odd size)
      const resultLines = snapToGrid(27, 33, gridSize, 'LINES', gridSize, gridSize);
      expect(result).toEqual(resultLines);
    });
  });
});
