import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useCanvasDrop } from '../useCanvasDrop';

import type { GridType } from '../../../../types/domain';

// Mock processImage from AssetProcessor
vi.mock('../../../../utils/AssetProcessor', () => ({
  processImage: vi.fn((file) => ({
    promise: Promise.resolve(`media://processed-${file.name}`),
    cancel: vi.fn(),
  })),
}));

// Mock grid utility
vi.mock('../../../../utils/grid', () => ({
  snapToGrid: vi.fn((x, y) => ({ x: Math.round(x / 50) * 50, y: Math.round(y / 50) * 50 })),
}));

describe('useCanvasDrop', () => {
  const mockAddToken = vi.fn();
  const mockShowToast = vi.fn();
  const mockContainerRef = {
    current: {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 800, height: 600 }),
    },
  } as React.RefObject<HTMLDivElement>;

  const defaultProps = {
    isWorldView: false,
    containerRef: mockContainerRef,
    position: { x: 0, y: 0 },
    scale: 1,
    gridSize: 50,
    gridType: 'LINES' as GridType,
    addToken: mockAddToken,
    showToast: mockShowToast,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any object URLs created
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  describe('handleDragOver', () => {
    it('prevents default when not in World View', () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));
      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('blocks drag over in World View', () => {
      const { result } = renderHook(() => useCanvasDrop({ ...defaultProps, isWorldView: true }));
      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent);
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('handleDrop - Library Token', () => {
    it('creates token instance with library reference', () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 200,
        clientY: 200,
        dataTransfer: {
          getData: vi.fn(() =>
            JSON.stringify({
              type: 'LIBRARY_TOKEN',
              src: 'media://library/goblin.webp',
              libraryItemId: 'lib-123',
            }),
          ),
          files: { length: 0 },
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent);
      });

      expect(mockAddToken).toHaveBeenCalledWith(
        expect.objectContaining({
          src: 'media://library/goblin.webp',
          libraryItemId: 'lib-123',
          x: expect.any(Number),
          y: expect.any(Number),
        }),
      );
    });
  });

  describe('handleDrop - Generic Token', () => {
    it('creates themed SVG placeholder token', () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 200,
        clientY: 200,
        dataTransfer: {
          getData: vi.fn(() => JSON.stringify({ type: 'GENERIC_TOKEN' })),
          files: { length: 0 },
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent);
      });

      expect(mockAddToken).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Generic Token',
          type: 'NPC',
          src: expect.stringContaining('data:image/svg+xml;base64,'),
        }),
      );
    });
  });

  describe('handleDrop - File Drop', () => {
    it('creates object URL and sets pendingCrop', () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));
      const mockFile = new File(['image-data'], 'token.png', { type: 'image/png' });
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 200,
        clientY: 200,
        dataTransfer: {
          getData: vi.fn(() => ''),
          files: [mockFile],
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent);
      });

      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockFile);
      expect(result.current.pendingCrop).toEqual({
        src: 'blob:mock-url',
        x: expect.any(Number),
        y: expect.any(Number),
      });
    });

    it('revokes existing object URL before creating new one', () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));
      const mockFile1 = new File(['image-1'], 'token1.png', { type: 'image/png' });
      const mockFile2 = new File(['image-2'], 'token2.png', { type: 'image/png' });

      // First drop
      const mockEvent1 = {
        preventDefault: vi.fn(),
        clientX: 200,
        clientY: 200,
        dataTransfer: {
          getData: vi.fn(() => ''),
          files: [mockFile1],
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent1);
      });

      const firstUrl = result.current.pendingCrop?.src;
      expect(firstUrl).toBe('blob:mock-url');

      // Second drop (should revoke first URL)
      const mockEvent2 = {
        preventDefault: vi.fn(),
        clientX: 300,
        clientY: 300,
        dataTransfer: {
          getData: vi.fn(() => ''),
          files: [mockFile2],
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent2);
      });

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    });

    it('blocks file drops in World View', () => {
      const { result } = renderHook(() => useCanvasDrop({ ...defaultProps, isWorldView: true }));
      const mockFile = new File(['image-data'], 'token.png', { type: 'image/png' });
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 200,
        clientY: 200,
        dataTransfer: {
          getData: vi.fn(() => ''),
          files: [mockFile],
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent);
      });

      expect(result.current.pendingCrop).toBeNull();
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('handleCropConfirm', () => {
    it('processes cropped image through asset pipeline', async () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));

      // Set up pending crop
      act(() => {
        result.current.setPendingCrop({
          src: 'blob:mock-preview',
          x: 100,
          y: 150,
        });
      });

      const mockBlob = new Blob(['cropped-image'], { type: 'image/png' });

      // Confirm crop
      await act(async () => {
        await result.current.handleCropConfirm(mockBlob);
      });

      expect(mockAddToken).toHaveBeenCalledWith(
        expect.objectContaining({
          src: expect.stringContaining('media://processed-'),
          x: 100,
          y: 150,
          name: 'New Token',
          type: 'NPC',
          scale: 1,
        }),
      );
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview');
      expect(result.current.pendingCrop).toBeNull();
    });

    it('cleans up object URL on error', async () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));

      // Set up pending crop
      act(() => {
        result.current.setPendingCrop({
          src: 'blob:mock-preview',
          x: 100,
          y: 150,
        });
      });

      // Mock processImage to reject
      const { processImage } = await import('../../../../utils/AssetProcessor');
      vi.mocked(processImage).mockReturnValueOnce({
        promise: Promise.reject(new Error('Processing failed')),
        cancel: vi.fn(),
      });

      const mockBlob = new Blob(['cropped-image'], { type: 'image/png' });

      // Confirm crop (should handle error)
      await act(async () => {
        await result.current.handleCropConfirm(mockBlob);
      });

      expect(mockShowToast).toHaveBeenCalledWith('Failed to save token image', 'error');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview');
      expect(result.current.pendingCrop).toBeNull();
    });

    it('does nothing if no pending crop', async () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));
      const mockBlob = new Blob(['cropped-image'], { type: 'image/png' });

      await act(async () => {
        await result.current.handleCropConfirm(mockBlob);
      });

      expect(mockAddToken).not.toHaveBeenCalled();
    });
  });

  describe('handleCropCancel', () => {
    it('revokes object URL and clears pending crop', () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));

      // Set up pending crop
      act(() => {
        result.current.setPendingCrop({
          src: 'blob:mock-preview',
          x: 100,
          y: 150,
        });
      });

      expect(result.current.pendingCrop).not.toBeNull();

      // Cancel crop
      act(() => {
        result.current.handleCropCancel();
      });

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview');
      expect(result.current.pendingCrop).toBeNull();
    });

    it('handles cancel when no pending crop', () => {
      const { result } = renderHook(() => useCanvasDrop(defaultProps));

      act(() => {
        result.current.handleCropCancel();
      });

      // Should not throw, just no-op
      expect(result.current.pendingCrop).toBeNull();
    });
  });
});
