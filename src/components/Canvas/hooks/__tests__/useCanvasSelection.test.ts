import { describe, it, expect } from 'vitest';
import { rectsOverlap } from '../useCanvasSelection';

describe('rectsOverlap', () => {
  it('returns true when rects overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 })).toBe(
      true,
    );
  });

  it('returns false when rects are adjacent (touching but not overlapping)', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 0, w: 100, h: 100 })).toBe(
      false,
    );
  });

  it('returns false when rects are clearly separated', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 50, h: 50 }, { x: 100, y: 100, w: 50, h: 50 })).toBe(
      false,
    );
  });

  it('returns true when one rect fully contains the other', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 200, h: 200 }, { x: 50, y: 50, w: 50, h: 50 })).toBe(true);
  });
});
