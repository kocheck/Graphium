import { describe, it, expect } from 'vitest';
import { simplifyPath, snapPointToPaths } from './pathOptimization';
import type { Point } from '../types/geometry';

describe('simplifyPath', () => {
  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      const result = simplifyPath([], 3.0);
      expect(result).toEqual([]);
    });

    it('should return single point unchanged', () => {
      const points = [10, 20];
      const result = simplifyPath(points, 3.0);
      expect(result).toEqual(points);
    });

    it('should return two points unchanged', () => {
      const points = [10, 20, 30, 40];
      const result = simplifyPath(points, 3.0);
      expect(result).toEqual(points);
    });
  });

  describe('straight line simplification', () => {
    it('should simplify collinear points to endpoints only', () => {
      // Straight horizontal line with intermediate points
      const points = [0, 0, 10, 0, 20, 0, 30, 0, 40, 0];
      const result = simplifyPath(points, 1.0);
      // All intermediate points should be removed (they're on the line)
      expect(result).toEqual([0, 0, 40, 0]);
    });

    it('should simplify collinear diagonal points', () => {
      // Straight diagonal line (45 degrees)
      const points = [0, 0, 10, 10, 20, 20, 30, 30, 40, 40];
      const result = simplifyPath(points, 1.0);
      expect(result).toEqual([0, 0, 40, 40]);
    });
  });

  describe('path smoothing with epsilon', () => {
    it('should keep points that deviate beyond epsilon', () => {
      // Path with a significant bend: (0,0) -> (50,0) -> (50,50)
      const points = [0, 0, 50, 0, 50, 50];
      const result = simplifyPath(points, 1.0);
      // Middle point should be kept because it's far from the direct line
      expect(result).toEqual([0, 0, 50, 0, 50, 50]);
    });

    it('should remove points within epsilon tolerance', () => {
      // Nearly straight line with small deviation
      const points = [0, 0, 50, 1, 100, 0]; // middle point deviates by 1px
      const result = simplifyPath(points, 2.0); // epsilon = 2px
      // Middle point should be removed (deviation < epsilon)
      expect(result).toEqual([0, 0, 100, 0]);
    });

    it('should be more aggressive with higher epsilon', () => {
      // Wavy line that can be simplified
      const points = [0, 0, 10, 2, 20, 1, 30, 3, 40, 0];
      const resultLow = simplifyPath(points, 1.0);
      const resultHigh = simplifyPath(points, 5.0);

      // Higher epsilon should produce fewer points
      expect(resultHigh.length).toBeLessThanOrEqual(resultLow.length);
      // With high epsilon, might simplify to just endpoints
      expect(resultHigh).toEqual([0, 0, 40, 0]);
    });
  });

  describe('realistic wall paths', () => {
    it('should reduce jittery hand-drawn wall', () => {
      // Simulate a hand-drawn wall with minor jitter
      const jitteryWall = [
        0, 0, 10, 1, 20, -1, 30, 2, 40, 0, 50, 1, 60, -1, 70, 1, 80, 0, 90, 2, 100, 0,
      ];

      const smoothed = simplifyPath(jitteryWall, 3.0);

      // Should significantly reduce point count
      expect(smoothed.length).toBeLessThan(jitteryWall.length);
      // Should still start and end at same points
      expect(smoothed[0]).toBe(0);
      expect(smoothed[1]).toBe(0);
      expect(smoothed[smoothed.length - 2]).toBe(100);
      expect(smoothed[smoothed.length - 1]).toBe(0);
    });

    it('should preserve important corners in L-shaped wall', () => {
      // L-shaped wall: horizontal then vertical
      const lWall = [0, 0, 50, 0, 100, 0, 100, 50, 100, 100];
      const result = simplifyPath(lWall, 1.0);

      // Should keep the corner point at (100, 0)
      expect(result).toContain(100);
      expect(result).toContain(0);
      // Should have at least 3 points (start, corner, end)
      expect(result.length).toBeGreaterThanOrEqual(6); // 3 points = 6 values
    });
  });

  describe('minimum points requirement', () => {
    it('should handle paths at minimum length (4 values = 2 points)', () => {
      const points = [0, 0, 100, 100];
      const result = simplifyPath(points, 10.0);
      expect(result).toEqual(points);
    });
  });
});

