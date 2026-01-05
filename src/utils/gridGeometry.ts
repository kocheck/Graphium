/**
 * Grid Geometry Implementations
 *
 * Provides efficient coordinate conversion and rendering for different grid types.
 * All implementations are optimized for performance on low-spec hardware.
 *
 * **Performance Optimizations:**
 * - Pre-computed constants (sqrt(3), etc.)
 * - Minimal object allocations in hot paths
 * - Simple arithmetic (avoid expensive Math functions)
 * - Efficient viewport culling
 *
 * **Grid Types:**
 * - Square: Traditional orthogonal grid
 * - Hexagonal: Flat-top hexagons using axial coordinates
 * - Isometric: Diamond-shaped cells (45° rotated square grid)
 */

import type { GridGeometry, GridCell, Point, Bounds } from '../types/grid';

// Pre-computed constants for performance
const SQRT3 = Math.sqrt(3); // ~1.732 (used in hex math)
const SQRT3_2 = SQRT3 / 2; // ~0.866
const SQRT3_3 = SQRT3 / 3; // ~0.577

/**
 * Safety factor for hex bounds checking
 * Multiplier applied to grid size when checking if a hex is within viewport bounds.
 * A value > 1.0 ensures we don't miss hexes that are partially visible at viewport edges.
 */
const HEX_BOUNDS_SAFETY_FACTOR = 1.2;

/**
 * Square Grid Geometry
 *
 * Traditional orthogonal grid (rows and columns).
 * Migrated from existing snapToGrid logic in grid.ts.
 *
 * **Coordinate System:**
 * - GridCell.q = column (x-axis)
 * - GridCell.r = row (y-axis)
 * - Cell (0,0) has top-left corner at pixel (0,0)
 */
export class SquareGridGeometry implements GridGeometry {
  pixelToGrid(x: number, y: number, gridSize: number): GridCell {
    return {
      q: Math.floor(x / gridSize),
      r: Math.floor(y / gridSize),
    };
  }

  gridToPixel(cell: GridCell, gridSize: number): Point {
    // Return center of cell
    return {
      x: (cell.q + 0.5) * gridSize,
      y: (cell.r + 0.5) * gridSize,
    };
  }

  getSnapPoint(x: number, y: number, gridSize: number, width?: number, height?: number): Point {
    // Migrated from grid.ts - smart snapping based on token size
    if (width === undefined || height === undefined) {
      // Legacy mode: simple rounding
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      };
    }

    // Smart snapping: odd sizes snap to center, even sizes snap to intersection
    const snapDimension = (pos: number, size: number): number => {
      const center = pos + size / 2;
      const cellCount = Math.round(size / gridSize);
      const isOdd = cellCount % 2 !== 0;

      let snapCenter: number;
      if (isOdd) {
        // Snap to cell center: (index + 0.5) * gridSize
        snapCenter = (Math.floor(center / gridSize) + 0.5) * gridSize;
      } else {
        // Snap to intersection: index * gridSize
        snapCenter = Math.round(center / gridSize) * gridSize;
      }

      return snapCenter - size / 2;
    };

    return {
      x: snapDimension(x, width),
      y: snapDimension(y, height),
    };
  }

  getCellVertices(cell: GridCell, gridSize: number): Point[] {
    const left = cell.q * gridSize;
    const top = cell.r * gridSize;
    const right = left + gridSize;
    const bottom = top + gridSize;

    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
  }

  getVisibleCells(bounds: Bounds, gridSize: number): GridCell[] {
    const cells: GridCell[] = [];

    const startQ = Math.floor(bounds.x / gridSize);
    const endQ = Math.ceil((bounds.x + bounds.width) / gridSize);
    const startR = Math.floor(bounds.y / gridSize);
    const endR = Math.ceil((bounds.y + bounds.height) / gridSize);

    for (let q = startQ; q <= endQ; q++) {
      for (let r = startR; r <= endR; r++) {
        cells.push({ q, r });
      }
    }

    return cells;
  }
}

/**
 * Hexagonal Grid Geometry (Flat-Top Orientation)
 *
 * Uses axial coordinates (q, r) for hexagon addressing.
 * Reference: https://www.redblobgames.com/grids/hexagons/
 *
 * **Coordinate System:**
 * - Axial coordinates (q, r) where q points right, r points down-right
 * - Flat-top orientation (hexagon has flat edge on top/bottom)
 * - gridSize = distance from hex center to vertex (circumradius)
 *
 * **Performance:**
 * - Pre-computed SQRT3 constants to avoid repeated Math.sqrt calls
 * - Efficient hex rounding algorithm (no cube coordinate conversion)
 */
