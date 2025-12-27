/**
 * Shared geometry type definitions
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