describe('snapPointToPaths', () => {
  const threshold = 10;

  describe('empty or invalid input', () => {
    it('should return original point when no paths exist', () => {
      const point: Point = { x: 50, y: 50 };
      const result = snapPointToPaths(point, [], threshold);

      expect(result.point).toEqual(point);
      expect(result.snapped).toBe(false);
      expect(result.pathIndex).toBe(-1);
    });

    it('should return original point when paths are too short', () => {
      const point: Point = { x: 50, y: 50 };
      const invalidPaths = [
        [10, 20], // Only 1 point (2 values)
      ];
      const result = snapPointToPaths(point, invalidPaths, threshold);

      expect(result.point).toEqual(point);
      expect(result.snapped).toBe(false);
    });
  });

  describe('snapping within threshold', () => {
    it('should snap to horizontal line within threshold', () => {
      const point: Point = { x: 50, y: 8 }; // 8px above a horizontal line
      const paths = [
        [0, 0, 100, 0], // Horizontal line at y=0
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      expect(result.pathIndex).toBe(0);
      expect(result.point.x).toBe(50); // Same x
      expect(result.point.y).toBe(0); // Snapped to y=0
    });

    it('should snap to vertical line within threshold', () => {
      const point: Point = { x: 8, y: 50 }; // 8px left of a vertical line
      const paths = [
        [0, 0, 0, 100], // Vertical line at x=0
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      expect(result.point.x).toBe(0); // Snapped to x=0
      expect(result.point.y).toBe(50); // Same y
    });

    it('should snap to diagonal line within threshold', () => {
      const point: Point = { x: 52, y: 52 }; // Near 45° line
      const paths = [
        [0, 0, 100, 100], // 45° diagonal
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      // Should snap to closest point on the diagonal
      expect(result.point.x).toBeCloseTo(52, 0);
      expect(result.point.y).toBeCloseTo(52, 0);
    });
  });

  describe('no snapping beyond threshold', () => {
    it('should not snap when distance exceeds threshold', () => {
      const point: Point = { x: 50, y: 20 }; // 20px above line
      const paths = [
        [0, 0, 100, 0], // Horizontal line
      ];
      const result = snapPointToPaths(point, paths, 10); // threshold = 10px

      expect(result.snapped).toBe(false);
      expect(result.point).toEqual(point); // Unchanged
    });
  });

  describe('multiple paths', () => {
    it('should snap to closest path when multiple paths exist', () => {
      const point: Point = { x: 50, y: 25 };
      const paths = [
        [0, 0, 100, 0], // Path 0: y=0 (distance = 25px)
        [0, 30, 100, 30], // Path 1: y=30 (distance = 5px) <- closest
        [0, 60, 100, 60], // Path 2: y=60 (distance = 35px)
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      expect(result.pathIndex).toBe(1); // Should snap to path 1
      expect(result.point.y).toBe(30);
    });

    it('should choose the absolute closest point across all paths', () => {
      const point: Point = { x: 50, y: 50 };
      const paths = [
        [0, 55, 100, 55], // Path 0: distance = 5px
        [48, 0, 48, 100], // Path 1: distance = 2px <- closest
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      expect(result.pathIndex).toBe(1);
      expect(result.point.x).toBe(48);
    });
  });

  describe('endpoint and segment snapping', () => {
    it('should snap to line endpoints', () => {
      const point: Point = { x: 3, y: 3 };
      const paths = [
        [0, 0, 100, 0], // Start at (0,0)
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      expect(result.point).toEqual({ x: 0, y: 0 }); // Snapped to endpoint
    });

    it('should snap to middle of segment', () => {
      const point: Point = { x: 50, y: 5 };
      const paths = [
        [0, 0, 100, 0], // Horizontal line
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      expect(result.point.x).toBe(50); // Middle of segment
      expect(result.point.y).toBe(0);
    });

    it('should snap to closest segment in multi-segment path', () => {
      const point: Point = { x: 150, y: 5 };
      const paths = [
        [0, 0, 100, 0, 200, 0], // Two segments: (0,0)-(100,0) and (100,0)-(200,0)
      ];
      const result = snapPointToPaths(point, paths, threshold);

      expect(result.snapped).toBe(true);
      expect(result.point.x).toBe(150); // On second segment
      expect(result.point.y).toBe(0);
    });
  });

  describe('realistic wall snapping scenarios', () => {
    it('should connect new wall to existing wall endpoint', () => {
      // Existing wall
      const existingWalls = [
        [100, 100, 200, 100], // Horizontal wall
      ];

      // User draws new wall starting near endpoint
      const newWallStart: Point = { x: 203, y: 97 };
      const result = snapPointToPaths(newWallStart, existingWalls, 10);

      expect(result.snapped).toBe(true);
      expect(result.point).toEqual({ x: 200, y: 100 }); // Snapped to endpoint
    });

    it('should not snap when walls are far apart', () => {
      const existingWalls = [[0, 0, 100, 0]];

      const newWallStart: Point = { x: 500, y: 500 };
      const result = snapPointToPaths(newWallStart, existingWalls, 10);

      expect(result.snapped).toBe(false);
      expect(result.point).toEqual(newWallStart);
    });
  });

  describe('configurable threshold', () => {
    it('should respect different threshold values', () => {
      const point: Point = { x: 50, y: 15 };
      const paths = [[0, 0, 100, 0]];

      // With strict threshold
      const strictResult = snapPointToPaths(point, paths, 10);
      expect(strictResult.snapped).toBe(false);

      // With lenient threshold
      const lenientResult = snapPointToPaths(point, paths, 20);
      expect(lenientResult.snapped).toBe(true);
      expect(lenientResult.point.y).toBe(0);
    });
  });
});
