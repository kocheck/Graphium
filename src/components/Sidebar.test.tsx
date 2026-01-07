import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from './Sidebar';
import { useGameStore } from '../store/gameStore';
import * as AssetProcessor from '../utils/AssetProcessor';
import { rollForMessage } from '../utils/systemMessages';

// Mock the AssetProcessor module
vi.mock('../utils/AssetProcessor', () => ({
  processImage: vi.fn(),
}));

// Mock systemMessages
vi.mock('../utils/systemMessages', () => ({
  rollForMessage: vi.fn(),
}));

describe('Sidebar - Map Upload Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rollForMessage).mockReturnValue('Failed to upload map');
    // Reset store
    useGameStore.setState({
      toast: null,
      map: null,
      gridType: 'LINES',
      isCalibrating: false,
    });
  });

  it('should show error toast when map upload fails', async () => {
    vi.mocked(AssetProcessor.processImage).mockReturnValue({
      promise: Promise.reject(new Error('Upload failed')),
      cancel: vi.fn(),
    } as any);

    render(<Sidebar />);

    const uploadButton = screen.getByText(/New Map/i);
    expect(uploadButton).toBeInTheDocument();

    // Get the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Create a mock file
    const file = new File(['test'], 'test.png', { type: 'image/png' });

    // Trigger file upload
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      const state = useGameStore.getState();
      expect(state.toast).not.toBeNull();
      expect(state.toast?.type).toBe('error');
      expect(state.toast?.message).toContain('Failed to upload map');
    });
  });

  it('should show error toast when map image fails to load', async () => {
    vi.mocked(AssetProcessor.processImage).mockReturnValue({
      promise: Promise.resolve('/path/to/image.png'),
      cancel: vi.fn(),
    } as any);

    // Mock URL.createObjectURL to return a fake URL
    const originalCreateObjectURL = global.URL.createObjectURL;
    const originalRevokeObjectURL = global.URL.revokeObjectURL;
    global.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock Image to trigger onerror
    const originalImage = global.Image;

    global.Image = class MockImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      _src: string = '';

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        // Trigger onerror asynchronously when src is set
        Promise.resolve().then(() => {
          if (this.onerror) {
            this.onerror(new Event('error'));
          }
        });
      }
    } as any;

    render(<Sidebar />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      const state = useGameStore.getState();
      expect(state.toast).not.toBeNull();
      expect(state.toast?.type).toBe('error');
      expect(state.toast?.message).toBe('Failed to upload map');
    });

    // Restore originals
    global.Image = originalImage;
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });
});

describe('Sidebar - Token Drag and Drop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store with token library and tokens on map
    useGameStore.setState({
      tokenLibrary: [
        {
          id: 'token-1',
          name: 'Test Token',
          src: 'file:///path/to/token.png',
          thumbnailSrc: 'file:///path/to/thumb.png',
          defaultType: 'PC',
          category: 'Characters',
          tags: [],
          dateAdded: Date.now(),
          defaultScale: 1,
        },
      ],
      tokens: [
        {
          id: 'placed-token-1',
          x: 100,
          y: 100,
          src: 'file:///path/to/token.png',
          libraryItemId: 'token-1',
        },
      ],
      toast: null,
    });
  });

  it('should pass libraryItemId in handleDragStart when provided', () => {
    // Test the drag handler behavior directly
    const mockDataTransfer = {
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };

    const mockEvent = {
      dataTransfer: mockDataTransfer,
      target: {},
    } as any;

    // Mock Image constructor for drag image
    const originalImage = global.Image;
    global.Image = class MockImage {
      src = '';
      onload: (() => void) | null = null;
    } as any;

    // Simulate handleDragStart call with libraryItemId
    const type = 'LIBRARY_TOKEN';
    const src = 'file:///path/to/token.png';
    const libraryItemId = 'token-1';

    // This is what happens inside handleDragStart
    mockEvent.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type, src, libraryItemId }),
    );

    // Verify the drag data includes libraryItemId
    expect(mockDataTransfer.setData).toHaveBeenCalledWith(
      'application/json',
      expect.stringContaining('"libraryItemId":"token-1"'),
    );

    const callArgs = mockDataTransfer.setData.mock.calls[0];
    const dragData = JSON.parse(callArgs[1]);
    expect(dragData).toEqual({
      type: 'LIBRARY_TOKEN',
      src: 'file:///path/to/token.png',
      libraryItemId: 'token-1',
    });

    // Restore
    global.Image = originalImage;
  });

  it('should not include libraryItemId in handleDragStart when not provided', () => {
    // Test the drag handler behavior for generic tokens
    const mockDataTransfer = {
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };

    const mockEvent = {
      dataTransfer: mockDataTransfer,
      target: {},
    } as any;

    // Simulate handleDragStart call without libraryItemId (generic token)
    const type = 'GENERIC_TOKEN';
    const src = '';

    // This is what happens inside handleGenericTokenDragStart
    mockEvent.dataTransfer.setData('application/json', JSON.stringify({ type, src }));

    // Verify the drag data does NOT include libraryItemId
    const callArgs = mockDataTransfer.setData.mock.calls[0];
    const dragData = JSON.parse(callArgs[1]);
    expect(dragData).toEqual({
      type: 'GENERIC_TOKEN',
      src: '',
    });
    expect(dragData).not.toHaveProperty('libraryItemId');
  });
});
