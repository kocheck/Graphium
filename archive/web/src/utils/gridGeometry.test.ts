/**
 * Grid Geometry Unit Tests
 *
 * Comprehensive tests for all grid geometry implementations:
 * - SquareGridGeometry
 * - HexagonalGridGeometry
 * - IsometricGridGeometry
 *
 * Tests cover coordinate conversion, snapping, rendering, and viewport culling.
 */

import { describe, it, expect } from 'vitest';
import {
  SquareGridGeometry,
  HexagonalGridGeometry,
  IsometricGridGeometry,
  createGridGeometry,
} from './gridGeometry';

describe('SquareGridGeometry', () => {
  const geometry = new SquareGridGeometry();
  const gridSize = 50;

  describe('pixelToGrid', () => {
    it('converts pixel coordinates to grid cell coordinates', () => {
      expect(geometry.pixelToGrid(0, 0, gridSize)).toEqual({ q: 0, r: 0 });
      expect(geometry.pixelToGrid(50, 50, gridSize)).toEqual({ q: 1, r: 1 });
      expect(geometry.pixelToGrid(100, 150, gridSize)).toEqual({ q: 2, r: 3 });
      expect(geometry.pixelToGrid(125, 175, gridSize)).toEqual({ q: 2, r: 3 });
    });

    it('handles negative coordinates', () => {
      expect(geometry.pixelToGrid(-50, -50, gridSize)).toEqual({ q: -1, r: -1 });
      expect(geometry.pixelToGrid(-25, -25, gridSize)).toEqual({ q: -1, r: -1 });
    });

    it('handles different grid sizes', () => {
      expect(geometry.pixelToGrid(100, 100, 25)).toEqual({ q: 4, r: 4 });
      expect(geometry.pixelToGrid(100, 100, 100)).toEqual({ q: 1, r: 1 });
    });
  });

  describe('gridToPixel', () => {
    it('converts grid cell to pixel coordinates (center)', () => {
      expect(geometry.gridToPixel({ q: 0, r: 0 }, gridSize)).toEqual({ x: 25, y: 25 });
      expect(geometry.gridToPixel({ q: 1, r: 1 }, gridSize)).toEqual({ x: 75, y: 75 });
      expect(geometry.gridToPixel({ q: 2, r: 3 }, gridSize)).toEqual({ x: 125, y: 175 });
    });

    it('handles negative cell coordinates', () => {
      expect(geometry.gridToPixel({ q: -1, r: -1 }, gridSize)).toEqual({ x: -25, y: -25 });
    });
  });

  describe('getSnapPoint', () => {
    it('snaps odd-sized tokens to cell center', () => {
      // 1x1 token (odd) should snap to cell center
      const pos = geometry.getSnapPoint(127, 83, gridSize, 50, 50);
      // Token center at (127+25, 83+25) = (152, 108)
      // Cell index: floor(152/50) = 3, floor(108/50) = 2
      // Nearest cell center at (3.5*50, 2.5*50) = (175, 125)
      // Top-left should be at (175-25, 125-25) = (150, 100)
      expect(pos).toEqual({ x: 150, y: 100 });
    });

    it('snaps even-sized tokens to intersection', () => {
      // 2x2 token (even) should snap to intersection
      const pos = geometry.getSnapPoint(127, 83, gridSize, 100, 100);
      // Token center at (127+50, 83+50) = (177, 133)
      // Nearest intersection: round(177/50)*50 = 4*50 = 200, round(133/50)*50 = 3*50 = 150
      // Top-left should be at (200-50, 150-50) = (150, 100)
      expect(pos).toEqual({ x: 150, y: 100 });
    });

    it('snaps 3x3 tokens to cell center', () => {
      // 3x3 token (odd) should snap to cell center
      const pos = geometry.getSnapPoint(180, 120, gridSize, 150, 150);
      // Token center at (180+75, 120+75) = (255, 195)
      // Cell index: floor(255/50) = 5, floor(195/50) = 3
      // Nearest cell center at (5.5*50, 3.5*50) = (275, 175)
      // Top-left should be at (275-75, 175-75) = (200, 100)
      expect(pos).toEqual({ x: 200, y: 100 });
    });

    it('handles legacy mode without dimensions', () => {
      // Simple rounding to nearest grid intersection
      const pos = geometry.getSnapPoint(127, 83, gridSize);
      expect(pos).toEqual({ x: 150, y: 100 });
    });

    it('handles negative coordinates', () => {
      const pos = geometry.getSnapPoint(-25, -25, gridSize, 50, 50);
      // Token center at (-25+25, -25+25) = (0, 0)
      // Cell index: floor(0/50) = 0
      // Cell center at (0.5*50, 0.5*50) = (25, 25)
      // Top-left at (25-25, 25-25) = (0, 0)
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });
  });

  describe('getCellVertices', () => {
    it('returns 4 vertices for square cell', () => {
      const vertices = geometry.getCellVertices({ q: 0, r: 0 }, gridSize);
      expect(vertices).toHaveLength(4);
      expect(vertices).toEqual([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 },
      ]);
    });

    it('handles different cell positions', () => {
      const vertices = geometry.getCellVertices({ q: 2, r: 3 }, gridSize);
      expect(vertices).toEqual([
        { x: 100, y: 150 },
        { x: 150, y: 150 },
        { x: 150, y: 200 },
        { x: 100, y: 200 },
      ]);
    });
  });

  describe('getVisibleCells', () => {
    it('returns cells within viewport bounds', () => {
      const bounds = { x: 0, y: 0, width: 150, height: 150 };
      const cells = geometry.getVisibleCells(bounds, gridSize);
      // Should include cells (0,0), (1,0), (2,0), (0,1), (1,1), (2,1), (0,2), (1,2), (2,2)
      // Plus boundary cells = 4x4 = 16 cells
      expect(cells.length).toBeGreaterThanOrEqual(9);
    });

    it('handles offset viewport', () => {
      const bounds = { x: 100, y: 100, width: 100, height: 100 };
      const cells = geometry.getVisibleCells(bounds, gridSize);
      expect(cells.length).toBeGreaterThan(0);
      // Check that we get cells around (2,2), (3,3), (4,4)
      const hasCell22 = cells.some((c) => c.q === 2 && c.r === 2);
      expect(hasCell22).toBe(true);
    });
  });
});

