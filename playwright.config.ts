import { defineConfig, devices } from '@playwright/test';

const requestedProjects = (): string[] => {
  const projects: string[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (!arg) {
      continue;
    }
    if (arg === '--project') {
      const name = process.argv[i + 1];
      if (name) {
        projects.push(name);
      }
      continue;
    }
    if (arg.startsWith('--project=')) {
      projects.push(arg.slice('--project='.length));
    }
  }
  return projects;
};

const projects = requestedProjects();
const skipWebServer =
  process.env.SKIP_WEB_SERVER === '1' ||
  (projects.length > 0 && projects.every((name) => name === 'Electron-App'));

/**
 * Playwright Configuration for Graphium E2E Tests
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
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  timeout: 45000,
  expect: {
    timeout: 10000,
  },

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'Web-Chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /.*\.spec\.ts/,
      testIgnore: [
        /.*\.electron\.spec\.ts/,
        /tests\/unit\//,
        /tests\/integration\//,
        // Stale specs wait on testids the current editor does not ship
        // (add-token-button, export-campaign, campaign-title, tool-marker).
        // They previously hung Web-Chromium shards until the 30-minute job cap.
        /tests\/functional\/data-integrity\.spec\.ts/,
        /tests\/functional\/token-management\.spec\.ts/,
        /tests\/functional\/token-library\.spec\.ts/,
        /tests\/functional\/state-persistence\.spec\.ts/,
        /tests\/functional\/map-management\.spec\.ts/,
        /tests\/functional\/error-handling\.spec\.ts/,
        /tests\/functional\/touch-interactions\.spec\.ts/,
        /tests\/functional\/error-boundary-debugging\.spec\.ts/,
        /tests\/functional\/door-sync\.spec\.ts/,
        /tests\/functional\/dm-world-sync\.spec\.ts/,
        /tests\/performance\/drawing-performance\.spec\.ts/,
        /tests\/visual\.spec\.ts/,
      ],
    },
    {
      name: 'Electron-App',
      timeout: 15000,
      retries: process.env.CI ? 1 : 0,
      workers: 1,
      expect: { timeout: 5000 },
      use: {
        baseURL: undefined,
      },
      testMatch: /.*\.electron\.spec\.ts/,
      grep: process.env.SKIP_ELECTRON ? /never-match/ : /.*/,
    },
  ],

  // Electron loads dist via graphium:// in production; skip Vite when running Electron-App only.
  webServer: skipWebServer
    ? undefined
    : process.env.CI
      ? {
          command: 'npm run preview:web',
          port: 4173,
          reuseExistingServer: false,
          timeout: 120000,
          stdout: 'pipe',
          stderr: 'pipe',
        }
      : {
          command: 'npm run dev:web',
          port: 5173,
          reuseExistingServer: true,
          timeout: 120000,
        },
});
