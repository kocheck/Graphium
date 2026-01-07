import { describe, it, expect } from 'vitest';
import {
  getRecentTokens,
  getPlayerTokens,
  deduplicatePlayerTokens,
  Token,
  LibraryItem,
} from './tokenUtils';

describe('tokenUtils', () => {
  describe('getRecentTokens', () => {
    const library: LibraryItem[] = [
      {
        id: 'lib1',
        src: 'img1.png',
        thumbnailSrc: 'thumb1.png',
        name: 'Goblin',
        category: 'Monster',
        tags: [],
        dateAdded: Date.now(),
      },
      {
        id: 'lib2',
        src: 'img2.png',
        thumbnailSrc: 'thumb2.png',
        name: 'Dragon',
        category: 'Monster',
        tags: [],
        dateAdded: Date.now(),
      },
      {
        id: 'lib3',
        src: 'img3.png',
        thumbnailSrc: 'thumb3.png',
        name: 'Wizard',
        category: 'Player',
        tags: [],
        dateAdded: Date.now(),
      },
    ];

    it('returns empty array for no tokens', () => {
      expect(getRecentTokens([], library)).toEqual([]);
    });

    it('returns recent unique tokens in reverse order', () => {
      const tokens: Token[] = [
        { id: 't1', x: 0, y: 0, src: 'img1.png' },
        { id: 't2', x: 0, y: 0, src: 'img2.png' },
        { id: 't3', x: 0, y: 0, src: 'img1.png' }, // Repeat img1
      ];

      const result = getRecentTokens(tokens, library);

      // Should find img1 (most recent is t3), then img2
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('lib1');
      expect(result[1].id).toBe('lib2');
    });

    it('respects the limit', () => {
      const tokens: Token[] = [
        { id: 't1', x: 0, y: 0, src: 'img1.png' },
        { id: 't2', x: 0, y: 0, src: 'img2.png' },
        { id: 't3', x: 0, y: 0, src: 'img3.png' },
      ];

      const result = getRecentTokens(tokens, library, 2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('lib3'); // Most recent
      expect(result[1].id).toBe('lib2');
    });

    it('ignores tokens not in library', () => {
      const tokens: Token[] = [
        { id: 't1', x: 0, y: 0, src: 'unknown.png' },
        { id: 't2', x: 0, y: 0, src: 'img1.png' },
      ];
      const result = getRecentTokens(tokens, library);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lib1');
    });
  });

  describe('getPlayerTokens', () => {
    const baseDate = Date.now();
    const library: LibraryItem[] = [
      {
        id: 'npc1',
        src: 'npc1.png',
        thumbnailSrc: 'thumb-npc1.png',
        name: 'Goblin',
        category: 'Monster',
        tags: ['monster'],
        dateAdded: baseDate - 1000,
        defaultType: 'NPC',
      },
      {
        id: 'pc1',
        src: 'pc1.png',
        thumbnailSrc: 'thumb-pc1.png',
        name: 'Warrior',
        category: 'Player',
        tags: ['player'],
        dateAdded: baseDate - 500,
        defaultType: 'PC',
      },
      {
        id: 'pc2',
        src: 'pc2.png',
        thumbnailSrc: 'thumb-pc2.png',
        name: 'Wizard',
        category: 'Player',
        tags: ['player'],
        dateAdded: baseDate - 300,
        defaultType: 'PC',
      },
      {
        id: 'pc3',
        src: 'pc3.png',
        thumbnailSrc: 'thumb-pc3.png',
        name: 'Rogue',
        category: 'Player',
        tags: ['player'],
        dateAdded: baseDate - 100,
        defaultType: 'PC',
      },
      {
        id: 'noType',
        src: 'noType.png',
        thumbnailSrc: 'thumb-noType.png',
        name: 'Unknown',
        category: 'Other',
        tags: [],
        dateAdded: baseDate,
      },
    ];

    it('returns tokens with defaultType PC OR category PC', () => {
      const result = getPlayerTokens(library);
      expect(result).toHaveLength(3);
      expect(result.every((token) => token.defaultType === 'PC' || token.category === 'PC')).toBe(
        true,
      );
    });

    it('includes tokens with category PC even if defaultType is undefined', () => {
      const pcCategoryLibrary: LibraryItem[] = [
        {
          id: 'cat-pc',
          src: 'cat-pc.png',
          thumbnailSrc: 'thumb.png',
          name: 'Category Player',
          category: 'PC',
          tags: [],
          dateAdded: Date.now(),
        },
      ];
      const result = getPlayerTokens(pcCategoryLibrary);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-pc');
    });

    it('sorts by dateAdded (most recent first)', () => {
      const result = getPlayerTokens(library);
      expect(result[0].id).toBe('pc3'); // Most recent
      expect(result[1].id).toBe('pc2');
      expect(result[2].id).toBe('pc1'); // Oldest
    });

    it('respects the limit parameter', () => {
      const result = getPlayerTokens(library, 2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('pc3');
      expect(result[1].id).toBe('pc2');
    });

    it('returns empty array when no PC tokens exist', () => {
      const npcOnlyLibrary: LibraryItem[] = [
        {
          id: 'npc1',
          src: 'npc1.png',
          thumbnailSrc: 'thumb-npc1.png',
          name: 'Goblin',
          category: 'Monster',
          tags: [],
          dateAdded: Date.now(),
          defaultType: 'NPC',
        },
      ];
      const result = getPlayerTokens(npcOnlyLibrary);
      expect(result).toEqual([]);
    });

    it('handles empty library', () => {
      const result = getPlayerTokens([]);
      expect(result).toEqual([]);
    });

    it('uses default limit of 5', () => {
      const largeLibrary: LibraryItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `pc${i}`,
        src: `pc${i}.png`,
        thumbnailSrc: `thumb-pc${i}.png`,
        name: `Player ${i}`,
        category: 'Player',
        tags: [],
        dateAdded: baseDate - i * 100,
        defaultType: 'PC' as const,
      }));

      const result = getPlayerTokens(largeLibrary);
      expect(result).toHaveLength(5);
    });
  });

  describe('deduplicatePlayerTokens', () => {
    const playerTokens: LibraryItem[] = [
      {
        id: 'pc1',
        src: 'pc1.png',
        thumbnailSrc: 'thumb-pc1.png',
        name: 'Warrior',
        category: 'Player',
        tags: [],
        dateAdded: Date.now(),
        defaultType: 'PC',
      },
      {
        id: 'pc2',
        src: 'pc2.png',
        thumbnailSrc: 'thumb-pc2.png',
        name: 'Wizard',
        category: 'Player',
        tags: [],
        dateAdded: Date.now(),
        defaultType: 'PC',
      },
      {
        id: 'pc3',
        src: 'pc3.png',
        thumbnailSrc: 'thumb-pc3.png',
        name: 'Rogue',
        category: 'Player',
        tags: [],
        dateAdded: Date.now(),
        defaultType: 'PC',
      },
    ];

    it('removes player tokens that appear in recent tokens', () => {
      const recentTokens: LibraryItem[] = [playerTokens[0]]; // pc1 is recent
      const result = deduplicatePlayerTokens(playerTokens, recentTokens);

      expect(result).toHaveLength(2);
      expect(result.find((t) => t.id === 'pc1')).toBeUndefined();
      expect(result.find((t) => t.id === 'pc2')).toBeDefined();
      expect(result.find((t) => t.id === 'pc3')).toBeDefined();
    });

    it('removes multiple player tokens if they appear in recent', () => {
      const recentTokens: LibraryItem[] = [playerTokens[0], playerTokens[1]];
      const result = deduplicatePlayerTokens(playerTokens, recentTokens);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pc3');
    });

    it('returns all player tokens when none are in recent', () => {
      const recentTokens: LibraryItem[] = [];
      const result = deduplicatePlayerTokens(playerTokens, recentTokens);

      expect(result).toEqual(playerTokens);
    });

    it('handles empty player tokens array', () => {
      const recentTokens: LibraryItem[] = [playerTokens[0]];
      const result = deduplicatePlayerTokens([], recentTokens);

      expect(result).toEqual([]);
    });

    it('handles empty recent tokens array', () => {
      const result = deduplicatePlayerTokens(playerTokens, []);
      expect(result).toEqual(playerTokens);
    });

    it('matches tokens by src property', () => {
      const recentTokens: LibraryItem[] = [
        {
          id: 'different-id', // Different ID
          src: 'pc1.png', // Same src as pc1
          thumbnailSrc: 'thumb-pc1.png',
          name: 'Warrior',
          category: 'Player',
          tags: [],
          dateAdded: Date.now(),
          defaultType: 'PC',
        },
      ];

      const result = deduplicatePlayerTokens(playerTokens, recentTokens);

      // Should still filter out pc1 because src matches
      expect(result).toHaveLength(2);
      expect(result.find((t) => t.id === 'pc1')).toBeUndefined();
    });

    it('returns empty array when all player tokens are in recent', () => {
      const result = deduplicatePlayerTokens(playerTokens, playerTokens);
      expect(result).toEqual([]);
    });
  });
});
