import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LOCAL_AUDIO_REJECT_BYTES } from '../../src/utils/localAudioAsset';
import { parseSessionConsolePack } from '../../src/utils/sessionConsolePack';
import {
  copyPackAssetToTemp,
  exportSessionConsolePackToDirectory,
  ingestSessionConsolePackFromBoardPath,
  resolveSandboxedPackPath,
} from '../../electron/sessionConsolePackFiles';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('resolveSandboxedPackPath', () => {
  it('accepts files under the pack root and rejects traversal', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const inside = path.join(packRoot, 'images', 'a.png');
    await fs.mkdir(path.dirname(inside), { recursive: true });
    await fs.writeFile(inside, 'img');

    await expect(resolveSandboxedPackPath(packRoot, './images/a.png')).resolves.toBe(
      await fs.realpath(inside),
    );
    await expect(resolveSandboxedPackPath(packRoot, '../secret.txt')).resolves.toBeNull();
  });

  it('rejects symlink escape outside the pack root', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const outside = await makeTempDir('graphium-out-');
    const secret = path.join(outside, 'secret.txt');
    await fs.writeFile(secret, 'secret');
    const linkPath = path.join(packRoot, 'escape.png');
    await fs.symlink(secret, linkPath);

    await expect(resolveSandboxedPackPath(packRoot, './escape.png')).resolves.toBeNull();
  });
});

describe('copyPackAssetToTemp', () => {
  it('skips oversized local audio the same way as localAudioAsset', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const tempAssets = await makeTempDir('graphium-temp-');
    const audioPath = path.join(packRoot, 'huge.mp3');
    await fs.writeFile(audioPath, Buffer.alloc(LOCAL_AUDIO_REJECT_BYTES + 1));

    const copied = await copyPackAssetToTemp(audioPath, tempAssets, 'audio');
    expect(copied).toBeNull();
    expect(await fs.readdir(tempAssets)).toEqual([]);
  });

  it('copies allowed audio under the size gate', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const tempAssets = await makeTempDir('graphium-temp-');
    const audioPath = path.join(packRoot, 'bed.mp3');
    await fs.writeFile(audioPath, 'audio-bytes');

    const copied = await copyPackAssetToTemp(audioPath, tempAssets, 'audio');
    expect(copied).toMatch(/^file:\/\//);
    const destPath = copied?.replace(/^file:\/\//, '') ?? '';
    expect(await fs.readFile(destPath, 'utf8')).toBe('audio-bytes');
  });
});

describe('ingestSessionConsolePackFromBoardPath', () => {
  it('materializes relative files from beside board.json into temp_assets', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const tempAssets = await makeTempDir('graphium-temp-');
    await fs.mkdir(path.join(packRoot, 'images'), { recursive: true });
    await fs.mkdir(path.join(packRoot, 'audio'), { recursive: true });
    await fs.writeFile(path.join(packRoot, 'images', 'campaign-opener.png'), 'plate');
    await fs.writeFile(path.join(packRoot, 'images', 'skeldra-island-overview.png'), 'map');
    await fs.writeFile(path.join(packRoot, 'images', 'session-3-01-breakfast.png'), 'breakfast');
    await fs.writeFile(path.join(packRoot, 'audio', 'shelter-rain.mp3'), 'rain');

    const example = JSON.parse(
      await fs.readFile(
        path.resolve(process.cwd(), 'docs/planning/session-console-pack.example.json'),
        'utf8',
      ),
    ) as unknown;
    const boardPath = path.join(packRoot, 'board.json');
    await fs.writeFile(boardPath, JSON.stringify(example));

    const result = await ingestSessionConsolePackFromBoardPath(boardPath, tempAssets);
    expect(result.skipped).toEqual([]);
    expect(result.catalog.trackGroups[0]?.tracks[0]?.youtubeId).toBe('bLZApMsorjA');
    expect(result.catalog.imageSets[0]?.images[0]?.src).toMatch(/^file:\/\//);
    expect(result.catalog.trackGroups[0]?.tracks[1]?.src).toMatch(/^file:\/\//);
  });
});

describe('exportSessionConsolePackToDirectory', () => {
  it('writes board.json and copies ingested assets into images/ and audio/', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const tempAssets = await makeTempDir('graphium-temp-');
    const exportDir = await makeTempDir('graphium-export-');
    await fs.mkdir(path.join(packRoot, 'images'), { recursive: true });
    await fs.mkdir(path.join(packRoot, 'audio'), { recursive: true });
    await fs.writeFile(path.join(packRoot, 'images', 'campaign-opener.png'), 'plate');
    await fs.writeFile(path.join(packRoot, 'images', 'skeldra-island-overview.png'), 'map');
    await fs.writeFile(path.join(packRoot, 'images', 'session-3-01-breakfast.png'), 'breakfast');
    await fs.writeFile(path.join(packRoot, 'audio', 'shelter-rain.mp3'), 'rain');

    const example = JSON.parse(
      await fs.readFile(
        path.resolve(process.cwd(), 'docs/planning/session-console-pack.example.json'),
        'utf8',
      ),
    ) as unknown;
    await fs.writeFile(path.join(packRoot, 'board.json'), JSON.stringify(example));

    const { catalog } = await ingestSessionConsolePackFromBoardPath(
      path.join(packRoot, 'board.json'),
      tempAssets,
    );
    const { skipped } = await exportSessionConsolePackToDirectory(catalog, exportDir, [tempAssets]);
    expect(skipped).toEqual([]);

    const written = JSON.parse(
      await fs.readFile(path.join(exportDir, 'board.json'), 'utf8'),
    ) as unknown;
    const { pack } = parseSessionConsolePack(written);
    expect(pack.trackGroups[0]?.tracks[0]?.src).toContain('youtube.com/watch');
    expect(pack.imageSets[0]?.images[0]?.src).toMatch(/^\.\/images\//);
    expect(await fs.readFile(path.join(exportDir, 'images', 'campaign-opener.png'), 'utf8')).toBe(
      'plate',
    );
    expect(
      await fs.readFile(path.join(exportDir, 'audio', 'shelter-from-the-rain.mp3'), 'utf8'),
    ).toBe('rain');
  });
});
