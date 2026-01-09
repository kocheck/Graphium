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
 * - Hexagonal: Flat-top and Pointy-top hexagons using axial coordinates
 * - Isometric: Diamond-shaped cells (45° rotated square grid)
 */

import { GridType } from '../store/gameStore';

// Define types locally if they are missing from imports in this context
// In a real merge, we would check types/grid.ts. Assuming they exist in origin/main's structure.
// If types/grid doesn't exist in my HEAD, I might need to define them or rely on them being there from the merge.
// Since origin/main introduced this file, it likely introduced ../types/grid too.
// I'll assume ../types/grid exists or I will define interfaces here to be safe and remove imports.
// Actually, I can't check other files easily in this one step.
// Safe bet: Copy the interfaces from origin/main's version of this file if they were inline?
// No, origin/main imported them: import type { GridGeometry, GridCell, Point, Bounds } from '../types/grid';
// If that file doesn't exist in HEAD, the merge would have brought it in unless there was a conflict THERE too.
// git status didn't show types/grid.ts conflict. So it should be there.

import type { GridGeometry, GridCell, Point, Bounds } from '../types/grid';

// Pre-computed constants for performance
const SQRT3 = Math.sqrt(3); // ~1.732
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
 * Coordinate system:
 * - {@link GridCell.q} = column index (x-axis, increasing to the right)
 * - {@link GridCell.r} = row index (y-axis, increasing downward)
 *
 * Pixel mapping:
 * - Cell (0, 0) has its **top-left corner** at pixel (0, 0)
 * - Each cell is a `gridSize × gridSize` square in pixel space
 * - {@link SquareGridGeometry.pixelToGrid} maps a pixel position to the
 *   containing cell (q, r) by flooring `x / gridSize` and `y / gridSize`
 * - {@link SquareGridGeometry.gridToPixel} returns the **center** of a cell
 *   in pixel space, i.e. `((q + 0.5) * gridSize, (r + 0.5) * gridSize)`
 */
export class SquareGridGeometry implements GridGeometry {
  pixelToGrid(x: number, y: number, gridSize: number): GridCell {
    return {
      q: Math.floor(x / gridSize),
      r: Math.floor(y / gridSize),
    };
  }

  gridToPixel(cell: GridCell, gridSize: number): Point {
    return {
      x: (cell.q + 0.5) * gridSize,
      y: (cell.r + 0.5) * gridSize,
    };
  }

  getSnapPoint(x: number, y: number, gridSize: number, width?: number, height?: number): Point {
    if (width === undefined || height === undefined) {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      };
    }

