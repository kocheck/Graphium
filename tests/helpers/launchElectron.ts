import { _electron as electron } from '@playwright/test';

import { getElectronLaunchArgs } from './electronLaunchArgs';

interface LaunchElectronOptions {
  env?: NodeJS.ProcessEnv;
}

export const launchElectron = async (options: LaunchElectronOptions = {}) =>
  electron.launch({
    args: getElectronLaunchArgs(),
    ...(options.env ? { env: options.env } : {}),
  });
