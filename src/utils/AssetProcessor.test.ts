import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processImage } from './AssetProcessor';
import { getStorage } from '../services/storage';
import { MAX_MAP_DIMENSION, MAX_THUMB_DIMENSION, MAX_TOKEN_DIMENSION } from './imageMaxDimensions';

// Mock getStorage
vi.mock('../services/storage', () => ({
  getStorage: vi.fn(),
}));

describe('AssetProcessor', () => {
  let mockSaveAssetTemp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock global browser APIs
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 1000,
      close: vi.fn(),
    });

    global.OffscreenCanvas = vi.fn().mockImplementation(function (width, height) {
      return {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        convertToBlob: vi.fn().mockResolvedValue({
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        }),
        width,
        height,
      };
    }) as unknown as typeof OffscreenCanvas;

    // Mock storage service
    mockSaveAssetTemp = vi.fn().mockResolvedValue('file:///tmp/asset.webp');
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({
      saveAssetTemp: mockSaveAssetTemp,
    });

    // Mock Worker
    global.Worker = vi.fn().mockImplementation(function () {
      return {
        postMessage: vi.fn(),
        onmessage: null,
        onerror: null,
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (global as Record<string, unknown>).Worker;
  });

  it('processing handles map constraints correctly', async () => {
    // For this test, we force main thread fallback by removing Worker
    delete (global as Record<string, unknown>).Worker;

    // Setup an oversized image
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 8000, // Double the max 4096
      height: 4000,
      close: vi.fn(),
    });

    const file = new File([''], 'map.png', { type: 'image/png' });
    const handle = processImage(file, 'MAP');
    const result = await handle.promise;

    expect(result).toBe('file:///tmp/asset.webp');
    expect(global.OffscreenCanvas).toHaveBeenCalledWith(MAX_MAP_DIMENSION, 2048);
    expect(mockSaveAssetTemp).toHaveBeenCalled();
  });

  it('processing handles token constraints correctly', async () => {
    delete (global as Record<string, unknown>).Worker;

    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 1000,
      close: vi.fn(),
    });

    const file = new File([''], 'token.png', { type: 'image/png' });
    const handle = processImage(file, 'TOKEN');
    await handle.promise;

    expect(global.OffscreenCanvas).toHaveBeenCalledWith(MAX_TOKEN_DIMENSION, MAX_TOKEN_DIMENSION);
  });

  it('processing handles thumb constraints correctly', async () => {
    delete (global as Record<string, unknown>).Worker;

    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 1000,
      close: vi.fn(),
    });

    const file = new File([''], 'plate.png', { type: 'image/png' });
    const handle = processImage(file, 'THUMB');
    await handle.promise;

    expect(global.OffscreenCanvas).toHaveBeenCalledWith(MAX_THUMB_DIMENSION, MAX_THUMB_DIMENSION);
  });

  it('converts extension to .webp', async () => {
    delete (global as Record<string, unknown>).Worker;

    const file = new File([''], 'character.jpg', { type: 'image/jpeg' });
    const handle = processImage(file, 'TOKEN');
    await handle.promise;

    expect(mockSaveAssetTemp).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'character.webp');
  });
});
