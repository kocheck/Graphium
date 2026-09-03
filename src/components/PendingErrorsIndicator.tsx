import type React from 'react';
import { useState, useEffect, useCallback } from 'react';

import {
  RiErrorWarningLine,
  RiCloseLine,
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiCheckLine,
  RiGithubFill,
  RiSaveLine,
} from '@remixicon/react';

import {
  getStoredErrors,
  getUnreportedErrorCount,
  markErrorReported,
  clearReportedErrors,
} from '../utils/globalErrorHandler';

import type { StoredError } from '../utils/globalErrorHandler';

// Constants for GitHub issue URL construction
const MAX_GITHUB_URL_LENGTH = 2000;
const MAX_ISSUE_TITLE_LENGTH = 200;
// Safety margin to account for URL-encoded ellipsis character (… becomes %E2%80%A6)
const TITLE_ELLIPSIS_MARGIN = 10;

interface PendingErrorsIndicatorProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function buildGithubUrl(error: StoredError): string {
  const rawTitle = `Bug Report: ${error.sanitizedError.name}`;
  const issueTitle =
    rawTitle.length > MAX_ISSUE_TITLE_LENGTH
      ? `${rawTitle.slice(0, MAX_ISSUE_TITLE_LENGTH - TITLE_ELLIPSIS_MARGIN)}…`
      : rawTitle;

  const baseUrl = 'https://github.com/kocheck/Graphium/issues/new';
  const baseWithTitle = `${baseUrl}?title=${encodeURIComponent(issueTitle)}`;
  const bodyPrefix = '&body=';
  const encodedBody = encodeURIComponent(error.reportBody);

  const fullUrl = `${baseWithTitle}${bodyPrefix}${encodedBody}`;
  if (fullUrl.length <= MAX_GITHUB_URL_LENGTH) {
    return fullUrl;
  }

  const allowedBodyLength = MAX_GITHUB_URL_LENGTH - (baseWithTitle.length + bodyPrefix.length);
  if (allowedBodyLength <= 0) {
    return baseWithTitle;
  }

