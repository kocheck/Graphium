import { describe, it, expect } from 'vitest';
import { stairsKey } from '../StairsLayer';
import type { Stairs } from '../../../types/domain';

const makeStairs = (overrides: Partial<Stairs> = {}): Stairs => ({
  id: 'stair-1',
  x: 100,
  y: 200,
  direction: 'north',
  type: 'up',
  width: 100,
  height: 100,
  ...overrides,
});

describe('stairsKey', () => {
  it('returns the stair id', () => {
    const s = makeStairs({ id: 'abc' });
    expect(stairsKey(s)).toBe('abc');
  });

  it('returns unique keys for different ids', () => {
    const a = makeStairs({ id: 'a' });
    const b = makeStairs({ id: 'b' });
    expect(stairsKey(a)).not.toBe(stairsKey(b));
  });
});
