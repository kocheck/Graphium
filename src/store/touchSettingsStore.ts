import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Pressure curve affects how stylus pressure translates to stroke width
 * - light: More sensitive to light touches (0.2-2.0x width range)
 * - normal: Balanced sensitivity (0.3-1.5x width range, default)
 * - heavy: Requires more pressure for thick strokes (0.4-1.2x width range)
 */
export type PressureCurve = 'light' | 'normal' | 'heavy';

/**
 * Palm rejection strategy determines how to filter out accidental palm touches
 * - off: No palm rejection (accept all touches)
 * - touchSize: Reject touches with large contact area (width/height > threshold)
 * - stylusOnly: When stylus is detected, ignore all touch input
 * - smartDelay: Ignore touches for brief period after stylus lift
 */
export type PalmRejectionMode = 'off' | 'touchSize' | 'stylusOnly' | 'smartDelay';

/**
 * TouchSettings manages user preferences for touch and stylus input
 *
 * These settings persist across sessions and allow users to customize
 * the touch experience for their specific device and workflow.
 */
export interface TouchSettings {
  // --- Pressure Sensitivity ---
  /** Enable pressure-sensitive drawing (variable stroke width) */
  pressureSensitivityEnabled: boolean;

  /** Pressure curve affects sensitivity (light/normal/heavy) */
  pressureCurve: PressureCurve;

  // --- Gesture Configuration ---
  /** Distance change threshold (in pixels) to distinguish pinch from pan */
  pinchDistanceThreshold: number;

  /** Enable two-finger pan gesture (if false, only pinch-zoom works) */
  twoFingerPanEnabled: boolean;

  // --- Palm Rejection ---
  /** Palm rejection mode */
  palmRejectionMode: PalmRejectionMode;

  /** Minimum touch contact size to reject (in pixels, for 'touchSize' mode) */
  palmRejectionThreshold: number;

  /** Delay in ms to ignore touches after stylus lift (for 'smartDelay' mode) */
  palmRejectionDelay: number;

  // --- Input Mode ---
  /** Desktop-only mode: disable all touch input (useful for hybrid laptops) */
  desktopOnlyMode: boolean;

  // --- Advanced Stylus Features ---
  /** Enable tilt sensitivity for shading effects (requires tilt-capable stylus) */
  tiltSensitivityEnabled: boolean;

  /** Show hover preview when stylus is near but not touching (requires hover-capable stylus) */
  hoverPreviewEnabled: boolean;

  /** Enable barrel button support for quick tool switching */
  barrelButtonEnabled: boolean;

  // --- Visual Feedback ---
  /** Show real-time pressure indicator during drawing */
  showPressureIndicator: boolean;

  /** Show touch point indicators during multi-touch gestures */
  showTouchPointIndicators: boolean;

  /** Show gesture mode feedback (e.g., "Pan Mode" overlay) */
  showGestureFeedback: boolean;

  // --- Tutorial/Hints ---
  /** Show gesture tutorial on first launch */
  showGestureTutorial: boolean;

  /** Show tooltip hints for gestures */
  showGestureHints: boolean;
}

/**
 * TouchSettingsState includes settings data and actions to modify settings
 */
interface TouchSettingsState extends TouchSettings {
  // --- Actions ---
  updateSettings: (updates: Partial<TouchSettings>) => void;
  resetToDefaults: () => void;

  // --- Computed Helpers ---
  /** Get pressure multiplier range based on current curve */
  getPressureRange: () => { min: number; max: number };

  /**
   * Check if palm rejection logic should reject this pointer event.
   *
   * Accepts any PointerEvent (mouse, pen, or touch), but is primarily used
   * to filter out accidental palm or touch input based on the current
   * palmRejectionMode and related settings.
   *
   * NOTE: The 'smartDelay' mode is NOT handled by this function. It requires
   * timing state that must be managed by the caller (e.g., CanvasManager).
   * This function will return false for smartDelay mode.
   */
  shouldRejectTouch: (event: PointerEvent, stylusActive: boolean) => boolean;
}

/**
 * Default touch settings (optimized for most users)
 */
const defaultSettings: TouchSettings = {
  // Pressure
  pressureSensitivityEnabled: true,
  pressureCurve: 'normal',

  // Gestures
  pinchDistanceThreshold: 10,
  twoFingerPanEnabled: true,

  // Palm Rejection
  palmRejectionMode: 'touchSize',
  palmRejectionThreshold: 40, // Reject touches > 40px contact area
  palmRejectionDelay: 300, // 300ms delay after stylus lift

  // Input Mode
  desktopOnlyMode: false,

  // Advanced Stylus
  tiltSensitivityEnabled: true,
  hoverPreviewEnabled: true,
  barrelButtonEnabled: true,

  // Visual Feedback
  showPressureIndicator: true,
  showTouchPointIndicators: true,
  showGestureFeedback: true,

  // Tutorial
  showGestureTutorial: true, // Show once on first launch
  showGestureHints: true,
};

/**
 * useTouchSettingsStore provides global access to touch/stylus settings
 *
 * Settings are automatically persisted to localStorage.
 */
export const useTouchSettingsStore = create<TouchSettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      updateSettings: (updates) => {
        set((state) => ({ ...state, ...updates }));
      },

      resetToDefaults: () => {
        set(defaultSettings);
      },

      getPressureRange: () => {
        const curve = get().pressureCurve;
        switch (curve) {
          case 'light':
            return { min: 0.2, max: 2.0 }; // More dramatic variation
          case 'heavy':
            return { min: 0.4, max: 1.2 }; // Subtle variation
          case 'normal':
          default:
            return { min: 0.3, max: 1.5 }; // Balanced
        }
      },

      shouldRejectTouch: (event: PointerEvent, stylusActive: boolean) => {
        const settings = get();

        // Desktop-only mode rejects all touch
        if (settings.desktopOnlyMode && event.pointerType === 'touch') {
          return true;
        }

        // No rejection if mode is off
        if (settings.palmRejectionMode === 'off') {
          return false;
        }

        // Only process touch events (not pen/mouse)
        if (event.pointerType !== 'touch') {
          return false;
        }

        // Stylus-only mode: reject touch when stylus is active
        if (settings.palmRejectionMode === 'stylusOnly' && stylusActive) {
          return true;
        }

        // Touch size mode: reject large contact areas (palms)
        if (settings.palmRejectionMode === 'touchSize') {
          const width = event.width || 0;
          const height = event.height || 0;
          const maxDimension = Math.max(width, height);

          if (maxDimension > settings.palmRejectionThreshold) {
            return true;
          }
        }

        // Smart delay mode: NOT handled here - requires timing state managed by caller.
        // Caller (e.g., CanvasManager) must implement time-based rejection logic.
        // This function returns false to allow the event through to caller's timing check.

        return false;
      },
    }),
    {
      name: 'graphium-touch-settings', // localStorage key
      version: 1,
    },
  ),
);
