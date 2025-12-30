import React, { useState, useEffect, useCallback } from 'react';
import {
  getStoredErrors,
  getUnreportedErrorCount,
  markErrorReported,
  clearReportedErrors,
  StoredError,
} from '../utils/globalErrorHandler';

// Constants for GitHub issue URL construction
const MAX_GITHUB_URL_LENGTH = 2000;
const MAX_ISSUE_TITLE_LENGTH = 200;
// Safety margin to account for URL-encoded ellipsis character (… becomes %E2%80%A6)
const TITLE_ELLIPSIS_MARGIN = 10;

interface PendingErrorsIndicatorProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

/**
 * Floating indicator that shows when there are pending unreported errors.
 * Allows users to review, report, or dismiss stored errors.
 */
const PendingErrorsIndicator: React.FC<PendingErrorsIndicatorProps> = ({
  position = 'bottom-right',
}) => {
  const [unreportedCount, setUnreportedCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errors, setErrors] = useState<StoredError[]>([]);
  const [selectedError, setSelectedError] = useState<StoredError | null>(null);
  const [reportStatus, setReportStatus] = useState<'idle' | 'opened' | 'error'>('idle');

  const refreshErrors = useCallback(() => {
    const stored = getStoredErrors();
    // Create a new array to force React to re-render
    setErrors([...stored]);
    setUnreportedCount(getUnreportedErrorCount());
  }, []);

  useEffect(() => {
    refreshErrors();

    // Listen for new errors
    const handleNewError = () => {
      refreshErrors();
    };

    window.addEventListener('hyle-error', handleNewError);
    return () => {
      window.removeEventListener('hyle-error', handleNewError);
    };
  }, [refreshErrors]);

  const handleReportError = async (error: StoredError) => {
    try {
      // GitHub issue URLs can break if they get too long, so enforce a conservative limit
      const rawTitle = `Bug Report: ${error.sanitizedError.name}`;
      const issueTitle =
        rawTitle.length > MAX_ISSUE_TITLE_LENGTH
          ? `${rawTitle.slice(0, MAX_ISSUE_TITLE_LENGTH - TITLE_ELLIPSIS_MARGIN)}…`
          : rawTitle;
      const issueBody = error.reportBody;

      const encodedTitle = encodeURIComponent(issueTitle);
      const encodedBody = encodeURIComponent(issueBody);

      const baseUrl = `https://github.com/kocheck/Hyle/issues/new`;
      const baseWithTitle = `${baseUrl}?title=${encodedTitle}`;
      const bodyPrefix = '&body=';

      let githubUrl = `${baseWithTitle}${bodyPrefix}${encodedBody}`;

      if (githubUrl.length > MAX_GITHUB_URL_LENGTH) {
        const allowedBodyLength =
          MAX_GITHUB_URL_LENGTH - (baseWithTitle.length + bodyPrefix.length);

        if (allowedBodyLength <= 0) {
          // In the unlikely event the base URL is already too long, drop the body entirely
          githubUrl = baseWithTitle;
        } else {
          // Truncate non-encoded string first, then encode to avoid breaking escape sequences
          let currentLength = 0;
          const encodedChunks: string[] = [];
          
          for (const char of issueBody) {
            const encodedChar = encodeURIComponent(char);
            if (currentLength + encodedChar.length > allowedBodyLength) {
              break;
            }
            encodedChunks.push(encodedChar);
            currentLength += encodedChar.length;
          }
          
          const truncatedEncodedBody = encodedChunks.join('');
          githubUrl = `${baseWithTitle}${bodyPrefix}${truncatedEncodedBody}`;
        }
      }

      // Open GitHub in browser
      const errorReporting = window.errorReporting;
      if (errorReporting) {
        await errorReporting.openExternal(githubUrl);
        setReportStatus('opened');
      }

      // Mark as reported
      markErrorReported(error.id);
      refreshErrors();

      // Reset report status
      setTimeout(() => setReportStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to report error:', err);
      setReportStatus('error');
      setTimeout(() => setReportStatus('idle'), 3000);
    }
  };

  const handleSaveError = async (error: StoredError) => {
    try {
      const errorReporting = window.errorReporting;
      if (errorReporting) {
        const result = await errorReporting.saveToFile(error.reportBody);
        if (result.success) {
          markErrorReported(error.id);
          refreshErrors();
        }
      }
    } catch (err) {
      console.error('Failed to save error:', err);
    }
  };

  const handleDismissReported = () => {
    clearReportedErrors();
    refreshErrors();
    setSelectedError(null);
  };

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  // Don't render if no errors
  if (errors.length === 0) {
    return null;
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {/* Collapsed View - Badge */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg px-4 py-2 shadow-lg transition-colors"
        >
          <svg
            className="w-5 h-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-neutral-200 text-sm">
            {errors.length} Error{errors.length !== 1 ? 's' : ''}
          </span>
          {unreportedCount > 0 && (
            <span className="bg-red-600 text-white text-xs rounded-full px-2 py-0.5">
              {unreportedCount} new
            </span>
          )}
        </button>
      )}

      {/* Expanded View - Panel */}
      {isExpanded && (
        <div className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
            <h3 className="font-medium text-neutral-200">Stored Errors</h3>
            <button
              onClick={() => {
                setIsExpanded(false);
                setSelectedError(null);
              }}
              className="text-neutral-400 hover:text-neutral-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Error List */}
          {!selectedError && (
            <div className="flex-1 overflow-y-auto">
              {errors.map((error) => (
                <button
                  key={error.id}
                  onClick={() => setSelectedError(error)}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-700 border-b border-neutral-700 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-red-400 truncate">
                          {error.sanitizedError.name}
                        </span>
                        {!error.reported && (
                          <span className="bg-amber-600/30 text-amber-400 text-xs px-1.5 py-0.5 rounded">
                            New
                          </span>
                        )}
                        {error.occurrences > 1 && (
                          <span className="bg-neutral-600 text-neutral-300 text-xs px-1.5 py-0.5 rounded">
                            x{error.occurrences}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate mt-1">
                        {error.sanitizedError.message}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {formatTimestamp(error.lastOccurrence || error.timestamp)}
                      </p>
                    </div>
                    <svg
                      className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-1"
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
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Error Detail View */}
          {selectedError && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-3">
                {/* Back button */}
                <button
                  onClick={() => setSelectedError(null)}
                  className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to list
                </button>

                {/* Error info */}
                <div>
                  <h4 className="text-red-400 font-medium">{selectedError.sanitizedError.name}</h4>
                  <p className="text-sm text-neutral-300 mt-1">
                    {selectedError.sanitizedError.message}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-neutral-500">
                    <span>Source: {selectedError.source}</span>
                    {selectedError.occurrences > 1 && (
                      <span>Occurred {selectedError.occurrences} times</span>
                    )}
                  </div>
                </div>

                {/* Stack trace preview */}
                <div className="bg-neutral-900 rounded border border-neutral-700 overflow-hidden">
                  <div className="px-3 py-2 bg-neutral-800 border-b border-neutral-700 text-xs text-neutral-400">
                    Stack Trace (Sanitized)
                  </div>
                  <pre className="p-2 text-xs text-neutral-300 overflow-x-auto max-h-32 whitespace-pre-wrap break-words font-mono">
                    {selectedError.sanitizedError.stack}
                  </pre>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReportError(selectedError)}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${
                      reportStatus === 'opened'
                        ? 'bg-green-600 hover:bg-green-500'
                        : reportStatus === 'error'
                        ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {reportStatus === 'opened' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Opened!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                        </svg>
                        Report on GitHub
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleSaveError(selectedError)}
                    className="flex-1 px-3 py-2 rounded text-sm font-medium bg-neutral-600 hover:bg-neutral-500 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-neutral-700 flex justify-between items-center">
            <span className="text-xs text-neutral-500">
              {unreportedCount} unreported of {errors.length}
            </span>
            {errors.some((e) => e.reported) && (
              <button
                onClick={handleDismissReported}
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Clear reported
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingErrorsIndicator;
