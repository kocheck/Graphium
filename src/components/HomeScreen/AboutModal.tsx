import { LogoIcon } from './LogoIcon';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * AboutModal - The Tome of Knowledge
 *
 * A modal explaining what Hyle is and how to use it,
 * written in the signature "Digital Dungeon Master" tone.
 */
export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
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
        className="about-modal-content"
        style={{
          background: 'var(--app-bg-surface)',
          color: 'var(--app-text-primary)',
          borderRadius: '12px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: '2rem',
          border: '2px solid var(--app-border-default)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--app-text-secondary)',
            width: '2rem',
            height: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--app-bg-hover)';
            e.currentTarget.style.color = 'var(--app-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--app-text-secondary)';
          }}
          aria-label="Close About dialog"
        >
          ×
        </button>

        {/* Header with logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <LogoIcon size={100} />
          </div>
          <h2
            style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, var(--app-accent-solid), var(--app-accent-text))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.5rem',
            }}
          >
            HYLE
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--app-text-secondary)', fontStyle: 'italic' }}>
            World Given Form
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--app-text-muted)', marginTop: '0.25rem' }}>
            Version {__APP_VERSION__}
          </p>
        </div>

        {/* Content */}
        <div style={{ lineHeight: '1.7' }}>
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
              🎲 What is Hyle?
            </h3>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: '0.75rem' }}>
              Greetings, Master of Dungeons! <strong>Hyle</strong> (from ancient Greek <em>ὕλη</em>: "matter") is your arcane battlemat—a
              local-first virtual tabletop designed to replace your physical grid with digital sorcery.
            </p>
            <p style={{ color: 'var(--app-text-secondary)' }}>
              Project your campaign map onto a second monitor or share your screen, maintaining <strong>total control</strong> over
              what your players see while you orchestrate the chaos from your Architect's throne.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
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
                <strong>Local-First:</strong> Your data stays <em>yours</em>—saved as <code>.hyle</code> files, no cloud required
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Asset Conjuration:</strong> Drag &amp; drop images, auto-optimized to WebP for performance
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>System Agnostic:</strong> Works with D&amp;D, Pathfinder, or homebrew systems—we don't judge
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
              📜 Quick Start Incantations
            </h3>
            <div style={{ background: 'var(--app-bg-base)', padding: '1rem', borderRadius: '6px', fontSize: '0.95rem' }}>
              <p style={{ color: 'var(--app-text-secondary)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Keyboard Shortcuts:
              </p>
              <ul style={{ color: 'var(--app-text-muted)', paddingLeft: '1.5rem', margin: 0, fontFamily: 'monospace' }}>
                <li><code>V</code> – Select Tool</li>
                <li><code>M</code> – Marker Tool</li>
                <li><code>E</code> – Eraser Tool</li>
                <li><code>W</code> – Wall Tool (vision blocking)</li>
                <li><code>I</code> – Color Picker</li>
                <li><code>Shift</code> (while drawing) – Lock to axis</li>
              </ul>
            </div>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
              🌟 The Sacred Philosophy
            </h3>
            <p style={{ color: 'var(--app-text-secondary)' }}>
              Hyle is a <strong>generic digital battlemat</strong>—no more, no less. It handles maps, tokens, and fog of war
              without demanding tribute to corporate overlords. Your campaigns are stored locally in sacred <code>.hyle</code> tomes
              that no cloud wizard can touch. Simple, powerful, and <em>yours</em>.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--app-accent-text)' }}>
              🔗 Seek Further Knowledge
            </h3>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: '0.5rem' }}>
              For documentation, bug reports, and source code, consult the Grand Repository:
            </p>
            <a
              href="https://github.com/kocheck/Hyle"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--app-accent-text)',
                textDecoration: 'underline',
                fontWeight: 'bold',
              }}
            >
              github.com/kocheck/Hyle
            </a>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
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
  );
}
