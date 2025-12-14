import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PendingErrorsIndicator from './PendingErrorsIndicator'
import { mockErrorReporting } from '../test/setup'
import * as globalErrorHandler from '../utils/globalErrorHandler'

// Mock the globalErrorHandler module
vi.mock('../utils/globalErrorHandler', () => ({
  getStoredErrors: vi.fn(),
  getUnreportedErrorCount: vi.fn(),
  markErrorReported: vi.fn(),
  clearReportedErrors: vi.fn(),
}))

describe('PendingErrorsIndicator', () => {
  const mockStoredError = {
    id: 'err_123',
    timestamp: '2025-01-01T12:00:00.000Z',
    lastOccurrence: '2025-01-01T12:00:00.000Z',
    occurrences: 1,
    reported: false,
    source: 'component',
    sanitizedError: {
      name: 'TestError',
      message: 'Test error message',
      stack: 'Error: Test error message\n    at test.tsx:1:1',
    },
    reportBody: 'Full error report body',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('rendering', () => {
    it('should not render when there are no errors', () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(0)

      const { container } = render(<PendingErrorsIndicator />)
      expect(container.firstChild).toBeNull()
    })

    it('should render collapsed badge when there are errors', () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      expect(screen.getByText('1 Error')).toBeInTheDocument()
    })

    it('should render plural "Errors" when there are multiple errors', () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([
        mockStoredError,
        { ...mockStoredError, id: 'err_456' },
      ])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(2)

      render(<PendingErrorsIndicator />)
      expect(screen.getByText('2 Errors')).toBeInTheDocument()
    })

    it('should show unreported count badge', () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([
        mockStoredError,
        { ...mockStoredError, id: 'err_456', reported: true },
      ])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      expect(screen.getByText('1 new')).toBeInTheDocument()
    })

    it('should render at the bottom-right by default', () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      const { container } = render(<PendingErrorsIndicator />)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('bottom-4')
      expect(element.className).toContain('right-4')
    })

    it('should render at custom position when specified', () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      const { container } = render(<PendingErrorsIndicator position="top-left" />)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('top-4')
      expect(element.className).toContain('left-4')
    })
  })

  describe('expansion and collapse', () => {
    it('should expand panel when badge is clicked', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('Stored Errors')).toBeInTheDocument()
      })
    })

    it('should show error list when expanded', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
        expect(screen.getByText('Test error message')).toBeInTheDocument()
      })
    })

    it('should collapse panel when close button is clicked', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      // Expand
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('Stored Errors')).toBeInTheDocument()
      })

      // Close
      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find(btn => 
        btn.querySelector('svg')?.querySelector('path')?.getAttribute('d')?.includes('M6 18L18 6M6 6l12 12')
      )
      if (closeButton) {
        fireEvent.click(closeButton)
      }

      await waitFor(() => {
        expect(screen.queryByText('Stored Errors')).not.toBeInTheDocument()
      })
    })
  })

  describe('error list display', () => {
    it('should show "New" badge for unreported errors', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument()
      })
    })

    it('should show occurrence count when error occurred multiple times', async () => {
      const multipleOccurrenceError = { ...mockStoredError, occurrences: 5 }
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([multipleOccurrenceError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('x5')).toBeInTheDocument()
      })
    })

    it('should format and display timestamp', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        // Check that a formatted date is shown (format depends on locale)
        const dateElements = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i)
        expect(dateElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('error detail view', () => {
    it('should show error detail when error is clicked', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      // Click on the error
      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Back to list')).toBeInTheDocument()
        expect(screen.getByText('Stack Trace (Sanitized)')).toBeInTheDocument()
      })
    })

    it('should show source and occurrence information in detail view', async () => {
      const errorWithMultipleOccurrences = { ...mockStoredError, occurrences: 3, source: 'window' }
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([errorWithMultipleOccurrences])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText(/Source: window/i)).toBeInTheDocument()
        expect(screen.getByText(/Occurred 3 times/i)).toBeInTheDocument()
      })
    })

    it('should return to list when back button is clicked', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Back to list')).toBeInTheDocument()
      })

      const backButton = screen.getByText('Back to list')
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(screen.queryByText('Back to list')).not.toBeInTheDocument()
      })
    })
  })

  describe('error reporting', () => {
    it('should copy report and open email when Email button is clicked', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator supportEmail="test@example.com" />)
      
      // Expand and select error
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument()
      })

      const emailButton = screen.getByText('Email')
      fireEvent.click(emailButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Full error report body')
        expect(mockErrorReporting.openExternal).toHaveBeenCalledWith(
          expect.stringContaining('mailto:test@example.com')
        )
      })
    })

    it('should mark error as reported after successful email', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument()
      })

      const emailButton = screen.getByText('Email')
      fireEvent.click(emailButton)

      await waitFor(() => {
        expect(globalErrorHandler.markErrorReported).toHaveBeenCalledWith('err_123')
      })
    })

    it('should show copied status after successful email', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument()
      })

      const emailButton = screen.getByText('Email')
      fireEvent.click(emailButton)

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })

    it('should handle email reporting errors gracefully', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Clipboard failed'))

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument()
      })

      const emailButton = screen.getByText('Email')
      fireEvent.click(emailButton)

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled()
      })
    })
  })

  describe('save to file', () => {
    it('should save error report to file when Save button is clicked', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockErrorReporting.saveToFile).toHaveBeenCalledWith('Full error report body')
      })
    })

    it('should mark error as reported after successful save', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)
      mockErrorReporting.saveToFile.mockResolvedValueOnce({ success: true, filePath: '/path/to/file.txt' })

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(globalErrorHandler.markErrorReported).toHaveBeenCalledWith('err_123')
      })
    })

    it('should not mark as reported if save was cancelled', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)
      mockErrorReporting.saveToFile.mockResolvedValueOnce({ success: false, reason: 'canceled' })

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockErrorReporting.saveToFile).toHaveBeenCalled()
        // Verify markErrorReported is not called after save is handled
        expect(globalErrorHandler.markErrorReported).not.toHaveBeenCalled()
      })
    })

    it('should handle save errors gracefully', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)
      mockErrorReporting.saveToFile.mockRejectedValueOnce(new Error('Save failed'))

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('TestError')).toBeInTheDocument()
      })

      const errorItem = screen.getByText('TestError')
      fireEvent.click(errorItem)

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled()
      })
    })
  })

  describe('dismiss functionality', () => {
    it('should show "Clear reported" button when there are reported errors', async () => {
      const reportedError = { ...mockStoredError, reported: true }
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([reportedError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(0)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('Clear reported')).toBeInTheDocument()
      })
    })

    it('should not show "Clear reported" button when all errors are unreported', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('Stored Errors')).toBeInTheDocument()
      })

      expect(screen.queryByText('Clear reported')).not.toBeInTheDocument()
    })

    it('should clear reported errors when button is clicked', async () => {
      const reportedError = { ...mockStoredError, reported: true }
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([reportedError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(0)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('1 Error')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('Clear reported')).toBeInTheDocument()
      })

      const clearButton = screen.getByText('Clear reported')
      fireEvent.click(clearButton)

      expect(globalErrorHandler.clearReportedErrors).toHaveBeenCalled()
    })
  })

  describe('event listener', () => {
    it('should refresh errors when hyle-error event is dispatched', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)

      // Initially renders with 1 error
      expect(screen.getByText('1 Error')).toBeInTheDocument()

      // Add another error
      const newError = { ...mockStoredError, id: 'err_456' }
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([mockStoredError, newError])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(2)

      // Dispatch event
      window.dispatchEvent(new Event('hyle-error'))

      // Should update to show 2 errors
      await waitFor(() => {
        expect(screen.getByText('2 Errors')).toBeInTheDocument()
      })
    })
  })

  describe('footer information', () => {
    it('should display unreported count in footer', async () => {
      vi.mocked(globalErrorHandler.getStoredErrors).mockReturnValue([
        mockStoredError,
        { ...mockStoredError, id: 'err_456', reported: true },
      ])
      vi.mocked(globalErrorHandler.getUnreportedErrorCount).mockReturnValue(1)

      render(<PendingErrorsIndicator />)
      
      const badge = screen.getByText('2 Errors')
      fireEvent.click(badge)

      await waitFor(() => {
        expect(screen.getByText('1 unreported of 2')).toBeInTheDocument()
      })
    })
  })
})
