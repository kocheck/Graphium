import { describe, it, expect } from 'vitest';

import { parseRgba } from './pixiColor';

describe('parseRgba', () => {
  it('parses a 6-digit hex color correctly', () => {
    // #f7edda → r=0xf7=247, g=0xed=237, b=0xda=218
    // color = (247 << 16) | (237 << 8) | 218 = 0xf7edda = 16_248_282
    const result = parseRgba('#f7edda');
    expect(result.color).toBe(0xf7edda);
    expect(result.alpha).toBe(1);
  });

  it('expands a 3-digit hex shorthand correctly', () => {
    // #abc → #aabbcc → r=0xaa=170, g=0xbb=187, b=0xcc=204
    const result = parseRgba('#abc');
    expect(result.color).toBe(0xaabbcc);
    expect(result.alpha).toBe(1);
  });

  it('parses rgba() with fractional alpha', () => {
    const result = parseRgba('rgba(140, 105, 20, 0.25)');
    // color = (140 << 16) | (105 << 8) | 20 = 0x8c6914
    expect(result.color).toBe((140 << 16) | (105 << 8) | 20);
    expect(result.alpha).toBeCloseTo(0.25);
  });

  it('parses rgb() and defaults alpha to 1', () => {
    const result = parseRgba('rgb(255, 0, 0)');
    expect(result.color).toBe(0xff0000);
    expect(result.alpha).toBe(1);
  });

  it('returns fallback { color: 0, alpha: 1 } for an invalid string', () => {
    const result = parseRgba('invalid');
    expect(result.color).toBe(0x000000);
    expect(result.alpha).toBe(1);
  });
});
