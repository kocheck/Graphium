import { describe, it, expect } from 'vitest';

import { toMediaProtocol } from './mediaProtocol';

describe('toMediaProtocol', () => {
  it('converts file URLs to media URLs', () => {
    expect(toMediaProtocol('file:///tmp/token.webp')).toBe('media:///tmp/token.webp');
  });

  it('leaves non-file URLs unchanged', () => {
    expect(toMediaProtocol('blob:abc')).toBe('blob:abc');
    expect(toMediaProtocol('media:///tmp/token.webp')).toBe('media:///tmp/token.webp');
  });
});
