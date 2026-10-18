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

import type React from 'react';
import { memo, useMemo } from 'react';

import { Group, Line, Circle } from 'react-konva';

import { usePointerOverlayStore } from '../../store/pointerOverlayStore';
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

type GridBounds = { x: number; y: number; width: number; height: number };

function renderDotElements(
  bounds: GridBounds,
  gridSize: number,
  stroke: string,
  opacity: number,
): React.ReactElement[] {
  const { x, y, width, height } = bounds;
  const elements: React.ReactElement[] = [];
  const startX = Math.floor(x / gridSize) * gridSize;
  const endX = Math.ceil((x + width) / gridSize) * gridSize;
  const startY = Math.floor(y / gridSize) * gridSize;
  const endY = Math.ceil((y + height) / gridSize) * gridSize;
  const totalDots =
    (Math.ceil((endX - startX) / gridSize) + 1) * (Math.ceil((endY - startY) / gridSize) + 1);

  let step = gridSize;
  if (totalDots > MAX_DOTS_THRESHOLD) {
    const minMultiplier = Math.ceil(Math.sqrt(totalDots / MAX_DOTS_THRESHOLD));
    const powerOf2Multiplier = Math.pow(2, Math.ceil(Math.log2(minMultiplier)));
    step = gridSize * powerOf2Multiplier;
    if (!hasWarnedAboutDensity) {
      console.warn(
        `Grid too dense for DOTS mode (${totalDots} dots > ${MAX_DOTS_THRESHOLD}), rendering subset with step size ${step}px (multiplier: ${powerOf2Multiplier})`,
      );
      hasWarnedAboutDensity = true;
    }
  } else {
    hasWarnedAboutDensity = false;
  }

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
          listening={false}
          perfectDrawEnabled={false}
        />,
      );
    }
  }
  return elements;
}

function renderSquareLineElements(
  bounds: GridBounds,
  gridSize: number,
  stroke: string,
  opacity: number,
): React.ReactElement[] {
  const { x, y, width, height } = bounds;
  const elements: React.ReactElement[] = [];
  const startX = Math.floor(x / gridSize) * gridSize;
  const endX = Math.ceil((x + width) / gridSize) * gridSize;
  const startY = Math.floor(y / gridSize) * gridSize;
  const endY = Math.ceil((y + height) / gridSize) * gridSize;

  for (let ix = startX; ix <= endX; ix += gridSize) {
    elements.push(
      <Line
        key={`v-${ix}`}
        points={[ix, y, ix, y + height]}
        stroke={stroke}
        strokeWidth={1}
        opacity={opacity}
        listening={false}
        perfectDrawEnabled={false}
      />,
    );
  }
  for (let iy = startY; iy <= endY; iy += gridSize) {
    elements.push(
      <Line
        key={`h-${iy}`}
        points={[x, iy, x + width, iy]}
        stroke={stroke}
        strokeWidth={1}
        opacity={opacity}
        listening={false}
        perfectDrawEnabled={false}
      />,
    );
  }
  return elements;
}

function renderGeometryElements(
  type: GridType,
  bounds: GridBounds,
  gridSize: number,
  stroke: string,
  opacity: number,
): React.ReactElement[] {
  const geometry = createGridGeometry(type);
  return geometry.getVisibleCells(bounds, gridSize).map((cell) => {
    const points = verticesToPoints(geometry.getCellVertices(cell, gridSize));
    return (
      <Line
        key={`cell-${cell.q}-${cell.r}`}
        points={points}
        stroke={stroke}
        strokeWidth={1}
        opacity={opacity}
        closed
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  });
}

function renderHoverHighlight(
  hoveredCell: { q: number; r: number },
  type: GridType,
  gridSize: number,
): React.ReactElement {
  const geometry = createGridGeometry(type);
  const points = verticesToPoints(geometry.getCellVertices(hoveredCell, gridSize));
  return (
    <Line
      key="hover-highlight"
      points={points}
      fill="rgba(255, 255, 255, 0.1)"
      stroke="rgba(255, 255, 255, 0.5)"
      strokeWidth={2}
      opacity={1}
      closed
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

function GridOverlay({
  visibleBounds,
  gridSize,
  stroke = '#222',
  opacity = 0.5,
  type = 'LINES',
  hoveredCell = null,
}: GridOverlayProps): React.ReactElement | null {
  const { x, y, width, height } = visibleBounds || { x: 0, y: 0, width: 0, height: 0 };
  const bounds = { x, y, width, height };

  const dotElements = useMemo(
    () => (type === 'DOTS' ? renderDotElements(bounds, gridSize, stroke, opacity) : null),
    // Primitive bounds fields — avoid depending on a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, x, y, width, height, gridSize, stroke, opacity],
  );
  const squareLineElements = useMemo(
    () => (type === 'LINES' ? renderSquareLineElements(bounds, gridSize, stroke, opacity) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, x, y, width, height, gridSize, stroke, opacity],
  );
  const geometryElements = useMemo(
    () =>
      type === 'HEXAGONAL' || type === 'ISOMETRIC'
        ? renderGeometryElements(type, bounds, gridSize, stroke, opacity)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, x, y, width, height, gridSize, stroke, opacity],
  );
  const hoverHighlight = useMemo(
    () =>
      hoveredCell && type !== 'DOTS' ? renderHoverHighlight(hoveredCell, type, gridSize) : null,
    [hoveredCell, type, gridSize],
  );

  if (type === 'HIDDEN') {
    return null;
  }

  return (
    <Group listening={false}>
      {squareLineElements}
      {dotElements}
      {geometryElements}
      {hoverHighlight}
    </Group>
  );
}

const MemoGridOverlay = memo(GridOverlay);
MemoGridOverlay.displayName = 'GridOverlay';

export function IsolatedGridOverlay(
  props: Omit<GridOverlayProps, 'hoveredCell'>,
): React.ReactElement | null {
  const hoveredCell = usePointerOverlayStore((s) => s.hoveredCell);
  return <MemoGridOverlay {...props} hoveredCell={hoveredCell} />;
}
