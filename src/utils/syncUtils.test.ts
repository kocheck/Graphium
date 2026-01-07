import { describe, it, expect } from 'vitest';
import { isEqual, detectChanges } from './syncUtils';

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
  });
});
