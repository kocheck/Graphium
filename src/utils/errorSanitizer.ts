/**
 * Error Sanitization Utility for Privacy-First Error Reporting
 *
 * Provides functions to sanitize error stack traces by removing PII
 * (Personal Identifiable Information) before displaying errors to users
 * or sending error reports.
 *
 * **Why sanitization is critical:**
 * - Error stack traces contain file paths with usernames: `/Users/johnsmith/...`
 * - Error messages may include emails, API keys, or sensitive data
 * - Electron apps expose local filesystem structure in errors
 *
 * **What gets sanitized:**
 * - Usernames in file paths → `<USER>`
 * - Email addresses → `<EMAIL>`
 * - IPv4/IPv6 addresses → `<IP>`
 * - UUIDs (potential user IDs) → `<UUID>`
 * - Bearer tokens → `Bearer <TOKEN>`
 * - API keys/secrets → `<REDACTED>`
 * - Environment variables → `<ENV_VAR>`
 *
 * **Usage flow:**
 * 1. Catch error in boundary or handler
 * 2. Get system username (via IPC from main process)
 * 3. Call `sanitizeStack(error, username)`
 * 4. Store/display sanitized error
 * 5. Optionally generate report with `generateReportBody()`
 *
 * See docs/ERROR_BOUNDARIES.md for complete architecture.
 *
 * @example
 * // Basic sanitization
 * const username = await window.ipcRenderer.invoke('get-username');
 * const sanitized = sanitizeStack(error, username);
 * console.error(sanitized.message); // Safe to display
 *
 * @example
 * // Generate email report
 * const sanitized = sanitizeStack(error, username);
 * const reportBody = generateReportBody(sanitized);
 * // User can review and send via email
 */

/**
 * Sanitized error object safe for public viewing/reporting
 *
 * All PII has been removed from name, message, and stack trace.
 *
 * @property name - Error type (e.g., 'TypeError', 'ReferenceError')
 * @property message - Error message with PII removed
 * @property stack - Stack trace with PII removed
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
  apiKey: /\b(?:api[_-]?key|token|secret|password|auth)[=:]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,

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
 *
 * Applies regex replacements for email, IP addresses, API keys, tokens,
 * environment variables, and UUIDs. Order matters - more specific patterns
 * (like bearerToken) should be replaced before generic ones.
 *
 * **Patterns matched:**
 * - Emails: `user@example.com` → `<EMAIL>`
 * - IPv4: `192.168.1.1` → `<IP>`
 * - IPv6: `2001:0db8::1` → `<IP>`
 * - Bearer tokens: `Bearer abc.def.ghi` → `Bearer <TOKEN>`
 * - API keys: `api_key=sk-1234...` → `<REDACTED>`
 * - Env vars: `DATABASE_URL=postgres://...` → `<ENV_VAR>`
 * - UUIDs: `550e8400-e29b-41d4-a716-446655440000` → `<UUID>`
 *
 * @param text - String to sanitize (error message or stack trace)
 * @returns Sanitized string with PII replaced
 *
 * @example
 * const msg = "Error connecting to user@example.com at 192.168.1.1";
 * const sanitized = sanitizePII(msg);
 * // Returns: "Error connecting to <EMAIL> at <IP>"
 */
function sanitizePII(text: string): string {
  return text
    .replace(PII_PATTERNS.email, '<EMAIL>')
    .replace(PII_PATTERNS.ipv4, '<IP>')
    .replace(PII_PATTERNS.ipv6, '<IP>')
    .replace(PII_PATTERNS.bearerToken, 'Bearer <TOKEN>')
    .replace(PII_PATTERNS.apiKey, '<REDACTED>')
    .replace(PII_PATTERNS.envVar, '<ENV_VAR>')
    .replace(PII_PATTERNS.uuid, '<UUID>');
}

