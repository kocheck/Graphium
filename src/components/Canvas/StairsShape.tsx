import { Group, Rect, Line, Path } from 'react-konva';
import type { Stairs } from '../../store/gameStore';

interface StairsShapeProps {
  stairs: Stairs;
  isWorldView: boolean;
}

/**
 * StairsShape renders stairs with visual indication of direction and type
 *
 * **Visual Design:**
 * - Stepped pattern showing stair treads
 * - Directional arrow indicating which way stairs face
 * - Color coding: Up stairs (lighter gray), Down stairs (darker gray)
 * - Border outline for visibility
 *
 * **Interaction:**
 * - Non-interactive (stairs are static architectural elements)
 * - Visible to both DM and players
 *
 * @param stairs - Stairs object from gameStore
 * @param isWorldView - If true, player view (currently no difference from DM view)
 */
const StairsShape = ({ stairs, isWorldView }: StairsShapeProps) => {
  // Color scheme based on type
  const fillColor = stairs.type === 'up' ? '#c0c0c0' : '#808080'; // Light gray for up, dark gray for down
  const strokeColor = '#000000';
  const arrowColor = stairs.type === 'up' ? '#4a90e2' : '#e24a4a'; // Blue for up, red for down

  return (
    <Group
      x={stairs.x}
      y={stairs.y}
      listening={false}  // Stairs are non-interactive
      opacity={1}
    >
      {/* Background rectangle */}
      <Rect
        x={0}
        y={0}
        width={stairs.width}
        height={stairs.height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
      />

      {/* Render stair treads based on direction */}
      {renderStairTreads(stairs, strokeColor)}

      {/* Directional arrow */}
      {renderDirectionalArrow(stairs, arrowColor)}

      {/* Type indicator (UP/DOWN text) */}
      {renderTypeIndicator(stairs)}
    </Group>
  );
};

/**
 * Renders stair treads (horizontal lines showing individual steps)
 *
 * @param stairs - Stairs object
 * @param strokeColor - Color for tread lines
 */
function renderStairTreads(stairs: Stairs, strokeColor: string) {
  const numSteps = 5; // Number of visible step lines
  const lines = [];

  if (stairs.direction === 'north' || stairs.direction === 'south') {
    // Horizontal treads for north/south stairs
    const stepHeight = stairs.height / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const y = i * stepHeight;
      lines.push(
        <Line
          key={`tread-${i}`}
          points={[0, y, stairs.width, y]}
          stroke={strokeColor}
          strokeWidth={1}
          opacity={0.6}
        />
      );
    }
  } else {
    // Vertical treads for east/west stairs
    const stepWidth = stairs.width / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const x = i * stepWidth;
      lines.push(
        <Line
          key={`tread-${i}`}
          points={[x, 0, x, stairs.height]}
          stroke={strokeColor}
          strokeWidth={1}
          opacity={0.6}
        />
      );
    }
  }

  return <>{lines}</>;
}

/**
 * Renders a directional arrow showing which way the stairs face
 *
 * @param stairs - Stairs object
 * @param arrowColor - Color for the arrow
 */
function renderDirectionalArrow(stairs: Stairs, arrowColor: string) {
  const centerX = stairs.width / 2;
  const centerY = stairs.height / 2;
  const arrowSize = Math.min(stairs.width, stairs.height) * 0.3;

  let arrowPath = '';

  switch (stairs.direction) {
    case 'north':
      // Arrow pointing up
      arrowPath = `M ${centerX} ${centerY - arrowSize} L ${centerX - arrowSize / 2} ${centerY} L ${centerX + arrowSize / 2} ${centerY} Z`;
      break;
    case 'south':
      // Arrow pointing down
      arrowPath = `M ${centerX} ${centerY + arrowSize} L ${centerX - arrowSize / 2} ${centerY} L ${centerX + arrowSize / 2} ${centerY} Z`;
      break;
    case 'east':
      // Arrow pointing right
      arrowPath = `M ${centerX + arrowSize} ${centerY} L ${centerX} ${centerY - arrowSize / 2} L ${centerX} ${centerY + arrowSize / 2} Z`;
      break;
    case 'west':
      // Arrow pointing left
      arrowPath = `M ${centerX - arrowSize} ${centerY} L ${centerX} ${centerY - arrowSize / 2} L ${centerX} ${centerY + arrowSize / 2} Z`;
      break;
  }

  return (
    <Path
      data={arrowPath}
      fill={arrowColor}
      stroke="#000000"
      strokeWidth={1}
      opacity={0.8}
    />
  );
}

/**
 * Renders type indicator showing if stairs go up or down
 *
 * For now, this is primarily handled by color and arrow color.
 * Could add text labels if needed in the future.
 */
function renderTypeIndicator(stairs: Stairs) {
  // Optional: Could add "UP" or "DOWN" text here
  // For now, the arrow color (blue/red) indicates the type
  return null;
}

export default StairsShape;
