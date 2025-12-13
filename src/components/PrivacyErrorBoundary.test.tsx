import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PrivacyErrorBoundary from './PrivacyErrorBoundary'
import { mockErrorReporting } from '../test/setup'

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Wrapper to control when error is thrown
function ErrorTrigger() {
  return <ThrowError shouldThrow={true} />
}

describe('PrivacyErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should render children when there is no error', () => {
    render(
      <PrivacyErrorBoundary>
        <div data-testid="child">Child content</div>
      </PrivacyErrorBoundary>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('should render error UI when child throws', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  it('should display friendly error message', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/something unexpected happened/i)).toBeInTheDocument()
    })
  })

  it('should show privacy notice', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Privacy Notice/i)).toBeInTheDocument()
      expect(screen.getByText(/replaced with/i)).toBeInTheDocument()
    })
  })

  it('should call getUsername on error', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(mockErrorReporting.getUsername).toHaveBeenCalled()
    })
  })

  it('should display Copy Report & Email Support button', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Copy Report & Email Support/i)).toBeInTheDocument()
    })
  })

  it('should display Reload App button', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText('Reload App')).toBeInTheDocument()
    })
  })

  it('should copy to clipboard and open email on button click', async () => {
    render(
      <PrivacyErrorBoundary supportEmail="test@example.com">
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Copy Report & Email Support/i)).toBeInTheDocument()
    })

    const button = screen.getByText(/Copy Report & Email Support/i)
    fireEvent.click(button)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      expect(mockErrorReporting.openExternal).toHaveBeenCalledWith(
        expect.stringContaining('mailto:test@example.com')
      )
    })
  })

  it('should include subject in mailto link', async () => {
    render(
      <PrivacyErrorBoundary supportEmail="support@hyle.app">
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Copy Report & Email Support/i)).toBeInTheDocument()
    })

    const button = screen.getByText(/Copy Report & Email Support/i)
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockErrorReporting.openExternal).toHaveBeenCalledWith(
        expect.stringContaining('subject=')
      )
    })
  })

  it('should show copied status after clicking button', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Copy Report & Email Support/i)).toBeInTheDocument()
    })

    const button = screen.getByText(/Copy Report & Email Support/i)
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Copied! Opening Email/i)).toBeInTheDocument()
    })
  })

  it('should use default support email if not provided', async () => {
    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Copy Report & Email Support/i)).toBeInTheDocument()
    })

    const button = screen.getByText(/Copy Report & Email Support/i)
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockErrorReporting.openExternal).toHaveBeenCalledWith(
        expect.stringContaining('mailto:support@example.com')
      )
    })
  })

  it('should display sanitized stack trace', async () => {
    // Set up mock to return a specific username
    mockErrorReporting.getUsername.mockResolvedValueOnce('testuser')

    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText('Stack Trace (Sanitized)')).toBeInTheDocument()
    })
  })

  it('should handle getUsername failure gracefully', async () => {
    mockErrorReporting.getUsername.mockRejectedValueOnce(new Error('IPC failed'))

    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      // Should still show error UI even if sanitization fails
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  it('should handle clipboard failure gracefully', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error('Clipboard failed')
    )

    render(
      <PrivacyErrorBoundary>
        <ErrorTrigger />
      </PrivacyErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText(/Copy Report & Email Support/i)).toBeInTheDocument()
    })

    const button = screen.getByText(/Copy Report & Email Support/i)
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Failed - Try Again/i)).toBeInTheDocument()
    })
  })

  // Tests for handleSaveToFile method
  describe('handleSaveToFile', () => {
    it('should display Save to File button', async () => {
      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      })
    })

    it('should call saveToFile API when button is clicked', async () => {
      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      })

      const button = screen.getByText('Save to File')
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockErrorReporting.saveToFile).toHaveBeenCalled()
      })
    })

    it('should show saving status when save is in progress', async () => {
      // Mock a delayed response
      mockErrorReporting.saveToFile.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      })

      const button = screen.getByText('Save to File')
      fireEvent.click(button)

      // Should show saving status
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })
    })

    it('should show success status after successful save', async () => {
      mockErrorReporting.saveToFile.mockResolvedValueOnce({ 
        success: true, 
        filePath: '/path/to/error-report.txt' 
      })

      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      })

      const button = screen.getByText('Save to File')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument()
      })
    })

    it('should handle user cancellation gracefully', async () => {
      mockErrorReporting.saveToFile.mockResolvedValueOnce({ 
        success: false, 
        reason: 'canceled' 
      })

      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      })

      const button = screen.getByText('Save to File')
      fireEvent.click(button)

      // Should return to idle state (button should say "Save to File" again)
      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      }, { timeout: 500 })
    })

    it('should show error status when save fails', async () => {
      mockErrorReporting.saveToFile.mockResolvedValueOnce({ 
        success: false, 
        reason: 'error' 
      })

      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      })

      const button = screen.getByText('Save to File')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/Failed - Try Again/i)).toBeInTheDocument()
      })
    })

    it('should handle saveToFile API errors gracefully', async () => {
      mockErrorReporting.saveToFile.mockRejectedValueOnce(new Error('IPC error'))

      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText('Save to File')).toBeInTheDocument()
      })

      const button = screen.getByText('Save to File')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/Failed - Try Again/i)).toBeInTheDocument()
      })
    })

    it('should include user context in saved report', async () => {
      render(
        <PrivacyErrorBoundary>
          <ErrorTrigger />
        </PrivacyErrorBoundary>
      )

      await waitFor(() => {
        expect(screen.getByText(/Add context \(optional\)/i)).toBeInTheDocument()
      })

      // Expand context input
      const contextToggle = screen.getByText(/Add context \(optional\)/i)
      fireEvent.click(contextToggle)

      // Add user context
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/I was trying to/i)
        fireEvent.change(textarea, { target: { value: 'Testing error reporting' } })
      })

      // Click save button
      const saveButton = screen.getByText('Save to File')
      fireEvent.click(saveButton)

      // Verify saveToFile was called with context included
      await waitFor(() => {
        expect(mockErrorReporting.saveToFile).toHaveBeenCalled()
        const callArg = mockErrorReporting.saveToFile.mock.calls[0][0]
        expect(callArg).toContain('Testing error reporting')
        expect(callArg).toContain('USER CONTEXT')
      })
    })
  })
})
