/**
 * usePlatformDetection — Hook for detecting the current platform/OS
 *
 * Checks navigator.userAgent and the storage service to determine:
 * - Whether we're running in Electron or the browser
 * - Which OS the user is on (for download banners, platform-specific UI)
 *
 * All navigator checks are centralized here so HomeScreen and other
 * components don't need direct navigator access.
 */

import { useState, useEffect } from 'react';

import { getStorage } from '../services/storage';

interface PlatformInfo {
  /** Running inside Electron (desktop app) */
  isElectron: boolean;
  /** macOS detected */
  isMac: boolean;
  /** Windows detected */
  isWindows: boolean;
  /** Linux detected */
  isLinux: boolean;
}

export function usePlatformDetection(): PlatformInfo {
  const [platform, setPlatform] = useState<PlatformInfo>({
    isElectron: false,
    isMac: false,
    isWindows: false,
    isLinux: false,
  });

  useEffect(() => {
    const storage = getStorage();
    const isElectron = storage.getPlatform() === 'electron';

    let isMac = false;
    let isWindows = false;
    let isLinux = false;

    if (typeof navigator !== 'undefined') {
      const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData;
      const platformHint = uaData?.platform ?? '';
      const userAgent = navigator.userAgent ?? '';

      isMac = platformHint.toLowerCase().includes('mac') || /mac/i.test(userAgent);
      isWindows = platformHint.toLowerCase().includes('win') || /win/i.test(userAgent);
      isLinux = platformHint.toLowerCase().includes('linux') || /linux/i.test(userAgent);
    }

    setPlatform({ isElectron, isMac, isWindows, isLinux });
  }, []);

  return platform;
}
