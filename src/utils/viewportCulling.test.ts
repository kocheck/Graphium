import { describe, expect, it } from 'vitest';

import { isTokenInViewport, shouldRenderTokenVisuals } from './viewportCulling';

describe('isTokenInViewport', () => {
  const bounds = { x: 0, y: 0, width: 200, height: 200 };

  it('keeps tokens that intersect the padded viewport', () => {
    expect(isTokenInViewport(180, 180, 50, bounds, 20)).toBe(true);
    expect(isTokenInViewport(-10, -10, 50, bounds, 20)).toBe(true);
  });

  it('culls tokens fully outside the padded viewport', () => {
    expect(isTokenInViewport(400, 400, 50, bounds, 20)).toBe(false);
    expect(isTokenInViewport(-80, 10, 50, bounds, 20)).toBe(false);
  });
});

describe('shouldRenderTokenVisuals', () => {
  it('hides fog-hidden tokens even while dragging', () => {
    expect(shouldRenderTokenVisuals(true, true, true)).toBe(false);
  });

  it('keeps visuals for in-view or actively dragged tokens', () => {
    expect(shouldRenderTokenVisuals(false, false, true)).toBe(true);
    expect(shouldRenderTokenVisuals(false, true, false)).toBe(true);
  });

  it('skips expensive visuals when off-screen and idle', () => {
    expect(shouldRenderTokenVisuals(false, false, false)).toBe(false);
  });
});
