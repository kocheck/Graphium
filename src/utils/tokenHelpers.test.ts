import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addLibraryTokenToMap } from './tokenHelpers';
import type { TokenLibraryItem, MapConfig } from '../store/gameStore';

describe('tokenHelpers', () => {
  describe('addLibraryTokenToMap', () => {
    let mockAddToken: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockAddToken = vi.fn();
    });

    it('should create a token instance with libraryItemId reference', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Goblin',
        src: 'goblin.png',
        thumbnailSrc: 'goblin-thumb.png',
        category: 'Monsters',
        tags: ['goblin'],
        dateAdded: Date.now(),
        defaultScale: 1,
        defaultType: 'NPC',
        defaultVisionRadius: 30,
      };

      const map: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 2000,
        height: 2000,
        scale: 1,
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, map);

      // Should call addToken
      expect(mockAddToken).toHaveBeenCalledOnce();

      // Should create token with correct properties
      expect(result.id).toBeDefined();
      expect(result.libraryItemId).toBe('lib-1');
      expect(result.src).toBe('goblin.png');

      // Should NOT include metadata properties (inherited from library)
      expect(result.scale).toBeUndefined();
      expect(result.type).toBeUndefined();
      expect(result.visionRadius).toBeUndefined();
      expect(result.name).toBeUndefined();
    });

    it('should place token at center of map when map exists', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Hero',
        src: 'hero.png',
        thumbnailSrc: 'hero-thumb.png',
        category: 'PCs',
        tags: [],
        dateAdded: Date.now(),
      };

      const map: MapConfig = {
        src: 'map.png',
        x: 100,
        y: 200,
        width: 1000,
        height: 1000,
        scale: 1,
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, map);

      // Center should be map.x + (map.width * map.scale) / 2
      const expectedCenterX = 100 + (1000 * 1) / 2; // 600
      const expectedCenterY = 200 + (1000 * 1) / 2; // 700

      expect(result.x).toBe(expectedCenterX);
      expect(result.y).toBe(expectedCenterY);
    });

    it('should account for map scale when calculating center', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Hero',
        src: 'hero.png',
        thumbnailSrc: 'hero-thumb.png',
        category: 'PCs',
        tags: [],
        dateAdded: Date.now(),
      };

      const map: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        scale: 2, // Scaled 2x
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, map);

      // Center should account for scale: (width * scale) / 2
      const expectedCenterX = 0 + (1000 * 2) / 2; // 1000
      const expectedCenterY = 0 + (1000 * 2) / 2; // 1000

      expect(result.x).toBe(expectedCenterX);
      expect(result.y).toBe(expectedCenterY);
    });

    it('should place token at (500, 500) when no map loaded', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Hero',
        src: 'hero.png',
        thumbnailSrc: 'hero-thumb.png',
        category: 'PCs',
        tags: [],
        dateAdded: Date.now(),
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, null);

      // Default position when no map
      expect(result.x).toBe(500);
      expect(result.y).toBe(500);
    });

    it('should generate unique IDs for each token', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Goblin',
        src: 'goblin.png',
        thumbnailSrc: 'goblin-thumb.png',
        category: 'Monsters',
        tags: [],
        dateAdded: Date.now(),
      };

      const result1 = addLibraryTokenToMap(libraryItem, mockAddToken, null);
      const result2 = addLibraryTokenToMap(libraryItem, mockAddToken, null);

      // Each token should have a different ID
      expect(result1.id).not.toBe(result2.id);
    });

    it('should call addToken with the created token', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Dragon',
        src: 'dragon.png',
        thumbnailSrc: 'dragon-thumb.png',
        category: 'Monsters',
        tags: [],
        dateAdded: Date.now(),
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, null);

      // Should have called addToken with the created token
      expect(mockAddToken).toHaveBeenCalledWith(result);
    });

    it('should handle map at origin (0, 0)', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Hero',
        src: 'hero.png',
        thumbnailSrc: 'hero-thumb.png',
        category: 'PCs',
        tags: [],
        dateAdded: Date.now(),
      };

      const map: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 2000,
        height: 2000,
        scale: 1,
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, map);

      // Center of map at origin
      expect(result.x).toBe(1000);
      expect(result.y).toBe(1000);
    });

    it('should handle map with negative position', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Hero',
        src: 'hero.png',
        thumbnailSrc: 'hero-thumb.png',
        category: 'PCs',
        tags: [],
        dateAdded: Date.now(),
      };

      const map: MapConfig = {
        src: 'map.png',
        x: -500,
        y: -300,
        width: 1000,
        height: 800,
        scale: 1,
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, map);

      // Center calculation should handle negative positions
      const expectedCenterX = -500 + (1000 * 1) / 2; // 0
      const expectedCenterY = -300 + (800 * 1) / 2; // 100

      expect(result.x).toBe(expectedCenterX);
      expect(result.y).toBe(expectedCenterY);
    });

    it('should copy the library item src to the token', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Wizard',
        src: 'wizard-fullsize.png',
        thumbnailSrc: 'wizard-thumb.png',
        category: 'PCs',
        tags: [],
        dateAdded: Date.now(),
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, null);

      // Should use the full-size src, not the thumbnail
      expect(result.src).toBe('wizard-fullsize.png');
    });

    it('should return the created token for caller use', () => {
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Token',
        src: 'token.png',
        thumbnailSrc: 'token-thumb.png',
        category: 'Props',
        tags: [],
        dateAdded: Date.now(),
      };

      const result = addLibraryTokenToMap(libraryItem, mockAddToken, null);

      // Should return a complete token
      expect(result).toMatchObject({
        id: expect.any(String),
        x: 500,
        y: 500,
        src: 'token.png',
        libraryItemId: 'lib-1',
      });
    });
  });
});
