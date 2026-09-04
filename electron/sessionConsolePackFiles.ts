import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  isRealPathInsideAllowedRoots,
  mediaUrlToFilePath,
  sanitizeAssetFileName,
} from './pathSecurity.js';
import {
  isAllowedAudioFileName,
  LOCAL_AUDIO_REJECT_BYTES,
  pushLocalAudioSizeWarning,
  shouldWarnLocalAudioSize,
} from '../src/utils/localAudioLimits.js';
import {
  catalogToSessionConsolePack,
  classifyPackSrc,
  isPathInsidePackRoot,
  materializePack,
  parseSessionConsolePack,
  type PackHttpFetchResult,
} from '../src/utils/sessionConsolePack.js';

import type { SessionConsoleCatalog } from '../src/types/sessionConsole.js';

/* eslint-disable import/no-unused-modules -- copy/sandbox helpers are covered by tests/unit */

export interface SessionConsolePackImportResult {
  catalog: SessionConsoleCatalog;
  skipped: string[];
  warnings: string[];
}

function sanitizePackFileName(name: string): string {
  const baseName = path.basename(name);
  try {
    return sanitizeAssetFileName(baseName);
  } catch {
    const safe = baseName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return safe || 'asset';
  }
}

const ensuredTempDirs = new Set<string>();

async function ensureTempAssetsDir(tempAssetsDir: string): Promise<void> {
  if (ensuredTempDirs.has(tempAssetsDir)) {
    return;
  }
  await fs.mkdir(tempAssetsDir, { recursive: true });
  ensuredTempDirs.add(tempAssetsDir);
}

function uniqueTempAssetPath(tempAssetsDir: string, fileName: string): string {
  return path.join(
    tempAssetsDir,
    `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizePackFileName(fileName)}`,
  );
}

/**
 * Resolve a relative pack path with realpath and require it to stay inside packRoot.
 * Absolute paths are allowed as a convenience and only need to exist.
 */
export async function resolveSandboxedPackPath(
  packRoot: string,
  requested: string,
): Promise<string | null> {
  const classified = classifyPackSrc(requested);
  let candidate: string;
  if (classified.kind === 'relative') {
    candidate = path.resolve(packRoot, classified.path);
  } else if (classified.kind === 'absolute') {
    candidate = classified.path;
  } else if (!path.isAbsolute(requested)) {
    candidate = path.resolve(packRoot, requested);
  } else {
    candidate = requested;
  }

  const mustStayInPack =
    classified.kind === 'relative' || !path.isAbsolute(path.resolve(candidate));
  if (classified.kind === 'relative' || (mustStayInPack && classified.kind !== 'absolute')) {
    try {
      const realRoot = await fs.realpath(packRoot);
      const realTarget = await fs.realpath(candidate);
      if (!isPathInsidePackRoot(realRoot, realTarget)) {
        return null;
      }
      return realTarget;
    } catch {
      return null;
    }
  }

  try {
    return await fs.realpath(candidate);
  } catch {
    return null;
  }
}

/**
 * Copy a sandboxed pack file into temp_assets. Audio uses the same 8MB/25MB gates as localAudioAsset.
 */
export async function copyPackAssetToTemp(
  sourcePath: string,
  tempAssetsDir: string,
  kind: 'image' | 'audio',
  warnings: string[] = [],
): Promise<string | null> {
  const fileName = path.basename(sourcePath);
  if (kind === 'audio') {
    if (!isAllowedAudioFileName(fileName)) {
      return null;
    }
    const stats = await fs.stat(sourcePath);
    if (stats.size > LOCAL_AUDIO_REJECT_BYTES) {
      return null;
    }
    if (shouldWarnLocalAudioSize(stats.size)) {
      pushLocalAudioSizeWarning(warnings);
    }
  }

  await ensureTempAssetsDir(tempAssetsDir);
  const destPath = uniqueTempAssetPath(tempAssetsDir, fileName);
  await fs.copyFile(sourcePath, destPath);
  return `file://${destPath}`;
}

async function persistBufferToTemp(
  buffer: ArrayBuffer,
  fileName: string,
  tempAssetsDir: string,
): Promise<string | null> {
  if (isAllowedAudioFileName(fileName) && buffer.byteLength > LOCAL_AUDIO_REJECT_BYTES) {
    return null;
  }
  await ensureTempAssetsDir(tempAssetsDir);
  const destPath = uniqueTempAssetPath(tempAssetsDir, fileName);
  await fs.writeFile(destPath, Buffer.from(buffer));
  return `file://${destPath}`;
}

/**
 * Read board.json, sandbox relative files under its directory, copy into temp_assets.
 */
