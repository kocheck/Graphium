/**
 * Area of Effect Templates Concept
 *
 * Grid-aware AoE visualization for spells and abilities.
 * Highlights affected cells based on spell radius/shape.
 */

interface AoETemplateProps {
  origin: Point;
  templateType: 'circle' | 'cone' | 'line' | 'cube';
  radius: number; // in feet
  direction?: number; // degrees (for cone/line)
  gridSize: number;
  gridType: GridType;
}

export const AoETemplate: React.FC<AoETemplateProps> = ({
  origin,
  templateType,
  radius,
  direction = 0,
  gridSize,
  gridType,
}) => {
  const geometry = createGridGeometry(gridType);

  const affectedCells = useMemo(() => {
    const cells: GridCell[] = [];
    const radiusInCells = radius / 5; // 5ft per cell
    const originCell = geometry.pixelToGrid(origin.x, origin.y, gridSize);

    // Get cells in a radius around origin
    const range = Math.ceil(radiusInCells) + 2; // Extra padding
    for (let q = originCell.q - range; q <= originCell.q + range; q++) {
      for (let r = originCell.r - range; r <= originCell.r + range; r++) {
        const cell = { q, r };
        const cellCenter = geometry.gridToPixel(cell, gridSize);

        if (templateType === 'circle') {
          // Distance from origin to cell center
          const distance = Math.sqrt(
            Math.pow(cellCenter.x - origin.x, 2) + Math.pow(cellCenter.y - origin.y, 2),
          );
          const distanceInFeet = (distance / gridSize) * 5;

          if (distanceInFeet <= radius) {
            cells.push(cell);
          }
        } else if (templateType === 'cone') {
          // Check if cell is within cone angle and range
          const dx = cellCenter.x - origin.x;
          const dy = cellCenter.y - origin.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const distance = Math.sqrt(dx * dx + dy * dy);
          const distanceInFeet = (distance / gridSize) * 5;

          const angleDiff = Math.abs(((angle - direction + 180) % 360) - 180);
          const coneAngle = 53; // Standard D&D cone angle

          if (distanceInFeet <= radius && angleDiff <= coneAngle / 2) {
            cells.push(cell);
          }
        }
        // Add other types: line, cube, etc.
      }
    }

    return cells;
  }, [origin, templateType, radius, direction, gridSize, gridType]);

  return (
    <Group listening={false}>
      {affectedCells.map((cell) => {
        const vertices = geometry.getCellVertices(cell, gridSize);
        return (
          <Line
            key={`aoe-${cell.q}-${cell.r}`}
            points={verticesToPoints(vertices)}
            fill="rgba(255, 100, 0, 0.25)"
            stroke="rgba(255, 100, 0, 0.6)"
            strokeWidth={2}
            closed={true}
          />
        );
      })}
      {/* Origin marker */}
      <Circle
        x={origin.x}
        y={origin.y}
        radius={8}
        fill="rgba(255, 100, 0, 0.8)"
        stroke="white"
        strokeWidth={2}
      />
    </Group>
  );
};
