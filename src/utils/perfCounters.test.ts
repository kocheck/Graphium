import { describe, expect, it } from 'vitest';

import {
  consumePerfSnapshot,
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
