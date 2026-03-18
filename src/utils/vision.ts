/**
 * Vision / Raycasting Module — Pure functions for fog-of-war calculations
 *
 * Extracted from FogOfWarLayer.tsx (ADR-004) so that vision logic is testable
 * with geometric assertions and can be offloaded to a Web Worker in the future.
 *
 * **No React or Konva dependencies.** This module operates on plain geometry.
 *
 * Performance characteristics:
 * - calculateVisibilityPolygon: O(360 × wall_count)
 * - castRay: O(wall_count)
 * - getWallSegments: O(drawings + doors)
 *
 * @see src/types/geometry.ts for Point, WallSegment types
 * @see src/components/Canvas/FogOfWarLayer.tsx for the rendering consumer
 */

import type { Drawing, Door } from '../types/domain';
import type { Point, WallSegment } from '../types/geometry';

/**
 * Calculates visibility polygon using 360-degree raycasting
 *
 * Sweeps 360 rays at 1-degree resolution from the origin point,
 * testing each ray against all wall segments. Returns a closed polygon
 * representing the visible area.
 *
 * @param originX - Ray origin X (typically token center)
 * @param originY - Ray origin Y (typically token center)
 * @param maxRange - Vision radius in pixels
 * @param walls - Wall segments that block vision
 * @param rayCount - Number of rays to cast (default 360 for 1° resolution)
 * @returns Array of points forming visibility polygon
 */
// eslint-disable-next-line import/no-unused-modules
export function calculateVisibilityPolygon(
  originX: number,
  originY: number,
  maxRange: number,
  walls: WallSegment[],
  rayCount: number = 360,
): Point[] {
  const polygon: Point[] = [];
  const angleStep = (Math.PI * 2) / rayCount;

  for (let i = 0; i < rayCount; i++) {
    const angle = i * angleStep;
    const rayEndpoint = castRay(originX, originY, angle, maxRange, walls);
    polygon.push(rayEndpoint);
  }

  return polygon;
}

/**
 * Casts a single ray and finds the closest wall intersection
 *
 * @param originX - Ray origin X
 * @param originY - Ray origin Y
 * @param angle - Ray angle in radians
 * @param maxRange - Maximum ray length
 * @param walls - Wall segments to test against
 * @returns Endpoint of ray — either maxRange distance or wall intersection
 */
// eslint-disable-next-line import/no-unused-modules
export function castRay(
  originX: number,
  originY: number,
  angle: number,
  maxRange: number,
  walls: WallSegment[],
): Point {
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);
  const rayEndX = originX + rayDirX * maxRange;
  const rayEndY = originY + rayDirY * maxRange;

  let closestDistance = maxRange;
  let closestPoint: Point = { x: rayEndX, y: rayEndY };

  // Test intersection with each wall segment
  for (const wall of walls) {
    const intersection = lineSegmentIntersection(
      originX,
      originY,
      rayEndX,
      rayEndY,
      wall.start.x,
      wall.start.y,
      wall.end.x,
      wall.end.y,
    );

    if (intersection) {
      const distance = Math.hypot(intersection.x - originX, intersection.y - originY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = intersection;
      }
    }
  }

  return closestPoint;
}

/**
 * Line segment intersection algorithm
 *
 * Tests if line segment (x1,y1)-(x2,y2) intersects (x3,y3)-(x4,y4).
 * Uses the parametric form with t and u parameters.
 *
 * @returns Intersection point or null if segments don't cross
 */
// eslint-disable-next-line import/no-unused-modules, max-params
export function lineSegmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): Point | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel
  if (Math.abs(denom) < 1e-10) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection is within both segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

/**
 * Extracts wall segments from drawings and closed doors
 *
 * Drawings with `tool === 'wall'` are converted from their points array
 * (x1,y1,x2,y2,...) to WallSegment pairs, with transform (x, y, scale) applied.
 *
 * Closed doors are converted to wall segments based on their orientation and size.
 * Open doors are transparent to vision and not included.
 *
 * @param drawings - All drawings on the current map
 * @param doors - All doors on the current map
 * @returns Wall segments that block vision
 */
// eslint-disable-next-line import/no-unused-modules
export function getWallSegments(drawings: Drawing[], doors: Door[]): WallSegment[] {
  const wallSegments: WallSegment[] = [];

  // Add static walls from drawings
  drawings
    .filter((d) => d.tool === 'wall')
    .forEach((wall) => {
      // Convert points array [x1, y1, x2, y2, ...] to segments
      // Apply drawing transform (x, y, scale) so logical walls match visual walls
      const points = wall.points;
      const offsetX = wall.x ?? 0;
      const offsetY = wall.y ?? 0;
      const scale = wall.scale ?? 1;

      for (let i = 0; i < points.length - 2; i += 2) {
        wallSegments.push({
          start: {
            x: (points[i] ?? 0) * scale + offsetX,
            y: (points[i + 1] ?? 0) * scale + offsetY,
          },
          end: {
            x: (points[i + 2] ?? 0) * scale + offsetX,
            y: (points[i + 3] ?? 0) * scale + offsetY,
          },
        });
      }
    });

  // Add CLOSED doors as blocking walls (open doors allow vision through)
  const closedDoors = doors.filter((door) => !door.isOpen);

  closedDoors.forEach((door) => {
    const halfSize = door.size / 2;
    if (door.orientation === 'horizontal') {
      // Horizontal door: blocks east-west vision
      wallSegments.push({
        start: { x: door.x - halfSize, y: door.y },
        end: { x: door.x + halfSize, y: door.y },
      });
    } else {
      // Vertical door: blocks north-south vision
      wallSegments.push({
        start: { x: door.x, y: door.y - halfSize },
        end: { x: door.x, y: door.y + halfSize },
      });
    }
  });

  return wallSegments;
}
