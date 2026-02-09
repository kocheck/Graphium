/**
 * Preferences Dialog Component
 *
 * Displays a modal dialog for configuring application preferences.
 * Uses the Dialog primitive for overlay, focus trap, and ARIA attributes.
 *
 * **Features:**
 * - Real-time preference updates
 * - Reset to defaults button
 * - Keyboard support (Escape to close via Dialog)
 * - Accessible with ARIA attributes (via Dialog)
 * - Persists settings to localStorage via Zustand
 *
 * **Wall Tool Preferences:**
 * - Path Smoothing (RDP algorithm) - Enable/disable and adjust epsilon
 * - Geometry Snapping/Fusing - Enable/disable and adjust snap threshold
 *
 * @component
 * @returns {JSX.Element | null} Preferences dialog or null if not active
 */

import { usePreferencesStore } from '../../store/preferencesStore';
import { useTouchSettingsStore } from '../../store/touchSettingsStore';
import Button from '../primitives/Button';
import Dialog from '../primitives/Dialog';

import type { PressureCurve, PalmRejectionMode } from '../../store/touchSettingsStore';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const { wallTool, setWallToolPreference, resetWallToolPreferences } = usePreferencesStore();
  const touchSettings = useTouchSettingsStore();

  const handleReset = () => {
    resetWallToolPreferences();
    touchSettings.resetToDefaults();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Preferences"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleReset} className="mr-auto">
            Reset to Defaults
          </Button>
          <Button variant="primary" onClick={onClose} autoFocus>
            Done
          </Button>
        </>
      }
    >
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
                onChange={(e) =>
                  setWallToolPreference('smoothingEpsilon', parseFloat(e.target.value))
                }
                className="w-full cursor-pointer"
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--app-text-muted)' }}
              >
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
            Automatically snaps new wall endpoints to existing walls when drawn nearby, creating
            clean, connected wall networks.
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
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--app-text-muted)' }}
              >
                <span>Precise (5px)</span>
                <span>Loose (30px)</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Touch & Stylus Section */}
      <section className="mb-6">
        <h3
          className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--app-border)]"
          style={{ color: 'var(--app-text)' }}
        >
          Touch & Stylus
        </h3>

        {/* Desktop-Only Mode */}
        <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="desktop-only-mode"
              className="font-medium"
              style={{ color: 'var(--app-text)' }}
            >
              Desktop-Only Mode
            </label>
            <input
              id="desktop-only-mode"
              type="checkbox"
              checked={touchSettings.desktopOnlyMode}
              onChange={(e) => touchSettings.updateSettings({ desktopOnlyMode: e.target.checked })}
              className="w-5 h-5 cursor-pointer"
            />
          </div>
          <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
            Disable all touch input (useful for hybrid laptops to prevent accidental touches). Only
            mouse and trackpad input will work.
          </p>
        </div>

        {/* Pressure Sensitivity */}
        <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="pressure-sensitivity"
              className="font-medium"
              style={{ color: 'var(--app-text)' }}
            >
              Pressure-Sensitive Drawing
            </label>
            <input
              id="pressure-sensitivity"
              type="checkbox"
              checked={touchSettings.pressureSensitivityEnabled}
              onChange={(e) =>
                touchSettings.updateSettings({ pressureSensitivityEnabled: e.target.checked })
              }
              className="w-5 h-5 cursor-pointer"
              disabled={touchSettings.desktopOnlyMode}
            />
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--app-text-muted)' }}>
            Vary stroke width based on stylus pressure (requires pressure-capable pen or stylus).
            Lighter touch = thin lines, heavier touch = thick lines.
          </p>

          {touchSettings.pressureSensitivityEnabled && !touchSettings.desktopOnlyMode && (
            <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="pressure-curve"
                  className="text-sm font-medium"
                  style={{ color: 'var(--app-text)' }}
                >
                  Pressure Curve
                </label>
                <span
                  className="text-sm font-mono bg-[var(--app-bg)] px-2 py-1 rounded capitalize"
                  style={{ color: 'var(--app-text)' }}
                >
                  {touchSettings.pressureCurve}
                </span>
              </div>
              <select
                id="pressure-curve"
                value={touchSettings.pressureCurve}
                onChange={(e) =>
                  touchSettings.updateSettings({ pressureCurve: e.target.value as PressureCurve })
                }
                className="w-full px-3 py-2 rounded bg-[var(--app-bg)] border border-[var(--app-border)] cursor-pointer"
                style={{ color: 'var(--app-text)' }}
              >
                <option value="light">Light (0.2-2.0× width range)</option>
                <option value="normal">Normal (0.3-1.5× width range)</option>
                <option value="heavy">Heavy (0.4-1.2× width range)</option>
              </select>
              <p className="text-xs mt-2" style={{ color: 'var(--app-text-muted)' }}>
                Light = More dramatic variation • Heavy = Subtle variation
              </p>
            </div>
          )}
        </div>

        {/* Palm Rejection */}
        <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="palm-rejection"
              className="font-medium"
              style={{ color: 'var(--app-text)' }}
            >
              Palm Rejection
            </label>
            <select
              id="palm-rejection"
              value={touchSettings.palmRejectionMode}
              onChange={(e) =>
                touchSettings.updateSettings({
                  palmRejectionMode: e.target.value as PalmRejectionMode,
                })
              }
              className="px-3 py-1.5 rounded bg-[var(--app-bg)] border border-[var(--app-border)] cursor-pointer text-sm"
              style={{ color: 'var(--app-text)' }}
              disabled={touchSettings.desktopOnlyMode}
            >
              <option value="off">Off</option>
              <option value="touchSize">Touch Size</option>
              <option value="stylusOnly">Stylus Only</option>
              <option value="smartDelay">Smart Delay</option>
            </select>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--app-text-muted)' }}>
            Prevent accidental palm touches when using a stylus on tablets.
          </p>

          {touchSettings.palmRejectionMode === 'touchSize' && !touchSettings.desktopOnlyMode && (
            <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="palm-threshold"
                  className="text-sm font-medium"
                  style={{ color: 'var(--app-text)' }}
                >
                  Contact Size Threshold
                </label>
                <span
                  className="text-sm font-mono bg-[var(--app-bg)] px-2 py-1 rounded"
                  style={{ color: 'var(--app-text)' }}
                >
                  {touchSettings.palmRejectionThreshold}px
                </span>
              </div>
              <input
                id="palm-threshold"
                type="range"
                min="20"
                max="80"
                step="5"
                value={touchSettings.palmRejectionThreshold}
                onChange={(e) =>
                  touchSettings.updateSettings({
                    palmRejectionThreshold: parseInt(e.target.value),
                  })
                }
                className="w-full cursor-pointer"
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--app-text-muted)' }}
              >
                <span>Lenient (20px)</span>
                <span>Strict (80px)</span>
              </div>
            </div>
          )}

          {touchSettings.palmRejectionMode === 'smartDelay' && !touchSettings.desktopOnlyMode && (
            <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="palm-delay"
                  className="text-sm font-medium"
                  style={{ color: 'var(--app-text)' }}
                >
                  Touch Delay After Stylus
                </label>
                <span
                  className="text-sm font-mono bg-[var(--app-bg)] px-2 py-1 rounded"
                  style={{ color: 'var(--app-text)' }}
                >
                  {touchSettings.palmRejectionDelay}ms
                </span>
              </div>
              <input
                id="palm-delay"
                type="range"
                min="100"
                max="1000"
                step="50"
                value={touchSettings.palmRejectionDelay}
                onChange={(e) =>
                  touchSettings.updateSettings({ palmRejectionDelay: parseInt(e.target.value) })
                }
                className="w-full cursor-pointer"
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--app-text-muted)' }}
              >
                <span>Quick (100ms)</span>
                <span>Conservative (1000ms)</span>
              </div>
            </div>
          )}
        </div>

        {/* Gesture Configuration */}
        <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="two-finger-pan"
              className="font-medium"
              style={{ color: 'var(--app-text)' }}
            >
              Two-Finger Pan Gesture
            </label>
            <input
              id="two-finger-pan"
              type="checkbox"
              checked={touchSettings.twoFingerPanEnabled}
              onChange={(e) =>
                touchSettings.updateSettings({ twoFingerPanEnabled: e.target.checked })
              }
              className="w-5 h-5 cursor-pointer"
              disabled={touchSettings.desktopOnlyMode}
            />
          </div>
          <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
            Enable two-finger panning alongside pinch-zoom. When disabled, only pinch-zoom works.
          </p>
        </div>

        {/* Advanced Stylus Features */}
        <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
          <h4 className="font-medium mb-3" style={{ color: 'var(--app-text)' }}>
            Advanced Stylus Features
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="tilt-sensitivity"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Tilt Sensitivity (shading effects)
              </label>
              <input
                id="tilt-sensitivity"
                type="checkbox"
                checked={touchSettings.tiltSensitivityEnabled}
                onChange={(e) =>
                  touchSettings.updateSettings({ tiltSensitivityEnabled: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="hover-preview"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Hover Preview (cursor before touching)
              </label>
              <input
                id="hover-preview"
                type="checkbox"
                checked={touchSettings.hoverPreviewEnabled}
                onChange={(e) =>
                  touchSettings.updateSettings({ hoverPreviewEnabled: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="barrel-button"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Barrel Button Support (quick tool switch)
              </label>
              <input
                id="barrel-button"
                type="checkbox"
                checked={touchSettings.barrelButtonEnabled}
                onChange={(e) =>
                  touchSettings.updateSettings({ barrelButtonEnabled: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>
          </div>
        </div>

        {/* Visual Feedback */}
        <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
          <h4 className="font-medium mb-3" style={{ color: 'var(--app-text)' }}>
            Visual Feedback
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="pressure-indicator"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Show Pressure Indicator
              </label>
              <input
                id="pressure-indicator"
                type="checkbox"
                checked={touchSettings.showPressureIndicator}
                onChange={(e) =>
                  touchSettings.updateSettings({ showPressureIndicator: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="touch-indicators"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Show Touch Point Indicators
              </label>
              <input
                id="touch-indicators"
                type="checkbox"
                checked={touchSettings.showTouchPointIndicators}
                onChange={(e) =>
                  touchSettings.updateSettings({ showTouchPointIndicators: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="gesture-feedback"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Show Gesture Mode Feedback
              </label>
              <input
                id="gesture-feedback"
                type="checkbox"
                checked={touchSettings.showGestureFeedback}
                onChange={(e) =>
                  touchSettings.updateSettings({ showGestureFeedback: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>
          </div>
        </div>

        {/* Tutorial & Hints */}
        <div className="mb-4 p-4 bg-[var(--app-bg-subtle)] rounded">
          <h4 className="font-medium mb-3" style={{ color: 'var(--app-text)' }}>
            Tutorial & Hints
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="gesture-tutorial"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Show Gesture Tutorial
              </label>
              <input
                id="gesture-tutorial"
                type="checkbox"
                checked={touchSettings.showGestureTutorial}
                onChange={(e) =>
                  touchSettings.updateSettings({ showGestureTutorial: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="gesture-hints"
                className="text-sm"
                style={{ color: 'var(--app-text)' }}
              >
                Show Tooltip Hints
              </label>
              <input
                id="gesture-hints"
                type="checkbox"
                checked={touchSettings.showGestureHints}
                onChange={(e) =>
                  touchSettings.updateSettings({ showGestureHints: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
                disabled={touchSettings.desktopOnlyMode}
              />
            </div>
          </div>
        </div>
      </section>
    </Dialog>
  );
}

export default PreferencesDialog;
