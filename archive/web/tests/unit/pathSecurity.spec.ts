import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import {
  allocateUniqueZipBasename,
  isPathInside,
  isPathInsideOrEqual,
  isRealPathInsideAllowedRoots,
  sanitizeAssetFileName,
  isValidUuid,
  mediaUrlToFilePath,
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

  describe('mediaUrlToFilePath', () => {
    it('converts media:// URLs to resolved filesystem paths', () => {
      expect(mediaUrlToFilePath('media:///tmp/graphium/token.webp')).toBe(
        path.resolve('/tmp/graphium/token.webp'),
      );
    });

    it('accepts file:// URLs', () => {
      expect(mediaUrlToFilePath('file:///tmp/graphium/token.webp')).toBe(
        path.resolve('/tmp/graphium/token.webp'),
      );
    });

    it('rejects non-file/media schemes', () => {
      expect(() => mediaUrlToFilePath('https://example.com/token.webp')).toThrow();
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

  describe('allocateUniqueZipBasename', () => {
    it('keeps the first basename and suffixes collisions', () => {
      const used = new Set<string>();
      expect(allocateUniqueZipBasename('/a/token.webp', used)).toBe('token.webp');
      expect(allocateUniqueZipBasename('/b/token.webp', used)).toBe('token-2.webp');
      expect(allocateUniqueZipBasename('/c/token.webp', used)).toBe('token-3.webp');
      expect(allocateUniqueZipBasename('/d/other.webp', used)).toBe('other.webp');
    });
  });

  describe('isRealPathInsideAllowedRoots', () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
      await Promise.all(
        tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
      );
    });

    it('accepts files under an allowed root', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'graphium-root-'));
      tempDirs.push(root);
      const filePath = path.join(root, 'token.webp');
      await fs.writeFile(filePath, 'x');
      await expect(isRealPathInsideAllowedRoots(filePath, [root])).resolves.toBe(true);
    });

    it('rejects symlink escape outside allowed roots', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'graphium-root-'));
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'graphium-out-'));
      tempDirs.push(root, outside);
      const secret = path.join(outside, 'secret.txt');
      await fs.writeFile(secret, 'secret');
      const linkPath = path.join(root, 'escape.txt');
      await fs.symlink(secret, linkPath);
      await expect(isRealPathInsideAllowedRoots(linkPath, [root])).resolves.toBe(false);
    });
  });
});
