/**
 * Global Error Handler for Graphium
 *
 * Catches errors outside React's lifecycle and persists them for later reporting.
 * Part of the 3-layer error handling architecture:
 *
 * **Layer 1: React Error Boundaries** (PrivacyErrorBoundary, TokenErrorBoundary)
 * - Catches errors in React component tree
 * - Provides fallback UI
 *
 * **Layer 2: Global Error Handlers** (this file)
 * - Catches window.onerror (global JS errors)
 * - Catches unhandledrejection (promise rejections)
 * - Receives main process errors via IPC
 *
 * **Layer 3: Main Process Handlers** (electron/main.ts)
 * - Catches uncaughtException
 * - Catches unhandledRejection
 * - Sanitizes and sends to renderer
 *
 * **Error persistence flow:**
 * 1. Error occurs (global, promise, or main process)
 * 2. Handler catches and sanitizes error
 * 3. Generate unique ID and report body
 * 4. Store in localStorage with deduplication
 * 5. Dispatch custom event for UI updates
 * 6. User can review/report via PendingErrorsIndicator
 *
 * **Deduplication:**
 * Same error occurring multiple times increments occurrence count
 * instead of creating duplicate entries. Identified by hash of:
 * error name + message + first stack line
 *
 * **Privacy guarantee:**
 * All errors sanitized before storage (PII removed).
 * Stored in localStorage (`graphium_pending_errors`).
 * User must explicitly consent to send reports.
 *
 * See docs/ERROR_BOUNDARIES.md for complete architecture.
 *
 * @example
 * // Initialize in main.tsx
 * import { initGlobalErrorHandlers } from './utils/globalErrorHandler';
 * const cleanup = initGlobalErrorHandlers();
 * // Cleanup on unmount if needed
 *
 * @example
 * // Manually capture error
 * import { captureError } from './utils/globalErrorHandler';
 * try {
 *   riskyOperation();
 * } catch (error) {
 *   await captureError(error, 'global');
 *   // Error stored, user can report later
 * }
 *
 * @example
 * // Listen for new errors in UI
 * useEffect(() => {
 *   const handleError = (e: CustomEvent) => {
 *     setErrorCount(prev => prev + 1);
 *   };
 *   window.addEventListener('graphium-error', handleError);
 *   return () => window.removeEventListener('graphium-error', handleError);
 * }, []);
 */

import { sanitizeStack, generateReportBody, SanitizedError } from './errorSanitizer';

/** localStorage key for persisting errors */
const ERROR_STORAGE_KEY = 'graphium_pending_errors';

/** Maximum errors to keep in localStorage (FIFO when exceeded) */
const MAX_STORED_ERRORS = 10;

/**
 * Stored error with metadata for tracking and reporting
 *
 * @property id - Unique identifier for this error instance
 * @property timestamp - ISO timestamp of first occurrence
 * @property sanitizedError - PII-free error object
 * @property reportBody - Formatted report ready for email/file export
 * @property source - Where error originated ('react', 'global', 'promise', 'main')
 * @property reported - Whether user has sent this error report
 * @property occurrences - How many times this error occurred (deduplication)
 * @property lastOccurrence - ISO timestamp of most recent occurrence
 */
export interface StoredError {
  id: string;
  timestamp: string;
  sanitizedError: SanitizedError;
  reportBody: string;
  source: 'react' | 'global' | 'promise' | 'main';
  reported: boolean;
  occurrences: number;
  lastOccurrence: string;
}

/**
 * Generates a unique ID for error tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generates a hash for error deduplication
 * Uses error name, message, and first line of stack
 */
function generateErrorHash(sanitizedError: SanitizedError): string {
  const stackFirstLine = sanitizedError.stack.split('\n')[0] || '';
  const hashInput = `${sanitizedError.name}:${sanitizedError.message}:${stackFirstLine}`;

  // Simple hash function (for deduplication, not cryptographic)
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
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
 * Handles deduplication by incrementing occurrence count for duplicate errors
 */
export function storeError(error: StoredError): void {
  try {
    const errors = getStoredErrors();
    const errorHash = generateErrorHash(error.sanitizedError);

    // Check if this error already exists
    const existingIndex = errors.findIndex(
      (e) => generateErrorHash(e.sanitizedError) === errorHash
    );

    if (existingIndex !== -1) {
      // Error already exists - increment occurrence count
      const existing = errors[existingIndex];
      existing.occurrences += 1;
      existing.lastOccurrence = error.timestamp;

      // Move to front of list
      errors.splice(existingIndex, 1);
      errors.unshift(existing);
    } else {
      // New error - add at the beginning
      errors.unshift(error);
    }

    // Keep only the most recent errors
    const trimmedErrors = errors.slice(0, MAX_STORED_ERRORS);

    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(trimmedErrors));

    // Dispatch event to notify listeners
    window.dispatchEvent(new CustomEvent('graphium-error', { detail: error }));
  } catch (err) {
    console.warn('Failed to store error:', err);
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
    // Get username for sanitization (fallback if errorReporting not available)
    const username = window.errorReporting
      ? await window.errorReporting.getUsername()
      : 'unknown';

    // Sanitize the error
    const sanitizedError = sanitizeStack(error, username);

    // Generate report body
    const reportBody = generateReportBody(sanitizedError);

    // Create stored error object
    const timestamp = new Date().toISOString();
    const storedError: StoredError = {
      id: generateErrorId(),
      timestamp,
      sanitizedError,
      reportBody,
      source,
      reported: false,
      occurrences: 1,
      lastOccurrence: timestamp,
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
    occurrences: 1,
    lastOccurrence: errorData.timestamp,
  };

  storeError(storedError);

  // Notify any listeners about the new error
  window.dispatchEvent(
    new CustomEvent('graphium-error', { detail: storedError })
  );
}

/**
 * Initializes global error handlers
 * Call this once when the app starts
 */
export function initGlobalErrorHandlers(): () => void {
  window.addEventListener('error', onGlobalError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  // Listen for main process errors via IPC (Electron only)
  if (window.ipcRenderer) {
    window.ipcRenderer.on('main-process-error', onMainProcessError);
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('error', onGlobalError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    if (window.ipcRenderer) {
      window.ipcRenderer.off('main-process-error', onMainProcessError);
    }
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
