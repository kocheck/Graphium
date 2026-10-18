/**
 * Update Manager Component
 *
 * Handles application auto-update workflow using electron-updater.
 * Displays update status, download progress, and provides user controls
 * for checking, downloading, and installing updates from GitHub Releases.
 *
 * **Features:**
 * - Check for updates manually via "Check for Updates" button
 * - Display current version and available version
 * - Show download progress with percentage and speed
 * - Install and restart button when update is ready
 * - Error handling with user-friendly messages
 * - Randomized message variations for delightful UX
 * - Disabled in development mode
 *
 * **Update Workflow:**
 * 1. User clicks "Check for Updates"
 * 2. If update available → Shows version and "Download" button
 * 3. User clicks "Download" → Shows progress bar
 * 4. When complete → Shows "Restart & Install" button
 * 5. User clicks "Restart & Install" → App restarts with new version
 *
 * @component
 * @returns {JSX.Element | null} Update dialog or null if not active
 */

import type React from 'react';
import { useEffect, useState, useRef } from 'react';

import { RiSearchLine, RiDownloadLine, RiRefreshLine } from '@remixicon/react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import { throttle } from '../utils/throttle';

// ============================================================================
// MESSAGE VARIATIONS - Randomized for delightful UX
// ============================================================================

const updateMessages = {
  nonElectron: {
    title: [
      '🌐 The Auto-Forge only functions within the Desktop Sanctum.',
      '⚠️ Update magic requires the Desktop Realm.',
      '🔮 Alas! Auto-updates are bound to the Desktop Application.',
    ],
    subtitle: [
      'Web browsers cannot channel these arcane energies.',
      'The web plane lacks the necessary conduits.',
      'Browsers cannot invoke this ritual.',
    ],
  },
  idle: [
    '📜 Consult the Chronicle of Releases to see if new powers await.',
    '🔮 Seek wisdom from the Archive of Versions. New enchantments may have been forged.',
    '⚔️ Check if the smiths have completed any new artifacts.',
    '📖 The cosmic ledger may contain news of enhanced powers.',
  ],
  checking: [
    '🔮 Divining the cosmic archives...',
    '📜 Consulting the Chronicle of Releases...',
    '⚡ Communing with the GitHub Oracles...',
    '🎲 Rolling for version discovery...',
    '✨ Peering into the repository of legends...',
  ],
  noUpdate: {
    title: [
      '⚔️ Your forge burns with the latest flame!',
      '✨ You wield the cutting edge of power!',
      '🎲 Natural 20 on your version check!',
      '🛡️ Your arsenal is complete and current!',
      '📖 The latest chapter already graces your tome!',
    ],
    subtitle: [
      'Graphium is inscribed with the most recent enchantments.',
      'No new artifacts await. Your tool is supreme.',
      'The smiths have nothing newer to offer you.',
      'You possess the apex of available power.',
      'The cosmic forge has no further upgrades at this time.',
    ],
  },
  updateAvailable: {
    title: [
      '✨ New Power Forged: v{version}',
      '⚡ The Smiths Present: v{version}',
      '🎲 Artifact Discovery: v{version}',
      '🔮 Enhanced Edition Available: v{version}',
      '⚔️ Superior Armament Detected: v{version}',
    ],
    subtitle: [
      'The smiths have completed a new artifact. Ready to be summoned.',
      'A more potent version awaits your command.',
      'New enchantments have been forged in the cosmic anvil.',
      'The Guild of Developers offers enhanced power.',
      'An upgraded relic calls from the digital plane.',
    ],
  },
  downloading: [
    '⚡ Channeling the update through the aether...',
    '🔮 Summoning the artifact from the GitHub Vault...',
    '📜 Inscribing new powers into the fabric of reality...',
    '✨ Drawing the upgrade from the cosmic repository...',
    '⚔️ Forging the new version in real-time...',
  ],
  downloaded: {
    title: [
      '🎲 Natural 20! Artifact secured.',
      '✨ Summoning complete! Power obtained.',
      '⚔️ The forge has delivered your upgrade!',
      '🏆 Victory! Update successfully channeled.',
      '🔮 Divination successful! Artifact in hand.',
    ],
    subtitle: [
      'Version {version} awaits installation.',
      'The new edition stands ready to empower you.',
      'Version {version} is prepared for binding.',
      'Your enhanced arsenal is ready to deploy.',
    ],
    instruction: [
      'The ritual requires a restart to bind the new powers.',
      'Reforge your application to activate these enchantments.',
      'A restart will complete the transformation.',
      'Close and reopen to awaken the new magic.',
    ],
  },
  error: [
    '💀 Critical Failure - The update ritual was interrupted by mysterious forces. The cosmic archives may be unreachable.',
    '⚠️ Arcane Interference Detected - Communication with the GitHub Oracles has faltered. Try again?',
    '🎲 Rolled a 1 on Update Check - The ritual fizzled. Network spirits may be restless.',
    '❌ Divination Failed - Cannot reach the repository of versions. Cosmic alignment off.',
    '🔥 The summoning backfired! Connection to the Archive of Releases was severed.',
  ],
};

