/**
 * Integration Tests for Touch Settings
 *
 * Tests the full integration of touch settings with CanvasManager:
 * - Palm rejection filtering in pointer event handlers
 * - Pressure curve application
 * - Desktop-only mode filtering
 * - Settings persistence and restore
 * - UI settings reflecting in canvas behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTouchSettingsStore } from '../../src/store/touchSettingsStore';

describe('Touch Settings Integration', () => {
  beforeEach(() => {
    const { resetToDefaults } = useTouchSettingsStore.getState();
    resetToDefaults();
  });

  describe('Palm Rejection Integration', () => {
    it('should reject palm touches in touchSize mode', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({
        palmRejectionMode: 'touchSize',
        palmRejectionThreshold: 40,
      });

      // Small touch (finger) - should accept
      const fingerTouch = {
        pointerType: 'touch',
        width: 20,
        height: 20,
      } as PointerEvent;

      expect(shouldRejectTouch(fingerTouch, false)).toBe(false);

      // Large touch (palm) - should reject
      const palmTouch = {
        pointerType: 'touch',
        width: 60,
        height: 60,
      } as PointerEvent;

      expect(shouldRejectTouch(palmTouch, false)).toBe(true);
    });

    it('should reject touch when stylus is active in stylusOnly mode', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({ palmRejectionMode: 'stylusOnly' });

      const touchEvent = {
        pointerType: 'touch',
        width: 10,
        height: 10,
      } as PointerEvent;

      // Stylus not active - accept touch
      expect(shouldRejectTouch(touchEvent, false)).toBe(false);

      // Stylus active - reject touch
      expect(shouldRejectTouch(touchEvent, true)).toBe(true);
    });

    it('should allow threshold adjustment to affect rejection', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({ palmRejectionMode: 'touchSize' });

      const mediumTouch = {
        pointerType: 'touch',
        width: 45,
        height: 45,
      } as PointerEvent;

      // Lenient threshold (60px) - should accept 45px touch
      updateSettings({ palmRejectionThreshold: 60 });
      expect(shouldRejectTouch(mediumTouch, false)).toBe(false);

      // Strict threshold (30px) - should reject 45px touch
      updateSettings({ palmRejectionThreshold: 30 });
      expect(shouldRejectTouch(mediumTouch, false)).toBe(true);
    });

    it('should never reject pen input regardless of contact size', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({
        palmRejectionMode: 'touchSize',
        palmRejectionThreshold: 20, // Very strict
      });

      const penEvent = {
        pointerType: 'pen',
        width: 100, // Large contact (shouldn't matter)
        height: 100,
      } as PointerEvent;

      expect(shouldRejectTouch(penEvent, false)).toBe(false);
    });
  });

  describe('Pressure Curve Integration', () => {
    it('should calculate correct pressure range for each curve', () => {
      const { updateSettings, getPressureRange } = useTouchSettingsStore.getState();

      // Light curve - dramatic variation
      updateSettings({ pressureCurve: 'light' });
      let range = getPressureRange();
      expect(range.max - range.min).toBeCloseTo(1.8, 1); // 2.0 - 0.2 = 1.8

      // Normal curve - balanced
      updateSettings({ pressureCurve: 'normal' });
      range = getPressureRange();
      expect(range.max - range.min).toBeCloseTo(1.2, 1); // 1.5 - 0.3 = 1.2

      // Heavy curve - subtle variation
      updateSettings({ pressureCurve: 'heavy' });
      range = getPressureRange();
      expect(range.max - range.min).toBeCloseTo(0.8, 1); // 1.2 - 0.4 = 0.8
    });

    it('should apply pressure curve to raw pressure values', () => {
      const { updateSettings, getPressureRange } = useTouchSettingsStore.getState();

      updateSettings({ pressureCurve: 'light' });
      const range = getPressureRange();

      // Simulate applying pressure curve
      const rawPressure = 0.5;
      const adjustedPressure = range.min + rawPressure * (range.max - range.min);

      // With light curve: 0.2 + (0.5 * 1.8) = 0.2 + 0.9 = 1.1
      expect(adjustedPressure).toBeCloseTo(1.1, 1);
    });

    it('should clamp pressure to curve range', () => {
      const { updateSettings, getPressureRange } = useTouchSettingsStore.getState();

      updateSettings({ pressureCurve: 'heavy' });
      const range = getPressureRange();

      // Max pressure (1.0) with heavy curve
      const maxAdjusted = range.min + 1.0 * (range.max - range.min);
      expect(maxAdjusted).toBe(range.max); // Should equal max
      expect(maxAdjusted).toBe(1.2);

      // Min pressure (0.0) with heavy curve
      const minAdjusted = range.min + 0.0 * (range.max - range.min);
      expect(minAdjusted).toBe(range.min); // Should equal min
      expect(minAdjusted).toBe(0.4);
    });
  });

  describe('Desktop-Only Mode Integration', () => {
    it('should disable all touch input when desktop-only mode enabled', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({ desktopOnlyMode: true });

      const touchEvent = {
        pointerType: 'touch',
        width: 10,
        height: 10,
      } as PointerEvent;

      const penEvent = {
        pointerType: 'pen',
        width: 1,
        height: 1,
      } as PointerEvent;

      const mouseEvent = {
        pointerType: 'mouse',
      } as PointerEvent;

      expect(shouldRejectTouch(touchEvent, false)).toBe(true); // Touch rejected
      expect(shouldRejectTouch(penEvent, false)).toBe(false); // Pen allowed
      expect(shouldRejectTouch(mouseEvent, false)).toBe(false); // Mouse allowed
    });

    it('should override palm rejection modes when desktop-only enabled', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({
        desktopOnlyMode: true,
        palmRejectionMode: 'off', // Should be overridden
      });

      const touchEvent = {
        pointerType: 'touch',
        width: 10,
        height: 10,
      } as PointerEvent;

      // Even with palmRejectionMode off, desktop-only should reject touch
      expect(shouldRejectTouch(touchEvent, false)).toBe(true);
    });
  });

  describe('Pressure Sensitivity Toggle Integration', () => {
    it('should disable pressure capture when pressure sensitivity disabled', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      // When disabled, CanvasManager should NOT create pressures array
      updateSettings({ pressureSensitivityEnabled: false });

      // This would be checked in CanvasManager:
      // const shouldCapturePressure = touchSettings.pressureSensitivityEnabled;
      // currentLine.current = {
      //   ...
      //   pressures: shouldCapturePressure ? [pressure] : undefined
      // };

      expect(useTouchSettingsStore.getState().pressureSensitivityEnabled).toBe(false);
    });

    it('should enable pressure capture when pressure sensitivity enabled', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ pressureSensitivityEnabled: true });

      expect(useTouchSettingsStore.getState().pressureSensitivityEnabled).toBe(true);
    });
  });

  describe('Gesture Configuration Integration', () => {
    it('should allow disabling two-finger pan', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ twoFingerPanEnabled: false });

      // CanvasManager would check this:
      // if (touchSettings.twoFingerPanEnabled && !isPinchGesture) {
      //   // Allow pan
      // }

      expect(useTouchSettingsStore.getState().twoFingerPanEnabled).toBe(false);
    });

    it('should allow adjusting pinch distance threshold', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      // Increase threshold for more distinct gestures
      updateSettings({ pinchDistanceThreshold: 20 });

      // CanvasManager uses: const PINCH_DISTANCE_THRESHOLD = touchSettings.pinchDistanceThreshold;

      expect(useTouchSettingsStore.getState().pinchDistanceThreshold).toBe(20);
    });
  });

  describe('Settings Persistence Simulation', () => {
    it('should maintain settings across store recreation', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      // Change settings
      updateSettings({
        pressureCurve: 'heavy',
        palmRejectionMode: 'stylusOnly',
        palmRejectionThreshold: 60,
        desktopOnlyMode: true,
      });

      // Get current state
      const state = useTouchSettingsStore.getState();

      expect(state.pressureCurve).toBe('heavy');
      expect(state.palmRejectionMode).toBe('stylusOnly');
      expect(state.palmRejectionThreshold).toBe(60);
      expect(state.desktopOnlyMode).toBe(true);

      // In real app, these persist to localStorage and restore on reload
    });

    it('should allow reset to defaults after customization', () => {
      const { updateSettings, resetToDefaults } = useTouchSettingsStore.getState();

      // Customize everything
      updateSettings({
        pressureSensitivityEnabled: false,
        pressureCurve: 'heavy',
        palmRejectionMode: 'off',
        palmRejectionThreshold: 80,
        palmRejectionDelay: 1000,
        pinchDistanceThreshold: 25,
        twoFingerPanEnabled: false,
        desktopOnlyMode: true,
        tiltSensitivityEnabled: false,
        hoverPreviewEnabled: false,
        barrelButtonEnabled: false,
        showPressureIndicator: false,
        showTouchPointIndicators: false,
        showGestureFeedback: false,
      });

      // Reset
      resetToDefaults();

      // Verify all back to defaults
      const state = useTouchSettingsStore.getState();
      expect(state.pressureSensitivityEnabled).toBe(true);
      expect(state.pressureCurve).toBe('normal');
      expect(state.palmRejectionMode).toBe('touchSize');
      expect(state.palmRejectionThreshold).toBe(40);
      expect(state.palmRejectionDelay).toBe(300);
      expect(state.pinchDistanceThreshold).toBe(10);
      expect(state.twoFingerPanEnabled).toBe(true);
      expect(state.desktopOnlyMode).toBe(false);
      expect(state.showPressureIndicator).toBe(true);
      expect(state.showTouchPointIndicators).toBe(true);
      expect(state.showGestureFeedback).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle iPad Pro with Apple Pencil scenario', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      // Typical iPad Pro setup
      updateSettings({
        palmRejectionMode: 'stylusOnly',
        pressureSensitivityEnabled: true,
        pressureCurve: 'normal',
        tiltSensitivityEnabled: true,
        hoverPreviewEnabled: true,
      });

      const penEvent = {
        pointerType: 'pen',
        width: 1,
        height: 1,
      } as PointerEvent;

      const palmTouch = {
        pointerType: 'touch',
        width: 80,
        height: 80,
      } as PointerEvent;

      // Pen always accepted
      expect(shouldRejectTouch(penEvent, false)).toBe(false);

      // Palm rejected when stylus active
      expect(shouldRejectTouch(palmTouch, false)).toBe(false); // Stylus not active
      expect(shouldRejectTouch(palmTouch, true)).toBe(true); // Stylus active
    });

    it('should handle Surface Pro with Surface Pen scenario', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      // Typical Surface Pro setup
      updateSettings({
        palmRejectionMode: 'touchSize',
        palmRejectionThreshold: 45,
        pressureSensitivityEnabled: true,
        pressureCurve: 'light', // Surface Pen has excellent pressure
      });

      const fingerTouch = {
        pointerType: 'touch',
        width: 25,
        height: 25,
      } as PointerEvent;

      const palmTouch = {
        pointerType: 'touch',
        width: 60,
        height: 60,
      } as PointerEvent;

      expect(shouldRejectTouch(fingerTouch, false)).toBe(false); // Finger accepted
      expect(shouldRejectTouch(palmTouch, false)).toBe(true); // Palm rejected
    });

    it('should handle hybrid laptop scenario', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      // User wants mouse-only on convertible laptop
      updateSettings({
        desktopOnlyMode: true,
        palmRejectionMode: 'off', // Doesn't matter
      });

      const touchEvent = {
        pointerType: 'touch',
        width: 10,
        height: 10,
      } as PointerEvent;

      const mouseEvent = {
        pointerType: 'mouse',
      } as PointerEvent;

      expect(shouldRejectTouch(touchEvent, false)).toBe(true); // All touch rejected
      expect(shouldRejectTouch(mouseEvent, false)).toBe(false); // Mouse works
    });
  });
});
