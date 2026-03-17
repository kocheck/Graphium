import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('pixi.js', () => ({
  Assets: {
    load: vi.fn((url: string) => Promise.resolve({ url, width: 64, height: 64 })),
    unload: vi.fn(),
  },
}));

import { getOrLoadTexture, evictTexture } from '../TextureCache';

describe('getOrLoadTexture', () => {
  beforeEach(() => {
    // Reset module between tests to clear the inFlight map
    vi.resetModules();
  });

  it('returns the same promise for duplicate URLs (deduplication)', async () => {
    const { getOrLoadTexture: fresh } = await import('../TextureCache');
    const p1 = fresh('https://example.com/token.png');
    const p2 = fresh('https://example.com/token.png');
    expect(p1).toBe(p2); // Same promise object = deduplicated
  });

  it('returns different promises for different URLs', async () => {
    const { getOrLoadTexture: fresh } = await import('../TextureCache');
    const p1 = fresh('https://example.com/a.png');
    const p2 = fresh('https://example.com/b.png');
    expect(p1).not.toBe(p2);
  });

  it('evictTexture removes from cache so next call creates new promise', async () => {
    const { getOrLoadTexture: fresh, evictTexture: freshEvict } = await import('../TextureCache');
    const p1 = fresh('https://example.com/token.png');
    freshEvict('https://example.com/token.png');
    const p2 = fresh('https://example.com/token.png');
    expect(p1).not.toBe(p2);
  });
});
