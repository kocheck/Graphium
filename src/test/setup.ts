import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.errorReporting for tests
const mockErrorReporting = {
  getUsername: vi.fn().mockResolvedValue('testuser'),
  openExternal: vi.fn().mockResolvedValue(true),
  saveToFile: vi.fn().mockResolvedValue({ success: true, filePath: '/path/to/file.txt' }),
}

// Mock window.ipcRenderer for tests
const mockIpcRenderer = {
  on: vi.fn(),
  off: vi.fn(),
  send: vi.fn(),
  invoke: vi.fn(),
}

// Apply mocks to window
Object.defineProperty(window, 'errorReporting', {
  value: mockErrorReporting,
  writable: true,
})

Object.defineProperty(window, 'ipcRenderer', {
  value: mockIpcRenderer,
  writable: true,
})

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
})

// Basic Canvas Mock for Konva in jsdom
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-expect-error - Mocking Canvas context for tests
  HTMLCanvasElement.prototype.getContext = function(type: string) {
    if (type === '2d') {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
      };
    }
    return null;
  };

  // Mock toDataURL
  HTMLCanvasElement.prototype.toDataURL = function() {
      return "data:image/png;base64,";
  }
}

// Export mocks for use in tests
export { mockErrorReporting, mockIpcRenderer }
