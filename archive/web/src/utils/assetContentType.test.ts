import { describe, expect, it } from 'vitest';

import {
  contentTypeForAssetFileName,
  contentTypeForMediaPath,
  extensionForContentType,
} from './assetContentType';

describe('contentTypeForMediaPath', () => {
  it('maps audio extensions and leaves images undefined', () => {
    expect(contentTypeForMediaPath('/tmp/bed.mp3')).toBe('audio/mpeg');
    expect(contentTypeForMediaPath('C:\\tmp\\bed.m4a')).toBe('audio/mp4');
    expect(contentTypeForMediaPath('/tmp/token.webp')).toBeUndefined();
  });
});

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

describe('extensionForContentType', () => {
  it('maps standard and browser audio MIME aliases', () => {
    expect(extensionForContentType('audio/mpeg')).toBe('.mp3');
    expect(extensionForContentType('audio/mp4')).toBe('.m4a');
    expect(extensionForContentType('audio/x-m4a')).toBe('.m4a');
    expect(extensionForContentType('audio/x-wav')).toBe('.wav');
    expect(extensionForContentType('image/jpeg')).toBe('.jpg');
  });
});
