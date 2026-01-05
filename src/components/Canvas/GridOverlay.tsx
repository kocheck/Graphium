/**
 * Grid Overlay Component with Viewport Culling
 *
 * Renders a grid overlay on the canvas with support for multiple grid geometries:
 * - Square (LINES/DOTS/HIDDEN modes)
 * - Hexagonal (flat-top orientation)
 * - Isometric (diamond-shaped)
 *
 * Implements viewport culling to only render grid elements within visible bounds.
 *
 * **Grid types:**
 * 1. **LINES** - Traditional square grid with vertical and horizontal lines
 * 2. **DOTS** - Minimalist square grid with dots at intersections (performance optimized)
 * 3. **HIDDEN** - No grid rendered
 * 4. **HEXAGONAL** - Hexagonal grid (flat-top orientation)
 * 5. **ISOMETRIC** - Isometric/diamond grid (45° rotated)
 *
 * **Viewport culling (performance optimization):**
 * Only renders grid elements within visibleBounds, dramatically improving
 * performance for large maps. Without culling, a 10,000x10,000px map with
 * 50px gridSize would render 40,000 lines (200 vertical × 200 horizontal).
 * With culling, only ~20-40 cells rendered at typical zoom levels.
 *
 * **DOT mode performance optimization:**
 * DOTS mode is only supported for square grids. When dot count exceeds
 * MAX_DOTS_THRESHOLD (10,000), automatically renders a subset by increasing
 * step size, maintaining visual grid while preventing performance issues.
 *
 * **Performance calculations:**
 * - LINES (square): O(visibleWidth/gridSize + visibleHeight/gridSize)
 * - DOTS (square): O((visibleWidth/gridSize) × (visibleHeight/gridSize))
 * - HEXAGONAL: O(visible hexes) ~= O(visible area / hex area)
 * - ISOMETRIC: O(visible diamonds) ~= O(visible area / diamond area)
 *
 * @component
 */

import React, { useMemo } from 'react';
import { Group, Line, Circle } from 'react-konva';
import { createGridGeometry } from '../../utils/gridGeometry';
import type { GridType } from '../../store/gameStore';

/**
 * Maximum dots to render before using subset rendering
 * Prevents performance degradation when zoomed out on large maps
 */
const MAX_DOTS_THRESHOLD = 10000;

/**
 * Flag to prevent console warning spam when grid is too dense
 * Only logs warning once per threshold crossing
 */
let hasWarnedAboutDensity = false;

/**
 * Props for GridOverlay component
 *
 * @property visibleBounds - Current viewport bounds in canvas coordinates
 * @property visibleBounds.x - Left edge of viewport
 * @property visibleBounds.y - Top edge of viewport
 * @property visibleBounds.width - Width of viewport
 * @property visibleBounds.height - Height of viewport
 * @property gridSize - Size of each grid cell in pixels
 * @property stroke - Color of grid lines/dots (default: '#222')
 * @property opacity - Opacity of grid elements (default: 0.5)
 * @property type - Grid rendering type (default: 'LINES')
 * @property hoveredCell - Grid cell currently under cursor (for hover highlight)
 */
interface GridOverlayProps {
  visibleBounds: { x: number; y: number; width: number; height: number };
  gridSize: number;
  stroke?: string;
  opacity?: number;
  type?: GridType;
  hoveredCell?: { q: number; r: number } | null;
}

/**
 * Helper to convert vertex points array to flat coordinate array for Konva Line
 */
const verticesToPoints = (vertices: Array<{ x: number; y: number }>): number[] => {
  const points: number[] = [];
  for (const v of vertices) {
    points.push(v.x, v.y);
  }
  return points;
};

/**
 * GridOverlay renders a grid on the canvas with viewport culling
 * Only renders grid elements within visible bounds for performance
 */
