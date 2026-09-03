import path from 'node:path';

const SAFE_FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isPathInside = (basePath: string, targetPath: string): boolean => {
  const baseResolved = path.resolve(basePath);
  const targetResolved = path.resolve(targetPath);
  const relativePath = path.relative(baseResolved, targetResolved);

  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

export const sanitizeAssetFileName = (name: string): string => {
  const baseName = path.basename(name);
  if (!SAFE_FILE_NAME_PATTERN.test(baseName)) {
    throw new Error('Invalid asset filename');
  }

  return baseName;
};

export const isValidUuid = (value: string): boolean => UUID_PATTERN.test(value);
