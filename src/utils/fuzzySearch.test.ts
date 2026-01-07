import { describe, it, expect } from 'vitest';
import { fuzzySearch, filterByCategory, getCategories } from './fuzzySearch';
import type { TokenLibraryItem } from '../store/gameStore';

describe('fuzzySearch', () => {
  const mockLibrary: TokenLibraryItem[] = [
    {
      id: '1',
      name: 'Red Dragon',
      src: 'red-dragon.png',
      thumbnailSrc: 'red-dragon-thumb.png',
      category: 'Monsters',
      tags: ['dragon', 'red', 'large', 'fire'],
      dateAdded: 1000,
    },
    {
      id: '2',
      name: 'Blue Dragon',
      src: 'blue-dragon.png',
      thumbnailSrc: 'blue-dragon-thumb.png',
      category: 'Monsters',
      tags: ['dragon', 'blue', 'large', 'lightning'],
      dateAdded: 2000,
    },
    {
      id: '3',
      name: 'Goblin',
      src: 'goblin.png',
      thumbnailSrc: 'goblin-thumb.png',
      category: 'Monsters',
      tags: ['goblin', 'small', 'humanoid'],
      dateAdded: 3000,
    },
    {
      id: '4',
      name: 'Hero Token',
      src: 'hero.png',
      thumbnailSrc: 'hero-thumb.png',
      category: 'PCs',
      tags: ['hero', 'player', 'warrior'],
      dateAdded: 4000,
    },
    {
      id: '5',
      name: 'Dragon Statue',
      src: 'statue.png',
      thumbnailSrc: 'statue-thumb.png',
      category: 'Props',
      tags: ['statue', 'decoration', 'dragon'],
      dateAdded: 5000,
    },
  ];

  describe('fuzzySearch function', () => {
    it('should return all items sorted by date when query is empty', () => {
      const results = fuzzySearch(mockLibrary, '');

      // Should return all items
      expect(results).toHaveLength(5);

      // Should be sorted by dateAdded (newest first)
      expect(results[0].id).toBe('5'); // dateAdded: 5000
      expect(results[1].id).toBe('4'); // dateAdded: 4000
      expect(results[2].id).toBe('3'); // dateAdded: 3000
    });

    it('should return all items when query is whitespace only', () => {
      const results = fuzzySearch(mockLibrary, '   ');

      expect(results).toHaveLength(5);
    });

    it('should match exact name', () => {
      const results = fuzzySearch(mockLibrary, 'Goblin');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Goblin');
    });

    it('should match case-insensitively', () => {
      const results = fuzzySearch(mockLibrary, 'goblin');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Goblin');
    });

    it('should match names that start with query', () => {
      const results = fuzzySearch(mockLibrary, 'Red');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Red Dragon');
    });

    it('should match names containing query', () => {
      const results = fuzzySearch(mockLibrary, 'Dragon');

      // Should match "Red Dragon", "Blue Dragon", and "Dragon Statue"
      expect(results).toHaveLength(3);
      expect(results.map((r) => r.name)).toContain('Red Dragon');
      expect(results.map((r) => r.name)).toContain('Blue Dragon');
      expect(results.map((r) => r.name)).toContain('Dragon Statue');
    });

    it('should match tags', () => {
      const results = fuzzySearch(mockLibrary, 'fire');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Red Dragon');
    });

    it('should match category', () => {
      const results = fuzzySearch(mockLibrary, 'Props');

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('Props');
    });

    it('should match partial words (fuzzy)', () => {
      const results = fuzzySearch(mockLibrary, 'drg');

      // Should match "Dragon" variants as "drg" is a subsequence of "Dragon"
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name.includes('Dragon'))).toBe(true);
    });

    it('should match multi-word queries', () => {
      const results = fuzzySearch(mockLibrary, 'red dragon');

      // Should match items with both "red" and "dragon"
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Red Dragon');
    });

    it('should prioritize exact matches over partial matches', () => {
      const results = fuzzySearch(mockLibrary, 'dragon');

      // All should match, but exact matches should score higher
      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by score (best matches first)
      expect(results[0].name).toContain('Dragon');
    });

    it('should prioritize name matches over tag matches', () => {
      const library: TokenLibraryItem[] = [
        {
          id: '1',
          name: 'Dragon Warrior',
          src: 'warrior.png',
          thumbnailSrc: 'warrior-thumb.png',
          category: 'PCs',
          tags: ['warrior'],
          dateAdded: 1000,
        },
        {
          id: '2',
          name: 'Goblin',
          src: 'goblin.png',
          thumbnailSrc: 'goblin-thumb.png',
          category: 'Monsters',
          tags: ['goblin', 'dragon'], // dragon as tag
          dateAdded: 2000,
        },
      ];

      const results = fuzzySearch(library, 'dragon');

      // "Dragon Warrior" (name match) should rank higher than "Goblin" (tag match)
      expect(results[0].name).toBe('Dragon Warrior');
    });

    it('should handle queries with special characters', () => {
      const library: TokenLibraryItem[] = [
        {
          id: '1',
          name: 'Dragon (Red)',
          src: 'dragon.png',
          thumbnailSrc: 'dragon-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 1000,
        },
      ];

      const results = fuzzySearch(library, 'dragon');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Dragon (Red)');
    });

    it('should return empty array when no matches found', () => {
      const results = fuzzySearch(mockLibrary, 'nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should handle empty library', () => {
      const results = fuzzySearch([], 'dragon');

      expect(results).toHaveLength(0);
    });

    it('should score exact matches highest (100 points)', () => {
      const library: TokenLibraryItem[] = [
        {
          id: '1',
          name: 'Dragon',
          src: 'dragon.png',
          thumbnailSrc: 'dragon-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 1000,
        },
        {
          id: '2',
          name: 'Red Dragon',
          src: 'red-dragon.png',
          thumbnailSrc: 'red-dragon-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 2000,
        },
      ];

      const results = fuzzySearch(library, 'Dragon');

      // Exact match should come first
      expect(results[0].name).toBe('Dragon');
      expect(results[1].name).toBe('Red Dragon');
    });

    it('should score "starts with" matches higher than "contains"', () => {
      const library: TokenLibraryItem[] = [
        {
          id: '1',
          name: 'Red Dragon',
          src: 'red-dragon.png',
          thumbnailSrc: 'red-dragon-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 1000,
        },
        {
          id: '2',
          name: 'Dragon Statue',
          src: 'statue.png',
          thumbnailSrc: 'statue-thumb.png',
          category: 'Props',
          tags: [],
          dateAdded: 2000,
        },
        {
          id: '3',
          name: 'Ancient Red Dragon',
          src: 'ancient.png',
          thumbnailSrc: 'ancient-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 3000,
        },
      ];

      const results = fuzzySearch(library, 'Dragon');

      // "Dragon Statue" (starts with) should rank higher than "Red Dragon" (contains)
      expect(results[0].name).toBe('Dragon Statue');
    });
  });

  describe('filterByCategory function', () => {
    it('should filter items by category', () => {
      const results = filterByCategory(mockLibrary, 'Monsters');

      expect(results).toHaveLength(3);
      expect(results.every((item) => item.category === 'Monsters')).toBe(true);
    });

    it('should filter case-insensitively', () => {
      const results = filterByCategory(mockLibrary, 'monsters');

      expect(results).toHaveLength(3);
    });

    it('should return all items when category is "All"', () => {
      const results = filterByCategory(mockLibrary, 'All');

      expect(results).toHaveLength(5);
    });

    it('should return all items when category is empty', () => {
      const results = filterByCategory(mockLibrary, '');

      expect(results).toHaveLength(5);
    });

    it('should return empty array when category not found', () => {
      const results = filterByCategory(mockLibrary, 'NonExistent');

      expect(results).toHaveLength(0);
    });

    it('should handle empty library', () => {
      const results = filterByCategory([], 'Monsters');

      expect(results).toHaveLength(0);
    });
  });

  describe('getCategories function', () => {
    it('should return unique categories sorted alphabetically', () => {
      const categories = getCategories(mockLibrary);

      expect(categories).toEqual(['Monsters', 'PCs', 'Props']);
    });

    it('should handle duplicate categories', () => {
      const library: TokenLibraryItem[] = [
        {
          id: '1',
          name: 'Item 1',
          src: 'item1.png',
          thumbnailSrc: 'item1-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 1000,
        },
        {
          id: '2',
          name: 'Item 2',
          src: 'item2.png',
          thumbnailSrc: 'item2-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 2000,
        },
        {
          id: '3',
          name: 'Item 3',
          src: 'item3.png',
          thumbnailSrc: 'item3-thumb.png',
          category: 'Props',
          tags: [],
          dateAdded: 3000,
        },
      ];

      const categories = getCategories(library);

      expect(categories).toEqual(['Monsters', 'Props']);
      expect(categories).toHaveLength(2);
    });

    it('should handle empty library', () => {
      const categories = getCategories([]);

      expect(categories).toHaveLength(0);
    });

    it('should sort categories alphabetically', () => {
      const library: TokenLibraryItem[] = [
        {
          id: '1',
          name: 'Item 1',
          src: 'item1.png',
          thumbnailSrc: 'item1-thumb.png',
          category: 'Zombies',
          tags: [],
          dateAdded: 1000,
        },
        {
          id: '2',
          name: 'Item 2',
          src: 'item2.png',
          thumbnailSrc: 'item2-thumb.png',
          category: 'Adventurers',
          tags: [],
          dateAdded: 2000,
        },
        {
          id: '3',
          name: 'Item 3',
          src: 'item3.png',
          thumbnailSrc: 'item3-thumb.png',
          category: 'Monsters',
          tags: [],
          dateAdded: 3000,
        },
      ];

      const categories = getCategories(library);

      expect(categories).toEqual(['Adventurers', 'Monsters', 'Zombies']);
    });
  });
});
