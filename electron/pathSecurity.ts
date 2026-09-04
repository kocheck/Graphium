import fs from 'node:fs/promises';
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

// eslint-disable-next-line import/no-unused-modules -- covered by pathSecurity unit tests
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

/** @public Electron filename gate — covered by tests/unit/pathSecurity.spec.ts */
// eslint-disable-next-line import/no-unused-modules -- tests import this; production callers use rewriteSafeAssetFileName
export const sanitizeAssetFileName = (name: string): string => {
  const baseName = path.basename(name);
  if (!SAFE_FILE_NAME_PATTERN.test(baseName)) {
    throw new Error('Invalid asset filename');
  }

  return baseName;
};

export const isValidUuid = (value: string): boolean => UUID_PATTERN.test(value);

/**
 * Allocates a unique ZIP entry basename. Same source path should be cached by the
 * caller; this only disambiguates different files that share a basename.
 */
export const allocateUniqueZipBasename = (filePath: string, usedBasenames: Set<string>): string => {
  const baseName = path.basename(filePath);
  if (!usedBasenames.has(baseName)) {
    usedBasenames.add(baseName);
    return baseName;
  }

  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);
  let suffix = 2;
  let candidate = `${stem}-${suffix}${ext}`;
  while (usedBasenames.has(candidate)) {
    suffix += 1;
    candidate = `${stem}-${suffix}${ext}`;
  }
  usedBasenames.add(candidate);
  return candidate;
};

/**
 * Resolves symlinks via realpath, then checks the target against allowed roots
 * (also realpath'd when the root exists). Prevents escaping via symlink under an allowed root.
 */
export const isRealPathInsideAllowedRoots = async (
  targetPath: string,
  allowedRoots: string[],
): Promise<boolean> => {
  let realTarget: string;
  try {
    realTarget = await fs.realpath(targetPath);
  } catch {
    return false;
  }

  for (const root of allowedRoots) {
    let realRoot: string;
    try {
      realRoot = await fs.realpath(root);
    } catch {
      // Root may not exist yet (e.g. empty temp_assets). Fall back to resolve().
      realRoot = path.resolve(root);
    }
    if (isPathInsideOrEqual(realRoot, realTarget)) {
      return true;
    }
  }

  return false;
};