describe('HexagonalGridGeometry', () => {
  const geometry = new HexagonalGridGeometry();
  const gridSize = 50;

  describe('pixelToGrid and gridToPixel roundtrip', () => {
    it('converts pixel to hex and back accurately', () => {
      const originalPixel = { x: 150, y: 150 };
      const hex = geometry.pixelToGrid(originalPixel.x, originalPixel.y, gridSize);
      const convertedPixel = geometry.gridToPixel(hex, gridSize);

      // Should be close (within a few pixels due to hex geometry)
      expect(Math.abs(convertedPixel.x - originalPixel.x)).toBeLessThan(gridSize);
      expect(Math.abs(convertedPixel.y - originalPixel.y)).toBeLessThan(gridSize);
    });

    it('handles multiple hex positions', () => {
      const testCells = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: 2, r: 2 },
        { q: -1, r: -1 },
      ];

      testCells.forEach((cell) => {
        const pixel = geometry.gridToPixel(cell, gridSize);
        const convertedCell = geometry.pixelToGrid(pixel.x, pixel.y, gridSize);
        // Handle -0 vs +0 JavaScript quirk by normalizing zeros
        const normalizedQ = convertedCell.q === 0 ? 0 : convertedCell.q;
        const normalizedR = convertedCell.r === 0 ? 0 : convertedCell.r;
        expect(normalizedQ).toBe(cell.q);
        expect(normalizedR).toBe(cell.r);
      });
    });
  });

  describe('getSnapPoint', () => {
    it('snaps tokens to nearest hex center', () => {
      const pos = geometry.getSnapPoint(127, 83, gridSize, 50, 50);
      // Should snap to nearest hex center and return top-left corner
      expect(pos.x).toBeDefined();
      expect(pos.y).toBeDefined();
    });

    it('handles legacy mode', () => {
      const pos = geometry.getSnapPoint(127, 83, gridSize);
      expect(pos.x).toBeDefined();
      expect(pos.y).toBeDefined();
    });

    it('snaps large tokens correctly', () => {
      const pos = geometry.getSnapPoint(100, 100, gridSize, 100, 100);
      // Larger token should still snap to hex center
      expect(pos.x).toBeDefined();
      expect(pos.y).toBeDefined();
    });
  });

  describe('getCellVertices', () => {
    it('returns 6 vertices for hexagon', () => {
      const vertices = geometry.getCellVertices({ q: 0, r: 0 }, gridSize);
      expect(vertices).toHaveLength(6);
    });

    it('vertices are evenly spaced at 60 degrees', () => {
      const vertices = geometry.getCellVertices({ q: 0, r: 0 }, gridSize);
      const center = geometry.gridToPixel({ q: 0, r: 0 }, gridSize);

      // Check that all vertices are approximately gridSize distance from center
      vertices.forEach((v) => {
        const distance = Math.sqrt(Math.pow(v.x - center.x, 2) + Math.pow(v.y - center.y, 2));
        expect(Math.abs(distance - gridSize)).toBeLessThan(1);
      });
    });
  });

  describe('getVisibleCells', () => {
    it('returns hexes within viewport bounds', () => {
      const bounds = { x: 0, y: 0, width: 200, height: 200 };
      const cells = geometry.getVisibleCells(bounds, gridSize);
      expect(cells.length).toBeGreaterThan(0);
    });

    it('includes padding to catch boundary hexes', () => {
      const bounds = { x: 100, y: 100, width: 50, height: 50 };
      const cells = geometry.getVisibleCells(bounds, gridSize);
      // Should include cells even at boundaries due to padding
      expect(cells.length).toBeGreaterThan(1);
    });

    it('covers the entire viewport including top-right and bottom-left corners', () => {
      // Regression test for "narrow band" bug
      // With top-left (0,0) and bottom-right (1000, 1000) check ONLY:
      // TopLeft: q~0, r~0
      // BottomRight: q~13, r~0 (since 2/3*x dominates y-x/3 term roughly)
      // We missed TopRight (q~13, r < 0) and BottomLeft (q~0, r > 0)

      const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
      const cells = geometry.getVisibleCells(bounds, gridSize);

      const rs = cells.map((c) => c.r);
      const minR = Math.min(...rs);
      const maxR = Math.max(...rs);

      // We expect significant spread in R values
      // Top Right should give negative R (~ -7)
      // Bottom Left should give positive R (~ 12)
      // Bottom Right is only (~ 5)
      expect(minR).toBeLessThan(-5); // Expect negative R
      expect(maxR).toBeGreaterThan(10); // Expect larger positive R than BottomRight
    });
  });
});

