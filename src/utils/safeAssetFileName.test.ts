import { describe, expect, it } from 'vitest';

import { rewriteSafeAssetFileName } from './safeAssetFileName';

describe('rewriteSafeAssetFileName', () => {
  it('keeps already-safe names', () => {
    expect(rewriteSafeAssetFileName('bed.mp3')).toBe('bed.mp3');
  });

  it('rewrites spaces, parentheses, and path segments', () => {
    expect(rewriteSafeAssetFileName('C:\\\\Music\\\\tavern theme (1).mp3')).toBe(
      'tavern-theme-1.mp3',
    );
  });
});
