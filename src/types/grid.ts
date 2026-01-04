/**
 * Grid Type Definitions and Interfaces
 *
 * Provides type-safe abstractions for different grid geometries used in the tactical map.
 * Supports square, hexagonal, and isometric grids with efficient coordinate conversion.
 */

/**
 * Point in 2D space (pixel coordinates)
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangular bounds for viewport culling
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Grid cell identifier (abstract coordinates)
 * Works for square (row/col), hex (q/r axial), or iso (row/col)
 */
export interface GridCell {
  q: number; // Primary coordinate (x, q for hex, col for iso)
  r: number; // Secondary coordinate (y, r for hex, row for iso)
}

/**
 * Grid Geometry Interface
 *
 * Abstracts coordinate conversion and rendering logic for different grid types.
 * All implementations must be optimized for performance (minimal allocations).
 *
 * **Performance Requirements:**
 * - pixelToGrid: Called on every mouse move during drag (HOT PATH)
 * - getSnapPoint: Called on drag end (WARM PATH)
 * - getCellVertices: Called once per visible cell during render (WARM PATH)
 * - getVisibleCells: Called once per render frame (WARM PATH)
 */
export interface GridGeometry {
  /**
   * Convert pixel coordinates to grid cell coordinates
   * PERFORMANCE: HOT PATH - minimize allocations, avoid Math.sqrt if possible
   *
   * @param x Pixel X coordinate
   * @param y Pixel Y coordinate
   * @param gridSize Cell size in pixels
   * @returns Grid cell coordinates
   */
  pixelToGrid(x: number, y: number, gridSize: number): GridCell;

  /**
   * Convert grid cell coordinates to pixel coordinates (center of cell)
   * PERFORMANCE: WARM PATH - called during snapping
   *
   * @param cell Grid cell coordinates
   * @param gridSize Cell size in pixels
   * @returns Pixel coordinates of cell center
   */
  gridToPixel(cell: GridCell, gridSize: number): Point;

  /**
   * Get snap point for token placement (size-aware)
   * PERFORMANCE: WARM PATH - called on drag end
   *
   * Handles different token sizes intelligently:
   * - Small tokens (1x1): Snap to cell center
   * - Large tokens (2x2+): Snap appropriately for grid type
   *
   * @param x Pixel X coordinate (top-left corner)
   * @param y Pixel Y coordinate (top-left corner)
   * @param gridSize Cell size in pixels
   * @param width Token width in pixels (optional)
   * @param height Token height in pixels (optional)
   * @returns Snapped pixel coordinates (top-left corner)
   */
  getSnapPoint(
    x: number,
    y: number,
    gridSize: number,
    width?: number,
    height?: number
  ): Point;

  /**
   * Get vertices for rendering a single grid cell
   * PERFORMANCE: WARM PATH - called for each visible cell
   *
   * Returns vertices in clockwise order starting from top-left
   * For square: 4 vertices, hex: 6 vertices, iso: 4 vertices
   *
   * @param cell Grid cell coordinates
   * @param gridSize Cell size in pixels
   * @returns Array of vertex points (closed polygon)
   */
  getCellVertices(cell: GridCell, gridSize: number): Point[];

  /**
   * Get all grid cells visible within viewport bounds
   * PERFORMANCE: WARM PATH - called once per render frame
   *
   * Uses viewport culling to return only cells that need rendering.
   * Critical for performance on large maps.
   *
   * @param bounds Visible viewport bounds
   * @param gridSize Cell size in pixels
   * @returns Array of visible grid cells
   */
  getVisibleCells(bounds: Bounds, gridSize: number): GridCell[];
}
