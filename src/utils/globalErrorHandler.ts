/**
 * Global Error Handler
 *
 * Catches errors outside React's lifecycle:
 * - window.onerror (global JS errors)
 * - unhandledrejection (unhandled promise rejections)
 *
 * Persists errors locally so they can be reported later.
 */

import { sanitizeStack, generateReportBody, SanitizedError } from './errorSanitizer';

const ERROR_STORAGE_KEY = 'hyle_pending_errors';
const MAX_STORED_ERRORS = 10;

export interface StoredError {
  id: string;
  timestamp: string;
  sanitizedError: SanitizedError;
  reportBody: string;
  source: 'react' | 'global' | 'promise' | 'main';
  reported: boolean;
}

/**
 * Generates a unique ID for error tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Retrieves stored errors from localStorage
 */
export function getStoredErrors(): StoredError[] {
  try {
    const stored = localStorage.getItem(ERROR_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // localStorage might be unavailable or corrupted
    console.warn('Failed to retrieve stored errors');
  }
  return [];
}

/**
 * Stores an error in localStorage for later reporting
 */
export function storeError(error: StoredError): void {
  try {
    const errors = getStoredErrors();

    // Add new error at the beginning
    errors.unshift(error);

    // Keep only the most recent errors
    const trimmedErrors = errors.slice(0, MAX_STORED_ERRORS);

    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(trimmedErrors));
  } catch {
    console.warn('Failed to store error');
  }
}

/**
 * Marks an error as reported
 */
export function markErrorReported(errorId: string): void {
  try {
    const errors = getStoredErrors();
    const updated = errors.map((err) =>
      err.id === errorId ? { ...err, reported: true } : err
    );
    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    console.warn('Failed to mark error as reported');
  }
}

/**
 * Clears all stored errors
 */
export function clearStoredErrors(): void {
  try {
    localStorage.removeItem(ERROR_STORAGE_KEY);
  } catch {
    console.warn('Failed to clear stored errors');
  }
}

/**
 * Clears only reported errors
 */
export function clearReportedErrors(): void {
  try {
    const errors = getStoredErrors();
    const unreported = errors.filter((err) => !err.reported);
    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(unreported));
  } catch {
    console.warn('Failed to clear reported errors');
  }
}

/**
 * Gets the count of unreported errors
 */
export function getUnreportedErrorCount(): number {
  const errors = getStoredErrors();
  return errors.filter((err) => !err.reported).length;
}

/**
 * Creates and stores a sanitized error
 */
async function handleGlobalError(
  error: Error,
  source: StoredError['source']
): Promise<StoredError | null> {
  try {
    // Get username for sanitization
    const username = await window.errorReporting.getUsername();

    // Sanitize the error
    const sanitizedError = sanitizeStack(error, username);

    // Generate report body
    const reportBody = generateReportBody(sanitizedError);

    // Create stored error object
    const storedError: StoredError = {
      id: generateErrorId(),
      timestamp: new Date().toISOString(),
      sanitizedError,
      reportBody,
      source,
      reported: false,
    };

    // Persist to localStorage
    storeError(storedError);

    return storedError;
  } catch {
    console.warn('Failed to handle global error');
    return null;
  }
}

/**
 * Global error event handler
 */
function onGlobalError(event: ErrorEvent): void {
  const error = event.error || new Error(event.message);
  handleGlobalError(error, 'global');
}

/**
 * Unhandled promise rejection handler
 */
function onUnhandledRejection(event: PromiseRejectionEvent): void {
  const error =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
  handleGlobalError(error, 'promise');
}

/**
 * Main process error handler (received via IPC)
 */
interface MainProcessError {
  name: string;
  message: string;
  stack: string;
  source: string;
  timestamp: string;
}

function onMainProcessError(_event: unknown, errorData: MainProcessError): void {
  // Main process errors are already sanitized, just store them
  const storedError: StoredError = {
    id: generateErrorId(),
    timestamp: errorData.timestamp,
    sanitizedError: {
      name: errorData.name,
      message: errorData.message,
      stack: `[Main Process - ${errorData.source}]\n${errorData.stack}`,
    },
    reportBody: generateReportBody({
      name: errorData.name,
      message: errorData.message,
      stack: `[Main Process - ${errorData.source}]\n${errorData.stack}`,
    }),
    source: 'main',
    reported: false,
  };

  storeError(storedError);

  // Notify any listeners about the new error
  window.dispatchEvent(
    new CustomEvent('hyle-error', { detail: storedError })
  );
}

/**
 * Initializes global error handlers
 * Call this once when the app starts
 */
export function initGlobalErrorHandlers(): () => void {
  window.addEventListener('error', onGlobalError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  // Listen for main process errors via IPC
  window.ipcRenderer.on('main-process-error', onMainProcessError);

  // Return cleanup function
  return () => {
    window.removeEventListener('error', onGlobalError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    window.ipcRenderer.off('main-process-error', onMainProcessError);
  };
}

/**
 * Manually capture and store an error
 * Useful for try/catch blocks where you want to log but not crash
 */
export async function captureError(
  error: Error,
  source: StoredError['source'] = 'global'
): Promise<StoredError | null> {
  return handleGlobalError(error, source);
}
