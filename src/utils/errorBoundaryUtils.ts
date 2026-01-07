/**
 * Error Boundary Utilities
 *
 * Provides enhanced debugging and testing capabilities for error boundaries.
 * These utilities help developers diagnose issues faster during development
 * and QA teams reproduce bugs more easily.
 *
 * **Features:**
 * - Dev mode debugging with full error context
 * - Component state inspection
 * - Error history tracking
 * - Clipboard export for bug reports
 * - Test mode integration
 * - Performance metrics at error time
 *
 * **Usage:**
 * ```tsx
 * class MyErrorBoundary extends Component {
 *   componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 *     const context = captureErrorContext(error, errorInfo, {
 *       componentName: 'MyComponent',
 *       props: this.props,
 *       state: this.state
 *     });
 *     logErrorWithContext(context);
 *   }
 * }
 * ```
 */

export interface ErrorContext {
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  componentStack?: string | null;
  componentName?: string;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  environment: {
    isDev: boolean;
    isTest: boolean;
    userAgent: string;
    url: string;
  };
  performance?: {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    timing?: {
      loadTime: number;
      domReady: number;
    };
  };
  breadcrumbs?: string[];
}

/**
 * Global error history for debugging (dev/test mode only)
 */
const errorHistory: ErrorContext[] = [];
const MAX_ERROR_HISTORY = 50;

/**
 * Breadcrumb trail for tracking user actions before error
 */
const breadcrumbs: string[] = [];
const MAX_BREADCRUMBS = 20;

/**
 * Add a breadcrumb to track user actions
 */
