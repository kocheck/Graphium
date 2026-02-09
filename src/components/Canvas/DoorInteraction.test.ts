import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../store/gameStore';

import type { Door } from '../../store/gameStore';

// Mock system messages to avoid dependency on random message selection
vi.mock('../../utils/systemMessages', () => ({
  rollForMessage: (key: string) => `Mock message for ${key}`,
}));

/**
 * Tests for door interaction logic
 *
 * These tests verify the door removal and context menu behaviors:
 * 1. Right-click context menu actions (toggle, lock, delete)
 * 2. Eraser tool deletion
 * 3. Delete/Backspace key removal of doors via removeDoors
 * 4. Door state after context menu operations
 */

const createDoor = (overrides: Partial<Door> = {}): Door => ({
  id: crypto.randomUUID(),
  x: 100,
  y: 200,
  orientation: 'horizontal',
  isOpen: false,
  isLocked: false,
  size: 50,
  ...overrides,
});

describe('Door Interaction Logic', () => {
  beforeEach(() => {
    const initialMap = {
      id: crypto.randomUUID(),
      name: 'Map 1',
      tokens: [],
      drawings: [],
      doors: [],
      stairs: [],
      map: null,
      gridSize: 50,
      gridType: 'LINES' as const,
      fogOfWar: null,
      exploredRegions: [],
      isDaylightMode: false,
    };

    useGameStore.setState({
      doors: [],
      campaign: {
        name: 'Test Campaign',
        activeMapId: initialMap.id,
        maps: { [initialMap.id]: initialMap },
      },
    });
  });

  describe('Context Menu: Toggle Door', () => {
    it('should toggle a closed door to open', () => {
      const store = useGameStore.getState();
      const door = createDoor({ id: 'door-1', isOpen: false });
      store.addDoor(door);

      store.toggleDoor('door-1');
      expect(useGameStore.getState().doors[0]!.isOpen).toBe(true);
    });

    it('should toggle an open door to closed', () => {
      const store = useGameStore.getState();
      const door = createDoor({ id: 'door-1', isOpen: true });
      store.addDoor(door);

      store.toggleDoor('door-1');
      expect(useGameStore.getState().doors[0]!.isOpen).toBe(false);
    });

    it('should allow toggling a locked door via store (UI blocks this separately)', () => {
      const store = useGameStore.getState();
      const door = createDoor({ id: 'door-1', isOpen: false, isLocked: true });
      store.addDoor(door);

      // Store-level toggle works regardless of lock (UI enforces lock constraint)
      store.toggleDoor('door-1');
      expect(useGameStore.getState().doors[0]!.isOpen).toBe(true);
    });
  });

  describe('Context Menu: Lock/Unlock Door', () => {
    it('should lock an unlocked door', () => {
      const store = useGameStore.getState();
      const door = createDoor({ id: 'door-1', isLocked: false });
      store.addDoor(door);

      store.updateDoorLock('door-1', true);
      expect(useGameStore.getState().doors[0]!.isLocked).toBe(true);
    });

    it('should unlock a locked door', () => {
      const store = useGameStore.getState();
      const door = createDoor({ id: 'door-1', isLocked: true });
      store.addDoor(door);

      store.updateDoorLock('door-1', false);
      expect(useGameStore.getState().doors[0]!.isLocked).toBe(false);
    });

    it('should preserve open/closed state when toggling lock', () => {
      const store = useGameStore.getState();
      const door = createDoor({ id: 'door-1', isOpen: true, isLocked: false });
      store.addDoor(door);

      store.updateDoorLock('door-1', true);
      const state = useGameStore.getState().doors[0]!;
      expect(state.isLocked).toBe(true);
      expect(state.isOpen).toBe(true); // open state preserved
    });
  });

  describe('Context Menu: Delete Door', () => {
    it('should delete a single door via removeDoor', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1' }));
      store.addDoor(createDoor({ id: 'door-2' }));

      store.removeDoor('door-1');

      const doors = useGameStore.getState().doors;
      expect(doors).toHaveLength(1);
      expect(doors[0]!.id).toBe('door-2');
    });

    it('should handle deleting a non-existent door gracefully', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1' }));

      store.removeDoor('non-existent');

      expect(useGameStore.getState().doors).toHaveLength(1);
    });
  });

  describe('Eraser Tool: Delete Door on Click', () => {
    it('should remove door when eraser tool clicks it', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1' }));

      // Simulates: eraser click → onDelete(door.id) → removeDoor
      store.removeDoor('door-1');

      expect(useGameStore.getState().doors).toHaveLength(0);
    });
  });

  describe('Delete/Backspace: Batch Door Removal', () => {
    it('should remove multiple doors via removeDoors', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1' }));
      store.addDoor(createDoor({ id: 'door-2' }));
      store.addDoor(createDoor({ id: 'door-3' }));

      // Simulates: selectedIds = ['door-1', 'door-3'], press Delete
      store.removeDoors(['door-1', 'door-3']);

      const doors = useGameStore.getState().doors;
      expect(doors).toHaveLength(1);
      expect(doors[0]!.id).toBe('door-2');
    });

    it('should handle mixed IDs (tokens + doors) gracefully', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1' }));

      // selectedIds may contain token IDs too — removeDoors filters by door IDs
      store.removeDoors(['token-1', 'door-1', 'drawing-1']);

      expect(useGameStore.getState().doors).toHaveLength(0);
    });

    it('should handle empty selection gracefully', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1' }));

      store.removeDoors([]);

      expect(useGameStore.getState().doors).toHaveLength(1);
    });
  });

  describe('Door Interaction State Combinations', () => {
    it('should allow deleting a locked door', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1', isLocked: true }));

      // Locked doors can still be deleted by DM
      store.removeDoor('door-1');

      expect(useGameStore.getState().doors).toHaveLength(0);
    });

    it('should allow deleting an open door', () => {
      const store = useGameStore.getState();
      store.addDoor(createDoor({ id: 'door-1', isOpen: true }));

      store.removeDoor('door-1');

      expect(useGameStore.getState().doors).toHaveLength(0);
    });

    it('should support full lifecycle: add → toggle → lock → delete', () => {
      const store = useGameStore.getState();
      const door = createDoor({ id: 'door-1' });

      // Add
      store.addDoor(door);
      expect(useGameStore.getState().doors).toHaveLength(1);

      // Toggle open
      store.toggleDoor('door-1');
      expect(useGameStore.getState().doors[0]!.isOpen).toBe(true);

      // Lock
      store.updateDoorLock('door-1', true);
      expect(useGameStore.getState().doors[0]!.isLocked).toBe(true);

      // Delete
      store.removeDoor('door-1');
      expect(useGameStore.getState().doors).toHaveLength(0);
    });
  });
});
