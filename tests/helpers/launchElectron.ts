import { _electron as electron } from '@playwright/test';

import { getElectronLaunchArgs } from './electronLaunchArgs';

interface LaunchElectronOptions {
  env?: NodeJS.ProcessEnv;
  /** Extra command-line arguments (e.g. a .graphium path, as the OS passes on file open). */
  extraArgs?: string[];
}

export const launchElectron = async (options: LaunchElectronOptions = {}) =>
  electron.launch({
    args: [...getElectronLaunchArgs(), ...(options.extraArgs ?? [])],
    ...(options.env ? { env: options.env } : {}),
  });
