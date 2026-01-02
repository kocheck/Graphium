import { useState, useEffect } from 'react';
import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';
import { getRecentCampaigns, addRecentCampaignWithPlatform, removeRecentCampaign, type RecentCampaign } from '../utils/recentCampaigns';
import { rollForMessage } from '../utils/systemMessages';
import {
  RiDownloadCloudLine,
  RiAddLine,
  RiFolderOpenLine,
  RiFileTextLine,
  RiCloseLine,
  RiInformationLine,
  RiSwordLine,
  RiMapPinLine,
  RiDiceLine,
  RiLayoutGridLine,
} from '@remixicon/react';
import { LogoLockup } from './LogoLockup';
import { AboutModal, type AboutModalTab } from './AboutModal';

interface HomeScreenProps {
  onStartEditor: () => void;
}

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
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aboutInitialTab, setAboutInitialTab] = useState<AboutModalTab>('about');
  const [hideMacBanner, setHideMacBanner] = useState(() =>
    localStorage.getItem('hideMacBanner') === 'true'
  );

  // Random inclusive subtitle (stable for session)
  const [subtitle] = useState(() => {
    const titles = [
      "Storytellers", "World Builders", "Game Guides", "Adventure Architects",
      "Keepers of Lore", "Dice Rollers", "Party Leaders", "Campaign Curators",
      "Narrative Weavers", "Fantasy Facilitators", "Myth Makers", "Legend Spinners",
      "Plot Twisters", "Tabletop Tacticians", "Grid Guardians", "Scene Setters",
      "Roleplay Referees", "Quest Givers", "Map Makers", "Saga Shapers",
      "Chroniclers", "Chaos Coordinators", "Rules Lawyers (The Good Kind)"
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  });

  const loadCampaign = useGameStore((state) => state.loadCampaign);
  const showToast = useGameStore((state) => state.showToast);
  const showDungeonDialog = useGameStore((state) => state.showDungeonDialog);

  // Load recent campaigns and detect platform on mount
  useEffect(() => {
    setRecentCampaigns(getRecentCampaigns());

    // Detect platform
    const storage = getStorage();
    const platform = storage.getPlatform();
    setIsElectron(platform === 'electron');

    // Detect macOS for download banner
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
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isAboutOpen) {
        e.preventDefault();
        setAboutInitialTab('shortcuts');
        setIsAboutOpen(true);
      }
      if (e.key === 'Escape' && isAboutOpen) {
        setIsAboutOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAboutOpen]);

  const handleNewCampaign = () => {
    onStartEditor();
  };

  const handleLoadCampaign = async () => {
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
  };

  const handleLoadRecent = async (_recent: RecentCampaign) => {
    showToast(
      'Recent campaigns are a reference list only right now. Use "Load Campaign" and select the matching .graphium file.',
      'info'
    );
  };

  const handleRemoveRecent = (campaignId: string) => {
    removeRecentCampaign(campaignId);
    setRecentCampaigns(getRecentCampaigns());
  };

  const handleDismissMacBanner = () => {
    localStorage.setItem('hideMacBanner', 'true');
    setHideMacBanner(true);
  };

  const handleGenerateDungeon = () => {
    onStartEditor();
    // Small delay to ensure editor is rendered before opening dialog
    setTimeout(() => {
      showDungeonDialog();
    }, 100);
  };

  return (
    <div className="home-screen">
      {/* CSS-only background with animated geometric shapes */}
      <div className="bg-container">
        <div className="bg-gradient"></div>

        <div className="grid-overlay"></div>
      </div>

      {/* Main Content */}
      <div className="content-container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="logo-container">
            <LogoLockup
              width={420}
              className="logo"
            />
          </div>
          <h1 className="hero-title">
            Virtual Tabletop for <span className="highlight">{subtitle}</span>
          </h1>
          <p className="hero-subtitle">
            Dual-window VTT with fog of war • Local-first, no subscriptions
          </p>
        </div>

        {/* Mac App Download Banner */}
        {!isElectron && isMac && !hideMacBanner && (
          <div className="mac-banner">
            <button
              onClick={handleDismissMacBanner}
              className="dismiss-btn"
              title="Don't show again"
              aria-label="Dismiss Mac download banner permanently"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
            <div className="banner-content">
              <RiDownloadCloudLine className="banner-icon" />
              <div className="banner-text">
                <h3 className="banner-title">Download the Mac App</h3>
                <p className="banner-description">
                  Get greater portability, offline support, and privacy with the native Mac application.
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
          <button
            onClick={handleNewCampaign}
            className="action-card"
            aria-label="Create a new campaign and start the editor"
            data-testid="new-campaign-button"
          >
            <div className="card-icon-wrapper">
              <RiAddLine className="card-icon" />
              <RiSwordLine className="card-decoration" />
            </div>
            <h2 className="card-title">New Campaign</h2>
            <p className="card-description">
              Start a fresh adventure with a blank canvas
            </p>
            <div className="card-hover-effect"></div>
          </button>

          <button
            onClick={handleLoadCampaign}
            className="action-card"
            aria-label="Load an existing campaign from a .graphium file"
          >
            <div className="card-icon-wrapper">
              <RiFolderOpenLine className="card-icon" />
              <RiMapPinLine className="card-decoration" />
            </div>
            <h2 className="card-title">Load Campaign</h2>
            <p className="card-description">
              Continue an existing campaign from a .graphium file
            </p>
            <div className="card-hover-effect"></div>
          </button>

          <button
            onClick={handleGenerateDungeon}
            className="action-card"
            aria-label="Generate a procedural dungeon and start the editor"
          >
            <div className="card-icon-wrapper">
              <RiLayoutGridLine className="card-icon" />
              <RiDiceLine className="card-decoration" />
            </div>
            <h2 className="card-title">Generate Dungeon</h2>
            <p className="card-description">
              Create a procedural dungeon with rooms and corridors
            </p>
            <div className="card-hover-effect"></div>
          </button>
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
            <div className="recent-list">
              {recentCampaigns.map((recent) => (
                <div
                  key={recent.id}
                  className="recent-item"
                >
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
          <a
            href="/design-system"
            className="footer-link"
            title="Internal component library (Dev)"
          >
            Design System
          </a>
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

      <style>{`
        /* ======================
           Base Layout
           ====================== */
        .home-screen {
          position: relative;
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow-x: hidden;
          overflow-y: auto; /* Ensure vertical scrolling works */
          background: var(--app-bg-base);
          color: var(--app-text-primary);
          -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
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
        }

        .bg-gradient {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(
            ellipse at 50% 20%,
            rgba(139, 92, 246, 0.12) 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse at 80% 70%,
            rgba(59, 130, 246, 0.08) 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse at 20% 80%,
            rgba(236, 72, 153, 0.08) 0%,
            transparent 50%
          );
          animation: gradientShift 20s ease-in-out infinite;
        }

        @keyframes gradientShift {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }



        /* Subtle grid overlay */
        .grid-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image:
            linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          opacity: 0.5;
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
        }

        .logo {
          width: 100%;
          height: auto;
          max-width: 420px;
          filter: drop-shadow(0 4px 20px rgba(139, 92, 246, 0.3));
          animation: logoFloat 3s ease-in-out infinite;
        }

        @keyframes logoFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .hero-title {
          font-size: 1.75rem;
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
          font-size: 1.125rem;
          color: var(--app-text-secondary);
          font-style: italic;
        }

        /* ======================
           Mac Banner
           ====================== */
        .mac-banner {
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
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .action-card {
          position: relative;
          background: var(--app-bg-surface);
          border: 2px solid var(--app-border-default);
          border-radius: 16px;
          padding: 2rem;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--app-text-primary) !important; /* Override button default color */
        }

        .action-card:hover {
          border-color: var(--app-accent-solid);
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 12px 30px rgba(139, 92, 246, 0.2);
        }

        .action-card:active {
          transform: translateY(-2px) scale(1.01);
        }

        /* Dice roll effect on click */
        .action-card:active .card-icon {
          animation: diceRoll 0.5s ease;
        }

        @keyframes diceRoll {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(90deg) scale(1.1);
          }
          50% {
            transform: rotate(180deg) scale(0.9);
          }
          75% {
            transform: rotate(270deg) scale(1.1);
          }
        }

        .card-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .card-icon {
          width: 2rem;
          height: 2rem;
          color: var(--app-accent-solid);
          transition: transform 0.3s;
        }

        .card-decoration {
          width: 1.25rem;
          height: 1.25rem;
          color: var(--app-text-muted);
          opacity: 0.4;
          transition: all 0.3s;
        }

        .action-card:hover .card-decoration {
          opacity: 1;
          transform: translateX(4px);
          color: var(--app-accent-solid);
        }

        .card-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--app-text-primary) !important;
          margin-bottom: 0.5rem;
        }

        .card-description {
          font-size: 0.875rem;
          color: var(--app-text-primary) !important;
          line-height: 1.5;
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
            rgba(139, 92, 246, 0.1),
            transparent
          );
          transition: left 0.5s;
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
          font-size: 0.8125rem;
          color: var(--app-text-muted);
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
            min-height: 100vh;
            min-height: 100dvh; /* Dynamic viewport height for mobile browsers */
            justify-content: flex-start; /* Allow natural scrolling instead of centering */
            padding: 2rem 0; /* Add vertical padding for spacing */
          }

          .content-container {
            padding: 0 1.5rem 2rem; /* Remove top/bottom, let parent handle it */
            gap: 1.5rem;
            margin-bottom: 0; /* Remove margin to let footer spacing handle it */
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

          /* Mac banner improvements */
          .mac-banner {
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
            padding: 0 1rem 1.5rem; /* Tighter horizontal padding */
            gap: 1.25rem; /* Reduce gap between sections */
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
            padding: 0 0.875rem 1rem; /* Very tight padding */
            gap: 1rem; /* Minimal gap */
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
