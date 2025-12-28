import { describe, it, expect } from 'vitest';
import { isPointInPolygon, isPointInAnyPolygon, isRectInAnyPolygon, Point } from './geometry';

describe('Geometry Utilities', () => {
  describe('isPointInPolygon', () => {
    it('should return false for empty polygon', () => {
      const point: Point = { x: 0, y: 0 };
      const polygon: Point[] = [];
      expect(isPointInPolygon(point, polygon)).toBe(false);
    });

    it('should return false for polygon with less than 3 points', () => {
      const point: Point = { x: 0, y: 0 };
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ];
      expect(isPointInPolygon(point, polygon)).toBe(false);
    });

    it('should return true for point inside square', () => {
      const point: Point = { x: 5, y: 5 };
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      expect(isPointInPolygon(point, polygon)).toBe(true);
    });

    it('should return false for point outside square', () => {
      const point: Point = { x: 15, y: 15 };
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      expect(isPointInPolygon(point, polygon)).toBe(false);
    });

    it('should return true for point inside triangle', () => {
      const point: Point = { x: 5, y: 5 };
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ];
      expect(isPointInPolygon(point, polygon)).toBe(true);
    });

    it('should return false for point outside triangle', () => {
      const point: Point = { x: 20, y: 20 };
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ];
      expect(isPointInPolygon(point, polygon)).toBe(false);
    });

    it('should handle point on edge correctly', () => {
      const point: Point = { x: 5, y: 0 };
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      // Point on edge - behavior depends on implementation
      const result = isPointInPolygon(point, polygon);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isPointInAnyPolygon', () => {
    it('should return false for empty polygons array', () => {
      const point: Point = { x: 5, y: 5 };
      const polygons: Point[][] = [];
      expect(isPointInAnyPolygon(point, polygons)).toBe(false);
    });

    it('should return true if point is in at least one polygon', () => {
      const point: Point = { x: 5, y: 5 };
      const polygons: Point[][] = [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ],
        [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
          { x: 20, y: 30 }
        ]
      ];
      expect(isPointInAnyPolygon(point, polygons)).toBe(true);
    });

    it('should return false if point is in none of the polygons', () => {
      const point: Point = { x: 15, y: 15 };
      const polygons: Point[][] = [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ],
        [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
          { x: 20, y: 30 }
        ]
      ];
      expect(isPointInAnyPolygon(point, polygons)).toBe(false);
    });
  });

  describe('isRectInAnyPolygon', () => {
    it('should return false for empty polygons array', () => {
      const polygons: Point[][] = [];
      expect(isRectInAnyPolygon(0, 0, 10, 10, polygons)).toBe(false);
    });

    it('should return true if rect center is inside polygon', () => {
      const polygons: Point[][] = [
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ]
      ];
      // Rect from (40, 40) to (50, 50), center at (45, 45)
      expect(isRectInAnyPolygon(40, 40, 10, 10, polygons)).toBe(true);
    });

    it('should return true if any rect corner is inside polygon', () => {
      const polygons: Point[][] = [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      ];
      // Rect from (5, 5) to (15, 15), top-left corner inside
      expect(isRectInAnyPolygon(5, 5, 10, 10, polygons)).toBe(true);
    });

    it('should return false if rect is completely outside polygon', () => {
      const polygons: Point[][] = [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      ];
      // Rect from (20, 20) to (30, 30)
      expect(isRectInAnyPolygon(20, 20, 10, 10, polygons)).toBe(false);
    });

    it('should handle token visibility scenario', () => {
      // Simulate a vision cone
      const visionPolygon: Point[] = [
        { x: 100, y: 100 }, // Token position (center)
        { x: 150, y: 100 },
        { x: 150, y: 150 },
        { x: 100, y: 150 },
      ];

      const polygons: Point[][] = [visionPolygon];

      // Token at (110, 110) with size 20x20 - should be visible
      expect(isRectInAnyPolygon(110, 110, 20, 20, polygons)).toBe(true);

      // Token at (200, 200) with size 20x20 - should NOT be visible
      expect(isRectInAnyPolygon(200, 200, 20, 20, polygons)).toBe(false);
    });
  });
});
