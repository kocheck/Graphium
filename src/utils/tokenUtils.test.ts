import { describe, it, expect } from 'vitest';
import { getRecentTokens, Token, LibraryItem } from './tokenUtils';

describe('tokenUtils', () => {
  describe('getRecentTokens', () => {
    const library: LibraryItem[] = [
      { id: 'lib1', src: 'img1.png', thumbnailSrc: 'thumb1.png', name: 'Goblin' },
      { id: 'lib2', src: 'img2.png', thumbnailSrc: 'thumb2.png', name: 'Dragon' },
      { id: 'lib3', src: 'img3.png', thumbnailSrc: 'thumb3.png', name: 'Wizard' },
    ];

    it('returns empty array for no tokens', () => {
      expect(getRecentTokens([], library)).toEqual([]);
    });

    it('returns recent unique tokens in reverse order', () => {
      const tokens: Token[] = [
        { id: 't1', src: 'img1.png' },
        { id: 't2', src: 'img2.png' },
        { id: 't3', src: 'img1.png' }, // Repeat img1
      ];

      const result = getRecentTokens(tokens, library);

      // Should find img1 (most recent is t3), then img2
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('lib1');
      expect(result[1].id).toBe('lib2');
    });

    it('respects the limit', () => {
      const tokens: Token[] = [
        { id: 't1', src: 'img1.png' },
        { id: 't2', src: 'img2.png' },
        { id: 't3', src: 'img3.png' },
      ];

      const result = getRecentTokens(tokens, library, 2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('lib3'); // Most recent
      expect(result[1].id).toBe('lib2');
    });

    it('ignores tokens not in library', () => {
      const tokens: Token[] = [
          { id: 't1', src: 'unknown.png' },
          { id: 't2', src: 'img1.png' }
      ];
      const result = getRecentTokens(tokens, library);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lib1');
    });
  });
});
