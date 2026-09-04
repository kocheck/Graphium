import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { emptySessionConsoleCatalog } from '../types/sessionConsole';
import {
  catalogToSessionConsolePack,
  classifyPackSrc,
  isPathInsidePackRoot,
  materializePack,
  parseSessionConsolePack,
} from './sessionConsolePack';

import type { SessionConsolePack } from './sessionConsolePack';

const EXAMPLE_PACK_PATH = path.resolve(
  process.cwd(),
  'docs/planning/session-console-pack.example.json',
);

function loadExamplePackJson(): unknown {
  return JSON.parse(readFileSync(EXAMPLE_PACK_PATH, 'utf8')) as unknown;
}

describe('classifyPackSrc', () => {
  it('classifies youtube, relative, absolute, and http srcs', () => {
    expect(classifyPackSrc('https://youtu.be/bLZApMsorjA')).toEqual({
      kind: 'youtube',
      youtubeId: 'bLZApMsorjA',
    });
    expect(classifyPackSrc('./images/a.png').kind).toBe('relative');
    expect(classifyPackSrc('https://example.com/a.png').kind).toBe('http');
    expect(classifyPackSrc('not-a-src').kind).toBe('invalid');
  });

  it('classifies raw youtube ids and absolute file paths', () => {
    expect(classifyPackSrc('bLZApMsorjA')).toEqual({
      kind: 'youtube',
      youtubeId: 'bLZApMsorjA',
    });
    expect(classifyPackSrc('/tmp/pack/a.png')).toEqual({
      kind: 'absolute',
      path: '/tmp/pack/a.png',
    });
  });
});

describe('isPathInsidePackRoot', () => {
  it('rejects relative paths that escape the pack root', () => {
    expect(isPathInsidePackRoot('/pack', '/pack/images/a.png')).toBe(true);
    expect(isPathInsidePackRoot('/pack', '/etc/passwd')).toBe(false);
  });
});

