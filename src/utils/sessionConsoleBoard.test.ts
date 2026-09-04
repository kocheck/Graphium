import { afterEach, describe, expect, it, vi } from 'vitest';

import { emptySessionConsoleCatalog, type Track } from '../types/sessionConsole';
import { useGameStore } from '../store/gameStore';
import {
  flattenTracks,
  folderTitleFromFiles,
  formatSessionConsoleFallbackLinks,
  formatTrackFallbackLine,
  ingestDroppedFiles,
  processImportedCatalogPlates,
} from './sessionConsoleBoard';

vi.mock('./AssetProcessor', () => ({
  processImage: vi.fn(),
}));

vi.mock('./localAudioAsset', () => ({
  saveLocalAudioFile: vi.fn(async () => 'file://tmp/track.mp3'),
  shouldWarnLocalAudioSize: vi.fn(() => false),
  LOCAL_AUDIO_SIZE_WARN_MESSAGE: 'Audio file is larger than 8MB',
}));

import { processImage } from './AssetProcessor';

function makeTrack(overrides: Partial<Track> & Pick<Track, 'id' | 'title' | 'source'>): Track {
  return {
    cue: '',
    tag: 'bed',
    volumeOffset: 0,
    loop: true,
    ...overrides,
  };
}

describe('formatSessionConsoleFallbackLinks', () => {
  it('formats YouTube watch URLs and local-file placeholders in board order', () => {
    const catalog = emptySessionConsoleCatalog('Ash Crown');
    catalog.trackGroups = [
      {
        id: 'g1',
        title: 'Beds',
        note: '',
        accent: 'bed',
        tracks: [
          makeTrack({
            id: 'yt-1',
            title: 'Tavern bed',
            source: 'youtube',
            youtubeId: 'bLZApMsorjA',
          }),
          makeTrack({
            id: 'local-1',
            title: 'Door slam',
            source: 'local',
            src: 'file://door.mp3',
          }),
        ],
      },
      {
        id: 'g2',
        title: 'Combat',
        note: '',
        accent: 'combat',
        tracks: [
          makeTrack({
            id: 'yt-2',
            title: 'Clash',
            source: 'youtube',
            youtubeId: 'dQw4w9wgwcQ',
          }),
        ],
      },
    ];

    expect(flattenTracks(catalog).map((track) => track.id)).toEqual(['yt-1', 'local-1', 'yt-2']);
    const expected = [
      '1. Tavern bed — https://www.youtube.com/watch?v=bLZApMsorjA',
      '2. Door slam — (local file)',
      '3. Clash — https://www.youtube.com/watch?v=dQw4w9wgwcQ',
    ].join('\n');
    expect(formatSessionConsoleFallbackLinks(catalog)).toBe(expected);
  });

  it('lists YouTube tracks without an id as local-file placeholders so the index stays contiguous', () => {
    const catalog = emptySessionConsoleCatalog('Ash Crown');
    catalog.trackGroups = [
      {
        id: 'g1',
        title: 'Beds',
        note: '',
        accent: 'bed',
        tracks: [makeTrack({ id: 'broken', title: 'Missing id', source: 'youtube' })],
      },
    ];

    expect(formatTrackFallbackLine(1, catalog.trackGroups[0]!.tracks[0]!)).toBe(
      '1. Missing id — (local file)',
    );
    expect(formatSessionConsoleFallbackLinks(catalog)).toBe('1. Missing id — (local file)');
  });
});

describe('folderTitleFromFiles', () => {
  it('uses the first webkitRelativePath folder as the set title', () => {
    const file = new File(['x'], 'keep.png', { type: 'image/png' });
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Halls/keep.png' });
    expect(folderTitleFromFiles([file])).toBe('Halls');
  });

  it('returns undefined when files are not from a folder picker', () => {
    expect(folderTitleFromFiles([new File(['x'], 'keep.png')])).toBeUndefined();
  });
});

describe('processImportedCatalogPlates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(processImage).mockReset();
  });

  it('starts MAP and THUMB processing together', async () => {
    const started: string[] = [];
    const resolvers: Array<(src: string) => void> = [];
    vi.mocked(processImage).mockImplementation((_file, type) => {
      started.push(type);
      return {
        promise: new Promise<string>((resolve) => {
          resolvers.push((src) => {
            resolve(src);
          });
        }),
        cancel: () => undefined,
      };
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      })),
    );

    const catalog = emptySessionConsoleCatalog('Ash Crown');
    catalog.imageSets = [
      {
        id: 's',
        title: 'S',
        note: '',
        images: [
          {
            id: 'keep',
            name: 'Keep',
            cue: '',
            src: 'file:///tmp/keep.png',
            thumbnailSrc: 'file:///tmp/keep.png',
            alt: 'keep',
          },
        ],
      },
    ];

    const pending = processImportedCatalogPlates(catalog);
    await vi.waitFor(() => {
      expect(started).toEqual(['MAP', 'THUMB']);
    });
    for (const resolve of resolvers) {
      resolve('file:///tmp/out.webp');
    }
    await pending;
  });
});

describe('ingestDroppedFiles', () => {
  afterEach(() => {
    vi.mocked(processImage).mockReset();
  });

  it('throttles progress toasts to the first and last update when files finish together', async () => {
    vi.mocked(processImage).mockImplementation((_file, type) => ({
      promise: Promise.resolve(`file://tmp/${type}.webp`),
      cancel: () => undefined,
    }));

    const toasts: string[] = [];
    useGameStore.setState({
      sessionConsole: emptySessionConsoleCatalog('Ash Crown'),
      showToast: (message) => {
        toasts.push(message);
      },
    });

    const files = Array.from({ length: 10 }, (_, index) => {
      return new File(['x'], `keep-${index}.png`, { type: 'image/png' });
    });
    await ingestDroppedFiles(useGameStore.getState(), files);

    const progress = toasts.filter((message) => message.startsWith('Adding files…'));
    expect(progress[0]).toBe('Adding files… 1/10');
    expect(progress.at(-1)).toBe('Adding files… 10/10');
    expect(progress.length).toBeLessThan(10);
  });
});
