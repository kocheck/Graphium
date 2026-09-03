import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isPathInside,
  isPathInsideOrEqual,
  sanitizeAssetFileName,
  isValidUuid,
} from '../../electron/pathSecurity';

describe('pathSecurity', () => {
  describe('isPathInside', () => {
    it('returns true for nested child paths', () => {
      const base = '/tmp/graphium/userData';
      const target = '/tmp/graphium/userData/temp_assets/token.webp';
      expect(isPathInside(base, target)).toBe(true);
    });

    it('returns false for traversal paths', () => {
      const base = '/tmp/graphium/userData';
      const target = '/tmp/graphium/secret.txt';
      expect(isPathInside(base, target)).toBe(false);
    });

    it('returns false for equal paths', () => {
      const base = '/tmp/graphium/userData';
      expect(isPathInside(base, base)).toBe(false);
    });
  });

  describe('isPathInsideOrEqual', () => {
    it('returns true for equal paths', () => {
      const base = '/tmp/graphium/userData';
      expect(isPathInsideOrEqual(base, base)).toBe(true);
    });

    it('returns true for nested child paths', () => {
      const base = '/tmp/graphium/userData';
      const target = '/tmp/graphium/userData/temp_assets/token.webp';
      expect(isPathInsideOrEqual(base, target)).toBe(true);
    });

    it('returns false for traversal paths', () => {
      const base = '/tmp/graphium/userData';
      const target = '/tmp/graphium/secret.txt';
      expect(isPathInsideOrEqual(base, target)).toBe(false);
    });
  });

  describe('sanitizeAssetFileName', () => {
    it('keeps a safe basename', () => {
      expect(sanitizeAssetFileName('goblin-token.webp')).toBe('goblin-token.webp');
    });

    it('strips path segments', () => {
      expect(sanitizeAssetFileName(path.join('..', 'goblin.webp'))).toBe('goblin.webp');
    });

    it('rejects unsafe characters', () => {
      expect(() => sanitizeAssetFileName('bad name.webp')).toThrow('Invalid asset filename');
    });
  });

  describe('isValidUuid', () => {
    it('accepts valid UUIDs', () => {
      expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      expect(isValidUuid('../not-a-uuid')).toBe(false);
    });
  });
});
