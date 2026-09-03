import { describe, expect, it } from 'vitest';

import { isTokenInViewport } from './viewportCulling';

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
