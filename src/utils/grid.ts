import { createGridGeometry } from './gridGeometry';
import type { GridType } from '../store/gameStore';

/**
 * Snaps pixel coordinates to the nearest grid point based on grid type
 *
 * This function provides intelligent snapping based on token dimensions and grid geometry
 * to ensure proper alignment with the tactical grid. Different grid types and token sizes
 * snap differently:
 *
 * **Square Grid Smart Snapping Logic:**
 * - **Even-sized tokens** (0x0, 2x2, 4x4 cells): Snap to grid intersections
 * - **Odd-sized tokens** (1x1, 3x3, 5x5 cells): Snap to cell centers
 *
 * **Hexagonal & Isometric Grids:**
 * - All tokens snap to cell centers (hex center or diamond center)
 * - Token size determines how many cells it occupies
 *
 * This ensures all tokens align properly regardless of size. For example:
 * - A Medium creature (1x1, 50px) centers on a cell
 * - A Large creature (2x2, 100px) corners align to intersections (square) or centers on hex/diamond
 * - A Huge creature (3x3, 150px) centers on a 3x3 group of cells
 *
 * **Why this matters:**
 * In D&D 5e and similar games, creature size determines grid positioning:
 * - Medium/Small (1x1): Occupy single cell, should center
 * - Large (2x2): Occupy 4 cells, corners at intersections
 * - Huge (3x3): Occupy 9 cells, centered on middle cell
 *
 * **Legacy mode**: When width/height not provided, uses simple top-left
 * rounding for backward compatibility with existing code.
 *
 * **Algorithm details:**
 * 1. Calculate token center point
 * 2. Determine how many grid cells token occupies
 * 3. Use grid-specific geometry to find snap point
 * 4. Convert back to top-left corner position
 *
 * @param x - Raw X coordinate in pixels (top-left corner, e.g., from drag position)
 * @param y - Raw Y coordinate in pixels (top-left corner, e.g., from drag position)
 * @param gridSize - Size of each grid cell in pixels (typically 50)
 * @param gridType - Type of grid (LINES/DOTS/HIDDEN = square, HEX_H, HEX_V, ISO_H, ISO_V)
 * @param width - Token width in pixels (optional, enables smart snapping)
 * @param height - Token height in pixels (optional, enables smart snapping)
 * @returns Object with snapped x and y coordinates (top-left corner)
 */
export const snapToGrid = (
  x: number,
  y: number,
  gridSize: number,
  gridType: GridType = 'LINES',
  width?: number,
  height?: number,
): { x: number; y: number } => {
  const geometry = createGridGeometry(gridType);
  return geometry.getSnapPoint(x, y, gridSize, width, height);
};
