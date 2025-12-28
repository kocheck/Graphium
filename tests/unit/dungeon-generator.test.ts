import { describe, it, expect } from 'vitest';
import { DungeonGenerator } from '../../src/utils/DungeonGenerator';

describe('DungeonGenerator - Door and Corridor Alignment', () => {
  const gridSize = 50; // Standard grid size

  it('should generate a dungeon with doors', () => {
    const generator = new DungeonGenerator({
      numRooms: 5,
      gridSize
    });

    const result = generator.generate();

    // Verify doors were created
    expect(result.doors.length).toBeGreaterThan(0);
    expect(result.drawings.length).toBeGreaterThan(0);
  });

  it('should create doors that align to grid', () => {
    const generator = new DungeonGenerator({
      numRooms: 5,
      gridSize
    });

    const result = generator.generate();

    const misalignedDoors = result.doors.filter(door => {
      const xAligned = door.x % gridSize === 0;
      const yAligned = door.y % gridSize === 0;
      return !xAligned || !yAligned;
    });

    // All doors should be grid-aligned
    expect(misalignedDoors.length).toBe(0);
  });

  it('should verify door properties are valid', () => {
    const generator = new DungeonGenerator({
      numRooms: 5,
      gridSize
    });

    const result = generator.generate();

    result.doors.forEach((door) => {
      // Verify all required properties exist
      expect(door.id).toBeDefined();
      expect(door.x).toBeDefined();
      expect(door.y).toBeDefined();
      expect(door.orientation).toMatch(/^(horizontal|vertical)$/);
      expect(typeof door.isOpen).toBe('boolean');
      expect(typeof door.isLocked).toBe('boolean');
      expect(door.size).toBeGreaterThan(0);
      expect(door.thickness).toBeDefined();
      expect(door.swingDirection).toBeDefined();
    });
  });

});