/**
 * Sanitizes an error stack trace by removing usernames and PII
 *
 * This is the main entry point for error sanitization. Removes the system
 * username from file paths and applies all PII pattern replacements to both
 * the error message and stack trace.
 *
 * **Username sanitization:**
 * Handles multiple path formats:
 * - Unix: `/Users/johnsmith/project/` → `/Users/<USER>/project/`
 * - macOS: `/home/johnsmith/project/` → `/home/<USER>/project/`
 * - Windows: `C:\Users\johnsmith\project\` → `C:\Users\<USER>\project\`
 *
 * **Why this matters:**
 * - File paths in stack traces expose system username
 * - Error messages may contain local file paths
 * - Electron apps show full filesystem paths in errors
 * - Sanitized errors are safe to display in UI or send via email
 *
 * **Algorithm:**
 * 1. Extract error name, message, and stack
 * 2. Escape special regex characters in username
 * 3. Create patterns for Unix/Windows/generic paths
 * 4. Replace username in paths with `<USER>`
 * 5. Apply PII sanitization (emails, IPs, tokens, etc.)
 * 6. Return sanitized error object
 *
 * @param error - The error object to sanitize (from try/catch or error boundary)
 * @param username - The system username to remove (get via IPC: 'get-username')
 * @returns Sanitized error object safe for display/storage/reporting
 *
 * @example
 * // In error boundary component
 * const username = await window.ipcRenderer.invoke('get-username');
 * const sanitized = sanitizeStack(error, username);
 * setErrorState(sanitized);  // Safe to display
 *
 * @example
 * // Before sanitization
 * const error = new Error('File not found');
 * error.stack = `at /Users/johnsmith/graphium/src/App.tsx:42
 *   at user@example.com (192.168.1.1)`;
 *
 * const sanitized = sanitizeStack(error, 'johnsmith');
 * // After sanitization:
 * // stack: "at /Users/<USER>/graphium/src/App.tsx:42\n  at <EMAIL> (<IP>)"
 *
 * @example
 * // With no username (privacy fallback)
 * const sanitized = sanitizeStack(error, '');
 * // Still sanitizes emails, IPs, tokens, etc.
 */
export function sanitizeStack(error: Error, username: string): SanitizedError {
  const errorName = error.name || 'Error';
  let errorMessage = error.message || '';
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
 * Generates a formatted error report body for GitHub issues
 *
 * Creates a markdown-formatted error report suitable for GitHub issue body.
 * Includes sanitized error details plus non-sensitive system context (app version,
 * platform, user agent) to help with debugging.
 *
 * **Report sections:**
 * 1. **User Description**: Prompt for user to explain what they were doing
 * 2. **Technical Details**: Error type, message, stack trace, and system info
 *
 * **Privacy guarantee:**
 * Only accepts pre-sanitized errors. No PII is added to the report.
 * System info (platform, user agent) contains no username or identifying data.
 *
 * **Usage flow:**
 * 1. User encounters error
 * 2. Error caught and sanitized
 * 3. User clicks "Report Error" button
 * 4. Generate report body
 * 5. Opens GitHub issues with pre-filled body
 * 6. User can add context and submit
 *
 * @param sanitizedError - Pre-sanitized error from sanitizeStack()
 * @returns Formatted markdown report ready for GitHub issue body
 *
 * @example
 * // Generate report for GitHub issue
 * const sanitized = sanitizeStack(error, username);
 * const reportBody = generateReportBody(sanitized);
 * const githubUrl = `https://github.com/kocheck/Graphium/issues/new?body=${encodeURIComponent(reportBody)}`;
 * window.open(githubUrl);
 *
 * @example
 * // Example report output (markdown format):
 * // ## Description
 * // *Please describe what you were doing when the error occurred...*
 * //
 * // ## Error Details
 * //
 * // **Error Type:** TypeError
 * // **Message:** Cannot read property 'x' of undefined
 * //
 * // ### System Information
 * // - **App Version:** 1.0.0
 * // - **Platform:** MacIntel
 * // - **Timestamp:** 2025-01-15T10:30:45.123Z
 * //
 * // ### Stack Trace
 * // ```
 * // at /Users/<USER>/graphium/src/components/Canvas/CanvasManager.tsx:142
 * // at handleDrop ...
 * // ```
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

  // Escape backslashes first, then backticks to avoid breaking markdown code blocks
  const escapedName = sanitizedError.name.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const escapedMessage = sanitizedError.message.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const escapedStack = sanitizedError.stack.replace(/\\/g, '\\\\').replace(/`/g, '\\`');

  const report = `## Description

*Review and, if helpful, expand on the pre-filled context below about what you were doing when the error occurred.*

{{USER_CONTEXT}}

## Error Details

**Error Type:** ${escapedName}
**Message:** ${escapedMessage}

### System Information

- **App Version:** ${appVersion}
- **Platform:** ${platform}
- **Timestamp:** ${timestamp}
- **User Agent:** ${userAgent}

### Stack Trace

\`\`\`
${escapedStack}
\`\`\`
`.trim();

  return report;
}

// Declare the global __APP_VERSION__ variable for TypeScript
declare const __APP_VERSION__: string;
