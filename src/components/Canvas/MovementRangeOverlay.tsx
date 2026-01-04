/**
 * Movement Range Overlay Component
 *
 * Shows which grid cells a token can reach based on movement speed.
 * Uses efficient flood-fill (BFS) algorithm to calculate reachable cells.
 * Works with all grid types: square, hexagonal, and isometric.
 *
 * @component
 */

import React, { useMemo } from 'react';
import { Group, Line } from 'react-konva';
import { createGridGeometry } from '../../utils/gridGeometry';
import type { GridType } from '../../store/gameStore';

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
 * Get neighboring cells based on grid type
 * Uses grid-specific neighbor patterns
 */
function getNeighbors(cell: { q: number; r: number }, gridType: GridType): Array<{ q: number; r: number }> {
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
  /** Token position in canvas coordinates */
  tokenPosition: { x: number; y: number };
  /** Movement speed in feet (e.g., 30 for 30ft) */
  movementSpeed: number;
  /** Grid size in pixels */
  gridSize: number;
  /** Grid type */
  gridType: GridType;
  /** Optional color for the overlay (default: blue) */
  fillColor?: string;
  /** Optional stroke color (default: darker blue) */
  strokeColor?: string;
}

/**
 * MovementRangeOverlay renders a visual overlay showing reachable grid cells
 */
const MovementRangeOverlay: React.FC<MovementRangeOverlayProps> = ({
  tokenPosition,
  movementSpeed,
  gridSize,
  gridType,
  fillColor = 'rgba(0, 150, 255, 0.15)',
  strokeColor = 'rgba(0, 150, 255, 0.4)',
}) => {
  const reachableCells = useMemo(() => {
    if (gridType === 'HIDDEN') return [];

    const geometry = createGridGeometry(gridType);
    const cells: Array<{ q: number; r: number }> = [];

    // Calculate maximum cells based on movement (assuming 5ft per cell)
    const maxCells = Math.ceil(movementSpeed / 5);

    // Get starting cell from token position
    const startCell = geometry.pixelToGrid(tokenPosition.x, tokenPosition.y, gridSize);

    // BFS flood-fill to find reachable cells
    const visited = new Set<string>();
    const queue: Array<{ cell: { q: number; r: number }; distance: number }> = [
      { cell: startCell, distance: 0 },
    ];

    while (queue.length > 0) {
      const { cell, distance } = queue.shift()!;
      const key = `${cell.q},${cell.r}`;

      if (visited.has(key) || distance > maxCells) continue;
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

    return cells;
  }, [tokenPosition.x, tokenPosition.y, movementSpeed, gridSize, gridType]);

  if (gridType === 'HIDDEN' || reachableCells.length === 0) {
    return null;
  }

  const geometry = createGridGeometry(gridType);

  return (
    <Group listening={false}>
      {reachableCells.map((cell) => {
        const vertices = geometry.getCellVertices(cell, gridSize);
        const points = verticesToPoints(vertices);

        return (
          <Line
            key={`range-${cell.q}-${cell.r}`}
            points={points}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={1}
            closed={true}
            listening={false}
          />
        );
      })}
    </Group>
  );
};

export default MovementRangeOverlay;
