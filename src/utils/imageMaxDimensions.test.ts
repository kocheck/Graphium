import { describe, expect, it } from 'vitest';

import { maxDimensionForType } from './imageMaxDimensions';

describe('maxDimensionForType', () => {
  it('uses shared map, token, and thumb caps', () => {
    expect(maxDimensionForType('MAP')).toBe(4096);
    expect(maxDimensionForType('TOKEN')).toBe(512);
    expect(maxDimensionForType('THUMB')).toBe(256);
  });
});