const GridOverlay: React.FC<GridOverlayProps> = ({
  visibleBounds,
  gridSize,
  stroke = '#222',
  opacity = 0.5, // THEME ADJUSTMENT: Modify this value to change grid visibility (0.0 = invisible, 1.0 = fully opaque)
  type = 'LINES',
  hoveredCell = null,
}) => {
  if (type === 'HIDDEN') return null;

  const { x, y, width, height } = visibleBounds || { x: 0, y: 0, width: 0, height: 0 };

  // Render DOTS mode (square grid only)
  const dotElements = useMemo(() => {
    if (type !== 'DOTS') return null;

    const elements = [];

    // Calculate start and end grid numbers based on visible bounds
    const startX = Math.floor(x / gridSize) * gridSize;
    const endX = Math.ceil((x + width) / gridSize) * gridSize;
    const startY = Math.floor(y / gridSize) * gridSize;
    const endY = Math.ceil((y + height) / gridSize) * gridSize;

    const dotsX = Math.ceil((endX - startX) / gridSize) + 1;
    const dotsY = Math.ceil((endY - startY) / gridSize) + 1;
    const totalDots = dotsX * dotsY;

    // If there would be too many dots, fall back to a simpler grid or skip
    if (totalDots > MAX_DOTS_THRESHOLD) {
      // Use a power-of-2 step multiplier to maintain grid alignment and predictable iteration
      const minMultiplier = Math.ceil(Math.sqrt(totalDots / MAX_DOTS_THRESHOLD));
      // Find the next power of 2 greater than or equal to minMultiplier
      const powerOf2Multiplier = Math.pow(2, Math.ceil(Math.log2(minMultiplier)));
      const step = gridSize * powerOf2Multiplier;
      if (!hasWarnedAboutDensity) {
        console.warn(
          `Grid too dense for DOTS mode (${totalDots} dots > ${MAX_DOTS_THRESHOLD}), rendering subset with step size ${step}px (multiplier: ${powerOf2Multiplier})`,
        );
        hasWarnedAboutDensity = true;
      }
      // Render a subset by increasing step size
      for (let ix = startX; ix <= endX; ix += step) {
        for (let iy = startY; iy <= endY; iy += step) {
          elements.push(
            <Circle
              key={`dot-${ix}-${iy}`}
              x={ix}
              y={iy}
              radius={2}
              fill={stroke}
              opacity={opacity}
            />,
          );
        }
      }
    } else {
      // Normal rendering - reset warning flag when back under threshold
      hasWarnedAboutDensity = false;
      for (let ix = startX; ix <= endX; ix += gridSize) {
        for (let iy = startY; iy <= endY; iy += gridSize) {
          elements.push(
            <Circle
              key={`dot-${ix}-${iy}`}
              x={ix}
              y={iy}
              radius={2}
              fill={stroke}
              opacity={opacity}
            />,
          );
        }
      }
    }

    return elements;
  }, [type, x, y, width, height, gridSize, stroke, opacity]);

  // Render LINES mode (square grid only - legacy performance optimization)
  const squareLineElements = useMemo(() => {
    if (type !== 'LINES') return null;

    const elements = [];

    // Calculate start and end grid numbers based on visible bounds
    const startX = Math.floor(x / gridSize) * gridSize;
    const endX = Math.ceil((x + width) / gridSize) * gridSize;
    const startY = Math.floor(y / gridSize) * gridSize;
    const endY = Math.ceil((y + height) / gridSize) * gridSize;

    // Vertical lines
    for (let ix = startX; ix <= endX; ix += gridSize) {
      elements.push(
        <Line
          key={`v-${ix}`}
          points={[ix, y, ix, y + height]} // Draw from top of view to bottom
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
        />,
      );
    }

    // Horizontal lines
    for (let iy = startY; iy <= endY; iy += gridSize) {
      elements.push(
        <Line
          key={`h-${iy}`}
          points={[x, iy, x + width, iy]}
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
        />,
      );
    }

    return elements;
  }, [type, x, y, width, height, gridSize, stroke, opacity]);

  // Render HEXAGONAL or ISOMETRIC grids using geometry abstraction
  const geometryElements = useMemo(() => {
    if (type !== 'HEXAGONAL' && type !== 'ISOMETRIC') return null;

    const geometry = createGridGeometry(type);
    const visibleCells = geometry.getVisibleCells({ x, y, width, height }, gridSize);

    return visibleCells.map((cell) => {
      const vertices = geometry.getCellVertices(cell, gridSize);
      const points = verticesToPoints(vertices);

      return (
        <Line
          key={`cell-${cell.q}-${cell.r}`}
          points={points}
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
          closed={true}
        />
      );
    });
  }, [type, x, y, width, height, gridSize, stroke, opacity]);

  // Render hover highlight for hovered cell
  const hoverHighlight = useMemo(() => {
    // DOTS mode deliberately skips hover highlight to avoid extra per-frame geometry work
    // on already dense dot grids (similar to why DOTS is restricted to square grids).
    if (!hoveredCell || type === 'DOTS') return null;

    const geometry = createGridGeometry(type);
    const vertices = geometry.getCellVertices(hoveredCell, gridSize);
    const points = verticesToPoints(vertices);

    return (
      <Line
        key="hover-highlight"
        points={points}
        fill="rgba(255, 255, 255, 0.1)"
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={2}
        opacity={1}
        closed={true}
      />
    );
  }, [hoveredCell, type, gridSize]);

  return (
    <Group listening={false}>
      {squareLineElements}
      {dotElements}
      {geometryElements}
      {hoverHighlight}
    </Group>
  );
};

export default GridOverlay;
