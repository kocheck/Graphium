/**
 * Error Sanitization Utility
 *
 * Provides functions to sanitize error stack traces by removing PII
 * (Personal Identifiable Information) such as usernames, email addresses,
 * IP addresses, API keys, and file paths.
 */

export interface SanitizedError {
  name: string;
  message: string;
  stack: string;
}

/**
 * Patterns for detecting and sanitizing various types of PII
 */
const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // IPv4 addresses
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // IPv6 addresses (simplified pattern)
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:|:(?::[0-9a-fA-F]{1,4}){1,7}\b/g,

  // API keys / tokens (common patterns: long alphanumeric strings)
  apiKey: /\b(?:api[_-]?key|token|secret|password|auth)[=:]\s*['"]?([A-Za-z0-9_-]{20,})['"]?/gi,

  // Bearer tokens
  bearerToken: /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi,

  // Environment variable values that look sensitive
  envVar: /\b(?:DATABASE_URL|API_KEY|SECRET_KEY|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN)[=:]\s*\S+/gi,

  // UUIDs (could be user IDs)
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,

  // Hostname patterns (but preserve localhost)
  hostname: /\b(?!localhost\b)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g,
};

/**
 * Sanitizes a string by removing common PII patterns
 */
function sanitizePII(text: string): string {
  return text
    .replace(PII_PATTERNS.email, '<EMAIL>')
    .replace(PII_PATTERNS.ipv4, '<IP>')
    .replace(PII_PATTERNS.ipv6, '<IP>')
    .replace(PII_PATTERNS.bearerToken, 'Bearer <TOKEN>')
    .replace(PII_PATTERNS.apiKey, '$1=<REDACTED>')
    .replace(PII_PATTERNS.envVar, '<ENV_VAR>')
    .replace(PII_PATTERNS.uuid, '<UUID>');
}

/**
 * Sanitizes an error stack trace by replacing the system username with <USER>
 * and removing other PII patterns.
 * This prevents PII from being exposed in error reports.
 *
 * @param error - The error object to sanitize
 * @param username - The system username to scrub from the stack trace
 * @returns A sanitized error object safe for public viewing
 */
export function sanitizeStack(error: Error, username: string): SanitizedError {
  const errorName = error.name || 'Error';
  let errorMessage = error.message || 'Unknown error';
  let errorStack = error.stack || '';

  // Create regex patterns to match the username in various path formats
  // Handles: /Users/username/, /home/username/, C:\Users\username\, etc.
  if (username && username.length > 0) {
    // Escape special regex characters in the username
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern for Unix-style paths: /Users/username/ or /home/username/
    const unixPathPattern = new RegExp(
      `(/(?:Users|home)/)${escapedUsername}(/|$)`,
      'gi'
    );

    // Pattern for Windows-style paths: C:\Users\username\ or C:/Users/username/
    const windowsPathPattern = new RegExp(
      `([A-Za-z]:[/\\\\](?:Users|Documents and Settings)[/\\\\])${escapedUsername}([/\\\\]|$)`,
      'gi'
    );

    // Generic pattern: catch any remaining instances of the username in paths
    const genericPattern = new RegExp(
      `([\\\\/])${escapedUsername}([\\\\/])`,
      'gi'
    );

    // Apply username sanitization
    errorStack = errorStack
      .replace(unixPathPattern, '$1<USER>$2')
      .replace(windowsPathPattern, '$1<USER>$2')
      .replace(genericPattern, '$1<USER>$2');

    errorMessage = errorMessage
      .replace(unixPathPattern, '$1<USER>$2')
      .replace(windowsPathPattern, '$1<USER>$2')
      .replace(genericPattern, '$1<USER>$2');
  }

  // Apply general PII sanitization
  errorStack = sanitizePII(errorStack);
  errorMessage = sanitizePII(errorMessage);

  return {
    name: errorName,
    message: errorMessage,
    stack: errorStack,
  };
}

/**
 * Generates a formatted error report body with system information.
 *
 * @param sanitizedError - The sanitized error object
 * @returns A formatted string suitable for error reporting
 */
export function generateReportBody(sanitizedError: SanitizedError): string {
  // Get app version from package.json (exposed via Vite's define)
  const appVersion = typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : 'Unknown';

  // Get OS platform from navigator
  const platform = typeof navigator !== 'undefined'
    ? navigator.platform
    : 'Unknown';

  // Get user agent for additional context
  const userAgent = typeof navigator !== 'undefined'
    ? navigator.userAgent
    : 'Unknown';

  const timestamp = new Date().toISOString();

  const report = `
================================================================================
                           HYLE ERROR REPORT
================================================================================

Timestamp: ${timestamp}
App Version: ${appVersion}
Platform: ${platform}
User Agent: ${userAgent}

--------------------------------------------------------------------------------
                              ERROR DETAILS
--------------------------------------------------------------------------------

Error Type: ${sanitizedError.name}
Message: ${sanitizedError.message}

--------------------------------------------------------------------------------
                              STACK TRACE
--------------------------------------------------------------------------------

${sanitizedError.stack}

================================================================================
                            END OF REPORT
================================================================================
`.trim();

  return report;
}

// Declare the global __APP_VERSION__ variable for TypeScript
declare const __APP_VERSION__: string;
