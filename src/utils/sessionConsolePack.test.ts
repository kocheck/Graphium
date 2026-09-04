import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { emptySessionConsoleCatalog } from '../types/sessionConsole';
import {
  catalogToSessionConsolePack,
  classifyPackSrc,
  isPathInsidePackRoot,
  materializePack,
  PACK_HTTP_MAX_BYTES,
  parseSessionConsolePack,
  readResponseCapped,
} from './sessionConsolePack';

import type { SessionConsolePack } from './sessionConsolePack';

const EXAMPLE_PACK_PATH = path.resolve(
  process.cwd(),
  'docs/planning/session-console-pack.example.json',
);

function loadExamplePackJson(): unknown {
  return JSON.parse(readFileSync(EXAMPLE_PACK_PATH, 'utf8')) as unknown;
}

describe('readResponseCapped', () => {
  it('does not read the body when Content-Length exceeds the cap', async () => {
    const arrayBuffer = vi.fn();
    const response = {
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-length' ? String(PACK_HTTP_MAX_BYTES + 1) : null,
      },
      arrayBuffer,
      body: null,
    };

    await expect(readResponseCapped(response, PACK_HTTP_MAX_BYTES)).resolves.toEqual({
      status: 'too-large',
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('concatenates streamed chunks under the cap', async () => {
    const response = {
      ok: true,
      headers: { get: () => null },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.enqueue(new Uint8Array([3, 4]));
          controller.close();
        },
      }),
      arrayBuffer: vi.fn(),
    };

    const result = await readResponseCapped(response, 16);
    expect(result).toEqual({ status: 'ok', buffer: expect.any(ArrayBuffer) });
    expect(result.status === 'ok' ? [...new Uint8Array(result.buffer)] : []).toEqual([1, 2, 3, 4]);
    expect(response.arrayBuffer).not.toHaveBeenCalled();
  });

  it('aborts a streamed body that exceeds the cap', async () => {
    const arrayBuffer = vi.fn();
    const response = {
      ok: true,
      headers: { get: () => null },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5]));
          controller.close();
        },
      }),
      arrayBuffer,
    };

    await expect(readResponseCapped(response, 4)).resolves.toEqual({ status: 'too-large' });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});

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

  it('unions pack sfx onto the seeded five and only replaces matching ids', async () => {
    const pack: SessionConsolePack = {
      version: 1,
      kind: 'graphium.sessionConsolePack',
      stage: { title: 'T', subtitle: '', showFrame: true },
      defaults: { volume: 45, duckPercent: 27 },
      imageSets: [],
      trackGroups: [],
      sfx: [
        { id: 'chime', label: 'Pack Chime', kind: 'synth', synthType: 'chime' },
        { id: 'horn', label: 'Horn', kind: 'synth', synthType: 'ping' },
      ],
    };

    const { catalog } = await materializePack(pack, async () => null);
    expect(catalog.sfx.map((item) => item.id)).toEqual([
      'chime',
      'drone',
      'snap',
      'ping',
      'test-tone',
      'horn',
    ]);
    expect(catalog.sfx[0]?.label).toBe('Pack Chime');
    expect(catalog.sfx.find((item) => item.id === 'test-tone')).toBeDefined();
  });

  it('skips http bodies larger than 25MB without persisting a path', async () => {
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
              src: 'https://example.com/huge.png',
              alt: 'art',
            },
          ],
        },
      ],
      trackGroups: [],
    };
    const huge = { byteLength: 25 * 1024 * 1024 + 1 } as ArrayBuffer;
    const persist = vi.fn(async () => 'file:///Users/janedoe/tmp/huge.png');

    const { catalog, skipped } = await materializePack(
      pack,
      async () => null,
      async () => huge,
      persist,
    );

    expect(persist).not.toHaveBeenCalled();
    expect(catalog.imageSets[0]?.images).toEqual([]);
    expect(skipped.join(' ')).toMatch(/25\s*MB/i);
    expect(skipped.join(' ')).not.toMatch(/failed to fetch/i);
    expect(skipped.join(' ')).not.toContain('janedoe');
    expect(skipped.join(' ')).not.toMatch(/\/Users\//);
  });

  it('skips over-cap HTTP with a 25MB reason when fetch returns too-large', async () => {
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
              src: 'https://example.com/huge.png',
              alt: 'art',
            },
          ],
        },
      ],
      trackGroups: [],
    };

    const { skipped } = await materializePack(
      pack,
      async () => null,
      async () => ({
        status: 'too-large',
      }),
    );

    expect(skipped.join(' ')).toMatch(/25\s*MB/i);
    expect(skipped.join(' ')).not.toMatch(/failed to fetch/i);
  });

  it('skips failed HTTP fetches without calling them oversized', async () => {
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
              src: 'https://example.com/missing.png',
              alt: 'art',
            },
          ],
        },
      ],
      trackGroups: [],
    };

    const { skipped } = await materializePack(
      pack,
      async () => null,
      async () => ({
        status: 'failed',
      }),
    );

    expect(skipped.join(' ')).toMatch(/failed to fetch/i);
    expect(skipped.join(' ')).not.toMatch(/25\s*MB/i);
  });

  it('keeps pack image order when HTTP fetches finish out of order', async () => {
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
            { id: 'a', name: 'A', cue: '', src: 'https://example.com/a.png', alt: 'a' },
            { id: 'b', name: 'B', cue: '', src: 'https://example.com/b.png', alt: 'b' },
            { id: 'c', name: 'C', cue: '', src: 'https://example.com/c.png', alt: 'c' },
          ],
        },
      ],
      trackGroups: [],
    };
    const persist = vi.fn(async (_buffer: ArrayBuffer, fileName: string) => `file:///${fileName}`);

    const { catalog, skipped } = await materializePack(
      pack,
      async () => null,
      async (url) => {
        if (url.endsWith('/a.png')) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return { status: 'ok', buffer: new Uint8Array([1]).buffer };
      },
      persist,
    );

    expect(skipped).toEqual([]);
    expect(catalog.imageSets[0]?.images.map((image) => image.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips relative local files with an add-on-the-board reason for web ingest', async () => {
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
              id: 'local-art',
              name: 'Local',
              cue: '',
              src: './images/keep.png',
              alt: 'keep',
            },
          ],
        },
      ],
      trackGroups: [
        {
          id: 'g',
          title: 'Beds',
          note: '',
          accent: 'bed',
          tracks: [
            {
              title: 'Wilderness',
              cue: '',
              tag: 'bed',
              src: 'https://www.youtube.com/watch?v=bLZApMsorjA',
            },
          ],
        },
      ],
    };

    const { catalog, skipped } = await materializePack(
      pack,
      async () => null,
      undefined,
      undefined,
      {
        localFileSkipReason:
          'Local files cannot be imported in the browser — add files on the board.',
      },
    );

    expect(catalog.trackGroups[0]?.tracks[0]?.youtubeId).toBe('bLZApMsorjA');
    expect(catalog.imageSets[0]?.images).toEqual([]);
    expect(skipped.join(' ')).toMatch(/add files on the board/i);
    expect(skipped.join(' ')).not.toContain('/tmp/');
    expect(skipped.join(' ')).not.toContain('./images/keep.png');
  });

  it('warns generically when ingested HTTP audio is over 8MB and still persists under 25MB', async () => {
    const pack: SessionConsolePack = {
      version: 1,
      kind: 'graphium.sessionConsolePack',
      stage: { title: 'T', subtitle: '', showFrame: true },
      defaults: { volume: 45, duckPercent: 27 },
      imageSets: [],
      trackGroups: [
        {
          id: 'g',
          title: 'Beds',
          note: '',
          accent: 'bed',
          tracks: [
            {
              title: 'Rain',
              cue: '',
              tag: 'bed',
              src: 'https://example.com/secret-bed.mp3',
            },
          ],
        },
      ],
    };
    const large = { byteLength: 8 * 1024 * 1024 + 1 } as ArrayBuffer;
    const persist = vi.fn(async () => 'file:///tmp/bed.mp3');

    const { catalog, skipped, warnings } = await materializePack(
      pack,
      async () => null,
      async () => large,
      persist,
    );

    expect(persist).toHaveBeenCalled();
    expect(catalog.trackGroups[0]?.tracks[0]?.src).toBe('file:///tmp/bed.mp3');
    expect(skipped).toEqual([]);
    expect(warnings.join(' ')).toMatch(/8\s*MB/i);
    expect(warnings.join(' ')).not.toContain('secret-bed');
    expect(warnings.join(' ')).not.toContain('example.com');
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
    expect(exported.sfx?.map((item) => item.id)).toEqual([
      'chime',
      'drone',
      'snap',
      'ping',
      'test-tone',
    ]);
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
