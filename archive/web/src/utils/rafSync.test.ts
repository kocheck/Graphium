import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushRafSync, queueSyncAction, setRafSyncSender } from './rafSync';

describe('rafSync', () => {
  afterEach(() => {
    setRafSyncSender(null);
    vi.restoreAllMocks();
  });

  it('coalesces multiple TOKEN_DRAG_MOVE actions into one BATCH payload', () => {
    let queued: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued = cb;
      return 1;
    });
    const sent: unknown[] = [];
    setRafSyncSender((action) => {
      sent.push(action);
    });

    queueSyncAction({ type: 'TOKEN_DRAG_MOVE', payload: { id: 'a', x: 1, y: 1 } });
    queueSyncAction({ type: 'TOKEN_DRAG_MOVE', payload: { id: 'b', x: 2, y: 2 } });
    queued?.(0);

    expect(sent).toEqual([
      {
        type: 'TOKEN_DRAG_MOVE_BATCH',
        payload: [
          { id: 'a', x: 1, y: 1 },
          { id: 'b', x: 2, y: 2 },
        ],
      },
    ]);
  });

  it('keeps a single MOVE as TOKEN_DRAG_MOVE', () => {
    const sent: unknown[] = [];
    setRafSyncSender((action) => {
      sent.push(action);
    });
    queueSyncAction({ type: 'TOKEN_DRAG_MOVE', payload: { id: 'a', x: 3, y: 4 } });
    flushRafSync();
    expect(sent).toEqual([{ type: 'TOKEN_DRAG_MOVE', payload: { id: 'a', x: 3, y: 4 } }]);
  });
});
