import { afterEach, describe, expect, it } from 'vitest';

import {
  beginInboundApply,
  endInboundApply,
  isInboundApply,
  resetInboundApply,
  stampTokenPositionsOnSnapshot,
} from './syncStamp';

import type { SyncableGameState } from './syncUtils';
import type { Token } from '../store/gameStore';

describe('syncStamp inbound apply', () => {
  afterEach(() => {
    resetInboundApply();
  });

  it('treats nested begin/end as a depth counter', () => {
    expect(isInboundApply()).toBe(false);
    beginInboundApply();
    beginInboundApply();
    expect(isInboundApply()).toBe(true);
    endInboundApply();
    expect(isInboundApply()).toBe(true);
    endInboundApply();
    expect(isInboundApply()).toBe(false);
  });

  it('does not go negative when end is called without begin', () => {
    endInboundApply();
    expect(isInboundApply()).toBe(false);
  });
});

describe('stampTokenPositionsOnSnapshot', () => {
  it('patches matching token coordinates on the snapshot', () => {
    const tokens: Token[] = [
      { id: 'a', x: 0, y: 0, src: 'a.png' },
      { id: 'b', x: 10, y: 10, src: 'b.png' },
    ];
    const snapshot = { tokens } as SyncableGameState;

    stampTokenPositionsOnSnapshot(snapshot, [{ id: 'a', x: 40, y: 50 }]);

    expect(snapshot.tokens[0]).toMatchObject({ id: 'a', x: 40, y: 50 });
    expect(snapshot.tokens[1]).toMatchObject({ id: 'b', x: 10, y: 10 });
  });
});
