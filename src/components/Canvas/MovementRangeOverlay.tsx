/**
 * Movement Range Overlay Component
 *
 * Shows which grid cells a token can reach based on movement speed.
 * Uses efficient flood-fill (BFS) algorithm to calculate reachable cells.
 * Works with all grid types: square, hexagonal, and isometric.
 *
 * @component
 */

import { useEffect, useMemo } from 'react';

import { Graphics } from 'pixi.js';

import { usePixiContainer } from './hooks/usePixiContainer';
import { createGridGeometry } from '../../utils/gridGeometry';
import { parseRgba } from '../../utils/pixiColor';
import { clearContainer } from '../../utils/pixiUtils';

import type { GridType } from '../../types/domain';
import type { Container as PixiContainer } from 'pixi.js';

const MOVEMENT_COLORS = {
  fill: 'rgba(140, 105, 20, 0.12)', // --app-movement-range-fill
  stroke: 'rgba(140, 105, 20, 0.4)', // --app-movement-range-stroke
} as const;

/**
 * Get neighboring cells based on grid type.
 * Uses grid-specific neighbor patterns.
 *
 * **Note on Isometric Grids:**
 * In isometric grids, movement appears diagonal in visual space but is actually
 * orthogonal in grid coordinate space. The current BFS treats all neighbor
 * transitions as equal cost (distance + 1), which is appropriate for the grid
 * coordinate system. If D&D 5e diagonal movement rules should apply to isometric
 * grids, this would need to be updated to use actual pixel distances.
 */
function getNeighbors(
  cell: { q: number; r: number },
  gridType: GridType,
): Array<{ q: number; r: number }> {
  switch (gridType) {
    case 'HEXAGONAL':
      // Hex has 6 neighbors (axial coordinates)
      return [
        { q: cell.q + 1, r: cell.r },
        { q: cell.q - 1, r: cell.r },
        { q: cell.q, r: cell.r + 1 },
        { q: cell.q, r: cell.r - 1 },
        { q: cell.q + 1, r: cell.r - 1 },
        { q: cell.q - 1, r: cell.r + 1 },
      ];
    case 'ISOMETRIC':
      // Iso has 4 diagonal neighbors
      return [
        { q: cell.q + 1, r: cell.r },
        { q: cell.q - 1, r: cell.r },
        { q: cell.q, r: cell.r + 1 },
        { q: cell.q, r: cell.r - 1 },
      ];
    default: // Square (LINES, DOTS, HIDDEN)
      return [
        { q: cell.q + 1, r: cell.r },
        { q: cell.q - 1, r: cell.r },
        { q: cell.q, r: cell.r + 1 },
        { q: cell.q, r: cell.r - 1 },
      ];
  }
}

interface MovementRangeOverlayProps {
  /** PixiJS world container to attach graphics to */
  worldContainer: PixiContainer | null;
  /** Token position in canvas coordinates */
  tokenPosition: { x: number; y: number };
  /** Movement speed in feet (e.g., 30 for 30ft) */
  movementSpeed: number;
  /** Grid size in pixels */
  gridSize: number;
  /** Grid type */
  gridType: GridType;
  /** Optional color for the overlay (default: brass, low alpha) */
  fillColor?: string;
  /** Optional stroke color (default: brass, medium alpha) */
  strokeColor?: string;
}

/**
 * MovementRangeOverlay — PixiJS imperative movement range rendering.
 *
 * Returns null (imperative pattern): all drawing happens via PixiJS
 * Graphics objects added/removed from worldContainer.
 */
// eslint-disable-next-line import/no-unused-modules
export function MovementRangeOverlay({
  worldContainer,
  tokenPosition,
  movementSpeed,
  gridSize,
  gridType,
  fillColor = MOVEMENT_COLORS.fill,
  strokeColor = MOVEMENT_COLORS.stroke,
}: MovementRangeOverlayProps): null {
  const containerRef = usePixiContainer(worldContainer, 140);

  // BFS flood-fill to find reachable cells — unchanged logic from Konva version
  const { reachableCells, geometry } = useMemo(() => {
    if (gridType === 'HIDDEN') {
      return { reachableCells: [], geometry: createGridGeometry(gridType) };
    }

    const geom = createGridGeometry(gridType);
    const cells: Array<{ q: number; r: number }> = [];

    // Calculate maximum cells based on movement (assuming 5ft per cell)
    const maxCells = Math.ceil(movementSpeed / 5);

    // Get starting cell from token position
    const startCell = geom.pixelToGrid(tokenPosition.x, tokenPosition.y, gridSize);

    // BFS flood-fill to find reachable cells
    const visited = new Set<string>();
    const queue: Array<{ cell: { q: number; r: number }; distance: number }> = [
      { cell: startCell, distance: 0 },
    ];

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        break;
      }
      const { cell, distance } = item;
      const key = `${cell.q},${cell.r}`;

      if (visited.has(key) || distance > maxCells) {
        continue;
      }
      visited.add(key);
      cells.push(cell);

      // Add neighbors to queue
      const neighbors = getNeighbors(cell, gridType);
      neighbors.forEach((neighbor) => {
        const neighborKey = `${neighbor.q},${neighbor.r}`;
        if (!visited.has(neighborKey)) {
          queue.push({ cell: neighbor, distance: distance + 1 });
        }
      });
    }

    return { reachableCells: cells, geometry: geom };
  }, [tokenPosition.x, tokenPosition.y, movementSpeed, gridSize, gridType]);

  // Redraw cells when reachableCells or color props change
  useEffect(() => {
    const c = containerRef.current;
    if (!c) {
      return;
    }

    // Remove and destroy previous graphics
    clearContainer(c);

    if (gridType === 'HIDDEN' || reachableCells.length === 0) {
      return;
    }

    const fill = parseRgba(fillColor);
    const stroke = parseRgba(strokeColor);

    const gfx = new Graphics();
    gfx.eventMode = 'none';

    for (const cell of reachableCells) {
      const vertices = geometry.getCellVertices(cell, gridSize);
      gfx.poly(vertices, true);
      gfx.fill({ color: fill.color, alpha: fill.alpha });
      gfx.stroke({ color: stroke.color, alpha: stroke.alpha, width: 1 });
    }

    c.addChild(gfx);
  }, [containerRef, reachableCells, geometry, gridSize, gridType, fillColor, strokeColor]);

  return null;
}

// eslint-disable-next-line import/no-unused-modules
export default MovementRangeOverlay;
