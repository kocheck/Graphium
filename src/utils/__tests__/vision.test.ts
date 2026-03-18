import { describe, it, expect } from 'vitest';

import {
  castRay,
  lineSegmentIntersection,
  calculateVisibilityPolygon,
  getWallSegments,
} from '../vision';

import type { WallSegment } from '../../types/geometry';
import type { Drawing, Door } from '../../types/domain';

describe('vision', () => {
  describe('lineSegmentIntersection', () => {
    it('detects crossing segments', () => {
      // Horizontal line from (0,5) to (10,5) vs vertical from (5,0) to (5,10)
      const result = lineSegmentIntersection(0, 5, 10, 5, 5, 0, 5, 10);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(5);
      expect(result!.y).toBeCloseTo(5);
    });

    it('returns null for parallel segments', () => {
      // Two horizontal lines
      const result = lineSegmentIntersection(0, 0, 10, 0, 0, 5, 10, 5);
      expect(result).toBeNull();
    });

    it('returns null for non-intersecting segments', () => {
      // Two segments that would intersect if extended, but don't actually touch
      const result = lineSegmentIntersection(0, 0, 1, 0, 5, 5, 5, 10);
      expect(result).toBeNull();
    });

    it('detects intersection at segment endpoints', () => {
      // T-junction: horizontal from (0,5) to (10,5) meets vertical at (5,5) to (5,10)
      const result = lineSegmentIntersection(0, 5, 10, 5, 5, 5, 5, 10);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(5);
      expect(result!.y).toBeCloseTo(5);
    });

    it('handles diagonal segments', () => {
      // Diagonal from (0,0) to (10,10) vs (0,10) to (10,0)
      const result = lineSegmentIntersection(0, 0, 10, 10, 0, 10, 10, 0);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(5);
      expect(result!.y).toBeCloseTo(5);
    });

    it('returns null for collinear non-overlapping segments', () => {
      // Same line but non-overlapping ranges
      const result = lineSegmentIntersection(0, 0, 1, 0, 5, 0, 10, 0);
      expect(result).toBeNull();
    });
  });

  describe('castRay', () => {
    it('returns max range point with no walls', () => {
      const result = castRay(0, 0, 0, 100, []);
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(0);
    });

    it('returns max range point along angle with no walls', () => {
      // 90 degrees (straight down in screen coords)
      const result = castRay(0, 0, Math.PI / 2, 100, []);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(100);
    });

    it('stops at a wall', () => {
      const walls: WallSegment[] = [{ start: { x: 50, y: -100 }, end: { x: 50, y: 100 } }];
      // Ray going right from origin (angle 0)
      const result = castRay(0, 0, 0, 200, walls);
      expect(result.x).toBeCloseTo(50);
      expect(result.y).toBeCloseTo(0);
    });

    it('picks the closest wall when multiple intersect', () => {
      const walls: WallSegment[] = [
        { start: { x: 50, y: -100 }, end: { x: 50, y: 100 } },
        { start: { x: 100, y: -100 }, end: { x: 100, y: 100 } },
      ];
      const result = castRay(0, 0, 0, 200, walls);
      expect(result.x).toBeCloseTo(50);
    });

    it('ignores walls behind the ray origin', () => {
      const walls: WallSegment[] = [{ start: { x: -50, y: -100 }, end: { x: -50, y: 100 } }];
      // Ray going right
      const result = castRay(0, 0, 0, 100, walls);
      expect(result.x).toBeCloseTo(100);
    });

    it('ignores walls beyond max range', () => {
      const walls: WallSegment[] = [{ start: { x: 200, y: -100 }, end: { x: 200, y: 100 } }];
      const result = castRay(0, 0, 0, 100, walls);
      expect(result.x).toBeCloseTo(100);
    });
  });

  describe('calculateVisibilityPolygon', () => {
    it('returns a circle with no walls', () => {
      const polygon = calculateVisibilityPolygon(0, 0, 100, [], 360);
      expect(polygon).toHaveLength(360);

      // All points should be at max range distance from origin
      polygon.forEach((point) => {
        const distance = Math.hypot(point.x, point.y);
        expect(distance).toBeCloseTo(100, 0);
      });
    });

    it('respects custom ray count', () => {
      const polygon = calculateVisibilityPolygon(0, 0, 50, [], 36);
      expect(polygon).toHaveLength(36);
    });

    it('creates indentation where wall blocks vision', () => {
      // Wall at x=50, blocking rightward vision
      const walls: WallSegment[] = [{ start: { x: 50, y: -200 }, end: { x: 50, y: 200 } }];
      const polygon = calculateVisibilityPolygon(0, 0, 100, walls, 360);

      // Points facing right (around angle 0) should be closer than 100
      // Angle 0 = index 0, the ray goes right
      const rightPoint = polygon[0]!;
      expect(rightPoint.x).toBeCloseTo(50, 0);

      // Points facing left (around angle 180) should still be at max range
      // Angle PI = index 180
      const leftPoint = polygon[180]!;
      const leftDistance = Math.hypot(leftPoint.x, leftPoint.y);
      expect(leftDistance).toBeCloseTo(100, 0);
    });

    it('handles origin offset', () => {
      const polygon = calculateVisibilityPolygon(100, 200, 50, [], 4);
      expect(polygon).toHaveLength(4);

      // All points should be 50 units from (100, 200)
      polygon.forEach((point) => {
        const distance = Math.hypot(point.x - 100, point.y - 200);
        expect(distance).toBeCloseTo(50, 0);
      });
    });

    it('wall blocks only affected rays', () => {
      // Short wall segment that only blocks a narrow angle
      const walls: WallSegment[] = [{ start: { x: 50, y: -5 }, end: { x: 50, y: 5 } }];
      const polygon = calculateVisibilityPolygon(0, 0, 100, walls, 360);

      // Most points should be at max range
      const pointsAtMaxRange = polygon.filter((p) => {
        const dist = Math.hypot(p.x, p.y);
        return Math.abs(dist - 100) < 1;
      });
      // The majority should be at max range since the wall is small
      // A 10px wall at 50px distance subtends ~11.4° ≈ 12 rays blocked
      expect(pointsAtMaxRange.length).toBeGreaterThan(340);
    });
  });

  describe('getWallSegments', () => {
    it('returns empty for no drawings and no doors', () => {
      const result = getWallSegments([], []);
      expect(result).toHaveLength(0);
    });

    it('extracts segments from wall drawings', () => {
      const drawings: Drawing[] = [
        {
          id: 'wall-1',
          tool: 'wall',
          points: [0, 0, 100, 0, 100, 100],
          color: '#000',
          strokeWidth: 2,
          x: 0,
          y: 0,
          scale: 1,
        },
      ];
      const result = getWallSegments(drawings, []);
      // 6 points = 3 coordinate pairs → 2 segments
      expect(result).toHaveLength(2);
      expect(result[0]!.start).toEqual({ x: 0, y: 0 });
      expect(result[0]!.end).toEqual({ x: 100, y: 0 });
      expect(result[1]!.start).toEqual({ x: 100, y: 0 });
      expect(result[1]!.end).toEqual({ x: 100, y: 100 });
    });

    it('ignores non-wall drawings', () => {
      const drawings: Drawing[] = [
        {
          id: 'marker-1',
          tool: 'marker',
          points: [0, 0, 50, 50],
          color: '#f00',
          strokeWidth: 3,
          x: 0,
          y: 0,
          scale: 1,
        },
      ];
      const result = getWallSegments(drawings, []);
      expect(result).toHaveLength(0);
    });

    it('applies drawing transform to wall points', () => {
      const drawings: Drawing[] = [
        {
          id: 'wall-1',
          tool: 'wall',
          points: [0, 0, 10, 0],
          color: '#000',
          strokeWidth: 2,
          x: 50,
          y: 100,
          scale: 2,
        },
      ];
      const result = getWallSegments(drawings, []);
      expect(result).toHaveLength(1);
      // Point (0,0) with scale 2 + offset (50,100) = (50, 100)
      expect(result[0]!.start).toEqual({ x: 50, y: 100 });
      // Point (10,0) with scale 2 + offset (50,100) = (70, 100)
      expect(result[0]!.end).toEqual({ x: 70, y: 100 });
    });

    it('adds closed doors as wall segments', () => {
      const doors: Door[] = [
        {
          id: 'door-1',
          x: 100,
          y: 200,
          size: 50,
          orientation: 'horizontal',
          isOpen: false,
          isLocked: false,
        },
      ];
      const result = getWallSegments([], doors);
      expect(result).toHaveLength(1);
      // Horizontal door centered at (100,200) with size 50
      expect(result[0]!.start).toEqual({ x: 75, y: 200 });
      expect(result[0]!.end).toEqual({ x: 125, y: 200 });
    });

    it('adds vertical closed doors correctly', () => {
      const doors: Door[] = [
        {
          id: 'door-2',
          x: 100,
          y: 200,
          size: 50,
          orientation: 'vertical',
          isOpen: false,
          isLocked: false,
        },
      ];
      const result = getWallSegments([], doors);
      expect(result).toHaveLength(1);
      expect(result[0]!.start).toEqual({ x: 100, y: 175 });
      expect(result[0]!.end).toEqual({ x: 100, y: 225 });
    });

    it('excludes open doors', () => {
      const doors: Door[] = [
        {
          id: 'door-open',
          x: 100,
          y: 200,
          size: 50,
          orientation: 'horizontal',
          isOpen: true,
          isLocked: false,
        },
      ];
      const result = getWallSegments([], doors);
      expect(result).toHaveLength(0);
    });

    it('handles mix of open and closed doors', () => {
      const doors: Door[] = [
        {
          id: 'door-closed',
          x: 100,
          y: 100,
          size: 50,
          orientation: 'horizontal',
          isOpen: false,
          isLocked: false,
        },
        {
          id: 'door-open',
          x: 200,
          y: 200,
          size: 50,
          orientation: 'vertical',
          isOpen: true,
          isLocked: false,
        },
        {
          id: 'door-locked-closed',
          x: 300,
          y: 300,
          size: 40,
          orientation: 'vertical',
          isOpen: false,
          isLocked: true,
        },
      ];
      const result = getWallSegments([], doors);
      // Only the 2 closed doors become wall segments
      expect(result).toHaveLength(2);
    });

    it('combines walls from drawings and doors', () => {
      const drawings: Drawing[] = [
        {
          id: 'wall-1',
          tool: 'wall',
          points: [0, 0, 100, 0],
          color: '#000',
          strokeWidth: 2,
          x: 0,
          y: 0,
          scale: 1,
        },
      ];
      const doors: Door[] = [
        {
          id: 'door-1',
          x: 100,
          y: 100,
          size: 50,
          orientation: 'horizontal',
          isOpen: false,
          isLocked: false,
        },
      ];
      const result = getWallSegments(drawings, doors);
      expect(result).toHaveLength(2); // 1 from drawing + 1 from door
    });
  });
});
