import { useState, useEffect } from 'react';

import {
  RiLayoutGridLine,
  RiEyeOffLine,
  RiWindowLine,
  RiShieldLine,
  RiImageLine,
  RiPaletteLine,
} from '@remixicon/react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { LogoIcon } from './LogoIcon';

export type AboutModalTab = 'about' | 'tutorial' | 'shortcuts';

function toAboutModalTab(value: string): AboutModalTab {
  return value === 'tutorial' || value === 'shortcuts' ? value : 'about';
}

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AboutModalTab;
  onCheckForUpdates?: () => void;
}

// Add styles tag for modal-specific classes
const modalStyles = `
  .about-modal-close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--app-text-secondary);
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--app-radius-sm);
    transition: all var(--app-duration-fast) var(--app-ease-standard);
  }
  .about-modal-close-btn:hover {
    background: var(--app-bg-hover);
    color: var(--app-text-primary);
  }

  /* ======================
     Screenshot Showcase
     ====================== */
  .screenshot-showcase {
    background: var(--app-bg-surface);
    border: 1px solid var(--app-border-subtle);
    border-radius: var(--app-radius-lg);
    box-shadow: var(--app-elevation-low);
    padding: 2rem;
    text-align: center;
    margin-bottom: 2rem;
  }

  .showcase-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--app-text-primary);
    margin-bottom: 1.5rem;
  }

  .showcase-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .showcase-item {
    border-radius: var(--app-radius-md);
    overflow: hidden;
  }

  .placeholder-caption {
    font-size: 0.875rem;
    color: var(--app-text-muted);
    margin: 0;
  }

  .showcase-note {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--app-text-muted);
    font-style: italic;
  }

  .showcase-note code {
    background: var(--app-bg-base);
    padding: 0.125rem 0.5rem;
    border-radius: var(--app-radius-sm);
    font-family: 'Courier New', monospace;
    color: var(--app-accent-text);
  }

  /* ======================
     Feature Highlights
     ====================== */
  .feature-highlights {
    background: var(--app-bg-surface);
    border: 1px solid var(--app-border-subtle);
    border-radius: var(--app-radius-lg);
    box-shadow: var(--app-elevation-low);
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .features-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--app-text-primary);
    text-align: center;
    margin-bottom: 2rem;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .features-grid {
      grid-template-columns: 1fr;
    }
  }

  .feature-card {
    background: var(--app-bg-base);
    border: 1px solid var(--app-border-subtle);
    border-radius: var(--app-radius-md);
    padding: 1.5rem;
    text-align: center;
    transition: all var(--app-duration-fast) var(--app-ease-standard);
  }

  .feature-card:hover {
    border-color: var(--app-border-hover);
    box-shadow: var(--app-elevation-active);
  }

  .feature-icon-wrapper {
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 1rem;
    background: var(--app-accent-bg);
    border-radius: var(--app-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--app-duration-fast) var(--app-ease-standard);
  }

  .feature-card:hover .feature-icon-wrapper {
    transform: scale(1.1);
  }

  .feature-icon {
    width: 2rem;
    height: 2rem;
    color: var(--app-accent-solid);
  }

  .feature-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--app-text-primary);
    margin-bottom: 0.5rem;
  }

  .feature-desc {
    font-size: 0.875rem;
    color: var(--app-text-secondary);
    line-height: 1.5;
    margin: 0;
  }
`;

/**
 * AboutModal - The Tome of Knowledge
 *
 * A modal explaining what Graphium is and how to use it,
 * written in the signature "Digital Dungeon Master" tone.
 */