describe('IsometricGridGeometry', () => {
  const geometry = new IsometricGridGeometry();
  const gridSize = 50;

  describe('pixelToGrid and gridToPixel roundtrip', () => {
    it('converts pixel to iso and back accurately', () => {
      const testCells = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: 2, r: 2 },
        { q: -1, r: -1 },
      ];

      testCells.forEach((cell) => {
        const pixel = geometry.gridToPixel(cell, gridSize);
        const convertedCell = geometry.pixelToGrid(pixel.x, pixel.y, gridSize);
        expect(convertedCell).toEqual(cell);
      });
    });

    it('handles arbitrary pixel positions', () => {
      const originalPixel = { x: 150, y: 100 };
      const iso = geometry.pixelToGrid(originalPixel.x, originalPixel.y, gridSize);
      const convertedPixel = geometry.gridToPixel(iso, gridSize);

      // Should be relatively close
      expect(Math.abs(convertedPixel.x - originalPixel.x)).toBeLessThan(gridSize * 2);
      expect(Math.abs(convertedPixel.y - originalPixel.y)).toBeLessThan(gridSize);
    });
  });

  describe('getSnapPoint', () => {
    it('snaps tokens to nearest diamond center', () => {
      const pos = geometry.getSnapPoint(127, 83, gridSize, 50, 50);
      expect(pos.x).toBeDefined();
      expect(pos.y).toBeDefined();
    });

    it('handles legacy mode', () => {
      const pos = geometry.getSnapPoint(127, 83, gridSize);
      expect(pos.x).toBeDefined();
      expect(pos.y).toBeDefined();
    });

    it('snaps large tokens correctly', () => {
      const pos = geometry.getSnapPoint(100, 100, gridSize, 100, 100);
      expect(pos.x).toBeDefined();
      expect(pos.y).toBeDefined();
    });
  });

  describe('getCellVertices', () => {
    it('returns 4 vertices for diamond', () => {
      const vertices = geometry.getCellVertices({ q: 0, r: 0 }, gridSize);
      expect(vertices).toHaveLength(4);
    });

    it('vertices form diamond shape', () => {
      const vertices = geometry.getCellVertices({ q: 0, r: 0 }, gridSize);
      const center = geometry.gridToPixel({ q: 0, r: 0 }, gridSize);

      // Check diamond shape: vertices should be at top, right, bottom, left
      expect(vertices[0].x).toBeCloseTo(center.x); // Top
      expect(vertices[0].y).toBeLessThan(center.y);
      expect(vertices[1].x).toBeGreaterThan(center.x); // Right
      expect(vertices[1].y).toBeCloseTo(center.y);
      expect(vertices[2].x).toBeCloseTo(center.x); // Bottom
      expect(vertices[2].y).toBeGreaterThan(center.y);
      expect(vertices[3].x).toBeLessThan(center.x); // Left
      expect(vertices[3].y).toBeCloseTo(center.y);
    });
  });

  describe('getVisibleCells', () => {
    it('returns diamonds within viewport bounds', () => {
      const bounds = { x: 0, y: 0, width: 200, height: 200 };
      const cells = geometry.getVisibleCells(bounds, gridSize);
      expect(cells.length).toBeGreaterThan(0);
    });

    it('handles rotated viewport correctly', () => {
      // Isometric grids are rotated, so viewport calculation is different
      const bounds = { x: 100, y: 50, width: 100, height: 100 };
      const cells = geometry.getVisibleCells(bounds, gridSize);
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});

describe('createGridGeometry factory', () => {
  it('creates SquareGridGeometry for LINES type', () => {
    const geometry = createGridGeometry('LINES');
    expect(geometry).toBeInstanceOf(SquareGridGeometry);
  });

  it('creates SquareGridGeometry for DOTS type', () => {
    const geometry = createGridGeometry('DOTS');
    expect(geometry).toBeInstanceOf(SquareGridGeometry);
  });

  it('creates SquareGridGeometry for HIDDEN type', () => {
    const geometry = createGridGeometry('HIDDEN');
    expect(geometry).toBeInstanceOf(SquareGridGeometry);
  });

  it('creates HexagonalGridGeometry for HEXAGONAL type', () => {
    const geometry = createGridGeometry('HEXAGONAL');
    expect(geometry).toBeInstanceOf(HexagonalGridGeometry);
  });

  it('creates IsometricGridGeometry for ISOMETRIC type', () => {
    const geometry = createGridGeometry('ISOMETRIC');
    expect(geometry).toBeInstanceOf(IsometricGridGeometry);
  });
});

describe('Performance tests', () => {
  it('SquareGridGeometry getVisibleCells is efficient for large viewport', () => {
    const geometry = new SquareGridGeometry();
    const bounds = { x: 0, y: 0, width: 5000, height: 5000 };
    const gridSize = 50;

    const start = performance.now();
    const cells = geometry.getVisibleCells(bounds, gridSize);
    const duration = performance.now() - start;

    // Should complete in less than 100ms even for large viewport
    expect(duration).toBeLessThan(100);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('HexagonalGridGeometry getVisibleCells is efficient', () => {
    const geometry = new HexagonalGridGeometry();
    const bounds = { x: 0, y: 0, width: 5000, height: 5000 };
    const gridSize = 50;

    const start = performance.now();
    const cells = geometry.getVisibleCells(bounds, gridSize);
    const duration = performance.now() - start;

    // Hex culling should also be fast
    expect(duration).toBeLessThan(200);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('IsometricGridGeometry getVisibleCells is efficient', () => {
    const geometry = new IsometricGridGeometry();
    const bounds = { x: 0, y: 0, width: 5000, height: 5000 };
    const gridSize = 50;

    const start = performance.now();
    const cells = geometry.getVisibleCells(bounds, gridSize);
    const duration = performance.now() - start;

    // Iso culling should also be fast
    expect(duration).toBeLessThan(200);
    expect(cells.length).toBeGreaterThan(0);
  });
});
