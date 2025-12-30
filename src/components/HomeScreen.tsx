import { useState, useEffect } from 'react';
import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';
import { getRecentCampaigns, addRecentCampaignWithPlatform, removeRecentCampaign, type RecentCampaign } from '../utils/recentCampaigns';
import { rollForMessage } from '../utils/systemMessages';

interface HomeScreenProps {
  onStartEditor: () => void;
}

/**
 * HomeScreen - Landing page for the application
 *
 * Displays branding, primary actions (New/Load Campaign),
 * recent campaigns list, and platform-specific download banner.
 *
 * This component serves as the entry point before loading the editor.
 */
export function HomeScreen({ onStartEditor }: HomeScreenProps) {
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [isElectron, setIsElectron] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const loadCampaign = useGameStore((state) => state.loadCampaign);
  const showToast = useGameStore((state) => state.showToast);

  // Load recent campaigns and detect platform on mount
  useEffect(() => {
    setRecentCampaigns(getRecentCampaigns());

    // Detect platform
    const storage = getStorage();
    const platform = storage.getPlatform();
    setIsElectron(platform === 'electron');

    // Detect macOS for download banner (avoid deprecated navigator.platform)
    let isMacOS = false;
    if (typeof navigator !== 'undefined') {
      const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
      const platformHint = uaData?.platform ?? '';
      const userAgent = navigator.userAgent ?? '';

      isMacOS =
        platformHint.toLowerCase().includes('mac') ||
        /mac/i.test(userAgent);
    }
    setIsMac(isMacOS);
  }, []);

  /**
   * Create a new campaign and enter the editor
   */
  const handleNewCampaign = () => {
    // The default campaign is already loaded in the store
    // Just transition to editor view
    onStartEditor();
  };

  /**
   * Load an existing campaign from file
   */
  const handleLoadCampaign = async () => {
    try {
      const storage = getStorage();
      const campaign = await storage.loadCampaign();

      if (campaign) {
        // Load campaign into store
        loadCampaign(campaign);

        // Add to recent campaigns
        addRecentCampaignWithPlatform(
          campaign.id,
          campaign.name
        );

        // Update recent list
        setRecentCampaigns(getRecentCampaigns());

        // Transition to editor
        onStartEditor();

        showToast(rollForMessage('CAMPAIGN_LOAD_SUCCESS'), 'success');
      }
    } catch (error) {
      console.error('[HomeScreen] Failed to load campaign:', error);
      showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(error) }), 'error');
    }
  };

  /**
   * Handle click on a recent campaign entry.
   *
   * Current limitation:
   * - We cannot reliably reload a specific campaign from this list,
   *   because campaigns are stored as user-selected files and we do
   *   not currently persist file handles/paths.
   * - To avoid a confusing UX where clicking a recent item just opens
   *   a generic file picker, we treat this list as a reference only
   *   and show guidance to the user instead of re-opening the dialog.
   *
   * Future enhancement:
   * - Persist file handles (File System Access API) or file paths
   *   (Electron) so we can directly load the selected recent campaign.
   */
  const handleLoadRecent = async (_recent: RecentCampaign) => {
    showToast(
      'Recent campaigns are a reference list only right now. Use "Load Campaign" and select the matching .hyle file.',
      'info'
    );
  };

  /**
   * Remove a campaign from recent list
   */
  const handleRemoveRecent = (campaignId: string) => {
    removeRecentCampaign(campaignId);
    setRecentCampaigns(getRecentCampaigns());
  };

  return (
    <div className="home-screen w-full h-screen flex flex-col items-center justify-center" style={{
      background: 'var(--app-bg-base)',
      color: 'var(--app-text-primary)',
    }}>
      <style>{`
        .home-action-button {
          --border-color: var(--app-border-default);
        }
        .home-action-button:hover {
          --border-color: var(--app-accent-solid);
        }
        .home-recent-item {
          --item-bg: var(--app-bg-surface);
          --item-border: var(--app-border-subtle);
        }
        .home-recent-item:hover {
          --item-bg: var(--app-bg-hover);
          --item-border: var(--app-border-default);
        }
        .home-remove-btn {
          --remove-bg: transparent;
        }
        .home-remove-btn:hover {
          --remove-bg: var(--app-bg-active);
        }
      `}</style>
      {/* Main Content Container */}
      <div className="max-w-2xl w-full px-8">
        {/* Branding */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4" style={{
            background: 'linear-gradient(135deg, var(--app-accent-solid), var(--app-accent-text))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Hyle
          </h1>
          <p className="text-xl" style={{ color: 'var(--app-text-secondary)' }}>
            Virtual Tabletop for Dungeon Masters
          </p>
        </div>

        {/* Mac App Download Banner (Web only, Mac only) */}
        {!isElectron && isMac && (
          <div className="mb-8 p-4 rounded-lg" style={{
            background: 'var(--app-accent-bg)',
            border: '1px solid var(--app-accent-solid)',
          }}>
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-accent-text)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold mb-1" style={{ color: 'var(--app-accent-text-contrast)' }}>
                  Download the Mac App
                </h3>
                <p className="text-sm" style={{ color: 'var(--app-accent-text)' }}>
                  Get greater portability, offline support, and privacy with the native Mac application.
                </p>
              </div>
              <a
                href="https://github.com/kocheck/Hyle/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary px-4 py-2 rounded font-medium whitespace-nowrap"
                style={{
                  background: 'var(--app-accent-solid)',
                  color: 'var(--app-accent-solid-text)',
                }}
              >
                Download
              </a>
            </div>
          </div>
        )}

        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleNewCampaign}
            className="home-action-button p-6 rounded-lg text-left transition-all hover:scale-105"
            style={{
              background: 'var(--app-bg-surface)',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'var(--border-color)',
            }}
            aria-label="Create a new campaign and start the editor"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-accent-solid)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <h2 className="text-2xl font-bold">New Campaign</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
              Start a fresh adventure with a blank canvas
            </p>
          </button>

          <button
            onClick={handleLoadCampaign}
            className="home-action-button p-6 rounded-lg text-left transition-all hover:scale-105"
            style={{
              background: 'var(--app-bg-surface)',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'var(--border-color)',
            }}
            aria-label="Load an existing campaign from a .hyle file"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-accent-solid)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-2xl font-bold">Load Campaign</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
              Continue an existing campaign from a file
            </p>
          </button>
        </div>

        {/* Recent Campaigns */}
        {recentCampaigns.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--app-text-secondary)' }}>
              Recent Campaigns
            </h3>
            <div className="space-y-2">
              {recentCampaigns.map((recent) => (
                <div
                  key={recent.id}
                  className="home-recent-item w-full p-4 rounded flex items-center justify-between group transition-all"
                  style={{
                    background: 'var(--item-bg)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--item-border)',
                  }}
                >
                  <button
                    onClick={() => handleLoadRecent(recent)}
                    className="flex items-center gap-3 flex-1 text-left"
                    style={{ background: 'transparent', border: 'none', padding: 0 }}
                    aria-label={`Recent campaign: ${recent.name}. Click for more information about loading this campaign.`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-text-secondary)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">{recent.name}</div>
                      <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                        {new Date(recent.lastOpened).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRemoveRecent(recent.id)}
                    className="home-remove-btn p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: 'var(--remove-bg)',
                    }}
                    title="Remove from recent"
                    aria-label={`Remove ${recent.name} from recent campaigns`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center" style={{ color: 'var(--app-text-muted)' }}>
        <p className="text-sm">
          Version {__APP_VERSION__} · {isElectron ? 'Desktop' : 'Web'} Edition
        </p>
      </div>
    </div>
  );
}
