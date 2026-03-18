/**
 * Grid Overlay Component — PixiJS implementation
 *
 * Renders a square grid using a PixiJS Graphics object added to worldContainer.
 * The pure `buildGridGeometry` function is exported for unit testing.
 */

import { useEffect, useRef } from 'react';

import { Graphics } from 'pixi.js';

import { parseRgba } from '../../utils/pixiColor';

import type { Container } from 'pixi.js';

interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface GridGeometry {
  horizontal: GridLine[];
  vertical: GridLine[];
}

interface BuildGridOptions {
  gridSize: number;
  mapWidth: number;
  mapHeight: number;
  gridType: 'square' | 'hex';
}

/**
 * Pure function that computes the set of horizontal and vertical grid lines
 * for a square grid that spans [0, mapWidth] × [0, mapHeight].
 * Exported for unit testing.
 */
// eslint-disable-next-line import/no-unused-modules, react-refresh/only-export-components
export function buildGridGeometry({
  gridSize,
  mapWidth,
  mapHeight,
}: BuildGridOptions): GridGeometry {
  if (gridSize <= 0) {
    return { horizontal: [], vertical: [] };
  }
  const horizontal: GridLine[] = [];
  const vertical: GridLine[] = [];
  for (let y = 0; y <= mapHeight; y += gridSize) {
    horizontal.push({ x1: 0, y1: y, x2: mapWidth, y2: y });
  }
  for (let x = 0; x <= mapWidth; x += gridSize) {
    vertical.push({ x1: x, y1: 0, x2: x, y2: mapHeight });
  }
  return { horizontal, vertical };
}

interface GridOverlayProps {
  gridSize: number;
  gridColor: string; // hex color string e.g. '#8b7355'
  gridOpacity: number; // 0–1
  mapWidth: number;
  mapHeight: number;
  gridType: 'square' | 'hex';
  worldContainer: Container | null;
}

/**
 * GridOverlay renders an imperative PixiJS Graphics grid into worldContainer.
 * Returns null — all rendering is done via PixiJS, not React DOM.
 */
export function GridOverlay({
  gridSize,
  gridColor,
  gridOpacity,
  mapWidth,
  mapHeight,
  gridType,
  worldContainer,
}: GridOverlayProps): null {
  const graphicsRef = useRef<Graphics | null>(null);

  // Mount / unmount the Graphics object alongside worldContainer
  useEffect(() => {
    if (!worldContainer) {
      return;
    }
    const g = new Graphics();
    g.zIndex = 10;
    worldContainer.addChild(g);
    graphicsRef.current = g;
    return () => {
      worldContainer.removeChild(g);
      g.destroy();
      graphicsRef.current = null;
    };
  }, [worldContainer]);

  // Redraw whenever visual props change
  useEffect(() => {
    const g = graphicsRef.current;
    if (!g) {
      return;
    }

    g.clear();

    const colorNum = parseRgba(gridColor).color;
    const { horizontal, vertical } = buildGridGeometry({
      gridSize,
      mapWidth,
      mapHeight,
      gridType,
    });

    g.setStrokeStyle({ width: 1, color: colorNum, alpha: gridOpacity });

    [...horizontal, ...vertical].forEach(({ x1, y1, x2, y2 }) => {
      g.moveTo(x1, y1).lineTo(x2, y2);
    });

    g.stroke();
  }, [gridSize, gridColor, gridOpacity, mapWidth, mapHeight, gridType]);

  return null;
}

// eslint-disable-next-line import/no-unused-modules
export default GridOverlay;
