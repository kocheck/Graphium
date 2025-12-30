import { useState, useEffect, useMemo } from 'react';
import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';
import { getRecentCampaigns, addRecentCampaignWithPlatform, removeRecentCampaign, type RecentCampaign } from '../utils/recentCampaigns';
import { rollForMessage } from '../utils/systemMessages';
import { BackgroundCanvas } from './HomeScreen/BackgroundCanvas';
import { PlaygroundToken } from './HomeScreen/PlaygroundToken';
import { VignetteOverlay } from './HomeScreen/VignetteOverlay';
import { LogoIcon } from './HomeScreen/LogoIcon';
import { AboutModal } from './HomeScreen/AboutModal';

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
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [shouldAnimateLogo, setShouldAnimateLogo] = useState(true);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [triggerEasterEgg, setTriggerEasterEgg] = useState(0);
  const [hideMacBanner, setHideMacBanner] = useState(() =>
    localStorage.getItem('hideMacBanner') === 'true'
  );

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

  // Keyboard shortcut: Press '?' to open About modal
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if '?' was pressed (shift + / on most keyboards)
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isAboutOpen) {
        e.preventDefault();
        setIsAboutOpen(true);
      }
      // Also support Escape to close
      if (e.key === 'Escape' && isAboutOpen) {
        setIsAboutOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAboutOpen]);

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

  /**
   * Handle logo clicks for easter egg detection
   * Rapid clicks (5+ within 2 seconds) trigger easter egg
   */
  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);

    if (newCount >= 5) {
      // Trigger easter egg!
      setTriggerEasterEgg(prev => prev + 1);
      setLogoClickCount(0);

      // Show fun message
      const messages = [
        "🎲 Natural 20! The dice gods smile upon you!",
        "⚔️ Critical success! You've unlocked the secret handshake!",
        "✨ *Reality warps around you...* Roll for Perception!",
        "🌟 The cosmos aligns! You've discovered the hidden power!",
        "💫 Easter egg found! May your rolls be ever in your favor!",
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      showToast(randomMessage, 'success');
    }

    // Reset counter after 2 seconds of inactivity
    setTimeout(() => {
      setLogoClickCount(0);
    }, 2000);
  };

  /**
   * Handle dice roll animation completion
   */
  const handleAnimationComplete = (roll: number) => {
    // Could show different messages based on roll
    if (roll === 20) {
      // Natural 20 rolled on page load - lucky!
      console.log('🎲 Natural 20! Auspicious beginning!');
    } else if (roll === 1) {
      // Natural 1 - critical failure
      console.log('💀 Critical failure on the entrance roll. Proceed with caution!');
    }
  };

  /**
   * Dismiss Mac download banner permanently
   */
  const handleDismissMacBanner = () => {
    localStorage.setItem('hideMacBanner', 'true');
    setHideMacBanner(true);
  };

  // Generate random playground tokens with flavor text (memoized to prevent recreation on re-renders)
  const playgroundTokens = useMemo(() => {
    const tokens = [
      {
        id: 'demo-hero',
        color: '#3b82f6',
        label: 'Hero',
        flavorText: 'Definitely has protagonist energy.',
      },
      {
        id: 'demo-monster',
        color: '#ef4444',
        label: 'Dragon',
        flavorText: "This ancient wyrm hasn't had breakfast yet. You look crunchy.",
      },
      {
        id: 'demo-npc',
        color: '#8b5cf6',
        label: 'Wizard',
        flavorText: 'Contemplating the nature of reality... or maybe just lunch.',
      },
      {
        id: 'demo-ally',
        color: '#10b981',
        label: 'Ranger',
        flavorText: 'Survival check: 18. They know exactly where the nearest tavern is.',
      },
      {
        id: 'demo-enemy',
        color: '#f59e0b',
        label: 'Goblin',
        flavorText: 'Rolled a 3 on Stealth. You can smell them from here.',
      },
    ];

    // Distribute tokens around the viewport in a scattered pattern
    return tokens.map((token, index) => {
      const angle = (index / tokens.length) * Math.PI * 2;
      const distance = 200 + Math.random() * 150;
      return {
        ...token,
        x: window.innerWidth / 2 + Math.cos(angle) * distance,
        y: window.innerHeight / 2 + Math.sin(angle) * distance,
      };
    });
  }, []);

  return (
    <div className="home-screen w-full h-screen flex flex-col items-center justify-center" style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--app-bg-base)',
      color: 'var(--app-text-primary)',
    }}>
      {/* Background Layer - Paper texture and grid */}
      <BackgroundCanvas width={window.innerWidth} height={window.innerHeight}>
        {/* Playground tokens - draggable demo elements */}
        {playgroundTokens.map((token, index) => (
          <PlaygroundToken
            key={token.id}
            id={token.id}
            x={token.x}
            y={token.y}
            color={token.color}
            label={token.label}
            flavorText={token.flavorText}
            easterEggTrigger={triggerEasterEgg}
            showHint={index === 0} // Show hint on first token (Hero)
          />
        ))}
      </BackgroundCanvas>

      {/* Vignette overlay - creates fade to infinity effect */}
      <VignetteOverlay />

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .home-screen {
          animation: fadeIn 0.6s ease-out;
        }

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

      {/* Main Content Container - Above background and vignette */}
      <div className="max-w-2xl w-full px-8" style={{
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Branding */}
        <div className="text-center mb-12">
          <button
            onClick={(e) => {
              handleLogoClick();
              // Open about modal on single click (after easter egg check)
              if (logoClickCount < 4) {
                setTimeout(() => setIsAboutOpen(true), 100);
              }
            }}
            className="logo-button"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '1rem',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              display: 'inline-block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = 'rgba(var(--app-accent-solid-rgb, 59, 130, 246), 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Open About Hyle dialog (or click 5 times rapidly for a surprise!)"
          >
            <div style={{ marginBottom: '0.75rem' }}>
              <LogoIcon
                size={80}
                animate={shouldAnimateLogo}
                onAnimationComplete={handleAnimationComplete}
              />
            </div>
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
          </button>
        </div>

        {/* Mac App Download Banner (Web only, Mac only) */}
        {!isElectron && isMac && !hideMacBanner && (
          <div className="mb-8 p-4 rounded-lg" style={{
            background: 'var(--app-accent-bg)',
            border: '1px solid var(--app-accent-solid)',
            position: 'relative',
          }}>
            {/* Dismiss button */}
            <button
              onClick={handleDismissMacBanner}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: 'transparent',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: 'var(--app-accent-text)',
                width: '1.5rem',
                height: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                opacity: 0.6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.background = 'transparent';
              }}
              title="Don't show again"
              aria-label="Dismiss Mac download banner permanently"
            >
              ×
            </button>

            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-accent-text)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <div className="flex-1" style={{ paddingRight: '1rem' }}>
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
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-4 mb-4">
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

          {/* Take a Tour button */}
          <button
            onClick={() => setIsAboutOpen(true)}
            className="w-full p-4 rounded-lg text-center transition-all hover:scale-102"
            style={{
              background: 'var(--app-bg-hover)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--app-border-subtle)',
              color: 'var(--app-text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--app-accent-solid)';
              e.currentTarget.style.color = 'var(--app-accent-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--app-border-subtle)';
              e.currentTarget.style.color = 'var(--app-text-secondary)';
            }}
            aria-label="Learn about Hyle features"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">✨ New to Hyle? Learn the basics</span>
            </div>
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

      {/* Footer with links */}
      <div className="absolute bottom-4 left-0 right-0" style={{
        position: 'relative',
        zIndex: 10,
      }}>
        <div className="flex flex-col items-center gap-3">
          {/* Links */}
          <div className="flex items-center gap-4 text-sm">
            <a
              href="https://github.com/kocheck/Hyle"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--app-text-muted)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--app-accent-text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--app-text-muted)'}
            >
              GitHub
            </a>
            <span style={{ color: 'var(--app-border-default)' }}>·</span>
            <button
              onClick={() => setIsAboutOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--app-text-muted)',
                cursor: 'pointer',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--app-accent-text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--app-text-muted)'}
            >
              About
            </button>
            <span style={{ color: 'var(--app-border-default)' }}>·</span>
            <a
              href="https://github.com/kocheck/Hyle/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--app-text-muted)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--app-accent-text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--app-text-muted)'}
            >
              Report Bug
            </a>
            <span style={{ color: 'var(--app-border-default)' }}>·</span>
            <button
              onClick={() => setIsAboutOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--app-text-muted)',
                cursor: 'pointer',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--app-accent-text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--app-text-muted)'}
              title="Press ? to open"
            >
              Help (?)
            </button>
          </div>
          {/* Version */}
          <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
            Version {__APP_VERSION__} · {isElectron ? 'Desktop' : 'Web'} Edition
          </p>
        </div>
      </div>

      {/* About Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}