/**
 * Randomly selects a message from an array
 */
const rollForMessage = (messages: string[]): string => {
  return messages[Math.floor(Math.random() * messages.length)] ?? '';
};

/**
 * Replaces {version} placeholders in message
 */
const formatMessage = (message: string, version?: string): string => {
  return version ? message.replace(/{version}/g, version) : message;
};

interface UpdateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'no-update'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

// ============================================================================
// UTILITY FUNCTIONS (outside component to reduce complexity)
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

// ============================================================================
// STATUS CONTENT SUB-COMPONENT
// ============================================================================

interface StatusContentProps {
  isElectron: boolean;
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  errorMessage: string;
  messages: {
    nonElectronTitle: string;
    nonElectronSubtitle: string;
    idle: string;
    checking: string;
    noUpdateTitle: string;
    noUpdateSubtitle: string;
    updateAvailableTitle: string;
    updateAvailableSubtitle: string;
    downloading: string;
    downloadedTitle: string;
    downloadedSubtitle: string;
    downloadedInstruction: string;
    error: string;
  };
}

function StatusContent({
  isElectron,
  status,
  updateInfo,
  downloadProgress,
  errorMessage,
  messages,
}: StatusContentProps): React.ReactElement | null {
  return (
    <>
      {!isElectron && (
        <div className="text-center py-4">
          <p className="mb-2 text-[var(--app-text)]">{messages.nonElectronTitle}</p>
          <p className="text-sm text-[var(--app-text-muted)]">{messages.nonElectronSubtitle}</p>
        </div>
      )}
      {isElectron && status === 'idle' && (
        <div className="text-center py-4">
          <p className="mb-4 text-[var(--app-text-muted)]">{messages.idle}</p>
        </div>
      )}
      {status === 'checking' && (
        <div className="text-center py-4">
          <div className="animate-pulse mb-2 text-[var(--app-text)]">{messages.checking}</div>
        </div>
      )}
      {status === 'no-update' && (
        <div className="text-center py-4">
          <p className="mb-2 text-[var(--app-text)]">{messages.noUpdateTitle}</p>
          <p className="text-sm text-[var(--app-text-muted)]">{messages.noUpdateSubtitle}</p>
        </div>
      )}
      {status === 'update-available' && updateInfo && (
        <div className="p-4 bg-[var(--app-bg-subtle)] rounded-sm">
          <p className="mb-2 font-medium text-[var(--app-text)]">
            {formatMessage(messages.updateAvailableTitle, updateInfo.version)}
          </p>
          <p className="text-sm mb-4 text-[var(--app-text-muted)]">
            {messages.updateAvailableSubtitle}
          </p>
        </div>
      )}
      {status === 'downloading' && downloadProgress && (
        <div className="p-4 bg-[var(--app-bg-subtle)] rounded-sm">
          <p className="mb-3 font-medium text-[var(--app-text)]">{messages.downloading}</p>
          <div className="mb-2 bg-[var(--app-bg-surface)] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-[var(--app-accent-solid)] transition-all duration-base"
              ref={(el) => {
                if (el) {
                  el.style.width = `${downloadProgress.percent}%`;
                }
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-[var(--app-text-muted)]">
            <span>{downloadProgress.percent.toFixed(1)}%</span>
            <span>
              {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
            </span>
          </div>
          <div className="text-sm text-center mt-2 text-[var(--app-text-muted)]">
            {formatSpeed(downloadProgress.bytesPerSecond)}
          </div>
        </div>
      )}
      {status === 'downloaded' && updateInfo && (
        <div className="p-4 bg-[var(--app-bg-subtle)] rounded-sm">
          <p className="mb-2 font-medium text-[var(--app-text)]">{messages.downloadedTitle}</p>
          <p className="text-sm mb-2 text-[var(--app-text-muted)]">
            {formatMessage(messages.downloadedSubtitle, updateInfo.version)}
          </p>
          <p className="text-sm text-[var(--app-text-muted)]">{messages.downloadedInstruction}</p>
        </div>
      )}
      {status === 'error' && (
        <div className="p-4 bg-[var(--app-error-bg)] border border-[var(--app-error-border)] rounded-sm">
          <p className="text-sm text-[var(--app-text-muted)]">{errorMessage || messages.error}</p>
        </div>
      )}
    </>
  );
}

interface AutoUpdaterState {
  status: UpdateStatus;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  errorMessage: string;
  isElectron: boolean;
  handleCheckForUpdates: () => Promise<void>;
  handleDownload: () => Promise<void>;
  handleInstall: () => Promise<void>;
}

function useAutoUpdater(): AutoUpdaterState {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isElectron, setIsElectron] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsElectron(!!window.autoUpdater);
    if (window.autoUpdater) {
      const autoUpdater = window.autoUpdater;
      void (async (): Promise<void> => {
        try {
          const version = await autoUpdater.getCurrentVersion();
          if (isMounted) {
            setCurrentVersion(version);
          }
        } catch (error) {
          console.error('Failed to get current app version', error);
          if (isMounted) {
            setErrorMessage('Failed to get current app version');
          }
        }
      })();
    }
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!window.autoUpdater) {
      return;
    }
    const applyDownloadProgress = (progress: DownloadProgress): void => {
      setStatus('downloading');
      setDownloadProgress(progress);
      setErrorMessage('');
    };
    const throttledProgress = throttle(applyDownloadProgress, 100);

    const cleanupFunctions: Array<() => void> = [];
    cleanupFunctions.push(
      window.autoUpdater.onCheckingForUpdate(() => {
        setStatus('checking');
        setErrorMessage('');
      }),
    );
    cleanupFunctions.push(
      window.autoUpdater.onUpdateAvailable((info) => {
        setStatus('update-available');
        setUpdateInfo(info);
      }),
    );
    cleanupFunctions.push(
      window.autoUpdater.onUpdateNotAvailable(() => {
        setStatus('no-update');
        setUpdateInfo(null);
      }),
    );
    cleanupFunctions.push(
      window.autoUpdater.onDownloadProgress((progress) => {
        if (progress.percent >= 99.9) {
          throttledProgress.cancel();
          applyDownloadProgress(progress);
          return;
        }
        throttledProgress(progress);
      }),
    );
    cleanupFunctions.push(
      window.autoUpdater.onUpdateDownloaded((info) => {
        setStatus('downloaded');
        setUpdateInfo(info);
      }),
    );
    cleanupFunctions.push(
      window.autoUpdater.onError((error) => {
        setStatus('error');
        setErrorMessage(error.message);
      }),
    );
    return () => {
      throttledProgress.cancel();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, []);

  const handleCheckForUpdates = async (): Promise<void> => {
    if (!window.autoUpdater) {
      return;
    }
    try {
      setStatus('checking');
      setErrorMessage('');
      await window.autoUpdater.checkForUpdates();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to check for updates');
    }
  };

  const handleDownload = async (): Promise<void> => {
    if (!window.autoUpdater) {
      return;
    }
    try {
      setStatus('downloading');
      setErrorMessage('');
      await window.autoUpdater.downloadUpdate();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to download update');
    }
  };

  const handleInstall = async (): Promise<void> => {
    if (!window.autoUpdater) {
      return;
    }
    try {
      await window.autoUpdater.quitAndInstall();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to install update');
    }
  };

  return {
    status,
    currentVersion,
    updateInfo,
    downloadProgress,
    errorMessage,
    isElectron,
    handleCheckForUpdates,
    handleDownload,
    handleInstall,
  };
}

function UpdateManager({ isOpen, onClose }: UpdateManagerProps): React.ReactElement | null {
  const {
    status,
    currentVersion,
    updateInfo,
    downloadProgress,
    errorMessage,
    isElectron,
    handleCheckForUpdates,
    handleDownload,
    handleInstall,
  } = useAutoUpdater();

  const messages = useRef({
    nonElectronTitle: rollForMessage(updateMessages.nonElectron.title),
    nonElectronSubtitle: rollForMessage(updateMessages.nonElectron.subtitle),
    idle: rollForMessage(updateMessages.idle),
    checking: rollForMessage(updateMessages.checking),
    noUpdateTitle: rollForMessage(updateMessages.noUpdate.title),
    noUpdateSubtitle: rollForMessage(updateMessages.noUpdate.subtitle),
    updateAvailableTitle: rollForMessage(updateMessages.updateAvailable.title),
    updateAvailableSubtitle: rollForMessage(updateMessages.updateAvailable.subtitle),
    downloading: rollForMessage(updateMessages.downloading),
    downloadedTitle: rollForMessage(updateMessages.downloaded.title),
    downloadedSubtitle: rollForMessage(updateMessages.downloaded.subtitle),
    downloadedInstruction: rollForMessage(updateMessages.downloaded.instruction),
    error: rollForMessage(updateMessages.error),
  }).current;

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-w-md rounded-lg"
        data-testid="dialog-update-manager-root"
        showCloseButton={false}
      >
        <div className="flex justify-between items-center mb-6">
          <DialogTitle
            id="update-manager-title"
            className="text-xl font-semibold text-[var(--app-text)]"
          >
            Software Update
          </DialogTitle>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-2xl leading-none text-[var(--app-text-muted)]"
            aria-label="Close update manager"
          >
            ×
          </Button>
        </div>

        {/* Current Version */}
        <div className="mb-6 p-4 bg-[var(--app-bg-subtle)] rounded-sm">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-[var(--app-text-muted)]">
              Current Version
            </span>
            <span className="font-mono text-sm text-[var(--app-text)]">
              {currentVersion || 'Unknown'}
            </span>
          </div>
        </div>

        {/* Status Content */}
        <div className="mb-6">
          <StatusContent
            isElectron={isElectron}
            status={status}
            updateInfo={updateInfo}
            downloadProgress={downloadProgress}
            errorMessage={errorMessage}
            messages={messages}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {isElectron && (status === 'idle' || status === 'no-update' || status === 'error') && (
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                void handleCheckForUpdates();
              }}
            >
              <RiSearchLine className="size-5" />
              Consult the Archives
            </Button>
          )}

          {status === 'update-available' && (
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                void handleDownload();
              }}
            >
              <RiDownloadLine className="size-5" />
              Summon the Artifact
            </Button>
          )}

          {status === 'downloaded' && (
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                void handleInstall();
              }}
            >
              <RiRefreshLine className="size-5" />
              Restart & Install
            </Button>
          )}

          <Button variant="secondary" onClick={onClose}>
            {status === 'downloaded' ? 'Later' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpdateManager;
