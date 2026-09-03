import { describe, it, expect } from 'vitest';

import { pickTokenPositionChanges, sanitizeWorldToArchitectAction } from './worldViewTokenSync';

describe('worldViewTokenSync', () => {
  describe('pickTokenPositionChanges', () => {
    it('keeps only finite x/y numbers', () => {
      expect(
        pickTokenPositionChanges({
          x: 10,
          y: 20,
          src: 'file://evil.webp',
          type: 'PC',
        }),
      ).toEqual({ x: 10, y: 20 });
    });

    it('drops non-finite values', () => {
      expect(pickTokenPositionChanges({ x: Number.NaN, y: 5 })).toEqual({ y: 5 });
    });
  });

  describe('sanitizeWorldToArchitectAction', () => {
    it('accepts TOKEN_UPDATE with position fields only', () => {
      expect(
        sanitizeWorldToArchitectAction({
          type: 'TOKEN_UPDATE',
          payload: { id: 't1', changes: { x: 1, y: 2, src: 'nope' } },
        }),
      ).toEqual({
        type: 'TOKEN_UPDATE',
        payload: { id: 't1', changes: { x: 1, y: 2 } },
      });
    });

    it('rejects non-token actions', () => {
      expect(
        sanitizeWorldToArchitectAction({
          type: 'FULL_SYNC',
          payload: { tokens: [] },
        }),
      ).toBeNull();
    });

    it('sanitizes BATCH payloads and drops invalid entries', () => {
      expect(
        sanitizeWorldToArchitectAction({
          type: 'BATCH',
          payload: [
            { type: 'TOKEN_UPDATE', payload: { id: 't1', changes: { x: 3 } } },
            { type: 'TOKEN_REMOVE', payload: { id: 't2' } },
            { type: 'TOKEN_UPDATE', payload: { id: 't3', changes: { name: 'Goblin' } } },
            { type: 'TOKEN_UPDATE', payload: { id: 't4', changes: { y: 9 } } },
          ],
        }),
      ).toEqual({
        type: 'BATCH',
        payload: [
          { type: 'TOKEN_UPDATE', payload: { id: 't1', changes: { x: 3 } } },
          { type: 'TOKEN_UPDATE', payload: { id: 't4', changes: { y: 9 } } },
        ],
      });
    });

    it('unwraps a single valid BATCH entry', () => {
      expect(
        sanitizeWorldToArchitectAction({
          type: 'BATCH',
          payload: [{ type: 'TOKEN_UPDATE', payload: { id: 't1', changes: { x: 1 } } }],
        }),
      ).toEqual({
        type: 'TOKEN_UPDATE',
        payload: { id: 't1', changes: { x: 1 } },
      });
    });
  });
});
