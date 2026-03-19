import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('pixi.js', () => ({
  Assets: {
    load: vi.fn((url: string) => Promise.resolve({ url, width: 64, height: 64 })),
    unload: vi.fn(),
  },
}));

import { getOrLoadTexture, evictTexture, resetInFlightForTesting } from '../TextureCache';

describe('getOrLoadTexture', () => {
  beforeEach(() => {
    resetInFlightForTesting();
  });

  it('returns the same promise for duplicate URLs (deduplication)', () => {
    const p1 = getOrLoadTexture('https://example.com/token.png');
    const p2 = getOrLoadTexture('https://example.com/token.png');
    expect(p1).toBe(p2);
  });

  it('returns different promises for different URLs', () => {
    const p1 = getOrLoadTexture('https://example.com/a.png');
    const p2 = getOrLoadTexture('https://example.com/b.png');
    expect(p1).not.toBe(p2);
  });

  it('evictTexture removes from cache so next call creates new promise', () => {
    const p1 = getOrLoadTexture('https://example.com/token.png');
    evictTexture('https://example.com/token.png');
    const p2 = getOrLoadTexture('https://example.com/token.png');
    expect(p1).not.toBe(p2);
  });
});
