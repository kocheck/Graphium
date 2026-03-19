import { describe, it, expect } from 'vitest';
import { tokensToLightUniforms, worldToUV } from '../fogUniforms';

describe('worldToUV', () => {
  it('converts world coords to UV 0–1 range', () => {
    const uv = worldToUV({ x: 500, y: 250 }, { mapWidth: 1000, mapHeight: 500 });
    expect(uv).toEqual({ u: 0.5, v: 0.5 });
  });

  it('clamps to 0–1', () => {
    const uv = worldToUV({ x: -100, y: 9999 }, { mapWidth: 1000, mapHeight: 500 });
    expect(uv.u).toBe(0);
    expect(uv.v).toBe(1);
  });
});

describe('tokensToLightUniforms', () => {
  it('packs token light data into flat Float32Array', () => {
    const tokens = [
      {
        id: 'a',
        x: 500,
        y: 250,
        visionRadius: 100,
        lightColor: [1, 0.8, 0.5] as [number, number, number],
      },
    ];
    const result = tokensToLightUniforms(tokens, { mapWidth: 1000, mapHeight: 500, gridSize: 50 });
    // Each token: [u, v, radiusUV, r, g, b, falloff, _pad] = 8 floats
    // 32 tokens max × 8 floats = 256 floats total
    expect(result.length).toBe(256);
    expect(result[0]).toBeCloseTo(0.5); // u
    expect(result[1]).toBeCloseTo(0.5); // v
  });

  it('returns zero-filled array for no tokens', () => {
    const result = tokensToLightUniforms([], { mapWidth: 1000, mapHeight: 500, gridSize: 50 });
    expect(result.every((v) => v === 0)).toBe(true);
  });
});
