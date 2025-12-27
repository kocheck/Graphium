/**
 * Path Optimization Utilities
 *
 * Provides path smoothing and geometry snapping for wall tool refinement.
 * Includes Ramer-Douglas-Peucker algorithm for path simplification.
 */

import { Point, WallSegment } from '../types/geometry';

export type { Point, WallSegment };

/**
 * Ramer-Douglas-Peucker algorithm for path simplification
 * Recursively removes points that don't significantly affect the shape
 *
 * @param points - Flat array of coordinates [x1, y1, x2, y2, ...]
 * @param epsilon - Maximum perpendicular distance tolerance (pixels)
 * @returns Simplified flat array of coordinates
 */
export function simplifyPath(points: number[], epsilon: number): number[] {
  if (points.length <= 4) {
    // Need at least 2 points (4 values) to form a line
    return points;
  }

  // Convert flat array to Point objects
  const pointObjects: Point[] = [];
  for (let i = 0; i < points.length; i += 2) {
    pointObjects.push({ x: points[i], y: points[i + 1] });
  }

  // Apply RDP algorithm
  const simplified = rdpRecursive(pointObjects, epsilon);

  // Convert back to flat array
  const result: number[] = [];
  for (const point of simplified) {
    result.push(point.x, point.y);
  }

  return result;
}

/**
 * Recursive RDP implementation
 */
function rdpRecursive(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with maximum perpendicular distance from line (first -> last)
  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Split at the point with max distance and recursively simplify both halves
    const leftSegment = rdpRecursive(points.slice(0, maxIndex + 1), epsilon);
    const rightSegment = rdpRecursive(points.slice(maxIndex), epsilon);

    // Combine results (remove duplicate point at maxIndex)
    return leftSegment.slice(0, -1).concat(rightSegment);
  } else {
    // All points are close enough to the line, keep only endpoints
    return [start, end];
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Handle degenerate case (line is actually a point)
  if (dx === 0 && dy === 0) {
    return distance(point, lineStart);
  }

  // Calculate perpendicular distance using cross product
  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const denominator = Math.sqrt(dx * dx + dy * dy);

  return numerator / denominator;
}

/**
 * Euclidean distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance from point to line segment and return the closest point
 * (accounts for segment endpoints, not just infinite line)
 * 
 * @returns Object with distance and the closest point on the segment
 */
function pointToSegmentDistanceWithPoint(
  point: Point,
  segStart: Point,
  segEnd: Point
): { distance: number; closestPoint: Point } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Segment is actually a point
    return {
      distance: distance(point, segStart),
      closestPoint: segStart,
    };
  }

  // Calculate projection parameter t
  // t = 0 means point projects to segStart
  // t = 1 means point projects to segEnd
  // 0 < t < 1 means point projects onto the segment
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSquared;

  // Clamp t to [0, 1] to stay within segment bounds
  t = Math.max(0, Math.min(1, t));

  // Calculate closest point on segment
  const closestPoint = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };

  return {
    distance: distance(point, closestPoint),
    closestPoint,
  };
}

/**
 * Find the closest point on a path to a given point
 * Returns the closest point and the segment index it belongs to
 */
function findClosestPointOnPath(
  point: Point,
  pathPoints: number[]
): { point: Point; segmentIndex: number; distance: number } | null {
  if (pathPoints.length < 4) {
    return null;
  }

  let minDistance = Infinity;
  let closestPoint: Point | null = null;
  let closestSegmentIndex = -1;

  // Check each segment
  for (let i = 0; i < pathPoints.length - 2; i += 2) {
    const segStart = { x: pathPoints[i], y: pathPoints[i + 1] };
    const segEnd = { x: pathPoints[i + 2], y: pathPoints[i + 3] };

    const result = pointToSegmentDistanceWithPoint(point, segStart, segEnd);

    if (result.distance < minDistance) {
      minDistance = result.distance;
      closestPoint = result.closestPoint;
      closestSegmentIndex = i / 2;
    }
  }

  if (closestPoint === null) {
    return null;
  }

  return {
    point: closestPoint,
    segmentIndex: closestSegmentIndex,
    distance: minDistance,
  };
}

/**
 * Snap a point to the nearest point on existing paths if within threshold
 *
 * @param point - Point to snap
 * @param existingPaths - Array of existing wall paths (each is a flat number array)
 * @param threshold - Maximum distance for snapping (pixels)
 * @returns Snapped point or original point if no snap found
 */
export function snapPointToPaths(
  point: Point,
  existingPaths: number[][],
  threshold: number
): { point: Point; snapped: boolean; pathIndex: number } {
  let bestSnapPoint = point;
  let minDistance = threshold;
  let snapped = false;
  let pathIndex = -1;

  for (let i = 0; i < existingPaths.length; i++) {
    const path = existingPaths[i];
    const result = findClosestPointOnPath(point, path);

    if (result && result.distance < minDistance) {
      minDistance = result.distance;
      bestSnapPoint = result.point;
      snapped = true;
      pathIndex = i;
    }
  }

  return { point: bestSnapPoint, snapped, pathIndex };
}