  let currentLength = 0;
  const encodedChunks: string[] = [];
  for (const char of error.reportBody) {
    const encodedChar = encodeURIComponent(char);
    if (currentLength + encodedChar.length > allowedBodyLength) {
      break;
    }
    encodedChunks.push(encodedChar);
    currentLength += encodedChar.length;
  }
  return `${baseWithTitle}${bodyPrefix}${encodedChunks.join('')}`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ErrorListViewProps {
  errors: StoredError[];
  onSelectError: (error: StoredError) => void;
}

function ErrorListView({ errors, onSelectError }: ErrorListViewProps): React.ReactElement {
  return (
    <div className="flex-1 overflow-y-auto">
      {errors.map((error) => (
        <button
          key={error.id}
          onClick={() => onSelectError(error)}
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
                {formatTimestamp(error.lastOccurrence ?? error.timestamp)}
              </p>
            </div>
            <RiArrowRightSLine className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-1" />
          </div>
        </button>
      ))}
    </div>
  );
}

interface ErrorDetailViewProps {
  error: StoredError;
  reportStatus: 'idle' | 'opened' | 'error';
  onBack: () => void;
  onReport: (error: StoredError) => void;
  onSave: (error: StoredError) => void;
}

function ErrorDetailView({
  error,
  reportStatus,
  onBack,
  onReport,
  onSave,
}: ErrorDetailViewProps): React.ReactElement {
  let reportBtnClass = 'bg-blue-600 hover:bg-blue-500';
  if (reportStatus === 'opened') {
    reportBtnClass = 'bg-green-600 hover:bg-green-500';
  } else if (reportStatus === 'error') {
    reportBtnClass = 'bg-red-600 hover:bg-red-500';
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
        >
          <RiArrowLeftSLine className="w-4 h-4" />
          Back to list
        </button>

        <div>
          <h4 className="text-red-400 font-medium">{error.sanitizedError.name}</h4>
          <p className="text-sm text-neutral-300 mt-1">{error.sanitizedError.message}</p>
          <div className="flex gap-3 mt-2 text-xs text-neutral-500">
            <span>Source: {error.source}</span>
            {error.occurrences > 1 && <span>Occurred {error.occurrences} times</span>}
          </div>
        </div>

        <div className="bg-neutral-900 rounded border border-neutral-700 overflow-hidden">
          <div className="px-3 py-2 bg-neutral-800 border-b border-neutral-700 text-xs text-neutral-400">
            Stack Trace (Sanitized)
          </div>
          <pre className="p-2 text-xs text-neutral-300 overflow-x-auto max-h-32 whitespace-pre-wrap break-words font-mono">
            {error.sanitizedError.stack}
          </pre>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onReport(error)}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${reportBtnClass}`}
          >
            {reportStatus === 'opened' ? (
              <>
                <RiCheckLine className="w-4 h-4" />
                Opened!
              </>
            ) : (
              <>
                <RiGithubFill className="w-4 h-4" />
                Report on GitHub
              </>
            )}
          </button>
          <button
            onClick={() => onSave(error)}
            className="flex-1 px-3 py-2 rounded text-sm font-medium bg-neutral-600 hover:bg-neutral-500 flex items-center justify-center gap-2"
          >
            <RiSaveLine className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating indicator that shows when there are pending unreported errors.
 * Allows users to review, report, or dismiss stored errors.
 */

function PendingErrorsIndicator({
  position = 'bottom-right',
}: PendingErrorsIndicatorProps): React.ReactElement | null {
  const [unreportedCount, setUnreportedCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errors, setErrors] = useState<StoredError[]>([]);
  const [selectedError, setSelectedError] = useState<StoredError | null>(null);
  const [reportStatus, setReportStatus] = useState<'idle' | 'opened' | 'error'>('idle');

  const refreshErrors = useCallback((): void => {
    setErrors([...getStoredErrors()]);
    setUnreportedCount(getUnreportedErrorCount());
  }, []);

  useEffect(() => {
    refreshErrors();
    const handleNewError = (): void => {
      refreshErrors();
    };
    window.addEventListener('graphium-error', handleNewError);
    return () => {
      window.removeEventListener('graphium-error', handleNewError);
    };
  }, [refreshErrors]);

  const handleReportError = async (error: StoredError): Promise<void> => {
    try {
      const githubUrl = buildGithubUrl(error);
      const errorReporting = window.errorReporting;
      if (errorReporting) {
        await errorReporting.openExternal(githubUrl);
        setReportStatus('opened');
      }
      markErrorReported(error.id);
      refreshErrors();
      setTimeout(() => setReportStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to report error:', err);
      setReportStatus('error');
      setTimeout(() => setReportStatus('idle'), 3000);
    }
  };

  const handleSaveError = async (error: StoredError): Promise<void> => {
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

  const handleDismissReported = (): void => {
    clearReportedErrors();
    refreshErrors();
    setSelectedError(null);
  };

  const positionClasses = {
    'bottom-right': import.meta.env.DEV ? 'bottom-16 right-4' : 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg px-4 py-2 shadow-lg transition-colors"
        >
          <RiErrorWarningLine className="w-5 h-5 text-amber-500" />
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

      {isExpanded && (
        <div className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
            <h3 className="font-medium text-neutral-200">Stored Errors</h3>
            <button
              onClick={() => {
                setIsExpanded(false);
                setSelectedError(null);
              }}
              className="text-neutral-400 hover:text-neutral-200"
              aria-label="Close"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>

          {!selectedError && <ErrorListView errors={errors} onSelectError={setSelectedError} />}

          {selectedError && (
            <ErrorDetailView
              error={selectedError}
              reportStatus={reportStatus}
              onBack={() => setSelectedError(null)}
              onReport={(e) => {
                void handleReportError(e);
              }}
              onSave={(e) => {
                void handleSaveError(e);
              }}
            />
          )}

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
}

export default PendingErrorsIndicator;
