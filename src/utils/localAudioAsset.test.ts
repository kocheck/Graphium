import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getStorage } from '../services/storage';
import { isAllowedAudioFileName, saveLocalAudioFile } from './localAudioAsset';

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

describe('saveLocalAudioFile', () => {
  let mockSaveAssetTemp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSaveAssetTemp = vi.fn().mockResolvedValue('file:///tmp/bed.mp3');
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({
      saveAssetTemp: mockSaveAssetTemp,
    });
  });

  it('rejects files larger than 25MB', async () => {
    const file = new File(['x'], 'bed.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file, 'size', { value: 25 * 1024 * 1024 + 1 });

    await expect(saveLocalAudioFile(file)).rejects.toThrow(/25\s*MB/i);
    expect(mockSaveAssetTemp).not.toHaveBeenCalled();
  });
});
