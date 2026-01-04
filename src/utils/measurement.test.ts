import { describe, it, expect } from 'vitest';
import {
  euclideanDistance,
  dnd5eDistance,
  pixelsToFeet,
  calculateAngle,
  calculateAngleDegrees,
  calculateConeVertices,
  formatDistance,
  formatRadius,
  formatCone,
  DistanceMode,
} from './measurement';
import { Point } from '../types/geometry';

describe('measurement utilities', () => {
  describe('euclideanDistance', () => {
    it('should calculate distance between two points', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 3, y: 4 };
      expect(euclideanDistance(p1, p2)).toBe(5); // 3-4-5 triangle
    });

    it('should handle horizontal distance', () => {
      const p1: Point = { x: 10, y: 20 };
      const p2: Point = { x: 50, y: 20 };
      expect(euclideanDistance(p1, p2)).toBe(40);
    });

    it('should handle vertical distance', () => {
      const p1: Point = { x: 10, y: 20 };
      const p2: Point = { x: 10, y: 80 };
      expect(euclideanDistance(p1, p2)).toBe(60);
    });

    it('should handle negative coordinates', () => {
      const p1: Point = { x: -10, y: -10 };
      const p2: Point = { x: -7, y: -6 };
      expect(euclideanDistance(p1, p2)).toBe(5); // 3-4-5 triangle
    });

    it('should return 0 for identical points', () => {
      const p1: Point = { x: 42, y: 73 };
      const p2: Point = { x: 42, y: 73 };
      expect(euclideanDistance(p1, p2)).toBe(0);
    });

    it('should handle decimal coordinates', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 1.5, y: 2 };
      expect(euclideanDistance(p1, p2)).toBeCloseTo(2.5);
    });
  });

  describe('dnd5eDistance', () => {
    const gridSize = 50;

    it('should calculate straight horizontal movement', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 200, y: 0 }; // 4 cells horizontally
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(4);
    });

    it('should calculate straight vertical movement', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 0, y: 150 }; // 3 cells vertically
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(3);
    });

    it('should calculate single diagonal (costs 1 square)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 50, y: 50 }; // 1 diagonal
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(1);
    });

    it('should calculate two diagonals (costs 3 squares: 5ft + 10ft)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 100, y: 100 }; // 2 diagonals
      // 2 diagonals = 1 pair * 3 = 3 cells
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(3);
    });

    it('should calculate three diagonals (costs 4 squares: 5ft + 10ft + 5ft)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 150, y: 150 }; // 3 diagonals
      // 3 diagonals = 1 pair (3) + 1 remaining (1) = 4 cells
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(4);
    });

    it('should calculate four diagonals (costs 6 squares)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 200, y: 200 }; // 4 diagonals
      // 4 diagonals = 2 pairs * 3 = 6 cells
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(6);
    });

    it('should calculate mixed diagonal and straight movement', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 150, y: 100 }; // 3 cells horizontal, 2 cells vertical
      // 2 diagonals (3 squares) + 1 straight (1 square) = 4 squares
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(4);
    });

    it('should handle negative coordinates', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: -100, y: -100 }; // 2 diagonals in negative direction
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(3);
    });

    it('should handle movement in all four quadrants', () => {
      const p1: Point = { x: 100, y: 100 };
      const p2: Point = { x: -100, y: -100 }; // 4 cells each direction
      // 4 diagonals = 2 pairs * 3 = 6 cells
      expect(dnd5eDistance(p1, p2, gridSize)).toBe(6);
    });
  });

  describe('pixelsToFeet', () => {
    const gridSize = 50;

    describe('EUCLIDEAN mode', () => {
      it('should convert one grid cell to 5 feet', () => {
        expect(pixelsToFeet(50, gridSize, DistanceMode.EUCLIDEAN)).toBe(5);
      });

      it('should convert multiple cells to feet', () => {
        expect(pixelsToFeet(200, gridSize, DistanceMode.EUCLIDEAN)).toBe(20);
      });

      it('should round fractional cells', () => {
        expect(pixelsToFeet(75, gridSize, DistanceMode.EUCLIDEAN)).toBe(8); // 1.5 cells * 5 = 7.5 → 8
      });

      it('should handle zero distance', () => {
        expect(pixelsToFeet(0, gridSize, DistanceMode.EUCLIDEAN)).toBe(0);
      });
    });

    describe('DND_5E mode', () => {
      it('should use dnd5eDistance when points are provided', () => {
        const p1: Point = { x: 0, y: 0 };
        const p2: Point = { x: 100, y: 100 }; // 2 diagonals = 3 cells = 15ft
        const pixelDist = euclideanDistance(p1, p2);
        expect(pixelsToFeet(pixelDist, gridSize, DistanceMode.DND_5E, p1, p2)).toBe(15);
      });

      it('should handle straight movement', () => {
        const p1: Point = { x: 0, y: 0 };
        const p2: Point = { x: 200, y: 0 }; // 4 cells = 20ft
        const pixelDist = euclideanDistance(p1, p2);
        expect(pixelsToFeet(pixelDist, gridSize, DistanceMode.DND_5E, p1, p2)).toBe(20);
      });

      it('should fall back to EUCLIDEAN if points not provided', () => {
        expect(pixelsToFeet(100, gridSize, DistanceMode.DND_5E)).toBe(10);
      });
    });
  });

  describe('calculateAngle', () => {
    it('should calculate angle to the right (0 radians)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 10, y: 0 };
      expect(calculateAngle(p1, p2)).toBeCloseTo(0);
    });

    it('should calculate angle upward (-π/2 radians)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 0, y: -10 };
      expect(calculateAngle(p1, p2)).toBeCloseTo(-Math.PI / 2);
    });

    it('should calculate angle downward (π/2 radians)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 0, y: 10 };
      expect(calculateAngle(p1, p2)).toBeCloseTo(Math.PI / 2);
    });

    it('should calculate angle to the left (π radians)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: -10, y: 0 };
      expect(Math.abs(calculateAngle(p1, p2))).toBeCloseTo(Math.PI);
    });

    it('should calculate 45-degree angle', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 10, y: 10 };
      expect(calculateAngle(p1, p2)).toBeCloseTo(Math.PI / 4);
    });
  });

  describe('calculateAngleDegrees', () => {
    it('should convert angle to degrees (0-360 range)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 10, y: 0 };
      expect(calculateAngleDegrees(p1, p2)).toBeCloseTo(0);
    });

    it('should handle upward direction (270 degrees)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 0, y: -10 };
      expect(calculateAngleDegrees(p1, p2)).toBeCloseTo(270);
    });

    it('should handle downward direction (90 degrees)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 0, y: 10 };
      expect(calculateAngleDegrees(p1, p2)).toBeCloseTo(90);
    });

    it('should handle left direction (180 degrees)', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: -10, y: 0 };
      expect(calculateAngleDegrees(p1, p2)).toBeCloseTo(180);
    });

    it('should handle 45-degree angle', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 10, y: 10 };
      expect(calculateAngleDegrees(p1, p2)).toBeCloseTo(45);
    });
  });

  describe('calculateConeVertices', () => {
    it('should return tuple of exactly 3 points', () => {
      const origin: Point = { x: 0, y: 0 };
      const target: Point = { x: 100, y: 0 };
      const vertices = calculateConeVertices(origin, target);
      expect(vertices).toHaveLength(3);
    });

    it('should include origin as first vertex', () => {
      const origin: Point = { x: 50, y: 50 };
      const target: Point = { x: 150, y: 50 };
      const [v0] = calculateConeVertices(origin, target);
      expect(v0).toEqual(origin);
    });

    it('should calculate vertices for horizontal cone', () => {
      const origin: Point = { x: 0, y: 0 };
      const target: Point = { x: 100, y: 0 }; // 100 pixels to the right
      const coneAngle = 53;
      const [, left, right] = calculateConeVertices(origin, target, coneAngle);

      // Vertices should be on opposite sides of the axis
      // One should be positive Y, one negative Y
      expect(left.y * right.y).toBeLessThan(0); // Different signs
      // Both should be approximately 100 pixels from origin
      expect(euclideanDistance(origin, left)).toBeCloseTo(100);
      expect(euclideanDistance(origin, right)).toBeCloseTo(100);
    });

    it('should calculate vertices for vertical cone', () => {
      const origin: Point = { x: 0, y: 0 };
      const target: Point = { x: 0, y: 100 }; // 100 pixels down
      const [, left, right] = calculateConeVertices(origin, target);

      // Both vertices should be approximately 100 pixels from origin
      expect(euclideanDistance(origin, left)).toBeCloseTo(100);
      expect(euclideanDistance(origin, right)).toBeCloseTo(100);
    });

    it('should calculate vertices for diagonal cone', () => {
      const origin: Point = { x: 0, y: 0 };
      const target: Point = { x: 100, y: 100 };
      const [, left, right] = calculateConeVertices(origin, target);

      const dist = euclideanDistance(origin, target);
      expect(euclideanDistance(origin, left)).toBeCloseTo(dist);
      expect(euclideanDistance(origin, right)).toBeCloseTo(dist);
    });

    it('should respect custom cone angle', () => {
      const origin: Point = { x: 0, y: 0 };
      const target: Point = { x: 100, y: 0 };
      const narrowCone = 30;
      const [, leftNarrow, rightNarrow] = calculateConeVertices(origin, target, narrowCone);

      // Narrow cone should have vertices closer together (smaller Y difference)
      const narrowSpread = Math.abs(leftNarrow.y - rightNarrow.y);

      const wideCone = 90;
      const [, leftWide, rightWide] = calculateConeVertices(origin, target, wideCone);
      const wideSpread = Math.abs(leftWide.y - rightWide.y);

      expect(narrowSpread).toBeLessThan(wideSpread);
    });

    it('should use default 53-degree cone angle', () => {
      const origin: Point = { x: 0, y: 0 };
      const target: Point = { x: 100, y: 0 };
      const withDefault = calculateConeVertices(origin, target);
      const withExplicit = calculateConeVertices(origin, target, 53);

      // Should produce identical results
      expect(withDefault[1]).toEqual(withExplicit[1]);
      expect(withDefault[2]).toEqual(withExplicit[2]);
    });
  });

  describe('formatting functions', () => {
    describe('formatDistance', () => {
      it('should format distance with cell count by default', () => {
        expect(formatDistance(30)).toBe('30ft (6 cells)');
      });

      it('should handle zero distance', () => {
        expect(formatDistance(0)).toBe('0ft (0 cells)');
      });

      it('should handle large distances', () => {
        expect(formatDistance(500)).toBe('500ft (100 cells)');
      });

      it('should handle singular cell', () => {
        expect(formatDistance(5)).toBe('5ft (1 cell)');
      });

      it('should format without cells when showCells=false', () => {
        expect(formatDistance(30, false)).toBe('30ft');
      });
    });

    describe('formatRadius', () => {
      it('should format radius with cell count by default', () => {
        expect(formatRadius(20)).toBe('20ft radius (4 cells)');
      });

      it('should handle zero radius', () => {
        expect(formatRadius(0)).toBe('0ft radius (0 cells)');
      });

      it('should handle large radius', () => {
        expect(formatRadius(100)).toBe('100ft radius (20 cells)');
      });

      it('should handle singular cell', () => {
        expect(formatRadius(5)).toBe('5ft radius (1 cell)');
      });

      it('should format without cells when showCells=false', () => {
        expect(formatRadius(20, false)).toBe('20ft radius');
      });
    });

    describe('formatCone', () => {
      it('should format cone with cell count by default', () => {
        expect(formatCone(30, 53)).toBe('30ft 53° cone (6 cells)');
      });

      it('should use default 53-degree angle', () => {
        expect(formatCone(30)).toBe('30ft 53° cone (6 cells)');
      });

      it('should handle zero length', () => {
        expect(formatCone(0, 90)).toBe('0ft 90° cone (0 cells)');
      });

      it('should handle custom angles', () => {
        expect(formatCone(15, 90)).toBe('15ft 90° cone (3 cells)');
      });

      it('should handle singular cell', () => {
        expect(formatCone(5, 53)).toBe('5ft 53° cone (1 cell)');
      });

      it('should format without cells when showCells=false', () => {
        expect(formatCone(30, 53, false)).toBe('30ft 53° cone');
      });
    });
  });
});
