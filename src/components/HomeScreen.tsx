import type React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import {
  RiDownloadCloudLine,
  RiAddLine,
  RiFolderOpenLine,
  RiFileTextLine,
  RiCloseLine,
  RiInformationLine,
  RiLayoutGridLine,
  RiDiceLine,
  RiMoonLine,
  RiSunLine,
  RiComputerLine,
  RiSearchLine,
  RiFlashlightLine,
  RiSparklingLine,
  RiFileList3Line,
  RiBuilding2Line,
  RiTreeLine,
  RiGobletLine,
  RiSwordLine,
} from '@remixicon/react';

import { AboutModal, type AboutModalTab } from './Dialogs/AboutModal';
import { LogoLockup } from './LogoLockup';
import Tooltip from './Tooltip';
import { usePlatformDetection } from '../hooks/usePlatformDetection';
import { useRecentCampaigns, type RecentCampaign } from '../hooks/useRecentCampaigns';
import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { rollForMessage } from '../utils/systemMessages';

import type { ThemeMode } from '../services/IStorageService';
import type { PixelSize } from '../types/domain';

interface HomeScreenProps {
  onStartEditor: () => void;
}

/**
 * Campaign template definition
 */
interface CampaignTemplate {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  grid: {
    width: number;
    height: number;
    cellSize: number;
  };
}

/**
 * Pre-made campaign templates for quick start
 */
const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'dungeon',
    name: 'Classic Dungeon',
    icon: RiBuilding2Line,
    description: '5-room dungeon with fog of war',
    grid: { width: 30, height: 30, cellSize: 50 },
  },
  {
    id: 'wilderness',
    name: 'Wilderness Map',
    icon: RiTreeLine,
    description: 'Large outdoor exploration area',
    grid: { width: 40, height: 40, cellSize: 50 },
  },
  {
    id: 'tavern',
    name: 'Starting Tavern',
    icon: RiGobletLine,
    description: 'Small indoor social encounter',
    grid: { width: 20, height: 20, cellSize: 50 },
  },
  {
    id: 'arena',
    name: 'Combat Arena',
    icon: RiSwordLine,
    description: 'Tactical battle grid',
    grid: { width: 25, height: 25, cellSize: 50 },
  },
];

/**
 * HomeScreen - Redesigned landing page for the application
 *
 * A lightweight, high-performance launcher with a modern fantasy aesthetic.
 * Features quirky TTRPG-themed micro-interactions and CSS-only visuals.
 */
