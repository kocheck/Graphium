import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Tooltip from './Tooltip';
import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';
import {
  getRecentCampaigns,
  addRecentCampaignWithPlatform,
  removeRecentCampaign,
  type RecentCampaign,
} from '../utils/recentCampaigns';
import { rollForMessage } from '../utils/systemMessages';
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
import { LogoLockup } from './LogoLockup';
import { AboutModal, type AboutModalTab } from './AboutModal';
import type { ThemeMode } from '../services/IStorageService';

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
export function HomeScreen({ onStartEditor }: HomeScreenProps) {
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [isElectron, setIsElectron] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isLinux, setIsLinux] = useState(false);
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
    return titles[Math.floor(Math.random() * titles.length)];
  });

  const loadCampaign = useGameStore((state) => state.loadCampaign);
  const showToast = useGameStore((state) => state.showToast);
  const showDungeonDialog = useGameStore((state) => state.showDungeonDialog);

  // Handler functions (defined before effects that use them)
  const handleNewCampaign = useCallback(() => {
    onStartEditor();
  }, [onStartEditor]);

  const handleLoadCampaign = useCallback(async () => {
    try {
      const storage = getStorage();
      const campaign = await storage.loadCampaign();

      if (campaign) {
        loadCampaign(campaign);
        addRecentCampaignWithPlatform(campaign.id, campaign.name);
        setRecentCampaigns(getRecentCampaigns());
        onStartEditor();
        showToast(rollForMessage('CAMPAIGN_LOAD_SUCCESS'), 'success');
      }
    } catch (error) {
      console.error('[HomeScreen] Failed to load campaign:', error);
      showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(error) }), 'error');
    }
  }, [loadCampaign, onStartEditor, showToast]);

  const handleGenerateDungeon = useCallback(() => {
    onStartEditor();
    // Small delay to ensure editor is rendered before opening dialog
    setTimeout(() => {
      showDungeonDialog();
    }, 100);
  }, [onStartEditor, showDungeonDialog]);

  // Load recent campaigns and detect platform on mount
  useEffect(() => {
    setRecentCampaigns(getRecentCampaigns());

    // Detect platform
    const storage = getStorage();
    const platform = storage.getPlatform();
    setIsElectron(platform === 'electron');

    // Load current theme mode
    storage
      .getThemeMode()
      .then((mode) => setCurrentTheme(mode))
      .catch(() => {});

    // Detect OS for download banners
    if (typeof navigator !== 'undefined') {
      const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData;
      const platformHint = uaData?.platform ?? '';
      const userAgent = navigator.userAgent ?? '';

      const isMacOS = platformHint.toLowerCase().includes('mac') || /mac/i.test(userAgent);
      const isWindowsOS = platformHint.toLowerCase().includes('win') || /win/i.test(userAgent);
      const isLinuxOS = platformHint.toLowerCase().includes('linux') || /linux/i.test(userAgent);

      setIsMac(isMacOS);
      setIsWindows(isWindowsOS);
      setIsLinux(isLinuxOS);
    }
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
    if (!showTemplates) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !templatesModalRef.current) return;

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
    const handleKeyPress = (e: KeyboardEvent) => {
      // Global shortcuts (Ctrl/Cmd + key)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === 'n') {
          e.preventDefault();
          handleNewCampaign();
        } else if (e.key === 'o') {
          e.preventDefault();
          handleLoadCampaign();
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

  const handleLoadRecent = async (_recent: RecentCampaign) => {
    showToast(
      'Recent campaigns are a reference list only right now. Use "Load Campaign" and select the matching .graphium file.',
      'info',
    );
  };

  const handleRemoveRecent = (campaignId: string) => {
    removeRecentCampaign(campaignId);
    setRecentCampaigns(getRecentCampaigns());
  };

  const handleDismissDownloadBanner = () => {
    localStorage.setItem('hideDownloadBanner', 'true');
    setHideDownloadBanner(true);
  };

  // NEW FEATURE HANDLERS

  const handleToggleLiteMode = () => {
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

  const handleToggleTheme = async () => {
    const storage = getStorage();
    const themes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];

    try {
      await storage.setThemeMode(nextTheme);
      setCurrentTheme(nextTheme);

      // Apply theme immediately for web (Electron handles via IPC)
      if (storage.getPlatform() === 'web') {
        const effectiveTheme =
          nextTheme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : nextTheme;
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
  };

  const handleSelectTemplate = (template: CampaignTemplate) => {
    setShowTemplates(false);

    // Set up new campaign with template settings
    const store = useGameStore.getState();
    store.resetToNewCampaign();
    // Note: Only cell size can be set via store. Grid width/height are reference
    // values - actual canvas size is determined by the uploaded map image.
    store.setGridSize(template.grid.cellSize);

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

  const getThemeIcon = () => {
    if (currentTheme === 'light') return <RiSunLine className="w-4 h-4" />;
    if (currentTheme === 'dark') return <RiMoonLine className="w-4 h-4" />;
    return <RiComputerLine className="w-4 h-4" />;
  };

  const getThemeLabel = () => {
    if (currentTheme === 'light') return 'Light';
    if (currentTheme === 'dark') return 'Dark';
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
                  <p>No campaigns match "{searchQuery}"</p>
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
        <div className="templates-overlay" onClick={() => setShowTemplates(false)}>
          <div
            className="templates-modal"
            onClick={(e) => e.stopPropagation()}
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

      <style>{`
        /* ======================
           Base Layout
           ====================== */
        .home-screen {
          position: relative;
          width: 100%;
          height: 100%; /* Changed from min-height: 100vh to constrain within global overflow:hidden */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start; /* Changed from center to allow scrolling from top */
          overflow-x: hidden;
          overflow-y: auto; /* Ensure vertical scrolling works */
          background: var(--app-bg-base);
          color: var(--app-text-primary);
          -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
          scroll-behavior: smooth; /* Smooth scrolling for anchor links and focus jumps */
          scroll-padding-bottom: 140px; /* Ensure scrolled-to elements aren't hidden behind footer */
        }

        /* ======================
           Animated Background
           ====================== */
        .bg-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          /* Removed hardcoded #050505 to respect theme background */
        }

        .bg-gradient {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          /* Monochrome + Blue Gradient using Theme Variables */
          background: radial-gradient(
            circle at 50% 30%,
            var(--blue-a3) 0%, /* Theme-aware blue alpha */
            transparent 60%
          ),
          radial-gradient(
            circle at 80% 10%,
            var(--slate-a3) 0%, /* Theme-aware slate alpha */
            transparent 40%
          );
          filter: blur(40px);
        }



        /* Subtle dot grid overlay */
        .grid-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          /* Increased opacity for visibility, using theme variable */
          background-image: radial-gradient(circle, var(--slate-a4) 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 1; /* Opacity handled by alpha var */
        }

        /* Paper noise texture overlay */
        .noise-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.08; /* Slightly visible texture */
          pointer-events: none;
          /* Removed blend-mode overlay which hides texture on dark backgrounds */
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
        }

        /* ======================
           Content Container
           ====================== */
        .content-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 800px;
          padding: 2rem;
          padding-bottom: 140px; /* Prevent overlap with fixed footer (footer height + safe margin) */
          margin: auto; /* Vertically center content if it fits, scroll if it doesn't */
          display: flex;
          flex-direction: column;
          gap: 2rem;
          animation: fadeInUp 0.8s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ======================
           Hero Section
           ====================== */
        .hero-section {
          text-align: center;
          margin-bottom: 1rem;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1.5rem;
          width: 100%;
          max-width: 420px;
          margin-left: auto;
          margin-right: auto;
          padding: 0 1.5rem; /* Ensure breathing room on small screens */
        }

        .logo {
          width: 100%;
          height: auto;
          max-width: 420px;
          filter: drop-shadow(0 4px 20px rgba(139, 92, 246, 0.3));
        }

        .hero-title {
          font-size: clamp(1.25rem, 2.5vw + 0.5rem, 1.75rem); /* Fluid typography: scales smoothly from 1.25rem to 1.75rem */
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: var(--app-text-primary);
          line-height: 1.3;
        }

        .hero-title .highlight {
          color: var(--app-accent-solid);
          font-weight: 700;
          position: relative;
          display: inline-block;
        }

        .hero-title .highlight::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, var(--app-accent-solid), transparent);
          opacity: 0.5;
        }

        .hero-subtitle {
          font-size: clamp(0.875rem, 1.5vw + 0.5rem, 1.125rem); /* Fluid typography */
          color: var(--app-text-secondary);
          font-style: italic;
        }

        /* ======================
           Download Banner (Multi-Platform)
           ====================== */
        .download-banner {
          background: var(--app-accent-bg);
          border: 1px solid var(--app-accent-solid);
          border-radius: 12px;
          padding: 1rem;
          position: relative;
          animation: slideIn 0.5s ease-out 0.3s both;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .dismiss-btn {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: var(--app-accent-text);
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          opacity: 0.6;
          transition: all 0.2s;
        }

        .dismiss-btn:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.1);
        }

        .banner-content {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .banner-icon {
          width: 2rem;
          height: 2rem;
          flex-shrink: 0;
          color: var(--app-accent-text);
        }

        .banner-text {
          flex: 1;
          padding-right: 1rem;
        }

        .banner-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--app-accent-text-contrast);
          margin-bottom: 0.25rem;
        }

        .banner-description {
          font-size: 0.875rem;
          color: var(--app-accent-text-contrast);
        }

        .banner-button {
          background: var(--app-accent-solid);
          color: var(--app-accent-solid-text);
          padding: 0.5rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .banner-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        /* ======================
           Action Cards
           ====================== */
        .action-cards {
          display: flex;
          flex-direction: row;
          justify-content: center;
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .action-card {
          position: relative;
          background: var(--app-bg-surface);
          border: 1px solid var(--app-border-default);
          border-radius: 12px;
          padding: 1rem 2rem;
          min-width: 180px;

          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;

          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--app-text-primary) !important;
          overflow: hidden; /* Ensure shimmer handles overflow correctly */
        }

        .action-card:hover {
          border-color: var(--app-accent-solid);
          background: var(--app-bg-subtle);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .action-card:active {
          transform: translateY(0);
        }

        .card-icon {
          width: 2rem;
          height: 2rem;
          color: var(--app-text-secondary); /* Grey by default */
          transition: color 0.2s;
        }

        .action-card:hover .card-icon {
          color: var(--app-accent-solid); /* Blue on hover */
        }

        .card-title {
          font-size: clamp(0.9375rem, 1.2vw + 0.6rem, 1rem); /* Fluid typography */
          font-weight: 600;
          color: var(--app-text-primary);
          z-index: 1; /* Ensure title is above shimmer */
        }

        /* Hover shimmer effect */
        .card-hover-effect {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            var(--slate-a3),
            transparent
          );
          transition: left 0.5s;
          pointer-events: none;
        }

        .action-card:hover .card-hover-effect {
          left: 100%;
        }

        /* ======================
           Quick Actions
           ====================== */
        .quick-actions {
          display: flex;
          justify-content: center;
        }

        .quick-action-btn {
          background: var(--app-bg-hover);
          border: 1px solid var(--app-border-subtle);
          color: var(--app-text-primary) !important;
          padding: 0.875rem 1.5rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quick-action-btn:hover {
          border-color: var(--app-accent-solid);
          color: var(--app-accent-text);
          transform: translateY(-2px);
        }



        /* ======================
           Recent Campaigns
           ====================== */
        .recent-campaigns {
          background: var(--app-bg-surface);
          border: 1px solid var(--app-border-subtle);
          border-radius: 16px;
          padding: 1.5rem;
        }

        .recent-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .recent-icon {
          width: 1.5rem;
          height: 1.5rem;
          color: var(--app-accent-solid);
        }

        .recent-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--app-text-primary);
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .recent-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--app-bg-base);
          border: 1px solid var(--app-border-subtle);
          border-radius: 10px;
          padding: 0.875rem;
          transition: all 0.2s;
        }

        .recent-item:hover {
          background: var(--app-bg-hover);
          border-color: var(--app-border-default);
          transform: translateX(4px);
        }

        .recent-button {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
          background: transparent;
          border: none;
          padding: 0;
          text-align: left;
          cursor: pointer;
          color: inherit;
        }

        .recent-item-icon {
          width: 1.25rem;
          height: 1.25rem;
          color: var(--app-text-secondary);
          flex-shrink: 0;
        }

        .recent-info {
          flex: 1;
        }

        .recent-name {
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--app-text-primary);
          margin-bottom: 0.125rem;
        }

        .recent-date {
          font-size: 0.8125rem;
          color: var(--app-text-muted);
        }

        .recent-remove {
          background: transparent;
          border: none;
          color: var(--app-text-muted);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 6px;
          opacity: 0;
          transition: all 0.2s;
        }

        .recent-item:hover .recent-remove {
          opacity: 1;
        }

        .recent-remove:hover {
          background: var(--app-bg-active);
          color: var(--app-text-primary);
        }

        /* ======================
           Footer
           ====================== */
        .footer {
          position: fixed;
          bottom: 1rem;
          left: 0;
          right: 0;
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .footer-links {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
        }

        .footer-link {
          color: var(--app-text-muted);
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
          font-size: inherit;
          transition: color 0.2s;
        }

        .footer-link:hover {
          color: var(--app-accent-text);
        }

        .footer-separator {
          color: var(--app-border-default);
        }

        .footer-version {
          font-size: clamp(0.75rem, 1vw + 0.4rem, 0.8125rem); /* Fluid typography */
          color: var(--app-text-muted);
        }

        .footer-icon-link {
          display: inline-flex !important;
          align-items: center;
          gap: 0.375rem;
        }

        .footer-link-label {
          font-size: 0.875rem;
        }

        /* ======================
           Recent Campaigns Search
           ====================== */
        .recent-search-container {
          position: relative;
          margin-bottom: 0.75rem;
        }

        .recent-search-container .search-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          width: 1.125rem;
          height: 1.125rem;
          color: var(--app-text-muted);
          pointer-events: none;
        }

        .recent-search {
          width: 100%;
          padding: 0.625rem 0.875rem 0.625rem 2.75rem;
          background: var(--app-bg-base);
          border: 1px solid var(--app-border-subtle);
          border-radius: 8px;
          color: var(--app-text-primary);
          font-size: 0.875rem;
          transition: border-color 0.2s;
        }

        .recent-search:focus {
          outline: none;
          border-color: var(--app-accent-solid);
        }

        .recent-search::placeholder {
          color: var(--app-text-muted);
        }

        .recent-empty {
          padding: 1.5rem;
          text-align: center;
          color: var(--app-text-muted);
          font-size: 0.875rem;
        }

        /* ======================
           Templates Modal
           ====================== */
        .templates-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .templates-modal {
          background: var(--app-bg-surface);
          border: 1px solid var(--app-border-default);
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 1.5rem;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .templates-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .templates-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--app-text-primary);
        }

        .templates-close {
          background: transparent;
          border: none;
          color: var(--app-text-muted);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .templates-close:hover {
          background: var(--app-bg-hover);
          color: var(--app-text-primary);
        }

        .templates-description {
          font-size: 0.9375rem;
          color: var(--app-text-secondary);
          margin-bottom: 1.5rem;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
        }

        .template-card {
          background: var(--app-bg-base);
          border: 1px solid var(--app-border-subtle);
          border-radius: 12px;
          padding: 1.25rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .template-card:hover {
          border-color: var(--app-accent-solid);
          background: var(--app-bg-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .template-icon {
          width: 3rem;
          height: 3rem;
          display: block;
          margin-left: auto;
          margin-right: auto;
          margin-bottom: 0.75rem;
          color: var(--blue-11); /* Theme-aware blue for icon color */
        }

        .template-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--app-text-primary);
          margin-bottom: 0.5rem;
        }

        .template-description {
          font-size: 0.875rem;
          color: var(--app-text-secondary);
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }

        .template-specs {
          font-size: 0.8125rem;
          color: var(--app-text-muted);
          font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
        }

        /* ======================
           Lite Mode Overrides
           ====================== */
        /* Disable performance-intensive features in Lite Mode */
        [data-lite-mode="true"] .bg-gradient,
        [data-lite-mode="true"] .grid-overlay,
        [data-lite-mode="true"] .noise-overlay {
          display: none;
        }

        [data-lite-mode="true"] .content-container {
          animation: none; /* Disable fadeInUp */
        }

        [data-lite-mode="true"] .download-banner {
          animation: none; /* Disable slideIn */
        }

        [data-lite-mode="true"] .card-hover-effect {
          display: none; /* Disable shimmer */
        }

        [data-lite-mode="true"] .logo {
          filter: none; /* Disable drop-shadow */
        }

        [data-lite-mode="true"] .action-card:hover,
        [data-lite-mode="true"] .template-card:hover {
          transform: none; /* Disable lift effect */
        }

        /* ======================
           Accessibility - Focus Indicators
           ====================== */
        /* Enhanced keyboard navigation focus indicators */
        .action-card:focus-visible,
        .quick-action-btn:focus-visible,
        .footer-link:focus-visible,
        .recent-button:focus-visible,
        .recent-remove:focus-visible,
        .recent-search:focus-visible,
        .banner-button:focus-visible,
        .dismiss-btn:focus-visible,
        .template-card:focus-visible,
        .templates-close:focus-visible {
          outline: 2px solid var(--app-accent-solid);
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Ensure focus is visible even with existing borders */
        .action-card:focus-visible,
        .template-card:focus-visible {
          outline-offset: 4px; /* Extra space to clear card border */
        }

        /* ======================
           Responsive
           ====================== */
        /* Tablet: 769px - 1024px */
        @media (min-width: 769px) and (max-width: 1024px) {
          .action-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .action-card:last-child {
            grid-column: 1 / -1;
            max-width: 50%;
            margin: 0 auto;
          }
        }

        /* Mobile: Up to 768px */
        @media (max-width: 768px) {
          .home-screen {
            min-height: 100vh; /* Fallback for browsers without dvh support */
            justify-content: flex-start; /* Allow natural scrolling instead of centering */
            padding: 2rem 0; /* Add vertical padding for spacing */
          }

          @supports (height: 100dvh) {
            .home-screen {
              min-height: 100dvh; /* Dynamic viewport height for mobile browsers */
            }
          }

          .content-container {
            padding: 0 1.5rem 2rem; /* Mobile: Footer is relative, no extra bottom padding needed */
            gap: 1.5rem;
            margin-bottom: 0; /* Remove margin to let footer spacing handle it */
          }

          .home-screen {
            scroll-padding-bottom: 0; /* Reset scroll padding on mobile */
          }

          .logo-container {
            max-width: 280px;
          }

          .hero-title {
            font-size: 1.375rem;
            line-height: 1.4;
          }

          .hero-subtitle {
            font-size: 0.875rem;
          }

          /* Action cards stack vertically on mobile */
          .action-cards {
            grid-template-columns: 1fr;
            gap: 0.875rem;
          }

          .action-card {
            padding: 1.5rem;
          }

          .card-title {
            font-size: 1.125rem;
          }

          .card-description {
            font-size: 0.8125rem;
          }

          /* Download banner improvements */
          .download-banner {
            padding: 1rem;
          }

          .banner-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.875rem;
          }

          .banner-text {
            padding-right: 0;
          }

          .banner-button {
            width: 100%;
            text-align: center;
            padding: 0.625rem 1.5rem;
          }

          .dismiss-btn {
            top: 0.5rem;
            right: 0.5rem;
          }

          /* Templates modal mobile */
          .templates-modal {
            padding: 1rem;
            max-height: 85vh;
          }

          .templates-grid {
            grid-template-columns: 1fr;
          }

          .footer-link-label {
            display: none; /* Hide labels on mobile to save space */
          }

          /* Recent campaigns */
          .recent-campaigns {
            padding: 1rem;
          }

          .recent-item {
            padding: 0.75rem;
          }

          /* Footer adjustments */
          .footer {
            position: relative;
            margin-top: 2rem;
            padding: 1rem;
            background: var(--app-bg-base);
          }

          .footer-links {
            font-size: 0.8125rem;
            gap: 0.5rem;
          }
        }

        /* Small mobile: Up to 480px */
        @media (max-width: 480px) {
          .home-screen {
            padding: 1.5rem 0; /* Reduce vertical padding on smaller screens */
          }

          .content-container {
            padding: 0 1rem 1.5rem; /* Tighter horizontal padding, natural bottom spacing */
            gap: 1.25rem; /* Reduce gap between sections */
          }

          .home-screen {
            scroll-padding-bottom: 0; /* No scroll padding needed on small mobile */
          }

          .logo-container {
            max-width: 200px; /* Smaller logo for small screens */
            margin-bottom: 1rem; /* Reduce bottom margin */
          }

          .hero-section {
            margin-bottom: 0.5rem; /* Reduce spacing */
          }

          .hero-title {
            font-size: 1.25rem;
          }

          .hero-subtitle {
            font-size: 0.8125rem;
            padding: 0 0.5rem;
          }

          .action-card {
            padding: 1rem; /* More compact padding */
          }

          .card-icon-wrapper {
            margin-bottom: 0.75rem; /* Reduce spacing */
          }

          .quick-action-btn {
            padding: 0.625rem 0.875rem; /* More compact */
            font-size: 0.8125rem;
          }

          .footer-links {
            flex-wrap: wrap;
            justify-content: center;
            line-height: 2;
          }

          .footer-separator {
            display: none;
          }

          .footer-version {
            font-size: 0.75rem;
          }

          /* Make touch targets larger on mobile */
          .action-card,
          .quick-action-btn,
          .recent-button {
            min-height: 44px; /* iOS recommended minimum touch target */
          }
        }

        /* Very small mobile: Up to 360px */
        @media (max-width: 360px) {
          .home-screen {
            padding: 1rem 0; /* Minimal vertical padding */
          }

          .content-container {
            padding: 0 0.875rem 1rem; /* Very tight padding, natural bottom spacing */
            gap: 1rem; /* Minimal gap */
          }

          .home-screen {
            scroll-padding-bottom: 0; /* No scroll padding needed on extra small */
          }

          .logo-container {
            max-width: 180px; /* Even smaller logo */
            margin-bottom: 0.75rem;
          }

          .hero-title {
            font-size: 1.125rem;
            margin-bottom: 0.5rem;
          }

          .hero-subtitle {
            font-size: 0.75rem; /* Smaller subtitle */
          }

          .card-title {
            font-size: 1rem;
          }

          .card-description {
            font-size: 0.75rem; /* Smaller description */
          }

          .action-card {
            padding: 0.875rem; /* Very compact cards */
            min-height: 44px; /* Maintain minimum touch target height */
          }

          .quick-action-btn {
            min-height: 44px; /* Preserve touch target size for quick action buttons */
          }

          .banner-icon {
            width: 1.5rem;
            height: 1.5rem;
          }

          .footer {
            margin-top: 1.5rem; /* Less top margin */
            padding: 0.75rem; /* Compact footer */
          }
        }
      `}</style>
    </div>
  );
}
