import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getStorage } from '../services/storage';
import { isAllowedAudioFileName } from './localAudioLimits';
import { saveLocalAudioFile } from './localAudioAsset';

vi.mock('../services/storage', () => ({
  getStorage: vi.fn(),
}));

describe('isAllowedAudioFileName', () => {
  it('accepts mp3 and rejects exe and webp', () => {
    expect(isAllowedAudioFileName('bed.mp3')).toBe(true);
    expect(isAllowedAudioFileName('bed.exe')).toBe(false);
    expect(isAllowedAudioFileName('bed.webp')).toBe(false);
  });
});

function audioFile(name: string, contents: string, size?: number): File {
  const file = new File([contents], name, { type: 'audio/mpeg' });
  const encoded = new TextEncoder().encode(contents);
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () =>
      encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength),
  });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

describe('saveLocalAudioFile', () => {
  let mockSaveAssetTemp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSaveAssetTemp = vi.fn().mockResolvedValue('file:///tmp/bed.mp3');
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({
      saveAssetTemp: mockSaveAssetTemp,
    });
  });

  it('rejects files larger than 25MB', async () => {
    const file = audioFile('bed.mp3', 'x', 25 * 1024 * 1024 + 1);

    await expect(saveLocalAudioFile(file)).rejects.toThrow(/25\s*MB/i);
    expect(mockSaveAssetTemp).not.toHaveBeenCalled();
  });

  it('saves a small bed.mp3 and returns the mocked file URL', async () => {
    const file = audioFile('bed.mp3', 'tiny-bed');
    const url = await saveLocalAudioFile(file);

    expect(url).toBe('file:///tmp/bed.mp3');
    expect(mockSaveAssetTemp).toHaveBeenCalledTimes(1);
    const [buffer, name] = mockSaveAssetTemp.mock.calls[0] as [ArrayBuffer, string];
    expect(name).toBe('bed.mp3');
    const expected = new TextEncoder().encode('tiny-bed');
    expect(buffer.byteLength).toBe(expected.byteLength);
    expect(Array.from(new Uint8Array(buffer))).toEqual(Array.from(expected));
  });

  it('rewrites spaces and parentheses before saveAssetTemp', async () => {
    const file = audioFile('tavern theme (1).mp3', 'tiny-bed');
    await expect(saveLocalAudioFile(file)).resolves.toBe('file:///tmp/bed.mp3');
    const name = mockSaveAssetTemp.mock.calls[0]?.[1];
    expect(name).toBe('tavern-theme-1.mp3');
  });

  it('rejects bed.exe and does not call saveAssetTemp', async () => {
    const file = audioFile('bed.exe', 'x');

    await expect(saveLocalAudioFile(file)).rejects.toMatchObject({
      message: 'Unsupported audio format (mp3, ogg, wav, m4a)',
    });
    expect(mockSaveAssetTemp).not.toHaveBeenCalled();
  });

  it('saves a file just over 8MB without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const file = audioFile('bed.mp3', 'x', 8 * 1024 * 1024 + 1);

    await expect(saveLocalAudioFile(file)).resolves.toBe('file:///tmp/bed.mp3');
    expect(mockSaveAssetTemp).toHaveBeenCalled();
    warn.mockRestore();
  });
});
