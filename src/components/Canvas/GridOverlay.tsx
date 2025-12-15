/**
 * Grid Overlay Component with Viewport Culling
 *
 * Renders a grid overlay on the canvas with three modes: LINES, DOTS, or HIDDEN.
 * Implements viewport culling to only render grid elements within visible bounds.
 *
 * **Three grid types:**
 * 1. **LINES** - Traditional grid with vertical and horizontal lines
 * 2. **DOTS** - Minimalist grid with dots at intersections (performance optimized)
 * 3. **HIDDEN** - No grid rendered
 *
 * **Viewport culling (performance optimization):**
 * Only renders grid elements within visibleBounds, dramatically improving
 * performance for large maps. Without culling, a 10,000x10,000px map with
 * 50px gridSize would render 40,000 lines (200 vertical × 200 horizontal).
 * With culling, only ~20 lines rendered at typical zoom levels.
 *
 * **DOT mode performance optimization:**
 * DOTS mode uses individual Circle components at grid intersections.
 * Performance degrades with many dots (e.g., zoomed out on large map).
 * When dot count exceeds MAX_DOTS_THRESHOLD (10,000), automatically
 * renders a subset by increasing step size, maintaining visual grid
 * while preventing performance issues.
 *
 * **Performance calculations:**
 * - LINES: O(visibleWidth/gridSize + visibleHeight/gridSize)
 * - DOTS normal: O((visibleWidth/gridSize) × (visibleHeight/gridSize))
 * - DOTS subset: Capped at ~MAX_DOTS_THRESHOLD via adaptive step size
 *
 * **Algorithm for subset rendering:**
 * 1. Calculate totalDots = (width/gridSize) × (height/gridSize)
 * 2. If totalDots > MAX_DOTS_THRESHOLD:
 *    - stepMultiplier = ceil(sqrt(totalDots / MAX_DOTS_THRESHOLD))
 *    - newStep = stepMultiplier × gridSize
 *    - Render with newStep instead of gridSize
 * 3. Example: 20,000 dots → multiplier ~1.4 → render every ~1.4 grids
 *
 * @example
 * // Basic usage in Canvas
 * <GridOverlay
 *   visibleBounds={getVisibleBounds()}
 *   gridSize={50}
 *   type="LINES"
 * />
 *
 * @example
 * // DOT mode with custom styling
 * <GridOverlay
 *   visibleBounds={viewport}
 *   gridSize={25}
 *   stroke="#333"
 *   opacity={0.3}
 *   type="DOTS"
 * />
 *
 * @example
 * // Hidden grid (user preference)
 * <GridOverlay
 *   visibleBounds={viewport}
 *   gridSize={50}
 *   type="HIDDEN"
 * />
 *
 * @component
 */

import React from 'react';
import { Group, Line, Circle } from 'react-konva';

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
 * @property type - Grid rendering type: LINES, DOTS, or HIDDEN (default: 'LINES')
 */
interface GridOverlayProps {
  visibleBounds: { x: number; y: number; width: number; height: number };
  gridSize: number;
  stroke?: string;
  opacity?: number;
  type?: 'LINES' | 'DOTS' | 'HIDDEN';
}

/**
 * GridOverlay renders a grid on the canvas with viewport culling
 * Only renders grid elements within visible bounds for performance
 */
const GridOverlay: React.FC<GridOverlayProps> = ({
  visibleBounds,
  gridSize,
  stroke = '#222',
  opacity = 0.5, // THEME ADJUSTMENT: Modify this value to change grid visibility (0.0 = invisible, 1.0 = fully opaque)
  type = 'LINES'
}) => {
  if (type === 'HIDDEN') return null;

  const elements = [];
  const { x, y, width, height } = visibleBounds || { x: 0, y: 0, width: 0, height: 0 };

  // Calculate start and end grid numbers based on visible bounds
  // We want to draw lines covering the visible area.
  // Start X = first multiple of gridSize <= x
  const startX = Math.floor(x / gridSize) * gridSize;
  const endX = Math.ceil((x + width) / gridSize) * gridSize;

  const startY = Math.floor(y / gridSize) * gridSize;
  const endY = Math.ceil((y + height) / gridSize) * gridSize;

  if (type === 'LINES') {
    // Vertical lines
    for (let ix = startX; ix <= endX; ix += gridSize) {
      elements.push(
        <Line
          key={`v-${ix}`}
          points={[ix, y, ix, y + height]} // Draw from top of view to bottom
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
        />
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
        />
      );
    }
  } else if (type === 'DOTS') {
    // Render dots at intersections using a single Shape for better performance
    // Limit rendering if there are too many dots to avoid performance issues
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
        console.warn(`Grid too dense for DOTS mode (${totalDots} dots > ${MAX_DOTS_THRESHOLD}), rendering subset with step size ${step}px (multiplier: ${powerOf2Multiplier})`);
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
            />
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
            />
          );
        }
      }
    }
  }

  return <Group listening={false}>{elements}</Group>;
};

export default GridOverlay;