// eslint-disable-next-line max-lines-per-function
export function AboutModal({
  isOpen,
  onClose,
  initialTab = 'about',
  onCheckForUpdates,
}: AboutModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<AboutModalTab>(initialTab);

  // Sync active tab with props when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
        className="max-w-[700px] max-h-[85vh] flex flex-col p-0 rounded-lg"
        data-testid="dialog-about-root"
        showCloseButton={false}
      >
        <style>{modalStyles}</style>
        {/* Header with Close button */}
        <div className="p-6 border-b border-[var(--app-border-subtle)]">
          <button
            onClick={onClose}
            className="about-modal-close-btn"
            aria-label="Close About dialog"
          >
            ×
          </button>
          <DialogTitle className="sr-only">About Graphium</DialogTitle>
          <div className="flex items-center gap-4">
            <LogoIcon size={80} />
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(toAboutModalTab(value))}>
            <TabsList className="flex gap-2 mt-4">
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-auto">
          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="leading-[1.7]">
              <section className="mb-6">
                <h3 className="text-[1.3rem] font-bold mb-3 text-[var(--app-accent-text)]">
                  🎲 World Given Form
                </h3>
                <p className="text-[var(--app-text-secondary)] mb-3">
                  Greetings, Master of Dungeons! <strong>Graphium</strong> (Latin: <em>graphium</em>
                  , &quot;a writing stylus&quot;) is your arcane battlemat—a local-first virtual
                  tabletop designed to replace your physical grid with digital sorcery.
                </p>
                <p className="text-[var(--app-text-secondary)]">
                  Project your campaign map onto a second monitor or share your screen, maintaining{' '}
                  <strong>total control</strong> over what your players see while you orchestrate
                  the chaos from your Architect&apos;s throne.
                </p>
              </section>

              <section className="mb-6">
                <h3 className="text-[1.3rem] font-bold mb-3 text-[var(--app-accent-text)]">
                  🌟 The Sacred Philosophy
                </h3>
                <p className="text-[var(--app-text-secondary)]">
                  Graphium is a <strong>digital stylus</strong> for the discerning World Builder. It
                  handles maps, tokens, and fog of war without demanding tribute to corporate
                  overlords. Your campaigns are stored locally in sacred <code>.graphium</code>{' '}
                  tomes that no cloud wizard can touch. Simple, powerful, and <em>yours</em>.
                </p>
              </section>

              <div className="mt-8 pt-6 border-t border-[var(--app-border-subtle)] text-center text-[0.9rem]">
                <p className="text-[var(--app-text-secondary)]">Version {__APP_VERSION__}</p>

                {/* Consult the Archives button (Electron only) */}
                {onCheckForUpdates && (
                  <button
                    onClick={onCheckForUpdates}
                    disabled={!onCheckForUpdates}
                    className="mt-4 px-4 py-2 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-solid-text)] rounded-md font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Consult the Archives
                  </button>
                )}

                <a
                  href="https://github.com/kocheck/Graphium"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--app-accent-text)] underline font-bold block mt-2"
                >
                  View Source on GitHub
                </a>
              </div>
            </div>
          )}

          {/* TUTORIAL TAB */}
          {activeTab === 'tutorial' && (
            <div className="leading-[1.7]">
              <section className="mb-8">
                <h3 className="text-[1.3rem] font-bold mb-3 text-[var(--app-accent-text)]">
                  ⚔️ Core Powers
                </h3>
                <ul className="text-[var(--app-text-secondary)] pl-6 m-0">
                  <li className="mb-2">
                    <strong>Dual-Window Enchantment:</strong> Architect View for you, pristine World
                    View for your players
                  </li>
                  <li className="mb-2">
                    <strong>Fog of War:</strong> Dynamic vision with raycasting, wall occlusion, and
                    blurred aesthetics
                  </li>
                  <li className="mb-2">
                    <strong>Drawing Tools:</strong> Markers, erasers, and vision-blocking walls
                    (Shift to lock axes!)
                  </li>
                  <li className="mb-2">
                    <strong>Local-First:</strong> Your data stays <em>yours</em>—saved as{' '}
                    <code>.graphium</code> files, no cloud required
                  </li>
                </ul>
              </section>

              {/* Feature Highlights */}
              <div className="feature-highlights">
                <h2 className="features-title">Designed for Dungeon Masters</h2>
                <div className="features-grid">
                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiWindowLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Dual Windows</h3>
                    <p className="feature-desc">
                      Architect view for you, clean world view for players
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiEyeOffLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Fog of War</h3>
                    <p className="feature-desc">
                      Hardware-accelerated raycasting with dynamic vision
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiLayoutGridLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Dungeon Generator</h3>
                    <p className="feature-desc">
                      Procedural dungeons with rooms, corridors, and doors
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiShieldLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Local-First</h3>
                    <p className="feature-desc">
                      Your campaigns live on your drive, no cloud required
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiPaletteLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Drawing Tools</h3>
                    <p className="feature-desc">Markers, walls, doors, and tactical annotations</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiImageLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Asset Library</h3>
                    <p className="feature-desc">Drag-and-drop tokens with automatic optimization</p>
                  </div>
                </div>
              </div>

              {/* Screenshot Showcase */}
              <div className="screenshot-showcase">
                <h2 className="showcase-title">See Graphium in Action</h2>
                <div className="showcase-grid">
                  {[
                    {
                      src: '/screenshots/Graphium-show.gif',
                      caption: 'Dual-window architecture with fog of war',
                    },
                    {
                      src: '/screenshots/Graphium-1.png',
                      caption: 'Dynamic lighting and shadows',
                    },
                    { src: '/screenshots/Graphium-2.png', caption: 'Asset library management' },
                    { src: '/screenshots/Graphium-3.png', caption: 'Detailed map editing' },
                    { src: '/screenshots/Graphium-4.png', caption: 'Token customization' },
                  ].map((img, index) => (
                    <div key={index} className="showcase-item">
                      <img
                        src={img.src}
                        alt={img.caption}
                        className="w-full h-auto block border-b border-[var(--app-border-subtle)]"
                      />
                      <div className="p-4 bg-[var(--app-bg-base)]">
                        <p className="placeholder-caption m-0">{img.caption}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="showcase-note">
                  Add your screenshots, GIFs, or videos to <code>/public/screenshots/</code>
                </p>
              </div>
            </div>
          )}

          {/* SHORTCUTS TAB */}
          {activeTab === 'shortcuts' && (
            <div className="leading-[1.7]">
              <section className="mb-6">
                <h3 className="text-[1.3rem] font-bold mb-3 text-[var(--app-accent-text)]">
                  📜 Quick Start Incantations
                </h3>
                <div className="bg-[var(--app-bg-base)] p-4 rounded-md text-[0.95rem]">
                  <ul className="text-[var(--app-text-muted)] pl-6 m-0 font-mono">
                    <li>
                      <code>V</code> – Select Tool
                    </li>
                    <li>
                      <code>M</code> – Marker Tool
                    </li>
                    <li>
                      <code>E</code> – Eraser Tool
                    </li>
                    <li>
                      <code>W</code> – Wall Tool (vision blocking)
                    </li>
                    <li>
                      <code>I</code> – Color Picker
                    </li>
                    <li>
                      <code>Shift</code> (while drawing) – Lock to axis
                    </li>
                    <li>
                      <code>?</code> – Open this help modal
                    </li>
                  </ul>
                </div>
              </section>

              {/* Feature Highlights */}
              <div className="feature-highlights">
                <h2 className="features-title">Designed for Dungeon Masters</h2>
                <div className="features-grid">
                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiWindowLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Dual Windows</h3>
                    <p className="feature-desc">
                      Architect view for you, clean world view for players
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiEyeOffLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Fog of War</h3>
                    <p className="feature-desc">
                      Hardware-accelerated raycasting with dynamic vision
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiLayoutGridLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Dungeon Generator</h3>
                    <p className="feature-desc">
                      Procedural dungeons with rooms, corridors, and doors
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiShieldLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Local-First</h3>
                    <p className="feature-desc">
                      Your campaigns live on your drive, no cloud required
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiPaletteLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Drawing Tools</h3>
                    <p className="feature-desc">Markers, walls, doors, and tactical annotations</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiImageLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Asset Library</h3>
                    <p className="feature-desc">Drag-and-drop tokens with automatic optimization</p>
                  </div>
                </div>
              </div>

              {/* Screenshot Showcase */}
              <div className="screenshot-showcase">
                <h2 className="showcase-title">See Graphium in Action</h2>
                <div className="showcase-grid">
                  {[
                    {
                      src: '/screenshots/Graphium-show.gif',
                      caption: 'Dual-window architecture with fog of war',
                    },
                    {
                      src: '/screenshots/Graphium-1.png',
                      caption: 'Dynamic lighting and shadows',
                    },
                    { src: '/screenshots/Graphium-2.png', caption: 'Asset library management' },
                    { src: '/screenshots/Graphium-3.png', caption: 'Detailed map editing' },
                    { src: '/screenshots/Graphium-4.png', caption: 'Token customization' },
                  ].map((img, index) => (
                    <div key={index} className="showcase-item">
                      <img
                        src={img.src}
                        alt={img.caption}
                        className="w-full h-auto block border-b border-[var(--app-border-subtle)]"
                      />
                      <div className="p-4 bg-[var(--app-bg-base)]">
                        <p className="placeholder-caption m-0">{img.caption}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="showcase-note">
                  Add your screenshots, GIFs, or videos to <code>/public/screenshots/</code>
                </p>
              </div>
            </div>
          )}

          {/* SHORTCUTS TAB */}
          {activeTab === 'shortcuts' && (
            <div className="leading-[1.7]">
              <section className="mb-6">
                <h3 className="text-[1.3rem] font-bold mb-3 text-[var(--app-accent-text)]">
                  📜 Quick Start Incantations
                </h3>
                <div className="bg-[var(--app-bg-base)] p-4 rounded-md text-[0.95rem]">
                  <ul className="text-[var(--app-text-muted)] pl-6 m-0 font-mono">
                    <li>
                      <code>V</code> – Select Tool
                    </li>
                    <li>
                      <code>M</code> – Marker Tool
                    </li>
                    <li>
                      <code>E</code> – Eraser Tool
                    </li>
                    <li>
                      <code>W</code> – Wall Tool (vision blocking)
                    </li>
                    <li>
                      <code>I</code> – Color Picker
                    </li>
                    <li>
                      <code>Shift</code> (while drawing) – Lock to axis
                    </li>
                    <li>
                      <code>?</code> – Open this help modal
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--app-border-subtle)] text-center text-[var(--app-text-muted)] text-[0.85rem]">
          <p>May your rolls be ever in your favor, Dungeon Master. ⚔️🎲</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
