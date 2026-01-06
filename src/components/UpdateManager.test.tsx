/**
 * UpdateManager Component Tests
 *
 * Tests for the auto-updater UI component including:
 * - Rendering states (idle, checking, available, downloading, downloaded, error)
 * - User interactions (check, download, install, close)
 * - Event handling (update events, progress updates)
 * - Electron environment detection
 * - Keyboard shortcuts (Escape to close)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import UpdateManager from './UpdateManager';

// Mock window.autoUpdater API
const mockAutoUpdater = {
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
  getCurrentVersion: vi.fn(),
  onCheckingForUpdate: vi.fn(),
  onUpdateAvailable: vi.fn(),
  onUpdateNotAvailable: vi.fn(),
  onDownloadProgress: vi.fn(),
  onUpdateDownloaded: vi.fn(),
  onError: vi.fn(),
};

describe('UpdateManager', () => {
  let cleanupFunctions: (() => void)[];

  beforeEach(() => {
    cleanupFunctions = [];

    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock cleanup functions
    const createMockCleanup = () => {
      const cleanup = vi.fn();
      cleanupFunctions.push(cleanup);
      return cleanup;
    };

    mockAutoUpdater.onCheckingForUpdate.mockReturnValue(createMockCleanup());
    mockAutoUpdater.onUpdateAvailable.mockReturnValue(createMockCleanup());
    mockAutoUpdater.onUpdateNotAvailable.mockReturnValue(createMockCleanup());
    mockAutoUpdater.onDownloadProgress.mockReturnValue(createMockCleanup());
    mockAutoUpdater.onUpdateDownloaded.mockReturnValue(createMockCleanup());
    mockAutoUpdater.onError.mockReturnValue(createMockCleanup());

    mockAutoUpdater.getCurrentVersion.mockResolvedValue('0.5.3');
    mockAutoUpdater.checkForUpdates.mockResolvedValue({ available: false });
    mockAutoUpdater.downloadUpdate.mockResolvedValue(true);
    mockAutoUpdater.quitAndInstall.mockResolvedValue(true);
  });

  afterEach(() => {
    // Remove mock from window
    delete (window as { autoUpdater?: unknown }).autoUpdater;
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      const { container } = render(
        <UpdateManager isOpen={false} onClose={() => {}} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when open', () => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;

      render(<UpdateManager isOpen={true} onClose={() => {}} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Software Update')).toBeInTheDocument();
    });

    it('should display current version', async () => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('0.5.3')).toBeInTheDocument();
      });
    });

    it('should show non-Electron message when autoUpdater is not available', () => {
      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // The non-Electron message uses randomized themed copy (e.g. "Desktop Sanctum", "Desktop Realm").
      // Assert on the stable "Desktop" keyword instead of an exact string.
      expect(screen.getByText(/Desktop/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<UpdateManager isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close update manager');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      render(<UpdateManager isOpen={true} onClose={onClose} />);

      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not close when clicking inside dialog', () => {
      const onClose = vi.fn();
      render(<UpdateManager isOpen={true} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call checkForUpdates when button is clicked', async () => {
      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      const checkButton = screen.getByText(/Consult the Archives/i);
      await act(async () => {
        fireEvent.click(checkButton);
      });

      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('should handle Escape key to close', () => {
      const onClose = vi.fn();
      render(<UpdateManager isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Update States', () => {
    beforeEach(() => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;
    });

    it('should show checking state', async () => {
      let checkingCallback: (() => void) | undefined;
      mockAutoUpdater.onCheckingForUpdate.mockImplementation((cb) => {
        checkingCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Trigger checking state
      await act(async () => {
        if (checkingCallback) checkingCallback();
      });

      // The checking message uses randomized themed copy (e.g. "Divining the cosmic archives", "Consulting the Chronicle").
      // Assert on common keywords that appear in all variations.
      expect(
        screen.getByText(
          /Divining|Consulting|Communing|Rolling|Peering/i,
        ),
      ).toBeInTheDocument();
    });

    it('should show update available state', async () => {
      let updateAvailableCallback: ((info: { version: string }) => void) | undefined;
      mockAutoUpdater.onUpdateAvailable.mockImplementation((cb) => {
        updateAvailableCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Trigger update available
      await act(async () => {
        if (updateAvailableCallback) {
          updateAvailableCallback({ version: '0.5.4' });
        }
      });

      // Message prefix is randomized (e.g. "✨ New Power Forged: v0.5.4"),
      // so only assert on the stable version substring.
      expect(screen.getByText('v0.5.4', { exact: false })).toBeInTheDocument();
      expect(screen.getByText(/Summon the Artifact/i)).toBeInTheDocument();
    });

    it('should show no update available state', async () => {
      let noUpdateCallback: (() => void) | undefined;
      mockAutoUpdater.onUpdateNotAvailable.mockImplementation((cb) => {
        noUpdateCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Trigger no update
      await act(async () => {
        if (noUpdateCallback) {
          noUpdateCallback({ version: '0.5.3' });
        }
      });

      // The no-update message uses randomized themed copy (e.g. "Your forge burns", "You wield the cutting edge").
      // Assert on the title pattern which appears above the subtitle.
      expect(
        screen.getByText(/forge burns|wield the cutting|Natural 20 on your version|arsenal is complete|chapter already graces/i),
      ).toBeInTheDocument();
    });

    it('should show download progress', async () => {
      let progressCallback: ((progress: {
        percent: number;
        bytesPerSecond: number;
        transferred: number;
        total: number;
      }) => void) | undefined;

      mockAutoUpdater.onDownloadProgress.mockImplementation((cb) => {
        progressCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Trigger download progress
      await act(async () => {
        if (progressCallback) {
          progressCallback({
            percent: 45.5,
            bytesPerSecond: 1024000,
            transferred: 50000000,
            total: 110000000,
          });
        }
      });

      // The downloading message uses randomized themed copy (e.g. "Channeling the update", "Summoning the artifact").
      // Assert on the progress percentage which is always shown.
      expect(screen.getByText('45.5%')).toBeInTheDocument();
    });

    it('should show update downloaded state', async () => {
      let downloadedCallback: ((info: { version: string }) => void) | undefined;
      mockAutoUpdater.onUpdateDownloaded.mockImplementation((cb) => {
        downloadedCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Trigger downloaded
      await act(async () => {
        if (downloadedCallback) {
          downloadedCallback({ version: '0.5.4' });
        }
      });

      // The downloaded message uses randomized themed copy, but button text is stable.
      expect(screen.getByText(/Restart & Install/i)).toBeInTheDocument();
    });

    it('should show error state', async () => {
      let errorCallback: ((error: { message: string }) => void) | undefined;
      mockAutoUpdater.onError.mockImplementation((cb) => {
        errorCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Trigger error
      await act(async () => {
        if (errorCallback) {
          errorCallback({ message: 'Network error' });
        }
      });

      // Error state displays the actual error message
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Download and Install', () => {
    beforeEach(() => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;
    });

    it('should call downloadUpdate when Download button is clicked', async () => {
      let updateAvailableCallback: ((info: { version: string }) => void) | undefined;
      mockAutoUpdater.onUpdateAvailable.mockImplementation((cb) => {
        updateAvailableCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Set to update available state
      await act(async () => {
        if (updateAvailableCallback) {
          updateAvailableCallback({ version: '0.5.4' });
        }
      });

      const downloadButton = screen.getByRole('button', { name: /Summon the Artifact/i });
      await act(async () => {
        fireEvent.click(downloadButton);
      });

      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    });

    it('should call quitAndInstall when Restart & Install is clicked', async () => {
      let downloadedCallback: ((info: { version: string }) => void) | undefined;
      mockAutoUpdater.onUpdateDownloaded.mockImplementation((cb) => {
        downloadedCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Set to downloaded state
      await act(async () => {
        if (downloadedCallback) {
          downloadedCallback({ version: '0.5.4' });
        }
      });

      const installButton = screen.getByText(/Restart & Install/i);
      await act(async () => {
        fireEvent.click(installButton);
      });

      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;
    });

    it('should handle checkForUpdates error', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(
        new Error('Check failed')
      );

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      const checkButton = screen.getByText(/Consult the Archives/i);
      await act(async () => {
        fireEvent.click(checkButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Check failed')).toBeInTheDocument();
      });
    });

    it('should handle downloadUpdate error', async () => {
      mockAutoUpdater.downloadUpdate.mockRejectedValue(
        new Error('Download failed')
      );

      let updateAvailableCallback: ((info: { version: string }) => void) | undefined;
      mockAutoUpdater.onUpdateAvailable.mockImplementation((cb) => {
        updateAvailableCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Set to update available state
      await act(async () => {
        if (updateAvailableCallback) {
          updateAvailableCallback({ version: '0.5.4' });
        }
      });

      const downloadButton = screen.getByRole('button', {
        name: /Summon the Artifact/i,
      });
      await act(async () => {
        fireEvent.click(downloadButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Download failed')).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;

      const { unmount } = render(<UpdateManager isOpen={true} onClose={() => {}} />);

      unmount();

      // All cleanup functions should be called
      cleanupFunctions.forEach((cleanup) => {
        expect(cleanup).toHaveBeenCalledTimes(1);
      });
    });

    it('should cleanup event listeners when closed', () => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;

      const { rerender } = render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Close the modal - listeners should NOT be cleaned up (they persist across opens/closes)
      rerender(<UpdateManager isOpen={false} onClose={() => {}} />);

      // Cleanup functions should NOT be called when just closing the modal
      // They're only cleaned up on unmount to prevent duplicate handler registration
      cleanupFunctions.forEach((cleanup) => {
        expect(cleanup).not.toHaveBeenCalled();
      });
    });
  });

  describe('Byte Formatting', () => {
    beforeEach(() => {
      (window as { autoUpdater?: unknown }).autoUpdater = mockAutoUpdater;
    });

    it('should format bytes correctly in progress display', async () => {
      let progressCallback: ((progress: {
        percent: number;
        bytesPerSecond: number;
        transferred: number;
        total: number;
      }) => void) | undefined;

      mockAutoUpdater.onDownloadProgress.mockImplementation((cb) => {
        progressCallback = cb;
        return vi.fn();
      });

      render(<UpdateManager isOpen={true} onClose={() => {}} />);

      // Trigger download progress with specific byte values
      await act(async () => {
        if (progressCallback) {
          progressCallback({
            percent: 50,
            bytesPerSecond: 2097152, // 2 MB/s
            transferred: 52428800, // 50 MB
            total: 104857600, // 100 MB
          });
        }
      });

      expect(screen.getByText(/50 MB/)).toBeInTheDocument();
      expect(screen.getByText(/100 MB/)).toBeInTheDocument();
      expect(screen.getByText(/2 MB\/s/)).toBeInTheDocument();
    });
  });
});
