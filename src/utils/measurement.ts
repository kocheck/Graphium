/**
 * Measurement and AoE (Area of Effect) utility functions
 *
 * Provides geometry calculations for D&D 5e measurement tools:
 * - Distance measurement (Ruler)
 * - Circular AoE (Blast/Fireball)
 * - Cone AoE (Burning Hands, etc.)
 */

import { Point } from '../types/geometry';

/**
 * D&D 5e distance calculation modes
 */
export enum DistanceMode {
  /** Simple Euclidean distance */
  EUCLIDEAN = 'euclidean',

  /** D&D 5e "5-10-5" diagonal rule: first diagonal costs 5ft, second costs 10ft, alternating */
  DND_5E = 'dnd5e',
}

/**
 * Calculates Euclidean distance between two points
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance in pixels
 */
export const euclideanDistance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculates distance in grid cells using D&D 5e "5-10-5" diagonal rule
 *
 * In D&D 5e, diagonal movement alternates cost:
 * - First diagonal: 5 feet (1 square)
 * - Second diagonal: 10 feet (2 squares)
 * - Third diagonal: 5 feet (1 square)
 * - And so on...
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @param gridSize - Size of one grid cell in pixels
 * @returns Distance in grid cells
 */
export const dnd5eDistance = (p1: Point, p2: Point, gridSize: number): number => {
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);

  const cellsX = Math.round(dx / gridSize);
  const cellsY = Math.round(dy / gridSize);

  // Minimum of horizontal and vertical = diagonal squares
  // Maximum - minimum = remaining straight squares
  const diagonals = Math.min(cellsX, cellsY);
  const straight = Math.max(cellsX, cellsY) - diagonals;

  // Diagonals cost: 1, 2, 1, 2, 1, 2... (alternating 5ft and 10ft)
  // For every 2 diagonals, cost is 3 squares (5ft + 10ft = 15ft = 3 squares)
  const diagonalPairs = Math.floor(diagonals / 2);
  const remainingDiagonal = diagonals % 2;

  const totalCells = (diagonalPairs * 3) + remainingDiagonal + straight;
  return totalCells;
};

/**
 * Converts distance in pixels to feet for display
 *
 * Assumes 1 grid square = 5 feet
 *
 * @param pixelDistance - Distance in pixels
 * @param gridSize - Size of one grid cell in pixels
 * @param mode - Distance calculation mode (Euclidean or D&D 5e)
 * @param p1 - First point (required for D&D 5e mode)
 * @param p2 - Second point (required for D&D 5e mode)
 * @returns Distance in feet
 */
export const pixelsToFeet = (
  pixelDistance: number,
  gridSize: number,
  mode: DistanceMode = DistanceMode.EUCLIDEAN,
  p1?: Point,
  p2?: Point
): number => {
  if (mode === DistanceMode.DND_5E && p1 && p2) {
    const cells = dnd5eDistance(p1, p2, gridSize);
    return cells * 5; // Each cell = 5 feet
  }

  // Euclidean mode
  const cells = pixelDistance / gridSize;
  return Math.round(cells * 5); // Each cell = 5 feet
};

/**
 * Calculates the angle in radians from p1 to p2
 *
 * @param p1 - Origin point
 * @param p2 - Target point
 * @returns Angle in radians
 */
export const calculateAngle = (p1: Point, p2: Point): number => {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
};

/**
 * Calculates the angle in degrees from p1 to p2
 *
 * @param p1 - Origin point
 * @param p2 - Target point
 * @returns Angle in degrees (0-360)
 */
export const calculateAngleDegrees = (p1: Point, p2: Point): number => {
  const radians = calculateAngle(p1, p2);
  const degrees = (radians * 180) / Math.PI;
  return degrees >= 0 ? degrees : degrees + 360;
};

/**
 * Calculates the three vertices of a D&D cone
 *
 * D&D 5e cones are typically 53 degrees (±26.5 degrees from center axis)
 * The start point is the origin, and the mouse cursor defines the
 * cone's direction and length.
 *
 * @param origin - The point where the cone originates
 * @param target - The point the cone is aimed at (cursor position)
 * @param coneAngleDegrees - Total cone angle in degrees (default: 53)
 * @returns Array of 3 points forming the cone triangle [origin, left vertex, right vertex]
 */
export const calculateConeVertices = (
  origin: Point,
  target: Point,
  coneAngleDegrees: number = 53
): [Point, Point, Point] => {
  // Calculate the central axis angle
  const centralAngle = calculateAngle(origin, target);
  const length = euclideanDistance(origin, target);

  // Half of the cone angle in radians
  const halfConeAngle = (coneAngleDegrees / 2) * (Math.PI / 180);

  // Calculate left and right vertex angles
  const leftAngle = centralAngle + halfConeAngle;
  const rightAngle = centralAngle - halfConeAngle;

  // Calculate left and right vertices
  const leftVertex: Point = {
    x: origin.x + length * Math.cos(leftAngle),
    y: origin.y + length * Math.sin(leftAngle),
  };

  const rightVertex: Point = {
    x: origin.x + length * Math.cos(rightAngle),
    y: origin.y + length * Math.sin(rightAngle),
  };

  return [origin, leftVertex, rightVertex];
};

/**
 * Formats distance for display
 *
 * @param feet - Distance in feet
 * @returns Formatted string (e.g., "30ft")
 */
export const formatDistance = (feet: number): string => {
  return `${feet}ft`;
};

/**
 * Formats area for display (for circular AoE)
 *
 * @param radiusFeet - Radius in feet
 * @returns Formatted string (e.g., "20ft radius")
 */
export const formatRadius = (radiusFeet: number): string => {
  return `${radiusFeet}ft radius`;
};

/**
 * Formats cone information for display
 *
 * @param lengthFeet - Length of the cone in feet
 * @param angleDegrees - Cone angle in degrees
 * @returns Formatted string (e.g., "30ft 53° cone")
 */
export const formatCone = (lengthFeet: number, angleDegrees: number = 53): string => {
  return `${lengthFeet}ft ${angleDegrees}° cone`;
};
