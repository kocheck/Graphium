import { describe, expect, it } from 'vitest';

import {
  consumePerfSnapshot,
  estimateIpcArgs,
  estimatePayloadBytes,
  recordFowRecalc,
  recordIpcAction,
} from './perfCounters';

describe('perfCounters', () => {
  it('estimates payload bytes without JSON.stringify', () => {
    expect(estimatePayloadBytes('abcd')).toBe(4);
    expect(estimatePayloadBytes({ type: 'TOKEN_DRAG_MOVE', x: 1 })).toBeGreaterThan(8);
    expect(estimatePayloadBytes(['a', 'bb'])).toBeGreaterThan(8);
  });

  it('estimates IPC by action type without walking point arrays', () => {
    expect(
      estimateIpcArgs(['SYNC_WORLD_STATE', { type: 'TOKEN_DRAG_MOVE', payload: { id: 'a' } }]),
    ).toBe(48);
    expect(
      estimateIpcArgs([
        {
          type: 'TOKEN_DRAG_MOVE_BATCH',
          payload: [
            { id: 'a', x: 1, y: 1 },
            { id: 'b', x: 2, y: 2 },
          ],
        },
      ]),
    ).toBe(80);
    expect(
      estimateIpcArgs([{ type: 'FULL_SYNC', payload: { exploredRegions: new Array(2000) } }]),
    ).toBe(256);
  });

  it('consumes FOW and IPC counters', () => {
    recordFowRecalc(2);
    recordIpcAction('TOKEN_DRAG_MOVE');
    recordIpcAction('TOKEN_DRAG_MOVE');
    const snapshot = consumePerfSnapshot();
    expect(snapshot.fowRecalcCount).toBe(2);
    expect(snapshot.ipcActionsByType.TOKEN_DRAG_MOVE).toBe(2);
    expect(consumePerfSnapshot().fowRecalcCount).toBe(0);
  });
});
