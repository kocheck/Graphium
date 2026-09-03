import { _electron as electron } from '@playwright/test';

interface LaunchElectronOptions {
  env?: NodeJS.ProcessEnv;
}

export const launchElectron = async (options: LaunchElectronOptions = {}) =>
  electron.launch({
    args: [
      './dist-electron/main.js',
      ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] : []),
    ],
    ...(options.env ? { env: options.env } : {}),
  });
