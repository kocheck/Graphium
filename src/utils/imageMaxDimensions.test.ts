import { describe, expect, it } from 'vitest';

import {
  MAX_MAP_DIMENSION,
  MAX_THUMB_DIMENSION,
  MAX_TOKEN_DIMENSION,
  maxDimensionForType,
} from './imageMaxDimensions';

describe('maxDimensionForType', () => {
  it('uses shared map, token, and thumb caps', () => {
    expect(maxDimensionForType('MAP')).toBe(MAX_MAP_DIMENSION);
    expect(maxDimensionForType('TOKEN')).toBe(MAX_TOKEN_DIMENSION);
    expect(maxDimensionForType('THUMB')).toBe(MAX_THUMB_DIMENSION);
    expect(MAX_MAP_DIMENSION).toBe(4096);
    expect(MAX_TOKEN_DIMENSION).toBe(512);
    expect(MAX_THUMB_DIMENSION).toBe(256);
  });
});