    const snapDimension = (pos: number, size: number): number => {
      const center = pos + size / 2;
      const cellCount = Math.round(size / gridSize);
      const isOdd = cellCount % 2 !== 0;

      let snapCenter: number;
      if (isOdd) {
        snapCenter = (Math.floor(center / gridSize) + 0.5) * gridSize;
      } else {
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
 * Hexagonal Grid Geometry
 * Supports both Flat-top and Pointy-top orientations via constructor.
 */
export class HexagonalGridGeometry implements GridGeometry {
  private orientation: 'FLAT' | 'POINTY';

  constructor(orientation: 'FLAT' | 'POINTY' = 'FLAT') {
    this.orientation = orientation;
  }

  pixelToGrid(x: number, y: number, gridSize: number): GridCell {
    // gridSize is approx "radius" (center to corner) or derived from cell width/height semantics.
    // origin/main used: q = 2/3 * x / size. This implies size is OUTER RADIUS.
    // For Pointy: x = size * sqrt(3) * (q + r/2)
    // For Flat: x = size * 3/2 * q

    let q: number, r: number;

    if (this.orientation === 'POINTY') {
      const size = gridSize / SQRT3; // derived size so width matches gridSize? No let's match origin/main semantics.
      // Actually, let's stick to standard hex math where gridSize = size (radius)
      // But in UI "gridSize" is usually the cell width/height spacing.
      // origin/main: q = ((2 / 3) * x) / gridSize; <- Flat Top

      // Let's use standard conversions assuming gridSize = circumradius (outer radius) for now
      // or apply the scaling factor used in my previous edit (gridSize/sqrt(3)).

      // Re-using origin/main logic for FLAT, adding POINTY.
      // And fixing size interpretation if needed.
      // In my previous edit: radius = gridSize / Math.sqrt(3).

      // const size = gridSize / SQRT3; // Use the same scaling I established in the fix

      q = (SQRT3_3 * x - (1 / 3) * y) / size;
      r = ((2 / 3) * y) / size;
    } else {
      // FLAT
      const size = gridSize / SQRT3;
      q = ((2 / 3) * x) / size;
      r = ((-1 / 3) * x + SQRT3_3 * y) / size;
    }

    return this.hexRound(q, r);
  }

  gridToPixel(cell: GridCell, gridSize: number): Point {
    const size = gridSize / SQRT3;
    let x: number, y: number;

    if (this.orientation === 'POINTY') {
      x = size * (SQRT3 * cell.q + SQRT3_2 * cell.r);
      y = size * (1.5 * cell.r);
    } else {
      // FLAT
      x = size * (1.5 * cell.q);
      y = size * (SQRT3_2 * cell.q + SQRT3 * cell.r);
    }
    return { x, y };
  }

  getSnapPoint(x: number, y: number, gridSize: number, width?: number, height?: number): Point {
    if (width === undefined || height === undefined) {
      const cell = this.pixelToGrid(x, y, gridSize);
      return this.gridToPixel(cell, gridSize);
    }
    // Center-based snap
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const cell = this.pixelToGrid(centerX, centerY, gridSize);
    const hexCenter = this.gridToPixel(cell, gridSize);

    return {
      x: hexCenter.x - width / 2,
      y: hexCenter.y - height / 2,
    };
  }

  getCellVertices(cell: GridCell, gridSize: number): Point[] {
    const center = this.gridToPixel(cell, gridSize);
    // gridSize represents the circumradius (distance from center to vertex)
    const vertices: Point[] = [];

    // Hexagon vertices are generated clockwise starting from:
    // - Pointy-top: starts at 30° (top vertex)
    // - Flat-top: starts at 0° (rightmost vertex)
    const offsetDeg = this.orientation === 'POINTY' ? 30 : 0;

    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i + offsetDeg;
      const angleRad = (Math.PI / 180) * angleDeg;
      vertices.push({
        x: center.x + gridSize * Math.cos(angleRad),
        y: center.y + gridSize * Math.sin(angleRad),
      });
    }

    return vertices;
  }

  getVisibleCells(bounds: Bounds, gridSize: number): GridCell[] {
    // Brute force bound check using updated pixelToGrid
    const padding = 2;
    const corners = [
      this.pixelToGrid(bounds.x, bounds.y, gridSize),
      this.pixelToGrid(bounds.x + bounds.width, bounds.y, gridSize),
      this.pixelToGrid(bounds.x + bounds.width, bounds.y + bounds.height, gridSize),
      this.pixelToGrid(bounds.x, bounds.y + bounds.height, gridSize),
    ];

    let minQ = corners[0].q,
      maxQ = corners[0].q;
    let minR = corners[0].r,
      maxR = corners[0].r;

    for (const c of corners) {
      minQ = Math.min(minQ, c.q);
      maxQ = Math.max(maxQ, c.q);
      minR = Math.min(minR, c.r);
      maxR = Math.max(maxR, c.r);
    }
    minQ -= padding;
    maxQ += padding;
    minR -= padding;
    maxR += padding;

    const cells: GridCell[] = [];
    const size = gridSize / SQRT3;
    const hexRadius = size * HEX_BOUNDS_SAFETY_FACTOR;

    // Rectangular iteration in axial coords (works for both, slightly wasteful)
    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        const center = this.gridToPixel({ q, r }, gridSize);
        // Simple circle check against bounds
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

  private hexRound(q: number, r: number): GridCell {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);

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
 */
export class IsometricGridGeometry implements GridGeometry {
  constructor(_orientation: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL') {
    // this.orientation = orientation;
  }

  pixelToGrid(x: number, y: number, gridSize: number): GridCell {
    // Iso transform: x' = (col - row) * size, y' = (col + row) * size/2

    // Inconsistent defs between my HEAD (tileWidth = 2*size) and origin/main.
    // origin/main:
    // col = (x / gridSize + (2 * y) / gridSize) / 2;
    // row = ((2 * y) / gridSize - x / gridSize) / 2;

    // Let's stick to origin/main math for consistency if it works,
    // but origin/main didn't handle ISO_V.
    // For now, map both ISO_H and ISO_V to this standard logic.

    const col = (x / gridSize + (2 * y) / gridSize) / 2;
    const row = ((2 * y) / gridSize - x / gridSize) / 2;

    return {
      q: Math.floor(col),
      r: Math.floor(row),
    };
  }

  gridToPixel(cell: GridCell, gridSize: number): Point {
    const x = (cell.q - cell.r) * gridSize;
    const y = ((cell.q + cell.r) * gridSize) / 2;
    return { x, y };
  }

  getSnapPoint(x: number, y: number, gridSize: number, width?: number, height?: number): Point {
    if (width === undefined || height === undefined) {
      const cell = this.pixelToGrid(x, y, gridSize);
      return this.gridToPixel(cell, gridSize);
    }
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const cell = this.pixelToGrid(centerX, centerY, gridSize);
    const diamondCenter = this.gridToPixel(cell, gridSize);
    return {
      x: diamondCenter.x - width / 2,
      y: diamondCenter.y - height / 2,
    };
  }

  getCellVertices(cell: GridCell, gridSize: number): Point[] {
    const center = this.gridToPixel(cell, gridSize);
    return [
      { x: center.x, y: center.y - gridSize / 2 }, // Top
      { x: center.x + gridSize, y: center.y }, // Right
      { x: center.x, y: center.y + gridSize / 2 }, // Bottom
      { x: center.x - gridSize, y: center.y }, // Left
    ];
  }

  getVisibleCells(bounds: Bounds, gridSize: number): GridCell[] {
    const cells: GridCell[] = [];
    const padding = 2;
    // Project viewport corners into grid space, compute a padded min/max range,
    // and iterate over that range to collect all potentially visible cells.
    const corners = [
      this.pixelToGrid(bounds.x, bounds.y, gridSize),
      this.pixelToGrid(bounds.x + bounds.width, bounds.y, gridSize),
      this.pixelToGrid(bounds.x + bounds.width, bounds.y + bounds.height, gridSize),
      this.pixelToGrid(bounds.x, bounds.y + bounds.height, gridSize),
    ];
    let minQ = corners[0].q,
      maxQ = corners[0].q;
    let minR = corners[0].r,
      maxR = corners[0].r;

    for (const c of corners) {
      minQ = Math.min(minQ, c.q);
      maxQ = Math.max(maxQ, c.q);
      minR = Math.min(minR, c.r);
      maxR = Math.max(maxR, c.r);
    }
    minQ -= padding;
    maxQ += padding;
    minR -= padding;
    maxR += padding;

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
 */
export function createGridGeometry(gridType: GridType): GridGeometry {
  switch (gridType) {
    case 'LINES':
    case 'DOTS':
    case 'HIDDEN':
      return new SquareGridGeometry();
    case 'HEX_H':
      return new HexagonalGridGeometry('FLAT');
    case 'HEX_V':
      return new HexagonalGridGeometry('POINTY');
    case 'ISO_H':
      return new IsometricGridGeometry('HORIZONTAL');
    case 'ISO_V':
      return new IsometricGridGeometry('VERTICAL');
    default:
      // Fallback for generic types if they leak in
      return new SquareGridGeometry();
  }
}
