import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAFE_FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// eslint-disable-next-line import/no-unused-modules -- covered by pathSecurity unit tests
export const isPathInside = (basePath: string, targetPath: string): boolean => {
  const baseResolved = path.resolve(basePath);
  const targetResolved = path.resolve(targetPath);
  const relativePath = path.relative(baseResolved, targetResolved);

  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

export const isPathInsideOrEqual = (basePath: string, targetPath: string): boolean => {
  const baseResolved = path.resolve(basePath);
  const targetResolved = path.resolve(targetPath);

  return targetResolved === baseResolved || isPathInside(baseResolved, targetResolved);
};

/**
 * Converts a `media://` or `file://` URL into a resolved filesystem path.
 * `fileURLToPath` only accepts the `file:` scheme, so media URLs are normalized first.
 */
export const mediaUrlToFilePath = (url: string): string => {
  const fileUrl = url.replace(/^media:/i, 'file:');
  return path.resolve(fileURLToPath(fileUrl));
};

export const sanitizeAssetFileName = (name: string): string => {
  const baseName = path.basename(name);
  if (!SAFE_FILE_NAME_PATTERN.test(baseName)) {
    throw new Error('Invalid asset filename');
  }

  return baseName;
};

export const isValidUuid = (value: string): boolean => UUID_PATTERN.test(value);