export function addBreadcrumb(action: string): void {
  const timestamp = new Date().toISOString();
  breadcrumbs.push(`[${timestamp}] ${action}`);
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

/**
 * Capture comprehensive error context for debugging
 */
export function captureErrorContext(
  error: Error,
  errorInfo: React.ErrorInfo,
  options: {
    componentName?: string;
    props?: Record<string, unknown>;
    state?: Record<string, unknown>;
  } = {},
): ErrorContext {
  const isDev = import.meta.env.DEV;
  const isTest = import.meta.env.MODE === 'test';

  // Capture performance metrics if available
  let performanceMetrics: ErrorContext['performance'];
  if (window.performance) {
    performanceMetrics = {};

    // Memory usage (Chrome only)
    interface PerformanceMemoryInfo {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    }

    interface PerformanceWithMemory extends Performance {
      memory?: PerformanceMemoryInfo;
    }

    const performanceWithMemory = performance as unknown as PerformanceWithMemory;

    if (performanceWithMemory.memory) {
      performanceMetrics.memory = {
        usedJSHeapSize: performanceWithMemory.memory.usedJSHeapSize,
        totalJSHeapSize: performanceWithMemory.memory.totalJSHeapSize,
        jsHeapSizeLimit: performanceWithMemory.memory.jsHeapSizeLimit,
      };
    }

    // Page load timing - prefer Navigation Timing Level 2 API, fallback to deprecated API
    const navigationEntries = performance.getEntriesByType?.('navigation') as
      | PerformanceNavigationTiming[]
      | undefined;
    const navigationEntry = navigationEntries?.[0];

    if (navigationEntry) {
      // Modern Navigation Timing Level 2 API
      performanceMetrics.timing = {
        loadTime: navigationEntry.loadEventEnd - navigationEntry.startTime,
        domReady: navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime,
      };
    } else {
      // Legacy fallback for environments without Navigation Timing Level 2
      const legacyPerformance = performance as Performance & { timing?: PerformanceTiming };
      const timing = legacyPerformance.timing;

      // Validate timing object exists, is an object, and has required numeric properties
      // Note: Values can legitimately be 0 if events haven't occurred yet
      if (
        timing != null &&
        typeof timing === 'object' &&
        typeof timing.navigationStart === 'number' &&
        typeof timing.loadEventEnd === 'number' &&
        typeof timing.domContentLoadedEventEnd === 'number'
      ) {
        performanceMetrics.timing = {
          loadTime: timing.loadEventEnd - timing.navigationStart,
          domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
        };
      }
    }
  }

  const context: ErrorContext = {
    timestamp: Date.now(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    componentStack: errorInfo.componentStack,
    componentName: options.componentName,
    props: sanitizeForLogging(options.props),
    state: sanitizeForLogging(options.state),
    environment: {
      isDev,
      isTest,
      userAgent: navigator.userAgent,
      url: window.location.href,
    },
    performance: performanceMetrics,
    breadcrumbs: [...breadcrumbs],
  };

  // Store in history (dev/test only)
  // NOTE: errorHistory is intentionally mutable for debugging utilities.
  // Unlike Zustand state (which requires immutable updates), this is a module-level
  // array used only for dev/test error tracking. Mutable updates are acceptable here
  // because: (1) this is not React state, (2) high-frequency error logging would create
  // performance overhead with immutable array copies, and (3) error history doesn't
  // need time-travel or state comparison features.
  if (isDev || isTest) {
    errorHistory.push(context);
    if (errorHistory.length > MAX_ERROR_HISTORY) {
      errorHistory.shift();
    }
  }

  return context;
}

/**
 * Sanitize data for logging (remove functions, circular refs, large objects)
 *
 * Note: The circular reference detection using WeakSet may produce false positives.
 * An object appearing in multiple branches of the tree (but not in a circular path)
 * will be marked as [Circular] after its first occurrence. This is acceptable for
 * debugging purposes as it prevents infinite recursion and keeps output readable.
 * A path-based approach would be more accurate but significantly more complex.
 */
function sanitizeForLogging(data: unknown): Record<string, unknown> | undefined {
  if (!data) return undefined;
  if (typeof data !== 'object') return undefined;

  try {
    // Use JSON stringify with replacer to handle functions and circular refs
    // Note: WeakSet persists across entire operation, so objects seen in different
    // branches will be marked as circular. This is a known limitation but acceptable
    // for error logging purposes where false positives are better than crashes.
    const seen = new WeakSet();
    const sanitized = JSON.parse(
      JSON.stringify(data, (_key, value) => {
        // Skip functions
        if (typeof value === 'function') {
          return '[Function]';
        }

        // Handle circular references (only for objects, not primitives)
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }

        // Truncate large arrays
        if (Array.isArray(value) && value.length > 100) {
          return `[Array(${value.length}) - truncated]`;
        }

        // Truncate large strings
        if (typeof value === 'string' && value.length > 500) {
          return value.substring(0, 500) + '... [truncated]';
        }

        return value;
      }),
    );

    return sanitized as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Log error with full context (pretty-printed for console)
 */
export function logErrorWithContext(context: ErrorContext): void {
  const timestamp = new Date(context.timestamp).toISOString();

  console.group(`🚨 Error Boundary: ${context.componentName || 'Component'} [${timestamp}]`);

  // Error details
  console.error('Error:', context.error.name, '-', context.error.message);

  // Stack traces
  if (context.error.stack) {
    console.groupCollapsed('JavaScript Stack Trace');
    console.error(context.error.stack);
    console.groupEnd();
  }

  if (context.componentStack) {
    console.groupCollapsed('React Component Stack');
    console.error(context.componentStack);
    console.groupEnd();
  }

  // Component state
  if (context.props || context.state) {
    console.groupCollapsed('Component State & Props');
    if (context.props) {
      console.log('Props:', context.props);
    }
    if (context.state) {
      console.log('State:', context.state);
    }
    console.groupEnd();
  }

  // Breadcrumbs
  if (context.breadcrumbs && context.breadcrumbs.length > 0) {
    console.groupCollapsed('User Actions (Breadcrumbs)');
    context.breadcrumbs.forEach((crumb) => console.log(crumb));
    console.groupEnd();
  }

  // Performance metrics
  if (context.performance) {
    console.groupCollapsed('Performance Metrics');
    if (context.performance.memory) {
      const { usedJSHeapSize, jsHeapSizeLimit } = context.performance.memory;
      console.log('Memory Usage:', {
        used: `${(usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        percentage: `${((usedJSHeapSize / jsHeapSizeLimit) * 100).toFixed(1)}%`,
      });
    }
    if (context.performance.timing) {
      console.log('Page Timing:', {
        loadTime: `${context.performance.timing.loadTime}ms`,
        domReady: `${context.performance.timing.domReady}ms`,
      });
    }
    console.groupEnd();
  }

  // Environment
  console.groupCollapsed('Environment');
  console.log('Mode:', context.environment.isDev ? 'Development' : 'Production');
  console.log('Test Mode:', context.environment.isTest);
  console.log('URL:', context.environment.url);
  console.log('User Agent:', context.environment.userAgent);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Get error history (dev/test mode only)
 */
export function getErrorHistory(): ErrorContext[] {
  return [...errorHistory];
}

/**
 * Clear error history
 * Note: Uses .length = 0 pattern because errorHistory is declared as const.
 * This is safe because getErrorHistory() returns a shallow copy, preventing external references.
 */
export function clearErrorHistory(): void {
  errorHistory.length = 0;
}

/**
 * Export error context to clipboard for bug reports
 */
export async function exportErrorToClipboard(context: ErrorContext): Promise<boolean> {
  try {
    const report = formatErrorReport(context);
    await navigator.clipboard.writeText(report);
    return true;
  } catch (e) {
    console.error('Failed to copy error to clipboard:', e);
    return false;
  }
}

/**
 * Format error context as human-readable report
 */
export function formatErrorReport(context: ErrorContext): string {
  const timestamp = new Date(context.timestamp).toISOString();
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push(`ERROR REPORT: ${context.componentName || 'Component'}`);
  lines.push(`Timestamp: ${timestamp}`);
  lines.push('================================================================================');
  lines.push('');

  // Error details
  lines.push(`Error: ${context.error.name}`);
  lines.push(`Message: ${context.error.message}`);
  lines.push('');

  // Stack traces
  if (context.error.stack) {
    lines.push('JavaScript Stack Trace:');
    lines.push(context.error.stack);
    lines.push('');
  }

  if (context.componentStack) {
    lines.push('React Component Stack:');
    lines.push(context.componentStack);
    lines.push('');
  }

  // Component state
  if (context.props || context.state) {
    lines.push('Component State & Props:');
    if (context.props) {
      lines.push('Props:');
      lines.push(JSON.stringify(context.props, null, 2));
    }
    if (context.state) {
      lines.push('State:');
      lines.push(JSON.stringify(context.state, null, 2));
    }
    lines.push('');
  }

  // Breadcrumbs
  if (context.breadcrumbs && context.breadcrumbs.length > 0) {
    lines.push('User Actions (Breadcrumbs):');
    context.breadcrumbs.forEach((crumb) => lines.push(`  ${crumb}`));
    lines.push('');
  }

  // Performance metrics
  if (context.performance) {
    lines.push('Performance Metrics:');
    if (context.performance.memory) {
      const { usedJSHeapSize, jsHeapSizeLimit } = context.performance.memory;
      lines.push(
        `  Memory: ${(usedJSHeapSize / 1024 / 1024).toFixed(2)} MB / ${(jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
      );
    }
    if (context.performance.timing) {
      lines.push(`  Load Time: ${context.performance.timing.loadTime}ms`);
      lines.push(`  DOM Ready: ${context.performance.timing.domReady}ms`);
    }
    lines.push('');
  }

  // Environment
  lines.push('Environment:');
  lines.push(`  Mode: ${context.environment.isDev ? 'Development' : 'Production'}`);
  lines.push(`  Test: ${context.environment.isTest}`);
  lines.push(`  URL: ${context.environment.url}`);
  lines.push(`  User Agent: ${context.environment.userAgent}`);
  lines.push('');

  lines.push('================================================================================');

  return lines.join('\n');
}

/**
 * Expose error utilities to window for testing and debugging
 */
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
  window.__ERROR_UTILS__ = {
    getErrorHistory,
    clearErrorHistory,
    addBreadcrumb,
    exportErrorToClipboard,
    formatErrorReport,
  };
}

/**
 * React.ErrorInfo type re-export for convenience
 */
export type { ErrorInfo } from 'react';