export async function ingestSessionConsolePackFromBoardPath(
  boardJsonPath: string,
  tempAssetsDir: string,
  fetchHttp?: (url: string) => Promise<PackHttpFetchResult | ArrayBuffer | null>,
): Promise<SessionConsolePackImportResult> {
  const rawText = await fs.readFile(boardJsonPath, 'utf8');
  const json = JSON.parse(rawText) as unknown;
  const { pack, errors } = parseSessionConsolePack(json);
  const packRoot = path.dirname(boardJsonPath);
  const warnings: string[] = [];
  await ensureTempAssetsDir(tempAssetsDir);

  const materialized = await materializePack(
    pack,
    async (relativeOrAbsolute) => {
      const sandboxed = await resolveSandboxedPackPath(packRoot, relativeOrAbsolute);
      if (!sandboxed) {
        return null;
      }
      const kind = isAllowedAudioFileName(sandboxed) ? 'audio' : 'image';
      return copyPackAssetToTemp(sandboxed, tempAssetsDir, kind, warnings);
    },
    fetchHttp,
    async (buffer, fileName) => persistBufferToTemp(buffer, fileName, tempAssetsDir),
  );

  return {
    catalog: materialized.catalog,
    skipped: [...errors, ...materialized.skipped],
    warnings: [...new Set([...warnings, ...materialized.warnings])],
  };
}

export interface SessionConsolePackExportResult {
  ok: boolean;
  skipped: string[];
}

async function copyCatalogAssetOut(
  src: string,
  destPath: string,
  allowedRoots: string[],
): Promise<string | null> {
  let sourcePath: string;
  try {
    sourcePath = mediaUrlToFilePath(src);
  } catch {
    return `Cannot export asset (not a local file): ${src}`;
  }
  const allowed = await isRealPathInsideAllowedRoots(sourcePath, allowedRoots);
  if (!allowed) {
    return `Refusing to export file outside campaign asset roots: ${sourcePath}`;
  }
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.copyFile(sourcePath, destPath);
  return null;
}

/**
 * Resolve an export destination under destDir. Ids are basenames only; dest must stay inside destDir.
 */
export async function resolveSandboxedExportDest(
  destDir: string,
  relativeSrc: string,
): Promise<string | null> {
  const trimmed = relativeSrc.replace(/^\.\//, '');
  const folder = trimmed.startsWith('audio/') ? 'audio' : 'images';
  const rawName = path.basename(trimmed);
  let fileName: string;
  try {
    fileName = sanitizeAssetFileName(rawName);
  } catch {
    fileName = sanitizePackFileName(rawName);
  }
  if (fileName === '.' || fileName === '..') {
    return null;
  }

  const destPath = path.resolve(destDir, folder, fileName);
  let realDestDir: string;
  try {
    realDestDir = await fs.realpath(destDir);
  } catch {
    realDestDir = path.resolve(destDir);
  }
  if (!isPathInsidePackRoot(realDestDir, destPath) || destPath === realDestDir) {
    return null;
  }
  return destPath;
}

/**
 * Write board.json plus copied image/audio files into destDir.
 */
export async function exportSessionConsolePackToDirectory(
  catalog: SessionConsoleCatalog,
  destDir: string,
  allowedRoots: string[],
): Promise<SessionConsolePackExportResult> {
  const pack = catalogToSessionConsolePack(catalog);
  const skipped: string[] = [];

  await fs.mkdir(path.join(destDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(destDir, 'audio'), { recursive: true });

  for (const set of catalog.imageSets) {
    for (const image of set.images) {
      const rel = pack.imageSets
        .find((item) => item.id === set.id)
        ?.images.find((item) => item.id === image.id)?.src;
      if (!rel) {
        continue;
      }
      const destPath = await resolveSandboxedExportDest(destDir, rel);
      if (!destPath) {
        skipped.push(`Refusing to export image "${image.id}" outside destination folder`);
        continue;
      }
      const error = await copyCatalogAssetOut(image.src, destPath, allowedRoots);
      if (error) {
        skipped.push(error);
      }
    }
  }

  for (const group of catalog.trackGroups) {
    for (const track of group.tracks) {
      if (track.source !== 'local' || !track.src) {
        continue;
      }
      const rel = pack.trackGroups
        .find((item) => item.id === group.id)
        ?.tracks.find((item) => item.id === track.id)?.src;
      if (!rel) {
        continue;
      }
      const destPath = await resolveSandboxedExportDest(destDir, rel);
      if (!destPath) {
        skipped.push(`Refusing to export track "${track.id}" outside destination folder`);
        continue;
      }
      const error = await copyCatalogAssetOut(track.src, destPath, allowedRoots);
      if (error) {
        skipped.push(error);
      }
    }
  }

  await fs.writeFile(
    path.join(destDir, 'board.json'),
    `${JSON.stringify(pack, null, 2)}\n`,
    'utf8',
  );
  return { ok: skipped.length === 0, skipped };
}
