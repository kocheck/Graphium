import { describe, expect, it } from 'vitest';

import { restorableBounds } from '../../electron/windowBounds';

const laptop = { x: 0, y: 0, width: 1512, height: 944 };
const projectorRight = { x: 1512, y: 0, width: 1920, height: 1080 };

describe('restorableBounds', () => {
  it('keeps a position that is on a connected display', () => {
    expect(restorableBounds({ width: 1200, height: 800, x: 100, y: 50 }, [laptop])).toEqual({
      width: 1200,
      height: 800,
      x: 100,
      y: 50,
    });
  });

  it('drops the position when the window was on a display that is now unplugged', () => {
    expect(restorableBounds({ width: 1600, height: 900, x: 1700, y: 40 }, [laptop])).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it('keeps a position on a second display while it is still attached', () => {
    const saved = { width: 1600, height: 900, x: 1700, y: 40 };
    expect(restorableBounds(saved, [laptop, projectorRight])).toEqual(saved);
  });

  it('drops a position that leaves only a sliver on screen', () => {
    expect(restorableBounds({ width: 1200, height: 800, x: 1480, y: 0 }, [laptop])).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it('passes size through when no position was saved', () => {
    expect(restorableBounds({ width: 1200, height: 800 }, [laptop])).toEqual({
      width: 1200,
      height: 800,
    });
  });
});
