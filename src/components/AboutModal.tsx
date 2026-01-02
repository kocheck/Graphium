import { useState, useEffect, useRef } from 'react';
import { LogoIcon } from './LogoIcon';
import {
  RiLayoutGridLine,
  RiEyeOffLine,
  RiWindowLine,
  RiShieldLine,
  RiImageLine,
  RiPaletteLine,
} from '@remixicon/react';

export type AboutModalTab = 'about' | 'tutorial' | 'shortcuts';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AboutModalTab;
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
    border-radius: 4px;
    transition: all 0.2s;
  }
  .about-modal-close-btn:hover {
    background: var(--app-bg-hover);
    color: var(--app-text-primary);
  }
  .tab-button {
    padding: 0.5rem 1rem;
    border: none;
    background: none;
    color: var(--app-text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    font-weight: 500;
    transition: all 0.2s;
  }
  .tab-button:hover {
    color: var(--app-text-primary);
  }
  .tab-button.active {
    color: var(--app-accent-solid);
    border-bottom-color: var(--app-accent-solid);
  }

  /* ======================
     Screenshot Showcase
     ====================== */
  .screenshot-showcase {
    background: var(--app-bg-surface);
    border: 1px solid var(--app-border-subtle);
    border-radius: 16px;
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
    border-radius: 12px;
    overflow: hidden;
  }

  .screenshot-placeholder {
    background: var(--app-bg-base);
    border: 2px dashed var(--app-border-default);
    border-radius: 12px;
    padding: 4rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 300px;
    transition: all 0.3s;
  }

  .screenshot-placeholder:hover {
    border-color: var(--app-accent-solid);
    background: var(--app-bg-hover);
  }

  .placeholder-icon {
    width: 4rem;
    height: 4rem;
    color: var(--app-text-muted);
    opacity: 0.5;
  }

  .placeholder-text {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--app-text-secondary);
    margin: 0;
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
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    color: var(--app-accent-text);
  }

  /* ======================
     Feature Highlights
     ====================== */
  .feature-highlights {
    background: var(--app-bg-surface);
    border: 1px solid var(--app-border-subtle);
    border-radius: 16px;
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
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    transition: all 0.3s;
  }

  .feature-card:hover {
    border-color: var(--app-accent-solid);
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(139, 92, 246, 0.15);
  }

  .feature-icon-wrapper {
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 1rem;
    background: var(--app-accent-bg);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s;
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
export function AboutModal({ isOpen, onClose, initialTab = 'about' }: AboutModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<AboutModalTab>(initialTab);

  // Sync active tab with props when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Get all focusable elements
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // Guard: if no focusable elements exist, don't set up the trap
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement?.focus();

    // Handle tab key
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <style>{modalStyles}</style>
      <div
      className="about-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="about-modal-content"
        style={{
          background: 'var(--app-bg-surface)',
          color: 'var(--app-text-primary)',
          borderRadius: '12px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid var(--app-border-default)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close button */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--app-border-subtle)' }}>
          <button
            onClick={onClose}
            className="about-modal-close-btn"
            aria-label="Close About dialog"
          >
            ×
          </button>
          <div className="flex items-center gap-4">
             <LogoIcon size={80} />
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              className={`tab-button ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              About
            </button>
            <button
              className={`tab-button ${activeTab === 'tutorial' ? 'active' : ''}`}
              onClick={() => setActiveTab('tutorial')}
            >
              Tutorial
            </button>
            <button
              className={`tab-button ${activeTab === 'shortcuts' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              Shortcuts
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '2rem', overflow: 'auto' }}>

          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <div style={{ lineHeight: '1.7' }}>
              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
                  🎲 World Given Form
                </h3>
                 <p style={{ color: 'var(--app-text-secondary)', marginBottom: '0.75rem' }}>
                  Greetings, Master of Dungeons! <strong>Graphium</strong> (Latin: <em>graphium</em>, "a writing stylus") is your arcane battlemat—a
                  local-first virtual tabletop designed to replace your physical grid with digital sorcery.
                </p>
                <p style={{ color: 'var(--app-text-secondary)' }}>
                  Project your campaign map onto a second monitor or share your screen, maintaining <strong>total control</strong> over
                  what your players see while you orchestrate the chaos from your Architect's throne.
                </p>
              </section>

               <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
                  🌟 The Sacred Philosophy
                </h3>
                <p style={{ color: 'var(--app-text-secondary)' }}>
                  Graphium is a <strong>digital stylus</strong> for the discerning World Builder. It handles maps, tokens, and fog of war
                  without demanding tribute to corporate overlords. Your campaigns are stored locally in sacred <code>.graphium</code> tomes
                  that no cloud wizard can touch. Simple, powerful, and <em>yours</em>.
                </p>
              </section>

              <div
                style={{
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid var(--app-border-subtle)',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                }}
              >
                 <p style={{ color: 'var(--app-text-secondary)' }}>Version {__APP_VERSION__}</p>
                 <a
                  href="https://github.com/kocheck/Graphium"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--app-accent-text)',
                    textDecoration: 'underline',
                    fontWeight: 'bold',
                    display: 'block',
                    marginTop: '0.5rem',
                  }}
                >
                  View Source on GitHub
                </a>
              </div>
            </div>
          )}

          {/* TUTORIAL TAB */}
          {activeTab === 'tutorial' && (
            <div style={{ lineHeight: '1.7' }}>
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
                  ⚔️ Core Powers
                </h3>
                <ul style={{ color: 'var(--app-text-secondary)', paddingLeft: '1.5rem', margin: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Dual-Window Enchantment:</strong> Architect View for you, pristine World View for your players
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Fog of War:</strong> Dynamic vision with raycasting, wall occlusion, and blurred aesthetics
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Drawing Tools:</strong> Markers, erasers, and vision-blocking walls (Shift to lock axes!)
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Local-First:</strong> Your data stays <em>yours</em>—saved as <code>.graphium</code> files, no cloud required
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
                    <p className="feature-desc">
                      Markers, walls, doors, and tactical annotations
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <RiImageLine className="feature-icon" />
                    </div>
                    <h3 className="feature-name">Asset Library</h3>
                    <p className="feature-desc">
                      Drag-and-drop tokens with automatic optimization
                    </p>
                  </div>
                </div>
              </div>

              {/* Screenshot Showcase */}
              <div className="screenshot-showcase">
                <h2 className="showcase-title">See Graphium in Action</h2>
                <div className="showcase-grid">
                  <div className="showcase-item">
                    <div className="screenshot-placeholder">
                      <RiImageLine className="placeholder-icon" />
                      <p className="placeholder-text">Screenshot / GIF</p>
                      <p className="placeholder-caption">Dual-window architecture with fog of war</p>
                    </div>
                  </div>
                </div>
                <p className="showcase-note">
                  Add your screenshots, GIFs, or videos to <code>/public/screenshots/</code>
                </p>
              </div>
            </div>
          )}

          {/* SHORTCUTS TAB */}
          {activeTab === 'shortcuts' && (
            <div style={{ lineHeight: '1.7' }}>
              <section style={{ marginBottom: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
                  📜 Quick Start Incantations
                </h3>
                <div style={{ background: 'var(--app-bg-base)', padding: '1rem', borderRadius: '6px', fontSize: '0.95rem' }}>
                  <ul style={{ color: 'var(--app-text-muted)', paddingLeft: '1.5rem', margin: 0, fontFamily: 'monospace' }}>
                    <li><code>V</code> – Select Tool</li>
                    <li><code>M</code> – Marker Tool</li>
                    <li><code>E</code> – Eraser Tool</li>
                    <li><code>W</code> – Wall Tool (vision blocking)</li>
                    <li><code>I</code> – Color Picker</li>
                    <li><code>Shift</code> (while drawing) – Lock to axis</li>
                    <li><code>?</code> – Open this help modal</li>
                  </ul>
                </div>
              </section>
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--app-border-subtle)',
            textAlign: 'center',
            color: 'var(--app-text-muted)',
            fontSize: '0.85rem',
          }}
        >
          <p>May your rolls be ever in your favor, Dungeon Master. ⚔️🎲</p>
        </div>
      </div>
    </div>
    </>
  );
}