export class HexagonalGridGeometry implements GridGeometry {
  pixelToGrid(x: number, y: number, gridSize: number): GridCell {
    // Convert pixel to fractional axial coordinates
    // Flat-top hex: width = 2 * size, height = sqrt(3) * size
    const q = ((2 / 3) * x) / gridSize;
    const r = ((-1 / 3) * x + SQRT3_3 * y) / gridSize;

    // Round to nearest hex using efficient algorithm
    return this.hexRound(q, r);
  }

  gridToPixel(cell: GridCell, gridSize: number): Point {
    // Convert axial to pixel (center of hex)
    const x = gridSize * (3 / 2) * cell.q;
    const y = gridSize * (SQRT3_2 * cell.q + SQRT3 * cell.r);

    return { x, y };
  }

  getSnapPoint(x: number, y: number, gridSize: number, width?: number, height?: number): Point {
    // For hex grids, always snap to hex center
    // Token size determines how many hexes it occupies, but placement is always centered

    if (width === undefined || height === undefined) {
      // Simple snap to nearest hex center
      const cell = this.pixelToGrid(x, y, gridSize);
      return this.gridToPixel(cell, gridSize);
    }

    // Calculate token center
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Find nearest hex center
    const cell = this.pixelToGrid(centerX, centerY, gridSize);
    const hexCenter = this.gridToPixel(cell, gridSize);

    // Return top-left corner position
    return {
      x: hexCenter.x - width / 2,
      y: hexCenter.y - height / 2,
    };
  }

  getCellVertices(cell: GridCell, gridSize: number): Point[] {
    const center = this.gridToPixel(cell, gridSize);
    const vertices: Point[] = [];

    // Flat-top hex has 6 vertices, starting from top-right, going clockwise
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i; // 0, 60, 120, 180, 240, 300 degrees
      const angleRad = (Math.PI / 180) * angleDeg;
      vertices.push({
        x: center.x + gridSize * Math.cos(angleRad),
        y: center.y + gridSize * Math.sin(angleRad),
      });
    }

    return vertices;
  }

  getVisibleCells(bounds: Bounds, gridSize: number): GridCell[] {
    const cells: GridCell[] = [];

    // Calculate bounding box in hex coordinates
    // We must check ALL corners because r-axis is diagonal in hex grid
    // Just simple top-left/bottom-right check isn't enough for hex
    const padding = 2;

    const corners = [
      this.pixelToGrid(bounds.x, bounds.y, gridSize), // Top Left
      this.pixelToGrid(bounds.x + bounds.width, bounds.y, gridSize), // Top Right
      this.pixelToGrid(bounds.x + bounds.width, bounds.y + bounds.height, gridSize), // Bottom Right
      this.pixelToGrid(bounds.x, bounds.y + bounds.height, gridSize), // Bottom Left
    ];

    let minQ = corners[0].q;
    let maxQ = corners[0].q;
    let minR = corners[0].r;
    let maxR = corners[0].r;

    for (const corner of corners) {
      minQ = Math.min(minQ, corner.q);
      maxQ = Math.max(maxQ, corner.q);
      minR = Math.min(minR, corner.r);
      maxR = Math.max(maxR, corner.r);
    }

    // Apply padding
    minQ -= padding;
    maxQ += padding;
    minR -= padding;
    maxR += padding;

    // Iterate over rectangular region in axial coordinates
    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        // Check if hex is actually visible (simple bounds check)
        const center = this.gridToPixel({ q, r }, gridSize);
        const hexRadius = gridSize * HEX_BOUNDS_SAFETY_FACTOR;

        if (
          center.x + hexRadius >= bounds.x &&
          center.x - hexRadius <= bounds.x + bounds.width &&
          center.y + hexRadius >= bounds.y &&
          center.y - hexRadius <= bounds.y + bounds.height
        ) {
          cells.push({ q, r });
        }
      }
    }

    return cells;
  }

  /**
   * Round fractional axial coordinates to nearest hex
   * Efficient algorithm without cube coordinate conversion
   */
  private hexRound(q: number, r: number): GridCell {
    // Convert to cube coordinates
    const s = -q - r;

    // Round all three coordinates
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);

    // Recalculate the coordinate with largest rounding error
    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  }
}

