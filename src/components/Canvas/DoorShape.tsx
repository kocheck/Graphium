import { useState, useEffect, useRef } from 'react';
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
 * **Animation:**
 * - Smooth transition when opening/closing (300ms easeInOut)
 * - animationProgress: 0 (closed) → 1 (fully open)
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
  // Animation state: 0 = fully closed, 1 = fully open
  const [animationProgress, setAnimationProgress] = useState(door.isOpen ? 1 : 0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const ANIMATION_DURATION = 300; // milliseconds

  // Animate when door.isOpen changes
  useEffect(() => {
    console.log('[DoorShape] door.isOpen changed:', door.id, 'from', animationProgress === 1 ? 'open' : 'closed', 'to', door.isOpen ? 'open' : 'closed');
    const targetProgress = door.isOpen ? 1 : 0;

    // If already at target, no animation needed
    if (animationProgress === targetProgress) return;

    // Start animation
    startTimeRef.current = performance.now();
    const initialProgress = animationProgress;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      // Ease-in-out function for smooth animation
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newProgress = initialProgress + (targetProgress - initialProgress) * eased;
      setAnimationProgress(newProgress);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setAnimationProgress(targetProgress);
        startTimeRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount or when animation changes
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [door.isOpen]); // animationProgress is intentionally excluded - it's managed by the animation loop, not a dependency

  const handleClick = () => {
    console.log('[DoorShape] handleClick called for door:', door.id, 'isWorldView:', isWorldView, 'onToggle:', !!onToggle, 'isLocked:', door.isLocked);
    // Only allow toggling in DM mode (not World View)
    if (!isWorldView && onToggle && !door.isLocked) {
      console.log('[DoorShape] Calling onToggle for door:', door.id);
      onToggle(door.id);
    } else {
      console.log('[DoorShape] Click blocked - isWorldView:', isWorldView, 'hasOnToggle:', !!onToggle, 'isLocked:', door.isLocked);
    }
  };

  const thickness = door.thickness ?? 12; // Thicker default for better visibility
  const halfSize = door.size / 2;

  console.log('[DoorShape] Rendering door:', door.id, 'isWorldView:', isWorldView, 'isOpen:', door.isOpen, 'position:', door.x, door.y);

  return (
    <Group
      x={door.x}
      y={door.y}
      onClick={handleClick}
      listening={!isWorldView}  // DM can click, players cannot
      opacity={1}  // Always visible to both DM and players
    >
      {/* Render door with animated transition */}
      {animationProgress < 1
        ? renderAnimatedDoor(door, halfSize, thickness, animationProgress, isWorldView)
        : renderOpenDoor(door, halfSize, thickness, isWorldView)}

      {/* Lock icon overlay (shown when door is locked) */}
      {door.isLocked && renderLockIcon(door)}
    </Group>
  );
};

/**
 * Renders an animated door during open/close transition
 *
 * Interpolates between closed (progress=0) and open (progress=1) states.
 * The door gradually fades from solid rectangle to swing arc.
 *
 * @param door - Door object
 * @param halfSize - Half of door size
 * @param thickness - Door thickness
 * @param progress - Animation progress (0 = closed, 1 = open)
 * @param isWorldView - Whether this is World View (for enhanced visibility)
 */
function renderAnimatedDoor(door: Door, halfSize: number, thickness: number, progress: number, isWorldView: boolean = false) {
  const swingAngle = 90 * progress; // Gradually increase swing angle from 0° to 90°
  const closedOpacity = 1 - progress; // Fade out closed door
  const openOpacity = progress; // Fade in open door

  return (
    <>
      {/* Closed door (fading out) */}
      {progress < 0.95 && (
        <Group opacity={closedOpacity}>
          {door.orientation === 'horizontal' ? (
            <Rect
              x={-halfSize}
              y={-thickness / 2}
              width={door.size}
              height={thickness}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={isWorldView ? 3 : 2}
              shadowColor={isWorldView ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)"}
              shadowBlur={isWorldView ? 10 : 4}
              shadowOffsetX={1}
              shadowOffsetY={1}
            />
          ) : (
            <Rect
              x={-thickness / 2}
              y={-halfSize}
              width={thickness}
              height={door.size}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={isWorldView ? 3 : 2}
              shadowColor={isWorldView ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)"}
              shadowBlur={isWorldView ? 10 : 4}
              shadowOffsetX={1}
              shadowOffsetY={1}
            />
          )}
        </Group>
      )}

      {/* Open door arc (fading in) */}
      {progress > 0.05 && (
        <Group opacity={openOpacity}>
          {renderSwingArc(door, halfSize, thickness, swingAngle, isWorldView)}
        </Group>
      )}
    </>
  );
}

/**
 * Renders the swing arc for an open door
 *
 * @param door - Door object
 * @param halfSize - Half of door size
 * @param thickness - Door thickness
 * @param swingAngle - Current swing angle (0-90 degrees)
 * @param isWorldView - Whether this is World View (for enhanced visibility)
 */
function renderSwingArc(door: Door, halfSize: number, thickness: number, swingAngle: number, _isWorldView: boolean = false) {
  let arcX = 0;
  let arcY = 0;
  let startAngle = 0;

  if (door.orientation === 'horizontal') {
    if (door.swingDirection === 'left') {
      arcX = -halfSize;
      arcY = 0;
      startAngle = 0;
    } else {
      arcX = halfSize;
      arcY = 0;
      startAngle = 90;
    }
  } else {
    if (door.swingDirection === 'up') {
      arcX = 0;
      arcY = -halfSize;
      startAngle = 270;
    } else {
      arcX = 0;
      arcY = halfSize;
      startAngle = 180;
    }
  }

  return (
    <Arc
      x={arcX}
      y={arcY}
      innerRadius={halfSize - thickness / 2}
      outerRadius={halfSize + thickness / 2}
      angle={swingAngle}
      rotation={startAngle}
      fill="rgba(255, 255, 255, 0.4)"
      stroke="#000000"
      strokeWidth={1}
      dash={[4, 4]}
      shadowColor="rgba(0,0,0,0.2)"
      shadowBlur={2}
      hitStrokeWidth={0}
    />
  );
}

/**
 * Renders an open door as a swing arc
 *
 * The arc shows the door swung open to provide visual feedback that the door is accessible.
 */
function renderOpenDoor(door: Door, halfSize: number, thickness: number, _isWorldView: boolean = false) {
  const swingAngle = 90; // Door swings 90 degrees when open

  // Calculate arc parameters based on swing direction
  let arcX = 0;
  let arcY = 0;
  let startAngle = 0;

  if (door.orientation === 'horizontal') {
    // Horizontal door swings vertically
    if (door.swingDirection === 'left') {
      arcX = -halfSize;
      arcY = 0;
      startAngle = 0;
    } else {
      // right
      arcX = halfSize;
      arcY = 0;
      startAngle = 90;
    }
  } else {
    // Vertical door swings horizontally
    if (door.swingDirection === 'up') {
      arcX = 0;
      arcY = -halfSize;
      startAngle = 270;
    } else {
      // down
      arcX = 0;
      arcY = halfSize;
      startAngle = 180;
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
