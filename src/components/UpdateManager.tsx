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

import { useEffect, useState, useMemo } from 'react';

// ============================================================================
// MESSAGE VARIATIONS - Randomized for delightful UX
// ============================================================================

const updateMessages = {
  nonElectron: [
    '🌐 The Auto-Forge only functions within the Desktop Sanctum.\nWeb browsers cannot channel these arcane energies.',
    '⚠️ Update magic requires the Desktop Realm.\nThe web plane lacks the necessary conduits.',
    '🔮 Alas! Auto-updates are bound to the Desktop Application.\nBrowsers cannot invoke this ritual.',
  ],
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
  return messages[Math.floor(Math.random() * messages.length)];
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

const UpdateManager = ({ isOpen, onClose }: UpdateManagerProps) => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isElectron, setIsElectron] = useState<boolean>(false);

  // Randomize messages on mount (stable per dialog open)
  const messages = useMemo(
    () => ({
      nonElectron: rollForMessage(updateMessages.nonElectron),
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
    }),
    [isOpen] // Re-roll when dialog reopens
  );

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.autoUpdater);

    if (window.autoUpdater) {
      // Get current version on mount
      window.autoUpdater.getCurrentVersion().then(setCurrentVersion);
    }
  }, []);

  // Set up event listeners for auto-updater
  useEffect(() => {
    if (!window.autoUpdater || !isOpen) return;

    const cleanupFunctions: (() => void)[] = [];

    // Checking for update
    cleanupFunctions.push(
      window.autoUpdater.onCheckingForUpdate(() => {
        setStatus('checking');
        setErrorMessage('');
      })
    );

    // Update available
    cleanupFunctions.push(
      window.autoUpdater.onUpdateAvailable((info) => {
        setStatus('update-available');
        setUpdateInfo(info);
      })
    );

    // No update available
    cleanupFunctions.push(
      window.autoUpdater.onUpdateNotAvailable(() => {
        setStatus('no-update');
        setUpdateInfo(null);
      })
    );

    // Download progress
    cleanupFunctions.push(
      window.autoUpdater.onDownloadProgress((progress) => {
        setStatus('downloading');
        setDownloadProgress(progress);
      })
    );

    // Update downloaded
    cleanupFunctions.push(
      window.autoUpdater.onUpdateDownloaded((info) => {
        setStatus('downloaded');
        setUpdateInfo(info);
      })
    );

    // Error
    cleanupFunctions.push(
      window.autoUpdater.onError((error) => {
        setStatus('error');
        setErrorMessage(error.message);
      })
    );

    // Cleanup on unmount
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCheckForUpdates = async () => {
    if (!window.autoUpdater) return;

    try {
      setStatus('checking');
      setErrorMessage('');
      await window.autoUpdater.checkForUpdates();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to check for updates');
    }
  };

  const handleDownload = async () => {
    if (!window.autoUpdater) return;

    try {
      setStatus('downloading');
      setErrorMessage('');
      await window.autoUpdater.downloadUpdate();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to download update');
    }
  };

  const handleInstall = async () => {
    if (!window.autoUpdater) return;

    try {
      await window.autoUpdater.quitAndInstall();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to install update');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-manager-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h2
            id="update-manager-title"
            className="text-xl font-semibold"
            style={{ color: 'var(--app-text)' }}
          >
            Software Update
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none hover:opacity-70 transition"
            style={{ color: 'var(--app-text-muted)' }}
            aria-label="Close update manager"
          >
            ×
          </button>
        </div>

        {/* Current Version */}
        <div className="mb-6 p-4 bg-[var(--app-bg-subtle)] rounded">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Current Version
            </span>
            <span className="font-mono text-sm" style={{ color: 'var(--app-text)' }}>
              {currentVersion || 'Unknown'}
            </span>
          </div>
        </div>

        {/* Status Content */}
        <div className="mb-6">
          {!isElectron && (
            <div className="text-center py-4">
              <p style={{ color: 'var(--app-text-muted)', whiteSpace: 'pre-line' }}>
                {messages.nonElectron}
              </p>
            </div>
          )}

          {isElectron && status === 'idle' && (
            <div className="text-center py-4">
              <p className="mb-4" style={{ color: 'var(--app-text-muted)' }}>
                {messages.idle}
              </p>
            </div>
          )}

          {status === 'checking' && (
            <div className="text-center py-4">
              <div className="animate-pulse mb-2" style={{ color: 'var(--app-text)' }}>
                {messages.checking}
              </div>
            </div>
          )}

          {status === 'no-update' && (
            <div className="text-center py-4">
              <p className="mb-2" style={{ color: 'var(--app-text)' }}>
                {messages.noUpdateTitle}
              </p>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                {messages.noUpdateSubtitle}
              </p>
            </div>
          )}

          {status === 'update-available' && updateInfo && (
            <div className="p-4 bg-[var(--app-bg-subtle)] rounded">
              <p className="mb-2 font-medium" style={{ color: 'var(--app-text)' }}>
                {formatMessage(messages.updateAvailableTitle, updateInfo.version)}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--app-text-muted)' }}>
                {messages.updateAvailableSubtitle}
              </p>
            </div>
          )}

          {status === 'downloading' && downloadProgress && (
            <div className="p-4 bg-[var(--app-bg-subtle)] rounded">
              <p className="mb-3 font-medium" style={{ color: 'var(--app-text)' }}>
                {messages.downloading}
              </p>
              <div className="mb-2 bg-[var(--app-bg)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-sm" style={{ color: 'var(--app-text-muted)' }}>
                <span>{downloadProgress.percent.toFixed(1)}%</span>
                <span>
                  {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                </span>
              </div>
              <div className="text-sm text-center mt-2" style={{ color: 'var(--app-text-muted)' }}>
                {formatSpeed(downloadProgress.bytesPerSecond)}
              </div>
            </div>
          )}

          {status === 'downloaded' && updateInfo && (
            <div className="p-4 bg-[var(--app-bg-subtle)] rounded">
              <p className="mb-2 font-medium" style={{ color: 'var(--app-text)' }}>
                {messages.downloadedTitle}
              </p>
              <p className="text-sm mb-2" style={{ color: 'var(--app-text-muted)' }}>
                {formatMessage(messages.downloadedSubtitle, updateInfo.version)}
              </p>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                {messages.downloadedInstruction}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                {errorMessage || messages.error}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {isElectron && (status === 'idle' || status === 'no-update' || status === 'error') && (
            <button
              onClick={handleCheckForUpdates}
              disabled={status === 'checking'}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition"
            >
              🔮 Consult the Archives
            </button>
          )}

          {status === 'update-available' && (
            <button
              onClick={handleDownload}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition"
            >
              ⚡ Summon the Artifact
            </button>
          )}

          {status === 'downloaded' && (
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition"
            >
              ⚔️ Install & Reforge
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--app-border)] hover:bg-[var(--app-bg-subtle)] rounded font-medium transition"
            style={{ color: 'var(--app-text)' }}
          >
            {status === 'downloaded' ? 'Later' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateManager;
