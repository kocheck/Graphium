import React, { Component, ErrorInfo, ReactNode } from 'react';
import { sanitizeStack, generateReportBody, SanitizedError } from '../utils/errorSanitizer';

interface Props {
  children: ReactNode;
  supportEmail?: string;
}

interface State {
  hasError: boolean;
  isLoading: boolean;
  sanitizedError: SanitizedError | null;
  reportBody: string;
  copyStatus: 'idle' | 'copied' | 'error';
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  userContext: string;
  showContextInput: boolean;
}

/**
 * Privacy-focused Error Boundary component.
 *
 * Catches React errors, sanitizes them to remove PII (usernames, file paths),
 * and provides a user-friendly interface for reporting errors via email.
 */
class PrivacyErrorBoundary extends Component<Props, State> {
  static defaultProps = {
    supportEmail: 'support@example.com',
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isLoading: false,
      sanitizedError: null,
      reportBody: '',
      copyStatus: 'idle',
      saveStatus: 'idle',
      userContext: '',
      showContextInput: false,
    };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, isLoading: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Delegate to async method to keep componentDidCatch synchronous per React lifecycle requirements
    this.sanitizeAndSetError(error, errorInfo);
  }

  private async sanitizeAndSetError(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      // Get the system username for sanitization
      const username = await window.errorReporting.getUsername();

      // Create a combined error with component stack
      const combinedError = new Error(error.message);
      combinedError.name = error.name;
      combinedError.stack = `${error.stack || ''}\n\nComponent Stack:${errorInfo.componentStack || ''}`;

      // Sanitize the error to remove PII
      const sanitizedError = sanitizeStack(combinedError, username);

      // Generate the full report body
      const reportBody = generateReportBody(sanitizedError);

      this.setState({
        sanitizedError,
        reportBody,
        isLoading: false,
      });
    } catch (sanitizationError) {
      // Sanitization failed - avoiding logging to prevent sensitive data leakage
      const fallbackError: SanitizedError = {
        name: 'Error',
        message: 'An error occurred, but we could not safely generate a report.',
        stack: 'Stack trace unavailable for privacy reasons.',
      };
      this.setState({
        sanitizedError: fallbackError,
        reportBody: generateReportBody(fallbackError),
        isLoading: false,
      });
    }
  }

  handleCopyAndEmail = async (): Promise<void> => {
    const { reportBody, userContext } = this.state;
    const { supportEmail } = this.props;

    try {
      // Build the final report with optional user context
      let finalReport = reportBody;
      if (userContext.trim()) {
        finalReport = reportBody.replace(
          '================================================================================\n                            END OF REPORT',
          `--------------------------------------------------------------------------------
                            USER CONTEXT (Optional)
--------------------------------------------------------------------------------

${userContext.trim()}

================================================================================
                            END OF REPORT`
        );
      }

      // Copy the full report to clipboard
      await navigator.clipboard.writeText(finalReport);
      this.setState({ copyStatus: 'copied' });

      // Create mailto link with instructions (not the actual report)
      const subject = encodeURIComponent('Hyle Error Report');
      const body = encodeURIComponent(
        'Please paste the error report from your clipboard here.\n\n' +
        '(The error report has been copied to your clipboard for privacy reasons.)'
      );
      const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

      // Open the default email client
      await window.errorReporting.openExternal(mailtoUrl);

      // Reset copy status after 3 seconds
      setTimeout(() => {
        this.setState({ copyStatus: 'idle' });
      }, 3000);
    } catch (err) {
      if (err instanceof Error) {
        console.error('Failed to copy report or open email client:', `${err.name}: ${err.message}`);
      } else {
        console.error('Failed to copy report or open email client:', typeof err === 'string' ? err : '[Unknown error]');
      }
      this.setState({ copyStatus: 'error' });

      // Reset error status after 3 seconds
      setTimeout(() => {
        this.setState({ copyStatus: 'idle' });
      }, 3000);
    }
  };

  handleSaveToFile = async (): Promise<void> => {
    const { reportBody, userContext } = this.state;

    try {
      this.setState({ saveStatus: 'saving' });

      // Build the final report with optional user context
      let finalReport = reportBody;
      if (userContext.trim()) {
        finalReport = reportBody.replace(
          '================================================================================\n                            END OF REPORT',
          `--------------------------------------------------------------------------------
                            USER CONTEXT (Optional)
--------------------------------------------------------------------------------

${userContext.trim()}

================================================================================
                            END OF REPORT`
        );
      }

      // Save to file using native dialog
      const result = await window.errorReporting.saveToFile(finalReport);

      if (result.success) {
        this.setState({ saveStatus: 'saved' });
        // Reset status after 3 seconds
        setTimeout(() => {
          this.setState({ saveStatus: 'idle' });
        }, 3000);
      } else if (result.reason === 'canceled') {
        // User canceled - just reset to idle
        this.setState({ saveStatus: 'idle' });
      } else {
        this.setState({ saveStatus: 'error' });
        setTimeout(() => {
          this.setState({ saveStatus: 'idle' });
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to save error report:', err);
      this.setState({ saveStatus: 'error' });
      setTimeout(() => {
        this.setState({ saveStatus: 'idle' });
      }, 3000);
    }
  };

  handleContextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    this.setState({ userContext: e.target.value });
  };

  toggleContextInput = (): void => {
    this.setState((prev) => ({ showContextInput: !prev.showContextInput }));
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { hasError, isLoading, sanitizedError, copyStatus, saveStatus, userContext, showContextInput } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-neutral-800 rounded-lg shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-red-600 px-6 py-4">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Something went wrong
              </h1>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <svg
                    className="w-12 h-12 animate-spin text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <p className="text-neutral-300">Preparing error report...</p>
                </div>
              ) : (
                <>
                  <p className="text-neutral-300">
                    We're sorry, but something unexpected happened. The error details
                    below have been sanitized to remove any personal information.
                  </p>

                  {/* Error Details */}
                  {sanitizedError && (
                    <div className="space-y-2">
                      <div className="text-sm text-neutral-400">
                        <span className="font-semibold text-red-400">
                          {sanitizedError.name}:
                        </span>{' '}
                        {sanitizedError.message}
                      </div>

                      {/* Scrollable Stack Trace */}
                      <div className="bg-neutral-900 rounded border border-neutral-700 overflow-hidden">
                        <div className="px-3 py-2 bg-neutral-800 border-b border-neutral-700 text-sm text-neutral-400 font-medium">
                          Stack Trace (Sanitized)
                        </div>
                        <pre className="p-3 text-xs text-neutral-300 overflow-x-auto overflow-y-auto max-h-64 whitespace-pre-wrap break-words font-mono">
                          {sanitizedError.stack}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Privacy Notice */}
                  <div className="bg-blue-900/30 border border-blue-700/50 rounded p-3 text-sm text-blue-200">
                    <strong>Privacy Notice:</strong> Your username and personal file
                    paths have been replaced with &lt;USER&gt; to protect your privacy.
                  </div>

                  {/* Optional User Context */}
                  <div className="space-y-2">
                    <button
                      onClick={this.toggleContextInput}
                      className="text-sm text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${showContextInput ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      Add context (optional) - What were you doing when this happened?
                    </button>

                    {showContextInput && (
                      <div className="space-y-1">
                        <textarea
                          value={userContext}
                          onChange={this.handleContextChange}
                          placeholder="E.g., 'I was trying to import an image when...'"
                          className="w-full h-24 bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-neutral-300 placeholder-neutral-500 resize-none focus:outline-none focus:border-blue-500"
                          maxLength={500}
                        />
                        <div className="text-xs text-neutral-500 text-right">
                          {userContext.length}/500 characters
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={this.handleCopyAndEmail}
                      className={`flex-1 px-4 py-2 rounded font-medium transition-colors flex items-center justify-center gap-2 ${
                        copyStatus === 'copied'
                          ? 'bg-green-600 hover:bg-green-500'
                          : copyStatus === 'error'
                          ? 'bg-red-600 hover:bg-red-500'
                          : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      {copyStatus === 'copied' ? (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Copied! Opening Email...
                        </>
                      ) : copyStatus === 'error' ? (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Failed - Try Again
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                            />
                          </svg>
                          Copy Report &amp; Email Support
                        </>
                      )}
                    </button>

                    <button
                      onClick={this.handleSaveToFile}
                      className={`flex-1 px-4 py-2 rounded font-medium transition-colors flex items-center justify-center gap-2 ${
                        saveStatus === 'saved'
                          ? 'bg-green-600 hover:bg-green-500'
                          : saveStatus === 'error'
                          ? 'bg-red-600 hover:bg-red-500'
                          : saveStatus === 'saving'
                          ? 'bg-neutral-700 cursor-wait'
                          : 'bg-neutral-600 hover:bg-neutral-500'
                      }`}
                      disabled={saveStatus === 'saving'}
                    >
                      {saveStatus === 'saved' ? (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Saved!
                        </>
                      ) : saveStatus === 'error' ? (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Failed - Try Again
                        </>
                      ) : saveStatus === 'saving' ? (
                        <>
                          <svg
                            className="w-5 h-5 animate-spin"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Save to File
                        </>
                      )}
                    </button>

                    <button
                      onClick={this.handleReload}
                      className="px-4 py-2 bg-neutral-600 hover:bg-neutral-500 rounded font-medium transition-colors flex items-center gap-2"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Reload App
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default PrivacyErrorBoundary;
