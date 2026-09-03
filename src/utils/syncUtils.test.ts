import { describe, it, expect } from 'vitest';
import {
  isEqual,
  detectChanges,
  coalesceSyncActions,
  FULL_SYNC_ACTION_THRESHOLD,
} from './syncUtils';

describe('syncUtils', () => {
  describe('isEqual', () => {
    it('handles primitives', () => {
      expect(isEqual(1, 1)).toBe(true);
      expect(isEqual('a', 'a')).toBe(true);
      expect(isEqual(true, true)).toBe(true);
      expect(isEqual(1, 2)).toBe(false);
    });

    it('handles nested objects', () => {
      const o1 = { a: 1, b: { c: 2 } };
      const o2 = { a: 1, b: { c: 2 } };
      const o3 = { a: 1, b: { c: 3 } };
      expect(isEqual(o1, o2)).toBe(true);
      expect(isEqual(o1, o3)).toBe(false);
    });

    it('handles arrays', () => {
      expect(isEqual([1, 2], [1, 2])).toBe(true);
      expect(isEqual([1, 2], [1, 3])).toBe(false);
    });
  });

  describe('detectChanges', () => {
    it('detects token addition', () => {
      const prev = { tokens: [] };
      const curr = { tokens: [{ id: 't1', x: 0 }] };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'TOKEN_ADD',
        payload: { id: 't1', x: 0 },
      });
    });

    it('detects token update', () => {
      const prev = { tokens: [{ id: 't1', x: 0, y: 0 }] };
      const curr = { tokens: [{ id: 't1', x: 10, y: 0 }] };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'TOKEN_UPDATE',
        payload: { id: 't1', changes: { x: 10 } },
      });
    });

    it('detects library update', () => {
      const prev = { tokenLibrary: [] };
      const curr = { tokenLibrary: [{ id: 'l1', name: 'Goblin' }] };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'LIBRARY_UPDATE',
        payload: [{ id: 'l1', name: 'Goblin' }],
      });
    });

    it('includes gridColor in GRID_UPDATE', () => {
      const prev = {
        gridSize: 50,
        gridType: 'LINES' as const,
        gridColor: '#222222',
        isDaylightMode: false,
      };
      const curr = { ...prev, gridColor: '#ff0000' };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'GRID_UPDATE',
        payload: {
          gridSize: 50,
          gridType: 'LINES',
          gridColor: '#ff0000',
          isDaylightMode: false,
        },
      });
    });

    it('emits MEASUREMENT_UPDATE when broadcasting', () => {
      const measurement = {
        id: 'active',
        type: 'ruler' as const,
        origin: { x: 0, y: 0 },
        end: { x: 50, y: 0 },
        distanceFeet: 5,
      };
      const prev = { broadcastMeasurement: true, activeMeasurement: null };
      const curr = { broadcastMeasurement: true, activeMeasurement: measurement };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'MEASUREMENT_UPDATE',
        payload: measurement,
      });
    });

    it('clears measurement when broadcast is disabled', () => {
      const measurement = {
        id: 'active',
        type: 'ruler' as const,
        origin: { x: 0, y: 0 },
        end: { x: 50, y: 0 },
        distanceFeet: 5,
      };
      const prev = { broadcastMeasurement: true, activeMeasurement: measurement };
      const curr = { broadcastMeasurement: false, activeMeasurement: measurement };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'MEASUREMENT_UPDATE',
        payload: null,
      });
    });

    it('includes activeMeasurement in FULL_SYNC when broadcasting', () => {
      const measurement = {
        id: 'active',
        type: 'ruler' as const,
        origin: { x: 0, y: 0 },
        end: { x: 50, y: 0 },
        distanceFeet: 5,
      };

      const curr = {
        tokens: [],
        tokenLibrary: [],
        drawings: [],
        doors: [],
        stairs: [],
        gridSize: 50,
        gridType: 'LINES' as const,
        gridColor: '#222222',
        map: null,
        exploredRegions: [],
        isDaylightMode: false,
        activeMeasurement: measurement,
        broadcastMeasurement: true,
      };

      const changes = detectChanges(null, curr);
      const fullSync = changes.find((c) => c.type === 'FULL_SYNC');
      expect(fullSync).toBeTruthy();
      if (fullSync && fullSync.type === 'FULL_SYNC') {
        expect(fullSync.payload.activeMeasurement).toEqual(measurement);
        expect(fullSync.payload.broadcastMeasurement).toBe(true);
      }
    });

    it('detects stairs add/remove', () => {
      const stairs = {
        id: 's1',
        x: 0,
        y: 0,
        direction: 'north' as const,
        type: 'up' as const,
        width: 50,
        height: 50,
      };
      expect(detectChanges({ stairs: [] }, { stairs: [stairs] })).toContainEqual({
        type: 'STAIRS_ADD',
        payload: stairs,
      });
      expect(detectChanges({ stairs: [stairs] }, { stairs: [] })).toContainEqual({
        type: 'STAIRS_REMOVE',
        payload: { id: 's1' },
      });
    });

    it('detects explored region updates', () => {
      const regions = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
          timestamp: 1,
        },
      ];
      const changes = detectChanges({ exploredRegions: [] }, { exploredRegions: regions });
      expect(changes).toContainEqual({
        type: 'EXPLORED_UPDATE',
        payload: regions,
      });
    });

    it('emits FULL_SYNC when previous state is null', () => {
      const changes = detectChanges(null, { tokens: [{ id: 't1', x: 0 }] });
      expect(changes).toHaveLength(1);
      expect(changes[0]?.type).toBe('FULL_SYNC');
    });
  });

  describe('coalesceSyncActions', () => {
    it('returns an empty list when there are no actions', () => {
      expect(coalesceSyncActions([], {})).toEqual([]);
    });

    it('leaves a single action unwrapped', () => {
      const action = { type: 'TOKEN_REMOVE' as const, payload: { id: 't1' } };
      expect(coalesceSyncActions([action], {})).toEqual([action]);
    });

    it('batches a small set of actions', () => {
      const actions = [
        { type: 'TOKEN_REMOVE' as const, payload: { id: 't1' } },
        { type: 'TOKEN_REMOVE' as const, payload: { id: 't2' } },
      ];
      expect(coalesceSyncActions(actions, {})).toEqual([{ type: 'BATCH', payload: actions }]);
    });

    it('collapses a large set of actions into FULL_SYNC', () => {
      const actions = Array.from({ length: FULL_SYNC_ACTION_THRESHOLD }, (_, i) => ({
        type: 'TOKEN_REMOVE' as const,
        payload: { id: `t${i}` },
      }));
      const coalesced = coalesceSyncActions(actions, { tokens: [] });
      expect(coalesced).toHaveLength(1);
      expect(coalesced[0]?.type).toBe('FULL_SYNC');
    });
  });
});
