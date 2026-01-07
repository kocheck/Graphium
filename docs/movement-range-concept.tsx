/**
 * Movement Range Visualization Concept
 *
 * Shows which cells a token can reach based on movement speed.
 * Uses efficient flood-fill algorithm for hex/iso grids.
 */

interface MovementRangeProps {
  tokenPosition: Point;
  movementSpeed: number; // in feet
  gridSize: number;
  gridType: GridType;
  visibleBounds: Bounds;
}

export const MovementRangeOverlay: React.FC<MovementRangeProps> = ({
  tokenPosition,
  movementSpeed,
  gridSize,
  gridType,
  visibleBounds,
}) => {
  const geometry = createGridGeometry(gridType);

  // Calculate reachable cells using BFS/flood-fill
  const reachableCells = useMemo(() => {
    const cells: GridCell[] = [];
    const maxCells = Math.ceil(movementSpeed / 5); // 5ft per cell
    const startCell = geometry.pixelToGrid(tokenPosition.x, tokenPosition.y, gridSize);

    // Simple radius check (for square grids)
    // For hex/iso, use proper distance calculation
    const visited = new Set<string>();
    const queue: Array<{ cell: GridCell; distance: number }> = [{ cell: startCell, distance: 0 }];

    while (queue.length > 0) {
      const { cell, distance } = queue.shift()!;
      const key = `${cell.q},${cell.r}`;

      if (visited.has(key) || distance > maxCells) continue;
      visited.add(key);
      cells.push(cell);

      // Add neighbors (6 for hex, 4 for square, 4 for iso)
      const neighbors = getNeighbors(cell, gridType);
      neighbors.forEach((neighbor) => {
        queue.push({ cell: neighbor, distance: distance + 1 });
      });
    }

    return cells;
  }, [tokenPosition, movementSpeed, gridSize, gridType]);

  return (
    <Group listening={false}>
      {reachableCells.map((cell) => {
        const vertices = geometry.getCellVertices(cell, gridSize);
        return (
          <Line
            key={`range-${cell.q}-${cell.r}`}
            points={verticesToPoints(vertices)}
            fill="rgba(0, 150, 255, 0.15)"
            stroke="rgba(0, 150, 255, 0.4)"
            strokeWidth={1}
            closed={true}
          />
        );
      })}
    </Group>
  );
};

// Helper: Get neighboring cells based on grid type
function getNeighbors(cell: GridCell, gridType: GridType): GridCell[] {
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
    default: // Square
      return [
        { q: cell.q + 1, r: cell.r },
        { q: cell.q - 1, r: cell.r },
        { q: cell.q, r: cell.r + 1 },
        { q: cell.q, r: cell.r - 1 },
      ];
  }
}
