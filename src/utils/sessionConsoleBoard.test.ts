import { describe, expect, it } from 'vitest';

import { emptySessionConsoleCatalog, type Track } from '../types/sessionConsole';
import {
  flattenTracks,
  folderTitleFromFiles,
  formatSessionConsoleFallbackLinks,
  formatTrackFallbackLine,
} from './sessionConsoleBoard';

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
