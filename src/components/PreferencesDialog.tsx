/**
 * Preferences Dialog Component
 *
 * Displays a modal dialog for configuring application preferences.
 * Currently includes Wall Tool settings for path smoothing and geometry fusing.
 *
 * **Features:**
 * - Modal overlay with focus trap
 * - Real-time preference updates
 * - Reset to defaults button
 * - Keyboard support (Escape to close)
 * - Accessible with ARIA attributes
 * - Persists settings to localStorage via Zustand
 *
 * **Wall Tool Preferences:**
 * - Path Smoothing (RDP algorithm) - Enable/disable and adjust epsilon
 * - Geometry Snapping/Fusing - Enable/disable and adjust snap threshold
 *
 * @component
 * @returns {JSX.Element | null} Preferences dialog or null if not active
 */

import { useEffect } from 'react';
import { usePreferencesStore } from '../store/preferencesStore';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesDialog = ({ isOpen, onClose }: PreferencesDialogProps) => {
  const { wallTool, setWallToolPreference, resetWallToolPreferences } = usePreferencesStore();

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

  const handleReset = () => {
    resetWallToolPreferences();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preferences-dialog-title"
    >
      <div
        className="bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2
            id="preferences-dialog-title"
            className="text-xl font-semibold"
            style={{ color: 'var(--app-text)' }}
          >
            Preferences
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none hover:opacity-70 transition"
            style={{ color: 'var(--app-text-muted)' }}
            aria-label="Close preferences"
          >
            ×
          </button>
        </div>

        {/* Wall Tool Section */}
        <section className="mb-6">
          <h3
            className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--app-border)]"
            style={{ color: 'var(--app-text)' }}
          >
            Wall Tool
          </h3>

          {/* Path Smoothing */}
          <div className="mb-6 p-4 bg-[var(--app-bg-subtle)] rounded">
            <div className="flex items-center justify-between mb-3">
              <label
                htmlFor="enable-smoothing"
                className="font-medium"
                style={{ color: 'var(--app-text)' }}
              >
                Path Smoothing
              </label>
              <input
                id="enable-smoothing"
                type="checkbox"
                checked={wallTool.enableSmoothing}
                onChange={(e) => setWallToolPreference('enableSmoothing', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--app-text-muted)' }}>
              Automatically smooths hand-drawn walls to eliminate jitter and improve Line of Sight
              calculations. Uses the Ramer-Douglas-Peucker algorithm.
            </p>

            {wallTool.enableSmoothing && (
              <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="smoothing-epsilon"
                    className="text-sm font-medium"
                    style={{ color: 'var(--app-text)' }}
                  >
                    Smoothing Intensity
                  </label>
                  <span
                    className="text-sm font-mono bg-[var(--app-bg)] px-2 py-1 rounded"
                    style={{ color: 'var(--app-text)' }}
                  >
                    {wallTool.smoothingEpsilon.toFixed(1)}px
                  </span>
                </div>
                <input
                  id="smoothing-epsilon"
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={wallTool.smoothingEpsilon}
                  onChange={(e) => setWallToolPreference('smoothingEpsilon', parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>
                  <span>Subtle (0.5)</span>
                  <span>Aggressive (10)</span>
                </div>
              </div>
            )}
          </div>

          {/* Geometry Snapping */}
          <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
            <div className="flex items-center justify-between mb-3">
              <label
                htmlFor="enable-snapping"
                className="font-medium"
                style={{ color: 'var(--app-text)' }}
              >
                Geometry Snapping
              </label>
              <input
                id="enable-snapping"
                type="checkbox"
                checked={wallTool.enableSnapping}
                onChange={(e) => setWallToolPreference('enableSnapping', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--app-text-muted)' }}>
              Automatically snaps new wall endpoints to existing walls when drawn nearby,
              creating clean, connected wall networks.
            </p>

            {wallTool.enableSnapping && (
              <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="snap-threshold"
                    className="text-sm font-medium"
                    style={{ color: 'var(--app-text)' }}
                  >
                    Snap Threshold
                  </label>
                  <span
                    className="text-sm font-mono bg-[var(--app-bg)] px-2 py-1 rounded"
                    style={{ color: 'var(--app-text)' }}
                  >
                    {wallTool.snapThreshold}px
                  </span>
                </div>
                <input
                  id="snap-threshold"
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={wallTool.snapThreshold}
                  onChange={(e) => setWallToolPreference('snapThreshold', parseInt(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>
                  <span>Precise (5px)</span>
                  <span>Loose (30px)</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Footer Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-[var(--app-border)]">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded bg-[var(--app-bg-subtle)] hover:bg-[var(--app-bg-hover)] transition text-sm"
            style={{ color: 'var(--app-text-muted)' }}
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition font-medium"
            autoFocus
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesDialog;
