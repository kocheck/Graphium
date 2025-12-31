import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processImage } from './AssetProcessor';
import { getStorage } from '../services/storage';

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

    global.OffscreenCanvas = vi.fn().mockImplementation((width, height) => ({
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      }),
      convertToBlob: vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }),
      width,
      height,
    })) as unknown as typeof OffscreenCanvas;

    // Mock storage service
    mockSaveAssetTemp = vi.fn().mockResolvedValue('file:///tmp/asset.webp');
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({
      saveAssetTemp: mockSaveAssetTemp,
    });

    // Mock Worker
    global.Worker = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      onmessage: null,
      onerror: null,
      terminate: vi.fn(),
    })) as unknown as typeof Worker;
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
    expect(global.OffscreenCanvas).toHaveBeenCalledWith(4096, 2048); // Scaled down
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

    expect(global.OffscreenCanvas).toHaveBeenCalledWith(512, 512); // Max token size
  });

  it('converts extension to .webp', async () => {
    delete (global as Record<string, unknown>).Worker;

    const file = new File([''], 'character.jpg', { type: 'image/jpeg' });
    const handle = processImage(file, 'TOKEN');
    await handle.promise;

    expect(mockSaveAssetTemp).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'character.webp'
    );
  });
});
