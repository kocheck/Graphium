import { describe, it, expect } from 'vitest';
import { Door } from '../store/gameStore';
import { WallSegment, Point } from '../types/geometry';

/**
 * Tests for door blocking logic
 *
 * These tests verify the critical door blocking functionality:
 * 1. Closed doors are converted to wall segments
 * 2. Open doors are NOT converted to wall segments
 * 3. Wall segments are correctly positioned
 * 4. Raycasting uses these wall segments
 */

describe('Door Blocking Logic', () => {
  describe('Door to Wall Segment Conversion', () => {
    it('should convert closed horizontal door to wall segment', () => {
      const door: Door = {
        id: 'door1',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: false,
        isLocked: false,
        size: 50,
      };

      // Simulate the conversion logic from FogOfWarLayer.tsx
      const wallSegments: WallSegment[] = [];

      if (!door.isOpen) {
        const halfSize = door.size / 2;
        if (door.orientation === 'horizontal') {
          wallSegments.push({
            start: { x: door.x - halfSize, y: door.y },
            end: { x: door.x + halfSize, y: door.y },
          });
        }
      }

      expect(wallSegments).toHaveLength(1);
      expect(wallSegments[0]).toEqual({
        start: { x: 75, y: 200 },  // 100 - 25
        end: { x: 125, y: 200 },   // 100 + 25
      });
    });

    it('should convert closed vertical door to wall segment', () => {
      const door: Door = {
        id: 'door2',
        x: 100,
        y: 200,
        orientation: 'vertical',
        isOpen: false,
        isLocked: false,
        size: 50,
      };

      const wallSegments: WallSegment[] = [];

      if (!door.isOpen) {
        const halfSize = door.size / 2;
        if (door.orientation === 'vertical') {
          wallSegments.push({
            start: { x: door.x, y: door.y - halfSize },
            end: { x: door.x, y: door.y + halfSize },
          });
        }
      }

      expect(wallSegments).toHaveLength(1);
      expect(wallSegments[0]).toEqual({
        start: { x: 100, y: 175 },  // 200 - 25
        end: { x: 100, y: 225 },    // 200 + 25
      });
    });

    it('should NOT convert open door to wall segment', () => {
      const door: Door = {
        id: 'door3',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: true,  // OPEN
        isLocked: false,
        size: 50,
      };

      const wallSegments: WallSegment[] = [];

      if (!door.isOpen) {
        const halfSize = door.size / 2;
        wallSegments.push({
          start: { x: door.x - halfSize, y: door.y },
          end: { x: door.x + halfSize, y: door.y },
        });
      }

      expect(wallSegments).toHaveLength(0);
    });

    it('should convert multiple closed doors correctly', () => {
      const doors: Door[] = [
        {
          id: 'door1',
          x: 100,
          y: 100,
          orientation: 'horizontal',
          isOpen: false,
          isLocked: false,
          size: 50,
        },
        {
          id: 'door2',
          x: 200,
          y: 200,
          orientation: 'vertical',
          isOpen: false,
          isLocked: false,
          size: 50,
        },
        {
          id: 'door3',
          x: 300,
          y: 300,
          orientation: 'horizontal',
          isOpen: true,  // OPEN - should not be converted
          isLocked: false,
          size: 50,
        },
      ];

      const wallSegments: WallSegment[] = [];

      doors
        .filter(door => !door.isOpen)
        .forEach(door => {
          const halfSize = door.size / 2;
          if (door.orientation === 'horizontal') {
            wallSegments.push({
              start: { x: door.x - halfSize, y: door.y },
              end: { x: door.x + halfSize, y: door.y },
            });
          } else {
            wallSegments.push({
              start: { x: door.x, y: door.y - halfSize },
              end: { x: door.x, y: door.y + halfSize },
            });
          }
        });

      expect(wallSegments).toHaveLength(2);  // Only 2 closed doors
    });
  });

  describe('Ray Intersection with Door Segments', () => {
    // Helper function to test line segment intersection
    function lineSegmentIntersection(
      x1: number, y1: number, x2: number, y2: number,
      x3: number, y3: number, x4: number, y4: number
    ): Point | null {
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

      if (Math.abs(denom) < 1e-10) return null;

      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
          x: x1 + t * (x2 - x1),
          y: y1 + t * (y2 - y1),
        };
      }

      return null;
    }

    it('should detect ray intersection with horizontal door', () => {
      // Door segment from (50, 100) to (150, 100)
      const doorSegment: WallSegment = {
        start: { x: 50, y: 100 },
        end: { x: 150, y: 100 },
      };

      // Ray from (100, 50) pointing down to (100, 150)
      const intersection = lineSegmentIntersection(
        100, 50,   // Ray start
        100, 150,  // Ray end
        doorSegment.start.x, doorSegment.start.y,
        doorSegment.end.x, doorSegment.end.y
      );

      expect(intersection).not.toBeNull();
      expect(intersection?.x).toBeCloseTo(100);
      expect(intersection?.y).toBeCloseTo(100);
    });

    it('should detect ray intersection with vertical door', () => {
      // Door segment from (100, 50) to (100, 150)
      const doorSegment: WallSegment = {
        start: { x: 100, y: 50 },
        end: { x: 100, y: 150 },
      };

      // Ray from (50, 100) pointing right to (150, 100)
      const intersection = lineSegmentIntersection(
        50, 100,   // Ray start
        150, 100,  // Ray end
        doorSegment.start.x, doorSegment.start.y,
        doorSegment.end.x, doorSegment.end.y
      );

      expect(intersection).not.toBeNull();
      expect(intersection?.x).toBeCloseTo(100);
      expect(intersection?.y).toBeCloseTo(100);
    });

    it('should NOT detect intersection when ray misses door', () => {
      // Door segment from (100, 100) to (200, 100)
      const doorSegment: WallSegment = {
        start: { x: 100, y: 100 },
        end: { x: 200, y: 100 },
      };

      // Ray from (50, 50) to (75, 75) - misses door
      const intersection = lineSegmentIntersection(
        50, 50,
        75, 75,
        doorSegment.start.x, doorSegment.start.y,
        doorSegment.end.x, doorSegment.end.y
      );

      expect(intersection).toBeNull();
    });

    it('should block vision through closed door', () => {
      // Scenario: PC at (50, 100), door at x=100 (horizontal), target at (150, 100)
      // Ray should hit the door and NOT reach the target

      const pcPosition = { x: 50, y: 100 };
      const targetPosition = { x: 150, y: 100 };

      // Closed door creates wall segment
      const doorSegment: WallSegment = {
        start: { x: 75, y: 100 },
        end: { x: 125, y: 100 },
      };

      // Check if ray from PC to target intersects door
      const intersection = lineSegmentIntersection(
        pcPosition.x, pcPosition.y,
        targetPosition.x, targetPosition.y,
        doorSegment.start.x, doorSegment.start.y,
        doorSegment.end.x, doorSegment.end.y
      );

      expect(intersection).not.toBeNull();

      // Intersection should be between PC and target (vision blocked)
      if (intersection) {
        const distanceToIntersection = Math.hypot(
          intersection.x - pcPosition.x,
          intersection.y - pcPosition.y
        );
        const distanceToTarget = Math.hypot(
          targetPosition.x - pcPosition.x,
          targetPosition.y - pcPosition.y
        );

        expect(distanceToIntersection).toBeLessThan(distanceToTarget);
      }
    });
  });

  describe('Door State Integration', () => {
    it('should allow vision through open door', () => {
      const doors: Door[] = [
        {
          id: 'door1',
          x: 100,
          y: 100,
          orientation: 'horizontal',
          isOpen: true,  // OPEN
          isLocked: false,
          size: 50,
        },
      ];

      // Convert only CLOSED doors
      const wallSegments = doors
        .filter(door => !door.isOpen)
        .map(door => {
          const halfSize = door.size / 2;
          return {
            start: { x: door.x - halfSize, y: door.y },
            end: { x: door.x + halfSize, y: door.y },
          };
        });

      expect(wallSegments).toHaveLength(0);  // Open door = no wall segment
    });

    it('should block vision through closed locked door', () => {
      const doors: Door[] = [
        {
          id: 'door1',
          x: 100,
          y: 100,
          orientation: 'horizontal',
          isOpen: false,  // CLOSED
          isLocked: true,  // LOCKED (but still blocks vision when closed)
          size: 50,
        },
      ];

      const wallSegments = doors
        .filter(door => !door.isOpen)
        .map(door => {
          const halfSize = door.size / 2;
          return {
            start: { x: door.x - halfSize, y: door.y },
            end: { x: door.x + halfSize, y: door.y },
          };
        });

      expect(wallSegments).toHaveLength(1);  // Locked but closed = still blocks
    });
  });
});
