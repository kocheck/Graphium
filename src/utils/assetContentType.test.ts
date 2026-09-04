import { describe, expect, it } from 'vitest';

import { contentTypeForAssetFileName } from './assetContentType';

describe('contentTypeForAssetFileName', () => {
  it('maps local audio extensions to playable MIME types', () => {
    expect(contentTypeForAssetFileName('bed.mp3')).toBe('audio/mpeg');
    expect(contentTypeForAssetFileName('bed.ogg')).toBe('audio/ogg');
    expect(contentTypeForAssetFileName('bed.wav')).toBe('audio/wav');
    expect(contentTypeForAssetFileName('bed.m4a')).toBe('audio/mp4');
  });

  it('keeps image types as webp/png/jpeg', () => {
    expect(contentTypeForAssetFileName('plate.webp')).toBe('image/webp');
    expect(contentTypeForAssetFileName('plate.png')).toBe('image/png');
    expect(contentTypeForAssetFileName('plate.jpg')).toBe('image/jpeg');
    expect(contentTypeForAssetFileName('plate.jpeg')).toBe('image/jpeg');
  });
});
