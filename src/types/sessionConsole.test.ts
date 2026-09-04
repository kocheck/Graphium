import { describe, expect, it } from 'vitest';
import { parseYouTubeVideoId, effectiveVolume, emptySessionConsoleCatalog } from './sessionConsole';

describe('parseYouTubeVideoId', () => {
  it('accepts a raw 11-char id', () => {
    expect(parseYouTubeVideoId('bLZApMsorjA')).toBe('bLZApMsorjA');
  });

  it('parses watch, youtu.be, shorts, and embed URLs', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=bLZApMsorjA')).toBe('bLZApMsorjA');
    expect(parseYouTubeVideoId('https://youtu.be/bLZApMsorjA')).toBe('bLZApMsorjA');
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/bLZApMsorjA')).toBe('bLZApMsorjA');
    expect(parseYouTubeVideoId('https://www.youtube.com/embed/bLZApMsorjA')).toBe('bLZApMsorjA');
  });

  it('returns null for garbage', () => {
    expect(parseYouTubeVideoId('https://example.com')).toBeNull();
    expect(parseYouTubeVideoId('')).toBeNull();
  });
});

describe('effectiveVolume', () => {
  it('applies offset then duck percent and clamps', () => {
    expect(effectiveVolume(45, false, 0)).toBe(45);
    expect(effectiveVolume(45, false, 10)).toBe(55);
    expect(effectiveVolume(45, true, 0)).toBe(12); // round(45 * 27 / 100)
    expect(effectiveVolume(45, true, 0, 50)).toBe(23);
    expect(effectiveVolume(200, false, 0)).toBe(100);
  });
});

describe('emptySessionConsoleCatalog', () => {
  it('seeds four synth SFX and campaign title', () => {
    const catalog = emptySessionConsoleCatalog('Ashen Crown');
    expect(catalog.version).toBe(1);
    expect(catalog.stage.title).toBe('Ashen Crown');
    expect(catalog.defaults).toEqual({ volume: 45, duckPercent: 27 });
    expect(catalog.sfx.map((item) => item.id)).toEqual([
      'chime',
      'drone',
      'snap',
      'ping',
      'test-tone',
    ]);
  });
});
