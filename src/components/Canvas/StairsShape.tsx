import { Group, Rect, Line, Path } from 'react-konva';

import type { Stairs } from '../../types/domain';

const STAIRS_COLORS = {
  fillUp: '#c0c0c0', // --app-stairs-fill-up (light gray)
  fillDown: '#808080', // --app-stairs-fill-down (dark gray)
  stroke: '#1c1007', // --app-stairs-stroke (warm ink)
  arrowUp: '#8c6914', // --app-stairs-arrow-up (antique brass)
  arrowDown: '#e5484d', // --app-stairs-arrow-down (red)
} as const;

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
 */
function StairsShape({ stairs }: StairsShapeProps): JSX.Element {
  // Color scheme based on type
  const fillColor = stairs.type === 'up' ? STAIRS_COLORS.fillUp : STAIRS_COLORS.fillDown;
  const strokeColor = STAIRS_COLORS.stroke;
  const arrowColor = stairs.type === 'up' ? STAIRS_COLORS.arrowUp : STAIRS_COLORS.arrowDown;

  // Calculate top-left offset for center positioning
  const halfWidth = stairs.width / 2;
  const halfHeight = stairs.height / 2;

  return (
    <Group
      x={stairs.x}
      y={stairs.y}
      listening={false} // Stairs are non-interactive
      opacity={1}
    >
      {/* Background rectangle */}
      <Rect
        x={-halfWidth}
        y={-halfHeight}
        width={stairs.width}
        height={stairs.height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
      />

      {/* Render stair treads based on direction */}
      {renderStairTreads(stairs, strokeColor, halfWidth, halfHeight)}

      {/* Directional arrow */}
      {renderDirectionalArrow(stairs, arrowColor)}

      {/* Type indicator (UP/DOWN text) */}
      {renderTypeIndicator()}
    </Group>
  );
}

/**
 * Renders stair treads (horizontal lines showing individual steps)
 *
 * @param stairs - Stairs object
 * @param strokeColor - Color for tread lines
 * @param halfWidth - Half width for centering
 * @param halfHeight - Half height for centering
 */
function renderStairTreads(
  stairs: Stairs,
  strokeColor: string,
  halfWidth: number,
  halfHeight: number,
): JSX.Element {
  const numSteps = 5; // Number of visible step lines
  const lines = [];

  if (stairs.direction === 'north' || stairs.direction === 'south') {
    // Horizontal treads for north/south stairs
    const stepHeight = stairs.height / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const y = i * stepHeight - halfHeight;
      lines.push(
        <Line
          key={`tread-${i}`}
          points={[-halfWidth, y, halfWidth, y]}
          stroke={strokeColor}
          strokeWidth={1}
          opacity={0.6}
        />,
      );
    }
  } else {
    // Vertical treads for east/west stairs
    const stepWidth = stairs.width / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const x = i * stepWidth - halfWidth;
      lines.push(
        <Line
          key={`tread-${i}`}
          points={[x, -halfHeight, x, halfHeight]}
          stroke={strokeColor}
          strokeWidth={1}
          opacity={0.6}
        />,
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
function renderDirectionalArrow(stairs: Stairs, arrowColor: string): JSX.Element {
  const centerX = 0; // Already centered by Group
  const centerY = 0; // Already centered by Group
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
    default:
      break;
  }

  return (
    <Path
      data={arrowPath}
      fill={arrowColor}
      stroke={STAIRS_COLORS.stroke}
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
function renderTypeIndicator(): null {
  // Optional: Could add "UP" or "DOWN" text here
  // For now, the arrow color (blue/red) indicates the type
  return null;
}

export default StairsShape;
