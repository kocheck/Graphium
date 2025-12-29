/**
 * Shared geometry type definitions and utilities
 *
 * Used across path optimization, fog of war, and other geometry-related features.
 */

export interface Point {
  x: number;
  y: number;
}

export interface WallSegment {
  start: Point;
  end: Point;
}

/**
 * Point-in-polygon test using ray casting algorithm
 *
 * Casts a horizontal ray from the point to infinity and counts intersections.
 * Odd number of intersections = inside, even = outside.
 *
 * @param point - Point to test
 * @param polygon - Array of points forming a closed polygon
 * @returns true if point is inside polygon
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    // Check if point is on horizontal edge
    const onEdge = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);

    if (onEdge) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Checks if a point is inside any of the provided polygons
 *
 * @param point - Point to test
 * @param polygons - Array of polygons to test against
 * @returns true if point is inside at least one polygon
 */
export function isPointInAnyPolygon(point: Point, polygons: Point[][]): boolean {
  return polygons.some(polygon => isPointInPolygon(point, polygon));
}

/**
 * Checks if a rectangular area (token bounds) intersects with any active vision polygon
 *
 * For performance, we test the center point and four corners.
 * If any point is inside a vision polygon, the token is considered visible.
 *
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Width of the rectangle
 * @param height - Height of the rectangle
 * @param polygons - Active vision polygons
 * @returns true if any part of the rectangle is visible
 */
export function isRectInAnyPolygon(
  x: number,
  y: number,
  width: number,
  height: number,
  polygons: Point[][]
): boolean {
  // Test center point (most important for token visibility)
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  if (isPointInAnyPolygon({ x: centerX, y: centerY }, polygons)) {
    return true;
  }

  // Test corners for edge cases
  const corners = [
    { x, y }, // Top-left
    { x: x + width, y }, // Top-right
    { x, y: y + height }, // Bottom-left
    { x: x + width, y: y + height }, // Bottom-right
  ];

  return corners.some(corner => isPointInAnyPolygon(corner, polygons));
}
