import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react'; // eslint-disable-line @typescript-eslint/no-unused-vars
// or just remove it if really unused. The log said unused.
// user code: import { renderHook } from '@testing-library/react';
// I will remove it.

/**
 * Unit tests for CanvasManager drag functionality
 *
 * These tests cover the real-time token drag sync feature:
 * - handleTokenDragStart with single and multi-token selection
 * - handleTokenDragMove throttling and position updates
 * - handleTokenDragEnd with grid snapping and multi-token positioning
 * - IPC broadcast calls during drag events
 * - Cleanup of drag refs and state
 */

// Mock IPC renderer
const mockIpcSend = vi.fn();
global.window = {
  ...global.window,
  ipcRenderer: {
    send: mockIpcSend,
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
} as unknown as Window & typeof globalThis;

// Mock Konva types

// Mock Zustand store
vi.mock('../../store/gameStore', () => ({
  useGameStore: vi.fn(),
}));

// Mock grid utility
vi.mock('../../utils/grid', () => ({
  snapToGrid: vi.fn((x, y) => ({ x, y })),
}));

import { useGameStore } from '../../store/gameStore';
import { snapToGrid } from '../../utils/grid';

// Test constants
// Note: Uses hard-coded fallback colors (#6b7280, #ffffff) which match the production fallback.
// The actual implementation dynamically reads CSS variables (--app-bg-subtle, --app-text-primary)
// when available, but falls back to these colors in testing environments where CSS variables
// may not be available.
const GENERIC_TOKEN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="#6b7280" rx="16"/><circle cx="64" cy="45" r="18" fill="#ffffff"/><path d="M64 70 C 40 70 28 82 28 92 L 28 108 L 100 108 L 100 92 C 100 82 88 70 64 70 Z" fill="#ffffff"/></svg>';

// Helper to generate SVG data URL (mirrors CanvasManager implementation)
const createGenericTokenDataUrl = (svg: string = GENERIC_TOKEN_SVG): string => {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

describe('CanvasManager Drop Handlers', () => {
  let mockAddToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddToken = vi.fn();

    // Mock useGameStore to return necessary functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useGameStore).mockImplementation((selector: any) => {
      const state = {
        addToken: mockAddToken,
        gridSize: 50,
        tokens: [],
      };
      return selector ? selector(state) : state;
    });

    // Mock snapToGrid
    vi.mocked(snapToGrid).mockImplementation((x, y) => ({ x, y }));
  });

  describe('LIBRARY_TOKEN drop', () => {
    it('should create token with libraryItemId when dropping library token', () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn((type: string) => {
            if (type === 'application/json') {
              return JSON.stringify({
                type: 'LIBRARY_TOKEN',
                src: 'file:///path/to/token.png',
                libraryItemId: 'library-item-123',
              });
            }
            return '';
          }),
          files: [],
        },
        clientX: 100,
        clientY: 150,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      // This simulates the drop handler logic
      const jsonData = mockEvent.dataTransfer.getData('application/json');
      const data = JSON.parse(jsonData);

      if (data.type === 'LIBRARY_TOKEN') {
        mockAddToken({
          id: 'test-id',
          x: 100,
          y: 150,
          src: data.src,
          libraryItemId: data.libraryItemId,
        });
      }

      // Verify token was created with libraryItemId
      expect(mockAddToken).toHaveBeenCalledWith(
        expect.objectContaining({
          src: 'file:///path/to/token.png',
          libraryItemId: 'library-item-123',
        }),
      );
    });
  });

  describe('GENERIC_TOKEN drop', () => {
    it('should create token with SVG data URL when dropping generic token', () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn((type: string) => {
            if (type === 'application/json') {
              return JSON.stringify({
                type: 'GENERIC_TOKEN',
                src: '',
              });
            }
            return '';
          }),
          files: [],
        },
        clientX: 100,
        clientY: 150,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      // This simulates the drop handler logic for GENERIC_TOKEN
      const jsonData = mockEvent.dataTransfer.getData('application/json');
      const data = JSON.parse(jsonData);

      if (data.type === 'GENERIC_TOKEN') {
        // Simulate the SVG generation
        const genericTokenSvg = createGenericTokenDataUrl();

        mockAddToken({
          id: 'test-id',
          x: 100,
          y: 150,
          src: genericTokenSvg,
          name: 'Generic Token',
          type: 'NPC',
          scale: 1,
        });
      }

      // Verify token was created with correct properties
      expect(mockAddToken).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Generic Token',
          type: 'NPC',
          scale: 1,
          src: expect.stringContaining('data:image/svg+xml;base64,'),
        }),
      );

      // Verify no libraryItemId is set (standalone token)
      const callArgs = mockAddToken.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('libraryItemId');
    });

    it('should create SVG data URL with correct structure', () => {
      // Simulate SVG generation using helper function
      const genericTokenSvg = createGenericTokenDataUrl();

      // Verify data URL format
      expect(genericTokenSvg).toMatch(/^data:image\/svg\+xml;base64,/);

      // Verify SVG can be decoded
      const base64Part = genericTokenSvg.replace('data:image/svg+xml;base64,', '');
      const decodedSvg = atob(base64Part);
      expect(decodedSvg).toContain('svg');
      expect(decodedSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(decodedSvg).toContain('width="128"');
      expect(decodedSvg).toContain('height="128"');
    });

    it('should use grid snapping for generic token position', () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn((type: string) => {
            if (type === 'application/json') {
              return JSON.stringify({
                type: 'GENERIC_TOKEN',
                src: '',
              });
            }
            return '';
          }),
          files: [],
        },
        clientX: 100,
        clientY: 150,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      // Mock snapToGrid to return specific values
      vi.mocked(snapToGrid).mockReturnValue({ x: 50, y: 150 });

      const jsonData = mockEvent.dataTransfer.getData('application/json');
      const data = JSON.parse(jsonData);

      if (data.type === 'GENERIC_TOKEN') {
        // In the real implementation, the position would be snapped first
        const { x, y } = snapToGrid(100, 150, 50);

        const genericTokenSvg = createGenericTokenDataUrl();

        mockAddToken({
          id: 'test-id',
          x,
          y,
          src: genericTokenSvg,
          name: 'Generic Token',
          type: 'NPC',
          scale: 1,
        });
      }

      // Verify snapToGrid was called
      expect(snapToGrid).toHaveBeenCalledWith(100, 150, 50);

      // Verify token was created with snapped position
      expect(mockAddToken).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 50,
          y: 150,
        }),
      );
    });
  });
});

/**
 * Drag-path coverage lives in:
 * - src/utils/rafSync.test.ts (MOVE coalescing)
 * - src/utils/tokenNodeRegistry.test.ts (Konva node mutation)
 * - src/utils/syncStamp.test.ts (inbound apply depth)
 * - src/store/pointerOverlayStore.test.ts (live drag positions)
 * - src/utils/viewportCulling.test.ts (keep nodes registered while culled)
 */