// eslint-disable-next-line max-lines-per-function, complexity
export function HomeScreen({ onStartEditor }: HomeScreenProps): React.JSX.Element {
  const { recentCampaigns, addRecent, removeRecent } = useRecentCampaigns();
  const { isElectron, isMac, isWindows, isLinux } = usePlatformDetection();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aboutInitialTab, setAboutInitialTab] = useState<AboutModalTab>('about');
  const [hideDownloadBanner, setHideDownloadBanner] = useState(
    () => localStorage.getItem('hideDownloadBanner') === 'true',
  );

  // NEW FEATURES
  const [liteMode, setLiteMode] = useState(() => localStorage.getItem('liteMode') === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>('system');

  // Refs for focus management
  const templatesModalRef = useRef<HTMLDivElement>(null);
  const templatesCloseButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Random inclusive subtitle (stable for session)
  const [subtitle] = useState(() => {
    const titles = [
      'Storytellers',
      'World Builders',
      'Game Guides',
      'Adventure Architects',
      'Keepers of Lore',
      'Dice Rollers',
      'Party Leaders',
      'Campaign Curators',
      'Narrative Weavers',
      'Fantasy Facilitators',
      'Myth Makers',
      'Legend Spinners',
      'Plot Twisters',
      'Tabletop Tacticians',
      'Grid Guardians',
      'Scene Setters',
      'Roleplay Referees',
      'Quest Givers',
      'Map Makers',
      'Saga Shapers',
      'Chroniclers',
      'Chaos Coordinators',
      'Rules Lawyers (The Good Kind)',
    ];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return titles[Math.floor(Math.random() * titles.length)]!;
  });

  const loadCampaign = useGameStore((state) => state.loadCampaign);
  const showToast = useUiStore((state) => state.showToast);
  const showDungeonDialog = useUiStore((state) => state.showDungeonDialog);

  // Handler functions (defined before effects that use them)
  const handleNewCampaign = useCallback(() => {
    onStartEditor();
  }, [onStartEditor]);

  const handleLoadCampaign = useCallback((): void => {
    void (async () => {
      try {
        const storage = getStorage();
        const campaign = await storage.loadCampaign();

        if (campaign) {
          loadCampaign(campaign);
          addRecent(campaign.id, campaign.name);
          onStartEditor();
          showToast(rollForMessage('CAMPAIGN_LOAD_SUCCESS'), 'success');
        }
      } catch (error) {
        console.error('[HomeScreen] Failed to load campaign:', error);
        showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(error) }), 'error');
      }
    })();
  }, [loadCampaign, onStartEditor, showToast, addRecent]);

  const handleGenerateDungeon = useCallback(() => {
    onStartEditor();
    // Small delay to ensure editor is rendered before opening dialog
    setTimeout(() => {
      showDungeonDialog();
    }, 100);
  }, [onStartEditor, showDungeonDialog]);

  // Load current theme mode on mount
  useEffect(() => {
    const storage = getStorage();
    storage
      .getThemeMode()
      .then((mode) => setCurrentTheme(mode))
      .catch((error: unknown) => {
        console.warn('[HomeScreen] Failed to load theme mode, using default:', error);
      });
  }, []);

  // Focus management for templates modal
  useEffect(() => {
    if (showTemplates) {
      // Store the element that had focus before opening
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the close button when modal opens
      setTimeout(() => {
        templatesCloseButtonRef.current?.focus();
      }, 0);
    } else if (previousFocusRef.current) {
      // Restore focus when modal closes
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [showTemplates]);

  // Focus trap for templates modal
  useEffect(() => {
    if (!showTemplates) {
      return;
    }

    const handleTabKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || !templatesModalRef.current) {
        return;
      }

      const focusableElements = templatesModalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [showTemplates]);

  // Global keyboard shortcuts
  useEffect(() => {
    // eslint-disable-next-line complexity
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Global shortcuts (Ctrl/Cmd + key)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === 'n') {
          e.preventDefault();
          handleNewCampaign();
        } else if (e.key === 'o') {
          e.preventDefault();
          void handleLoadCampaign();
        } else if (e.key === 'g') {
          e.preventDefault();
          handleGenerateDungeon();
        } else if (e.key === 't') {
          e.preventDefault();
          setShowTemplates(true);
        }
      }

      // Help shortcut: Press '?' to open About modal
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isAboutOpen && !showTemplates) {
        e.preventDefault();
        setAboutInitialTab('shortcuts');
        setIsAboutOpen(true);
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        if (showTemplates) {
          setShowTemplates(false);
        } else if (isAboutOpen) {
          setIsAboutOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAboutOpen, showTemplates, handleNewCampaign, handleLoadCampaign, handleGenerateDungeon]);

  const handleLoadRecent = (_recent: RecentCampaign): void => {
    showToast(
      'Recent campaigns are a reference list only right now. Use "Load Campaign" and select the matching .graphium file.',
      'info',
    );
  };

  const handleRemoveRecent = (campaignId: string): void => {
    removeRecent(campaignId);
  };

  const handleDismissDownloadBanner = (): void => {
    localStorage.setItem('hideDownloadBanner', 'true');
    setHideDownloadBanner(true);
  };

  // NEW FEATURE HANDLERS

  const handleToggleLiteMode = (): void => {
    const newLiteMode = !liteMode;
    setLiteMode(newLiteMode);
    localStorage.setItem('liteMode', String(newLiteMode));
    showToast(
      newLiteMode
        ? '⚡ Lite Mode enabled - animations disabled for better performance'
        : '✨ Full Mode enabled - animations restored',
      'success',
    );
  };

  const handleToggleTheme = (): void => {
    const storage = getStorage();
    const themes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(currentTheme);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nextTheme = themes[(currentIndex + 1) % themes.length]!;

    void (async () => {
      try {
        await storage.setThemeMode(nextTheme);
        setCurrentTheme(nextTheme);

        // Apply theme immediately for web (Electron handles via IPC)
        if (storage.getPlatform() === 'web') {
          let effectiveTheme: string = nextTheme;
          if (nextTheme === 'system') {
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
          }
          document.documentElement.setAttribute('data-theme', effectiveTheme);

          // Broadcast to other tabs
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('graphium-theme-sync');
            channel.postMessage({ type: 'THEME_CHANGED', mode: nextTheme });
            // Keep channel open briefly to ensure message delivery
            setTimeout(() => channel.close(), 100);
          }
        }
      } catch (error) {
        console.error('[HomeScreen] Failed to set theme:', error);
      }
    })();
  };

  const handleSelectTemplate = (template: CampaignTemplate): void => {
    setShowTemplates(false);

    // Set up new campaign with template settings
    const store = useGameStore.getState();
    store.resetToNewCampaign();
    // Note: Only cell size can be set via store. Grid width/height are reference
    // values - actual canvas size is determined by the uploaded map image.
    store.setGridSize(template.grid.cellSize as PixelSize);

    onStartEditor();
    showToast(`🎲 Created ${template.name} campaign!`, 'success');
  };

  // Filter recent campaigns by search query
  const filteredCampaigns = useMemo(
    () =>
      recentCampaigns.filter((campaign) =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [recentCampaigns, searchQuery],
  );

  const getThemeIcon = (): React.JSX.Element => {
    if (currentTheme === 'light') {
      return <RiSunLine className="w-4 h-4" />;
    }
    if (currentTheme === 'dark') {
      return <RiMoonLine className="w-4 h-4" />;
    }
    return <RiComputerLine className="w-4 h-4" />;
  };

  const getThemeLabel = (): string => {
    if (currentTheme === 'light') {
      return 'Light';
    }
    if (currentTheme === 'dark') {
      return 'Dark';
    }
    return 'Auto';
  };

  return (
    <div className="home-screen" data-lite-mode={liteMode}>
      {/* CSS-only background with animated geometric shapes */}
      <div className="bg-container">
        <div className="bg-gradient"></div>

        <div className="grid-overlay"></div>
        <div className="noise-overlay"></div>
      </div>

      {/* Main Content */}
      <div className="content-container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="logo-container">
            <LogoLockup width={420} className="logo" />
          </div>
          <h1 className="hero-title">
            Virtual Tabletop for <span className="highlight">{subtitle}</span>
          </h1>
          <p className="hero-subtitle">
            Dual-window VTT with fog of war • Local-first, no subscriptions
          </p>
        </div>

        {/* Platform-Specific Download Banners */}
        {!isElectron && !hideDownloadBanner && (isMac || isWindows || isLinux) && (
          <div className="download-banner">
            <button
              onClick={handleDismissDownloadBanner}
              className="dismiss-btn"
              title="Don't show again"
              aria-label="Dismiss download banner permanently"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
            <div className="banner-content">
              <RiDownloadCloudLine className="banner-icon" />
              <div className="banner-text">
                <h3 className="banner-title">
                  {isMac && 'Download the Mac App'}
                  {isWindows && 'Download the Windows App'}
                  {isLinux && 'Download for Linux'}
                </h3>
                <p className="banner-description">
                  Get greater portability, offline support, and privacy with the native desktop
                  application.
                </p>
              </div>
              <a
                href="https://github.com/kocheck/Graphium/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="banner-button"
              >
                Download
              </a>
            </div>
          </div>
        )}

        {/* Primary Action Cards with quirky icons */}
        <div className="action-cards">
          <Tooltip content="Start a fresh adventure with a blank canvas" offset={20}>
            <button
              onClick={handleNewCampaign}
              className="action-card"
              aria-label="Create a new campaign"
              data-testid="new-campaign-button"
            >
              <RiAddLine className="card-icon" />
              <h2 className="card-title">New Campaign</h2>
              <div className="card-hover-effect"></div>
            </button>
          </Tooltip>

          <Tooltip content="Continue an existing campaign from a .graphium file" offset={20}>
            <button
              onClick={handleLoadCampaign}
              className="action-card"
              aria-label="Load an existing campaign"
            >
              <RiFolderOpenLine className="card-icon" />
              <h2 className="card-title">Load Campaign</h2>
              <div className="card-hover-effect"></div>
            </button>
          </Tooltip>

          <Tooltip content="Create a procedural dungeon with rooms and corridors" offset={20}>
            <button
              onClick={handleGenerateDungeon}
              className="action-card"
              aria-label="Generate a procedural dungeon"
            >
              <RiLayoutGridLine className="card-icon" />
              <h2 className="card-title">Generate Dungeon</h2>
              <div className="card-hover-effect"></div>
            </button>
          </Tooltip>

          <Tooltip content="Start from a pre-made campaign template (Ctrl+T)" offset={20}>
            <button
              onClick={() => setShowTemplates(true)}
              className="action-card"
              aria-label="Browse campaign templates"
            >
              <RiFileList3Line className="card-icon" />
              <h2 className="card-title">Templates</h2>
              <div className="card-hover-effect"></div>
            </button>
          </Tooltip>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button
            onClick={() => {
              setAboutInitialTab('tutorial');
              setIsAboutOpen(true);
            }}
            className="quick-action-btn"
            aria-label="Learn about Graphium features"
          >
            <RiInformationLine className="w-5 h-5" />
            <span>✨ New to Graphium? Learn the basics</span>
          </button>
        </div>

        {/* Recent Campaigns */}
        {recentCampaigns.length > 0 && (
          <div className="recent-campaigns">
            <div className="recent-header">
              <RiDiceLine className="recent-icon" />
              <h3 className="recent-title">Recent Campaigns</h3>
            </div>

            {/* Search Input - Show if 6+ campaigns */}
            {recentCampaigns.length >= 6 && (
              <div className="recent-search-container">
                <RiSearchLine className="search-icon" />
                <input
                  type="search"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="recent-search"
                  aria-label="Filter recent campaigns by name"
                />
              </div>
            )}

            <div className="recent-list">
              {filteredCampaigns.length === 0 && searchQuery && (
                <div className="recent-empty">
                  <p>No campaigns match &quot;{searchQuery}&quot;</p>
                </div>
              )}
              {filteredCampaigns.map((recent) => (
                <div key={recent.id} className="recent-item">
                  <button
                    onClick={() => handleLoadRecent(recent)}
                    className="recent-button"
                    aria-label={`Recent campaign: ${recent.name}`}
                  >
                    <RiFileTextLine className="recent-item-icon" />
                    <div className="recent-info">
                      <div className="recent-name">{recent.name}</div>
                      <div className="recent-date">
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
                    className="recent-remove"
                    title="Remove from recent"
                    aria-label={`Remove ${recent.name} from recent campaigns`}
                  >
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-links">
          <a
            href="https://github.com/kocheck/Graphium"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            GitHub
          </a>
          <span className="footer-separator">·</span>
          <button
            onClick={() => {
              setAboutInitialTab('about');
              setIsAboutOpen(true);
            }}
            className="footer-link"
          >
            About
          </button>
          <span className="footer-separator">·</span>
          <a
            href="https://github.com/kocheck/Graphium/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Report Bug
          </a>
          <span className="footer-separator">·</span>
          <button
            onClick={() => {
              setAboutInitialTab('shortcuts');
              setIsAboutOpen(true);
            }}
            className="footer-link"
            title="Press ? to open"
          >
            Help (?)
          </button>
          <span className="footer-separator">·</span>
          <a href="/design-system" className="footer-link" title="Internal component library (Dev)">
            Design System
          </a>
          <span className="footer-separator">·</span>
          <button
            onClick={handleToggleTheme}
            className="footer-link footer-icon-link"
            title={`Theme: ${getThemeLabel()} (click to cycle)`}
            aria-label={`Current theme: ${getThemeLabel()}. Click to cycle themes.`}
          >
            {getThemeIcon()}
            <span className="footer-link-label">{getThemeLabel()}</span>
          </button>
          <span className="footer-separator">·</span>
          <button
            onClick={handleToggleLiteMode}
            className="footer-link footer-icon-link"
            title={
              liteMode ? 'Lite Mode: ON (better performance)' : 'Full Mode: ON (all animations)'
            }
            aria-label={
              liteMode
                ? 'Lite Mode enabled. Click to enable full mode.'
                : 'Full Mode enabled. Click to enable lite mode.'
            }
          >
            {liteMode ? (
              <RiFlashlightLine className="w-4 h-4" />
            ) : (
              <RiSparklingLine className="w-4 h-4" />
            )}
            <span className="footer-link-label">{liteMode ? 'Lite' : 'Full'}</span>
          </button>
        </div>
        <p className="footer-version">
          Version {__APP_VERSION__} · {isElectron ? 'Desktop' : 'Web'} Edition
        </p>
      </footer>

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        initialTab={aboutInitialTab}
      />

      {/* Templates Modal */}
      {showTemplates && (
        <div
          className="templates-overlay"
          onClick={() => setShowTemplates(false)}
          role="presentation"
        >
          <div
            className="templates-modal"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
            ref={templatesModalRef}
          >
            <div className="templates-header">
              <h2 className="templates-title">Campaign Templates</h2>
              <button
                ref={templatesCloseButtonRef}
                onClick={() => setShowTemplates(false)}
                className="templates-close"
                aria-label="Close templates"
              >
                <RiCloseLine className="w-6 h-6" />
              </button>
            </div>
            <p className="templates-description">
              Start your adventure with a pre-configured campaign grid
            </p>
            <div className="templates-grid">
              {CAMPAIGN_TEMPLATES.map((template) => {
                const IconComponent = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="template-card"
                    aria-label={`Select ${template.name} template`}
                  >
                    <IconComponent className="template-icon" />
                    <h3 className="template-name">{template.name}</h3>
                    <p className="template-description">{template.description}</p>
                    <div className="template-specs">
                      {template.grid.width}×{template.grid.height} • {template.grid.cellSize}px
                      cells
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Styles extracted to src/styles/home-screen.css — see CLAUDE.md Task 5.2 */}
    </div>
  );
}