/**
 * Isometric Grid Geometry
 *
 * Diamond-shaped grid created by rotating square grid 45° and scaling vertically.
 *
 * **Coordinate System:**
 * - GridCell.q = column (diagonal axis)
 * - GridCell.r = row (diagonal axis)
 * - Each diamond has width = gridSize * 2, height = gridSize
 *
 * **Visual:**
 * ```
 *     /\
 *    /  \
 *   /    \
 *  /______\
 * ```
 *
 * **Performance:**
 * - Simple linear transforms (no trigonometry needed)
 * - Minimal allocations
 */
export class IsometricGridGeometry implements GridGeometry {
  pixelToGrid(x: number, y: number, gridSize: number): GridCell {
    // Inverse isometric projection
    // Iso transform: x' = (col - row) * size, y' = (col + row) * size/2
    // Inverse: col = (x/size + 2*y/size) / 2, row = (2*y/size - x/size) / 2

    const col = (x / gridSize + (2 * y) / gridSize) / 2;
    const row = ((2 * y) / gridSize - x / gridSize) / 2;

    return {
      q: Math.floor(col),
      r: Math.floor(row),
    };
  }

  gridToPixel(cell: GridCell, gridSize: number): Point {
    // Isometric projection (cell center)
    const x = (cell.q - cell.r) * gridSize;
    const y = ((cell.q + cell.r) * gridSize) / 2;

    return { x, y };
  }

  getSnapPoint(x: number, y: number, gridSize: number, width?: number, height?: number): Point {
    if (width === undefined || height === undefined) {
      // Simple snap to nearest diamond center
      const cell = this.pixelToGrid(x, y, gridSize);
      return this.gridToPixel(cell, gridSize);
    }

    // Calculate token center
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Find nearest diamond center
    const cell = this.pixelToGrid(centerX, centerY, gridSize);
    const diamondCenter = this.gridToPixel(cell, gridSize);

    // Return top-left corner position
    return {
      x: diamondCenter.x - width / 2,
      y: diamondCenter.y - height / 2,
    };
  }

  getCellVertices(cell: GridCell, gridSize: number): Point[] {
    const center = this.gridToPixel(cell, gridSize);

    // Diamond has 4 vertices: top, right, bottom, left
    return [
      { x: center.x, y: center.y - gridSize / 2 }, // Top
      { x: center.x + gridSize, y: center.y }, // Right
      { x: center.x, y: center.y + gridSize / 2 }, // Bottom
      { x: center.x - gridSize, y: center.y }, // Left
    ];
  }

  getVisibleCells(bounds: Bounds, gridSize: number): GridCell[] {
    const cells: GridCell[] = [];

    // Calculate bounding box in iso coordinates with padding
    const padding = 2;

    const topLeft = this.pixelToGrid(bounds.x, bounds.y, gridSize);
    const bottomRight = this.pixelToGrid(
      bounds.x + bounds.width,
      bounds.y + bounds.height,
      gridSize,
    );

    // Also check top-right and bottom-left corners due to diamond shape
    const topRight = this.pixelToGrid(bounds.x + bounds.width, bounds.y, gridSize);
    const bottomLeft = this.pixelToGrid(bounds.x, bounds.y + bounds.height, gridSize);

    const minQ = Math.min(topLeft.q, bottomLeft.q) - padding;
    const maxQ = Math.max(topRight.q, bottomRight.q) + padding;
    const minR = Math.min(topLeft.r, topRight.r) - padding;
    const maxR = Math.max(bottomLeft.r, bottomRight.r) + padding;

    // Iterate over rectangular region in iso coordinates
    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        cells.push({ q, r });
      }
    }

    return cells;
  }
}

/**
 * Factory function to create grid geometry based on grid type
 *
 * @param gridType The type of grid (LINES/DOTS/HIDDEN = square, HEXAGONAL, ISOMETRIC)
 * @returns Appropriate GridGeometry implementation
 */
export function createGridGeometry(
  gridType: 'LINES' | 'DOTS' | 'HIDDEN' | 'HEXAGONAL' | 'ISOMETRIC',
): GridGeometry {
  switch (gridType) {
    case 'LINES':
    case 'DOTS':
    case 'HIDDEN':
      return new SquareGridGeometry();
    case 'HEXAGONAL':
      return new HexagonalGridGeometry();
    case 'ISOMETRIC':
      return new IsometricGridGeometry();
    default:
      // Fail loudly for unknown types to avoid masking configuration bugs
      throw new Error(`createGridGeometry: Unknown grid type "${String(gridType)}"`);
  }
}
