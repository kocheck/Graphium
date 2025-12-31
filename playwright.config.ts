import { defineConfig, devices } from '@playwright/test'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

/**
 * Playwright Configuration for Hyle E2E Tests
 *
 * Dual-target testing strategy:
 * - Web-Chromium: Functional tests for browser-based app
 * - Electron-App: Integration tests for desktop app
 *
 * See TESTING_STRATEGY.md for full documentation
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // Prevent .only() in CI
  retries: process.env.CI ? 2 : 0, // Retry flaky tests in CI
  workers: process.env.CI ? 1 : undefined, // Controlled parallelism in CI

  // Global timeout settings
  timeout: 45000, // 45s per test (accounts for auto-save tests that wait ~31s)
  expect: {
    timeout: 10000, // 10s for assertions
  },

  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }], // HTML report (always generated)
    ['list'], // Console output during test run
    ['json', { outputFile: 'test-results/results.json' }], // Machine-readable results
  ],

  use: {
    // Tracing configuration - only capture on failure/retry
    trace: 'on-first-retry', // Saves video/DOM/network on retry
    screenshot: 'only-on-failure', // Screenshots on assertion failures

    // Base URL for web tests
    baseURL: process.env.CI
      ? 'http://localhost:4173' // Vite preview (production build)
      : 'http://localhost:5173', // Vite dev server

    // Viewport settings
    viewport: { width: 1280, height: 720 },

    // Video recording (only on retry to save disk space)
    video: 'retain-on-failure',
  },

  projects: [
    // ===== PROJECT 1: Web-Chromium (Functional Tests) =====
    {
      name: 'Web-Chromium',
      use: {
        ...devices['Desktop Chrome'],
      },

      // Run all web functional tests (excludes Electron-specific)
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.electron\.spec\.ts/,
    },

    // ===== PROJECT 2: Electron-App (Integration Testing) =====
    {
      name: 'Electron-App',
      use: {
        // Launch actual Electron executable
        // Note: Requires Electron build to exist (npm run build)
        // @ts-expect-error - _electron is a valid Playwright context
        _electron: {
          executablePath: require('electron'),
          args: [
            './dist-electron/main.js', // Entry point after build
            // Disable sandbox in CI to avoid SUID sandbox errors
            // SECURITY NOTE: Only disabled in CI environment, not in local development
            ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
          ],
        },

        // Disable web-specific features
        baseURL: undefined,
      },

      // Only run Electron-specific tests
      testMatch: /.*\.electron\.spec\.ts/,

      // Electron tests require build, skip if not available
      grep: process.env.SKIP_ELECTRON ? /never-match/ : /.*/,
    },
  ],

  // Web server for Web-Chromium tests
  webServer: process.env.CI
    ? {
        command: 'npm run preview:web', // Production preview
        port: 4173,
        reuseExistingServer: false, // Always fresh server in CI
        timeout: 120000, // 2 minutes startup timeout
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : {
        command: 'npm run dev:web', // Dev server locally
        port: 5173,
        reuseExistingServer: true, // Reuse if already running
        timeout: 120000,
      },
})
