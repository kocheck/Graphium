import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getStoredErrors,
  storeError,
  markErrorReported,
  clearStoredErrors,
  clearReportedErrors,
  getUnreportedErrorCount,
  initGlobalErrorHandlers,
  StoredError,
} from './globalErrorHandler'

describe('globalErrorHandler', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getStoredErrors', () => {
    it('should return empty array when no errors stored', () => {
      const errors = getStoredErrors()
      expect(errors).toEqual([])
    })

    it('should return stored errors', () => {
      const mockError: StoredError = {
        id: 'err_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Test', stack: 'stack' },
        reportBody: 'report',
        source: 'global',
        reported: false,
      }
      localStorage.setItem('hyle_pending_errors', JSON.stringify([mockError]))

      const errors = getStoredErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].id).toBe('err_123')
    })

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('hyle_pending_errors', 'invalid json')
      const errors = getStoredErrors()
      expect(errors).toEqual([])
    })
  })

  describe('storeError', () => {
    it('should store an error', () => {
      const mockError: StoredError = {
        id: 'err_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Test', stack: 'stack' },
        reportBody: 'report',
        source: 'global',
        reported: false,
      }

      storeError(mockError)

      const stored = getStoredErrors()
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('err_123')
    })

    it('should add new errors at the beginning', () => {
      const error1: StoredError = {
        id: 'err_1',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'First', stack: '' },
        reportBody: '',
        source: 'global',
        reported: false,
      }
      const error2: StoredError = {
        id: 'err_2',
        timestamp: '2024-01-02T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Second', stack: '' },
        reportBody: '',
        source: 'promise',
        reported: false,
      }

      storeError(error1)
      storeError(error2)

      const stored = getStoredErrors()
      expect(stored[0].id).toBe('err_2')
      expect(stored[1].id).toBe('err_1')
    })

    it('should limit stored errors to MAX_STORED_ERRORS', () => {
      // Store 15 errors (more than the limit of 10)
      for (let i = 0; i < 15; i++) {
        storeError({
          id: `err_${i}`,
          timestamp: new Date().toISOString(),
          sanitizedError: { name: 'Error', message: `Error ${i}`, stack: '' },
          reportBody: '',
          source: 'global',
          reported: false,
        })
      }

      const stored = getStoredErrors()
      expect(stored.length).toBeLessThanOrEqual(10)
    })
  })

  describe('markErrorReported', () => {
    it('should mark an error as reported', () => {
      const mockError: StoredError = {
        id: 'err_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Test', stack: '' },
        reportBody: '',
        source: 'global',
        reported: false,
      }
      storeError(mockError)

      markErrorReported('err_123')

      const stored = getStoredErrors()
      expect(stored[0].reported).toBe(true)
    })

    it('should not affect other errors', () => {
      storeError({
        id: 'err_1',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'First', stack: '' },
        reportBody: '',
        source: 'global',
        reported: false,
      })
      storeError({
        id: 'err_2',
        timestamp: '2024-01-02T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Second', stack: '' },
        reportBody: '',
        source: 'promise',
        reported: false,
      })

      markErrorReported('err_1')

      const stored = getStoredErrors()
      const err1 = stored.find((e) => e.id === 'err_1')
      const err2 = stored.find((e) => e.id === 'err_2')
      expect(err1?.reported).toBe(true)
      expect(err2?.reported).toBe(false)
    })
  })

  describe('clearStoredErrors', () => {
    it('should clear all stored errors', () => {
      storeError({
        id: 'err_1',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Test', stack: '' },
        reportBody: '',
        source: 'global',
        reported: false,
      })

      clearStoredErrors()

      const stored = getStoredErrors()
      expect(stored).toEqual([])
    })
  })

  describe('clearReportedErrors', () => {
    it('should only clear reported errors', () => {
      storeError({
        id: 'err_reported',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Reported', stack: '' },
        reportBody: '',
        source: 'global',
        reported: true,
      })
      storeError({
        id: 'err_unreported',
        timestamp: '2024-01-02T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Unreported', stack: '' },
        reportBody: '',
        source: 'promise',
        reported: false,
      })

      clearReportedErrors()

      const stored = getStoredErrors()
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('err_unreported')
    })
  })

  describe('getUnreportedErrorCount', () => {
    it('should return count of unreported errors', () => {
      storeError({
        id: 'err_1',
        timestamp: '2024-01-01T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Test', stack: '' },
        reportBody: '',
        source: 'global',
        reported: false,
      })
      storeError({
        id: 'err_2',
        timestamp: '2024-01-02T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Test', stack: '' },
        reportBody: '',
        source: 'global',
        reported: true,
      })
      storeError({
        id: 'err_3',
        timestamp: '2024-01-03T00:00:00.000Z',
        sanitizedError: { name: 'Error', message: 'Test', stack: '' },
        reportBody: '',
        source: 'promise',
        reported: false,
      })

      expect(getUnreportedErrorCount()).toBe(2)
    })
  })

  describe('initGlobalErrorHandlers', () => {
    it('should add event listeners and return cleanup function', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const cleanup = initGlobalErrorHandlers()

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      )

      cleanup()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      )
    })
  })
})
