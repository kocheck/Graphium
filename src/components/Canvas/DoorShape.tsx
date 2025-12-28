import { Group, Rect, Arc, Path, Circle } from 'react-konva';
import type { Door } from '../../store/gameStore';

interface DoorShapeProps {
  door: Door;
  isWorldView: boolean;
  onToggle?: (id: string) => void;
}

/**
 * DoorShape renders a door with visual states (closed/open/locked)
 *
 * **Visual Design:**
 * - Closed: White rectangle with black outline (standard tabletop symbol)
 * - Open: Swing arc showing door position
 * - Locked: Small lock icon overlaid on the door
 *
 * **Interaction:**
 * - DM Mode: Click to toggle open/closed
 * - World View: Non-interactive (read-only)
 *
 * @param door - Door object from gameStore
 * @param isWorldView - If true, blocks interaction (player view)
 * @param onToggle - Callback when door is clicked (DM only)
 */
const DoorShape = ({ door, isWorldView, onToggle }: DoorShapeProps) => {
  const handleClick = () => {
    // Only allow toggling in DM mode (not World View)
    if (!isWorldView && onToggle && !door.isLocked) {
      onToggle(door.id);
    }
  };

  const thickness = door.thickness ?? 8;
  const halfSize = door.size / 2;

  // Determine cursor style based on mode and lock state
  let cursor = 'default';
  if (!isWorldView) {
    cursor = door.isLocked ? 'not-allowed' : 'pointer';
  }

  return (
    <Group
      x={door.x}
      y={door.y}
      onClick={handleClick}
      listening={!isWorldView}  // DM can click, players cannot
      opacity={isWorldView ? 0.9 : 1}
    >
      {door.isOpen ? renderOpenDoor(door, halfSize, thickness, cursor) : renderClosedDoor(door, halfSize, thickness, cursor)}

      {/* Lock icon overlay (shown when door is locked) */}
      {door.isLocked && renderLockIcon(door)}
    </Group>
  );
};

/**
 * Renders a closed door as a white rectangle with black outline
 *
 * This matches the standard tabletop RPG door symbol for immediate recognition.
 */
function renderClosedDoor(door: Door, halfSize: number, thickness: number, cursor: string) {
  if (door.orientation === 'horizontal') {
    return (
      <>
        {/* Main door rectangle */}
        <Rect
          x={-halfSize}
          y={-thickness / 2}
          width={door.size}
          height={thickness}
          fill="#ffffff"           // White fill
          stroke="#000000"         // Black outline
          strokeWidth={2}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={4}
          shadowOffsetX={1}
          shadowOffsetY={1}
          hitStrokeWidth={0}       // Don't expand hit area beyond visible shape
        />
        {/* Subtle door handle/knob */}
        <Circle
          x={halfSize - 10}
          y={0}
          radius={2}
          fill="#666666"           // Dark gray knob
        />
      </>
    );
  } else {
    // Vertical door
    return (
      <>
        <Rect
          x={-thickness / 2}
          y={-halfSize}
          width={thickness}
          height={door.size}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={2}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={4}
          shadowOffsetX={1}
          shadowOffsetY={1}
          hitStrokeWidth={0}
        />
        <Circle
          x={0}
          y={halfSize - 10}
          radius={2}
          fill="#666666"
        />
      </>
    );
  }
}

/**
 * Renders an open door as a swing arc
 *
 * The arc shows the door swung open to provide visual feedback that the door is accessible.
 */
function renderOpenDoor(door: Door, halfSize: number, thickness: number, cursor: string) {
  const swingAngle = 90; // Door swings 90 degrees when open

  // Calculate arc parameters based on swing direction
  let arcX = 0;
  let arcY = 0;
  let startAngle = 0;
  let endAngle = swingAngle;

  if (door.orientation === 'horizontal') {
    // Horizontal door swings vertically
    if (door.swingDirection === 'left') {
      arcX = -halfSize;
      arcY = 0;
      startAngle = 0;
      endAngle = 90;
    } else {
      // right
      arcX = halfSize;
      arcY = 0;
      startAngle = 90;
      endAngle = 180;
    }
  } else {
    // Vertical door swings horizontally
    if (door.swingDirection === 'up') {
      arcX = 0;
      arcY = -halfSize;
      startAngle = 270;
      endAngle = 360;
    } else {
      // down
      arcX = 0;
      arcY = halfSize;
      startAngle = 180;
      endAngle = 270;
    }
  }

  return (
    <>
      {/* Swing arc showing door position */}
      <Arc
        x={arcX}
        y={arcY}
        innerRadius={halfSize - thickness / 2}
        outerRadius={halfSize + thickness / 2}
        angle={swingAngle}
        rotation={startAngle}
        fill="rgba(255, 255, 255, 0.4)"  // Semi-transparent white
        stroke="#000000"
        strokeWidth={1}
        dash={[4, 4]}                     // Dashed outline
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={2}
        hitStrokeWidth={0}
      />

      {/* Small rectangle at the edge showing door position when open */}
      {renderOpenDoorEdge(door, halfSize, thickness)}
    </>
  );
}

/**
 * Renders a small rectangle at the edge of the swing arc to show the door's position when open
 */
function renderOpenDoorEdge(door: Door, halfSize: number, thickness: number) {
  let x = 0;
  let y = 0;
  let width = thickness;
  let height = halfSize;

  if (door.orientation === 'horizontal') {
    if (door.swingDirection === 'left') {
      x = -halfSize - thickness / 2;
      y = 0;
      width = thickness;
      height = halfSize;
    } else {
      // right
      x = halfSize - thickness / 2;
      y = 0;
      width = thickness;
      height = halfSize;
    }
  } else {
    if (door.swingDirection === 'up') {
      x = 0;
      y = -halfSize - thickness / 2;
      width = halfSize;
      height = thickness;
    } else {
      // down
      x = 0;
      y = halfSize - thickness / 2;
      width = halfSize;
      height = thickness;
    }
  }

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(255, 255, 255, 0.6)"
      stroke="#000000"
      strokeWidth={1}
      hitStrokeWidth={0}
    />
  );
}

/**
 * Renders a lock icon overlaid on the door
 *
 * Shows a simple padlock symbol to indicate the door is locked.
 */
function renderLockIcon(door: Door) {
  const lockSize = 8;
  const offsetY = door.orientation === 'horizontal' ? 6 : 0;
  const offsetX = door.orientation === 'vertical' ? 6 : 0;

  // Simple lock icon using SVG path data
  const lockPath = 'M 0 4 L 0 8 L 6 8 L 6 4 L 5 4 L 5 2 C 5 0.9 4.1 0 3 0 C 1.9 0 1 0.9 1 2 L 1 4 Z M 2 2 C 2 1.4 2.4 1 3 1 C 3.6 1 4 1.4 4 2 L 4 4 L 2 4 Z';

  return (
    <Group
      x={offsetX}
      y={offsetY}
      scale={{ x: 1, y: 1 }}
    >
      {/* Lock background circle */}
      <Circle
        x={3}
        y={4}
        radius={6}
        fill="rgba(255, 255, 255, 0.9)"
        stroke="#000000"
        strokeWidth={1}
      />
      {/* Lock icon */}
      <Path
        data={lockPath}
        fill="#FF4444"        // Red lock to indicate locked state
        stroke="#8B0000"      // Dark red outline
        strokeWidth={0.5}
        scale={{ x: 0.8, y: 0.8 }}
      />
    </Group>
  );
}

export default DoorShape;
