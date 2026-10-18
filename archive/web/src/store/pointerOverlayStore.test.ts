import { afterEach, describe, expect, it } from 'vitest';

import { usePointerOverlayStore } from './pointerOverlayStore';

describe('pointerOverlayStore live positions', () => {
  afterEach(() => {
    usePointerOverlayStore.getState().clearLivePositions();
  });

  it('replaces the live position map for the current drag set', () => {
    const { setLivePositions } = usePointerOverlayStore.getState();
    setLivePositions([
      { id: 'a', x: 1, y: 2 },
      { id: 'b', x: 3, y: 4 },
    ]);

    const live = usePointerOverlayStore.getState().livePositions;
    expect(live.get('a')).toEqual({ x: 1, y: 2 });
    expect(live.get('b')).toEqual({ x: 3, y: 4 });
  });

  it('clears back to an empty map', () => {
    usePointerOverlayStore.getState().setLivePositions([{ id: 'a', x: 8, y: 9 }]);
    usePointerOverlayStore.getState().clearLivePositions();
    expect(usePointerOverlayStore.getState().livePositions.size).toBe(0);
  });
});
