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

// Export mocks for use in tests
export { mockErrorReporting, mockIpcRenderer }
