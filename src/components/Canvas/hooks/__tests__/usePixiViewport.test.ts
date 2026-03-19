import { describe, it, expect } from 'vitest';

import { clampViewport } from '../usePixiViewport';

describe('clampViewport', () => {
  it('prevents panning beyond map bounds with padding', () => {
    const result = clampViewport(
      { x: 99999, y: 99999 },
      { scale: 1, mapWidth: 2000, mapHeight: 2000, viewWidth: 800, viewHeight: 600 },
    );
    expect(result.x).toBeLessThanOrEqual(1000); // VIEWPORT_CLAMP_PADDING
    expect(result.y).toBeLessThanOrEqual(1000);
  });

  it('allows panning within bounds', () => {
    const result = clampViewport(
      { x: -100, y: -100 },
      { scale: 1, mapWidth: 2000, mapHeight: 2000, viewWidth: 800, viewHeight: 600 },
    );
    expect(result.x).toBe(-100);
    expect(result.y).toBe(-100);
  });

  it('clamps minimum x when panned far left', () => {
    // At scale=2, a 2000px wide map is 4000px. minX = -(4000 - 800) + 1000 = -3200 + 1000...
    // Actually: minX = -(mapWidth * scale) + viewWidth - CLAMP_PADDING
    // minX = -(2000*2) + 800 - 1000 = -4000 + 800 - 1000 = -4200
    const result = clampViewport(
      { x: -99999, y: 0 },
      { scale: 2, mapWidth: 2000, mapHeight: 2000, viewWidth: 800, viewHeight: 600 },
    );
    expect(result.x).toBeGreaterThan(-99999); // Was clamped
  });
});
