import { Drawing, Door } from '../store/gameStore';

/**
 * Point represents a 2D coordinate
 */
interface Point {
  x: number;
  y: number;
}

/**
 * Circle represents a circular collision shape (for tokens)
 */
interface Circle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Line segment for wall collision
 */
interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Checks if a circle (token) collides with a line segment (wall)
 * Uses perpendicular distance calculation
 *
 * @param circle - The token's position and size
 * @param line - The wall segment
 * @returns true if collision detected
 */
export function circleLineCollision(circle: Circle, line: LineSegment): boolean {
  // Vector from line start to circle center
  const dx = circle.x - line.x1;
  const dy = circle.y - line.y1;

  // Line vector
  const lineDx = line.x2 - line.x1;
  const lineDy = line.y2 - line.y1;

  // Line length squared
  const lineLengthSq = lineDx * lineDx + lineDy * lineDy;

  // Avoid division by zero for degenerate lines
  if (lineLengthSq === 0) {
    // Line is a point, check distance to that point
    const distSq = dx * dx + dy * dy;
    return distSq <= circle.radius * circle.radius;
  }

  // Calculate projection parameter (0 to 1 for points on line segment)
  let t = (dx * lineDx + dy * lineDy) / lineLengthSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  // Find closest point on line segment
  const closestX = line.x1 + t * lineDx;
  const closestY = line.y1 + t * lineDy;

  // Distance from circle center to closest point
  const distX = circle.x - closestX;
  const distY = circle.y - closestY;
  const distSq = distX * distX + distY * distY;

  return distSq <= circle.radius * circle.radius;
}

/**
 * Checks if a token position would collide with any walls
 *
 * @param x - Token X position
 * @param y - Token Y position
 * @param size - Token size (diameter)
 * @param drawings - Array of drawings (walls)
 * @param doors - Array of doors (closed doors act as walls)
 * @returns true if collision detected
 */
export function checkWallCollision(
  x: number,
  y: number,
  size: number,
  drawings: Drawing[],
  doors: Door[]
): boolean {
  const radius = size / 2;
  const circle: Circle = { x, y, radius };

  // Check collision with walls from drawings
  for (const drawing of drawings) {
    if (drawing.tool !== 'wall') continue;

    const points = drawing.points;
    // Convert points array to line segments
    for (let i = 0; i < points.length - 2; i += 2) {
      const line: LineSegment = {
        x1: points[i],
        y1: points[i + 1],
        x2: points[i + 2],
        y2: points[i + 3],
      };

      if (circleLineCollision(circle, line)) {
        return true;
      }
    }
  }

  // Check collision with closed doors
  for (const door of doors) {
    if (door.isOpen) continue; // Open doors don't block movement

    const halfSize = door.size / 2;
    let line: LineSegment;

    if (door.orientation === 'horizontal') {
      line = {
        x1: door.x - halfSize,
        y1: door.y,
        x2: door.x + halfSize,
        y2: door.y,
      };
    } else {
      line = {
        x1: door.x,
        y1: door.y - halfSize,
        x2: door.x,
        y2: door.y + halfSize,
      };
    }

    if (circleLineCollision(circle, line)) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the nearest valid position to a target that doesn't collide with walls
 * Uses a spiral search pattern to find nearby valid spots
 *
 * @param targetX - Desired X position
 * @param targetY - Desired Y position
 * @param size - Token size
 * @param drawings - Array of wall drawings
 * @param doors - Array of doors
 * @param maxSearchRadius - Maximum search distance (default: 100)
 * @returns Valid position or original position if no valid spot found
 */
export function findNearestValidPosition(
  targetX: number,
  targetY: number,
  size: number,
  drawings: Drawing[],
  doors: Door[],
  maxSearchRadius: number = 100
): Point {
  // Check if target position is already valid
  if (!checkWallCollision(targetX, targetY, size, drawings, doors)) {
    return { x: targetX, y: targetY };
  }

  // Spiral search for valid position
  const step = 5; // Search step size
  for (let radius = step; radius <= maxSearchRadius; radius += step) {
    const angles = Math.floor(radius / step) * 8; // More angles for larger radius

    for (let i = 0; i < angles; i++) {
      const angle = (i / angles) * Math.PI * 2;
      const x = targetX + Math.cos(angle) * radius;
      const y = targetY + Math.sin(angle) * radius;

      if (!checkWallCollision(x, y, size, drawings, doors)) {
        return { x, y };
      }
    }
  }

  // No valid position found, return original
  return { x: targetX, y: targetY };
}

/**
 * Checks if a token is near a door (within interaction range)
 *
 * @param tokenX - Token X position
 * @param tokenY - Token Y position
 * @param door - Door to check
 * @param interactionRange - How close the token needs to be (default: 50px)
 * @returns true if token is near the door
 */
export function isNearDoor(
  tokenX: number,
  tokenY: number,
  door: Door,
  interactionRange: number = 50
): boolean {
  const dx = tokenX - door.x;
  const dy = tokenY - door.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= interactionRange;
}
