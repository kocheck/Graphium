import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { emptySessionConsoleCatalog } from '../../src/types/sessionConsole';
import { LOCAL_AUDIO_REJECT_BYTES } from '../../src/utils/localAudioLimits';
import { isPathInsidePackRoot, parseSessionConsolePack } from '../../src/utils/sessionConsolePack';
import {
  copyPackAssetToTemp,
  exportSessionConsolePackToDirectory,
  ingestSessionConsolePackFromBoardPath,
  resolveSandboxedExportDest,
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

  it('rejects absolute paths outside the pack root', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const outside = await makeTempDir('graphium-out-');
    const secret = path.join(outside, 'id_rsa');
    await fs.writeFile(secret, 'secret');

    await expect(resolveSandboxedPackPath(packRoot, secret)).resolves.toBeNull();
    await expect(
      resolveSandboxedPackPath(packRoot, path.join(packRoot, 'missing.png')),
    ).resolves.toBeNull();
  });
});

describe('copyPackAssetToTemp', () => {
  it('skips oversized local images', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const tempAssets = await makeTempDir('graphium-temp-');
    const imagePath = path.join(packRoot, 'huge.png');
    await fs.writeFile(imagePath, Buffer.alloc(25 * 1024 * 1024 + 1));

    const copied = await copyPackAssetToTemp(imagePath, tempAssets, 'image');
    expect(copied).toBeNull();
    expect(await fs.readdir(tempAssets)).toEqual([]);
  });

  it('skips oversized local audio the same way as localAudioAsset', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const tempAssets = await makeTempDir('graphium-temp-');
    const audioPath = path.join(packRoot, 'huge.mp3');
    await fs.writeFile(audioPath, Buffer.alloc(LOCAL_AUDIO_REJECT_BYTES + 1));

    const copied = await copyPackAssetToTemp(audioPath, tempAssets, 'audio');
    expect(copied).toBeNull();
    expect(await fs.readdir(tempAssets)).toEqual([]);
  });

  it('copies 8MB-plus audio and reports a generic warning without the filename', async () => {
    const packRoot = await makeTempDir('graphium-pack-');
    const tempAssets = await makeTempDir('graphium-temp-');
    const audioPath = path.join(packRoot, 'secret-bed.mp3');
    await fs.writeFile(audioPath, Buffer.alloc(8 * 1024 * 1024 + 1));

    const warnings: string[] = [];
    const copied = await copyPackAssetToTemp(audioPath, tempAssets, 'audio', warnings);
    expect(copied).toMatch(/^file:\/\//);
    expect(warnings.join(' ')).toMatch(/8\s*MB/i);
    expect(warnings.join(' ')).not.toContain('secret-bed');
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
    const { ok, skipped } = await exportSessionConsolePackToDirectory(catalog, exportDir, [
      tempAssets,
    ]);
    expect(ok).toBe(true);
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

  it('does not write outside destDir when an image id contains ".."', async () => {
    const tempAssets = await makeTempDir('graphium-temp-');
    const parent = await makeTempDir('graphium-export-parent-');
    const exportDir = path.join(parent, 'dest');
    await fs.mkdir(exportDir);
    const sourcePath = path.join(tempAssets, 'art.png');
    await fs.writeFile(sourcePath, 'plate');

    const catalog = emptySessionConsoleCatalog('Escape');
    catalog.imageSets = [
      {
        id: 's',
        title: 'S',
        note: '',
        images: [
          {
            id: '../../outside-escape',
            name: 'Evil',
            cue: '',
            src: `file://${sourcePath}`,
            thumbnailSrc: `file://${sourcePath}`,
            alt: '',
          },
        ],
      },
    ];

    const result = await exportSessionConsolePackToDirectory(catalog, exportDir, [tempAssets]);
    expect(result.ok).toBe(true);
    expect(result.skipped).toEqual([]);

    const escaped = path.join(parent, 'outside-escape.png');
    await expect(fs.stat(escaped)).rejects.toThrow();
    expect(await fs.readFile(path.join(exportDir, 'images', 'outside-escape.png'), 'utf8')).toBe(
      'plate',
    );

    const destReal = await fs.realpath(exportDir);
    const sandboxed = await resolveSandboxedExportDest(
      exportDir,
      './images/../../outside-escape.png',
    );
    expect(sandboxed).not.toBeNull();
    expect(isPathInsidePackRoot(destReal, sandboxed ?? '')).toBe(true);
  });

  it('returns skipped and ok false when a required copy is rejected', async () => {
    const allowed = await makeTempDir('graphium-allowed-');
    const outside = await makeTempDir('graphium-outside-');
    const exportDir = await makeTempDir('graphium-export-');
    const sourcePath = path.join(outside, 'art.png');
    await fs.writeFile(sourcePath, 'secret');

    const catalog = emptySessionConsoleCatalog('Reject');
    catalog.imageSets = [
      {
        id: 's',
        title: 'S',
        note: '',
        images: [
          {
            id: 'blocked',
            name: 'Blocked',
            cue: '',
            src: `file://${sourcePath}`,
            thumbnailSrc: `file://${sourcePath}`,
            alt: '',
          },
        ],
      },
    ];

    const result = await exportSessionConsolePackToDirectory(catalog, exportDir, [allowed]);
    expect(result.ok).toBe(false);
    expect(result.skipped.length).toBeGreaterThan(0);
    await expect(fs.stat(path.join(exportDir, 'images', 'blocked.png'))).rejects.toThrow();
  });
});