describe('parseSessionConsolePack', () => {
  it('parses the example board pack with kind graphium.sessionConsolePack', () => {
    const { pack, errors } = parseSessionConsolePack(loadExamplePackJson());
    expect(errors).toEqual([]);
    expect(pack.kind).toBe('graphium.sessionConsolePack');
    expect(pack.version).toBe(1);
    expect(pack.stage.title).toBe('Beneath the Ashen Crown');
    expect(pack.imageSets).toHaveLength(2);
    expect(pack.trackGroups[0]?.tracks).toHaveLength(2);
    expect(pack.trackGroups[0]?.tracks[0]?.src).toBe('https://www.youtube.com/watch?v=bLZApMsorjA');
    expect(pack.trackGroups[0]?.tracks[0]?.recommendedImage).toBe('skeldra-overview');
    expect(pack.trackGroups[0]?.tracks[1]?.src).toBe('./audio/shelter-rain.mp3');
  });

  it('collects row errors and keeps the rest of the pack', () => {
    const raw = loadExamplePackJson() as Record<string, unknown>;
    const imageSets = raw['imageSets'] as Array<{ images: Array<Record<string, unknown>> }>;
    imageSets[0]?.images.push({
      id: 'bad-row',
      name: 'Bad',
      cue: 'n/a',
      src: 'not-a-src',
      alt: 'x',
    });

    const { pack, errors } = parseSessionConsolePack(raw);
    expect(errors.some((error) => error.includes('bad-row') || error.includes('not-a-src'))).toBe(
      true,
    );
    expect(pack.imageSets[0]?.images.some((image) => image.id === 'bad-row')).toBe(false);
    expect(pack.imageSets[0]?.images.some((image) => image.id === 'campaign-opener')).toBe(true);
  });

  it('rejects the wrong pack kind', () => {
    const { pack, errors } = parseSessionConsolePack({
      version: 1,
      kind: 'nope',
      stage: { title: 'X', subtitle: '', showFrame: true },
      defaults: { volume: 45, duckPercent: 27 },
      imageSets: [],
      trackGroups: [],
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(pack.imageSets).toEqual([]);
  });
});

describe('materializePack', () => {
  it('maps recommendedImage name or id onto recommendedImageId', async () => {
    const { pack } = parseSessionConsolePack(loadExamplePackJson());
    const { catalog } = await materializePack(pack, async () => 'file://tmp/a.webp');
    expect(catalog.trackGroups[0]?.tracks[0]?.recommendedImageId).toBe('skeldra-overview');
  });

  it('keeps youtube tracks as ids and copies local srcs via resolveFile', async () => {
    const { pack } = parseSessionConsolePack(loadExamplePackJson());
    const resolved: string[] = [];
    const { catalog, skipped } = await materializePack(pack, async (filePath) => {
      resolved.push(filePath);
      return `file://ingested/${path.basename(filePath)}`;
    });

    expect(skipped).toEqual([]);
    const youtube = catalog.trackGroups[0]?.tracks[0];
    expect(youtube?.source).toBe('youtube');
    expect(youtube?.youtubeId).toBe('bLZApMsorjA');
    expect(youtube?.src).toBeUndefined();

    const local = catalog.trackGroups[0]?.tracks[1];
    expect(local?.source).toBe('local');
    expect(local?.src).toBe('file://ingested/shelter-rain.mp3');

    const plate = catalog.imageSets[0]?.images[0];
    expect(plate?.src).toBe('file://ingested/campaign-opener.png');
    expect(plate?.thumbnailSrc).toBe(plate?.src);
    expect(resolved).toContain('./images/campaign-opener.png');
    expect(resolved).toContain('./audio/shelter-rain.mp3');
  });

  it('skips files when resolveFile returns null and http when fetch fails', async () => {
    const pack: SessionConsolePack = {
      version: 1,
      kind: 'graphium.sessionConsolePack',
      stage: { title: 'T', subtitle: '', showFrame: true },
      defaults: { volume: 45, duckPercent: 27 },
      imageSets: [
        {
          id: 's',
          title: 'S',
          note: '',
          images: [
            { id: 'missing', name: 'Missing', cue: '', src: './images/gone.png', alt: 'gone' },
            {
              id: 'remote',
              name: 'Remote',
              cue: '',
              src: 'https://example.com/art.png',
              alt: 'art',
            },
          ],
        },
      ],
      trackGroups: [],
    };

    const { catalog, skipped } = await materializePack(
      pack,
      async () => null,
      async () => null,
    );

    expect(catalog.imageSets[0]?.images).toEqual([]);
    expect(skipped.length).toBeGreaterThanOrEqual(2);
  });

  it('ingests http bytes via persistBuffer', async () => {
    const pack: SessionConsolePack = {
      version: 1,
      kind: 'graphium.sessionConsolePack',
      stage: { title: 'T', subtitle: '', showFrame: true },
      defaults: { volume: 45, duckPercent: 27 },
      imageSets: [
        {
          id: 's',
          title: 'S',
          note: '',
          images: [
            {
              id: 'remote',
              name: 'Remote',
              cue: '',
              src: 'https://example.com/art.png',
              alt: 'art',
            },
          ],
        },
      ],
      trackGroups: [],
    };
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    const { catalog, skipped } = await materializePack(
      pack,
      async () => null,
      async () => bytes,
      async () => 'file://tmp/art.png',
    );

    expect(skipped).toEqual([]);
    expect(catalog.imageSets[0]?.images[0]?.src).toBe('file://tmp/art.png');
  });

  it('seeds synth sfx when the pack omits sfx', async () => {
    const { pack } = parseSessionConsolePack(loadExamplePackJson());
    const { catalog } = await materializePack(pack, async () => 'file://x');
    expect(catalog.sfx.map((item) => item.id)).toEqual([
      'chime',
      'drone',
      'snap',
      'ping',
      'test-tone',
    ]);
  });
});

describe('catalogToSessionConsolePack', () => {
  it('writes youtube as watch URLs and files as ./images or ./audio', async () => {
    const { pack } = parseSessionConsolePack(loadExamplePackJson());
    const { catalog } = await materializePack(pack, async (filePath) => {
      return `file:///tmp/${path.basename(filePath)}`;
    });
    const exported = catalogToSessionConsolePack(catalog);
    expect(exported.kind).toBe('graphium.sessionConsolePack');
    expect(exported.trackGroups[0]?.tracks[0]?.src).toBe(
      'https://www.youtube.com/watch?v=bLZApMsorjA',
    );
    expect(exported.trackGroups[0]?.tracks[1]?.src).toBe('./audio/shelter-from-the-rain.mp3');
    expect(exported.imageSets[0]?.images[0]?.src).toBe('./images/campaign-opener.png');
  });

  it('sanitizes ids so a ".." id cannot resolve outside destDir', () => {
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
            src: 'file:///tmp/art.png',
            thumbnailSrc: 'file:///tmp/art.png',
            alt: '',
          },
        ],
      },
    ];
    const exported = catalogToSessionConsolePack(catalog);
    const rel = exported.imageSets[0]?.images[0]?.src ?? '';
    expect(rel).toBe('./images/outside-escape.png');
    expect(rel.includes('..')).toBe(false);

    const destDir = '/chosen/export';
    const destPath = path.resolve(destDir, rel.replace(/^\.\//, ''));
    expect(isPathInsidePackRoot(destDir, destPath)).toBe(true);
    expect(destPath.startsWith(path.resolve(destDir) + path.sep)).toBe(true);
  });
});
