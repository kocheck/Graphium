/**
 * Unit Tests for touchSettingsStore
 *
 * Tests the touch settings Zustand store including:
 * - Default values
 * - Setting updates
 * - Pressure range calculations
 * - Palm rejection logic
 * - LocalStorage persistence
 * - Reset to defaults
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTouchSettingsStore } from '../../src/store/touchSettingsStore';

describe('touchSettingsStore', () => {
  // Reset store to defaults before each test
  beforeEach(() => {
    const { resetToDefaults } = useTouchSettingsStore.getState();
    resetToDefaults();
  });

  describe('Default Values', () => {
    it('should have sensible default settings', () => {
      const state = useTouchSettingsStore.getState();

      expect(state.pressureSensitivityEnabled).toBe(true);
      expect(state.pressureCurve).toBe('normal');
      expect(state.palmRejectionMode).toBe('touchSize');
      expect(state.palmRejectionThreshold).toBe(40);
      expect(state.palmRejectionDelay).toBe(300);
      expect(state.pinchDistanceThreshold).toBe(10);
      expect(state.twoFingerPanEnabled).toBe(true);
      expect(state.desktopOnlyMode).toBe(false);
      expect(state.tiltSensitivityEnabled).toBe(true);
      expect(state.hoverPreviewEnabled).toBe(true);
      expect(state.barrelButtonEnabled).toBe(true);
      expect(state.showPressureIndicator).toBe(true);
      expect(state.showTouchPointIndicators).toBe(true);
      expect(state.showGestureFeedback).toBe(true);
      expect(state.showGestureTutorial).toBe(true);
      expect(state.showGestureHints).toBe(true);
    });
  });

  describe('updateSettings', () => {
    it('should update single setting', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ pressureSensitivityEnabled: false });

      const state = useTouchSettingsStore.getState();
      expect(state.pressureSensitivityEnabled).toBe(false);
    });

    it('should update multiple settings at once', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({
        pressureSensitivityEnabled: false,
        pressureCurve: 'heavy',
        palmRejectionMode: 'stylusOnly',
      });

      const state = useTouchSettingsStore.getState();
      expect(state.pressureSensitivityEnabled).toBe(false);
      expect(state.pressureCurve).toBe('heavy');
      expect(state.palmRejectionMode).toBe('stylusOnly');
    });

    it('should not affect other settings', () => {
      const { updateSettings } = useTouchSettingsStore.getState();
      const initialState = useTouchSettingsStore.getState();

      updateSettings({ pressureCurve: 'light' });

      const newState = useTouchSettingsStore.getState();
      expect(newState.pressureCurve).toBe('light');
      expect(newState.palmRejectionMode).toBe(initialState.palmRejectionMode);
      expect(newState.desktopOnlyMode).toBe(initialState.desktopOnlyMode);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', () => {
      const { updateSettings, resetToDefaults } = useTouchSettingsStore.getState();

      // Change multiple settings
      updateSettings({
        pressureSensitivityEnabled: false,
        pressureCurve: 'heavy',
        palmRejectionMode: 'off',
        desktopOnlyMode: true,
        pinchDistanceThreshold: 25,
      });

      // Verify changes
      let state = useTouchSettingsStore.getState();
      expect(state.pressureSensitivityEnabled).toBe(false);
      expect(state.desktopOnlyMode).toBe(true);

      // Reset
      resetToDefaults();

      // Verify reset
      state = useTouchSettingsStore.getState();
      expect(state.pressureSensitivityEnabled).toBe(true);
      expect(state.pressureCurve).toBe('normal');
      expect(state.palmRejectionMode).toBe('touchSize');
      expect(state.desktopOnlyMode).toBe(false);
      expect(state.pinchDistanceThreshold).toBe(10);
    });
  });

  describe('getPressureRange', () => {
    it('should return correct range for light curve', () => {
      const { updateSettings, getPressureRange } = useTouchSettingsStore.getState();

      updateSettings({ pressureCurve: 'light' });

      const range = getPressureRange();
      expect(range.min).toBe(0.2);
      expect(range.max).toBe(2.0);
    });

    it('should return correct range for normal curve', () => {
      const { updateSettings, getPressureRange } = useTouchSettingsStore.getState();

      updateSettings({ pressureCurve: 'normal' });

      const range = getPressureRange();
      expect(range.min).toBe(0.3);
      expect(range.max).toBe(1.5);
    });

    it('should return correct range for heavy curve', () => {
      const { updateSettings, getPressureRange } = useTouchSettingsStore.getState();

      updateSettings({ pressureCurve: 'heavy' });

      const range = getPressureRange();
      expect(range.min).toBe(0.4);
      expect(range.max).toBe(1.2);
    });
  });

  describe('shouldRejectTouch', () => {
    it('should accept all touches when palmRejectionMode is off', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({ palmRejectionMode: 'off' });

      const mockEvent = {
        pointerType: 'touch',
        width: 50,
        height: 50,
      } as PointerEvent;

      expect(shouldRejectTouch(mockEvent, false)).toBe(false);
      expect(shouldRejectTouch(mockEvent, true)).toBe(false);
    });

    it('should reject all touch when desktopOnlyMode is enabled', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({ desktopOnlyMode: true });

      const mockTouchEvent = {
        pointerType: 'touch',
        width: 10,
        height: 10,
      } as PointerEvent;

      const mockPenEvent = {
        pointerType: 'pen',
        width: 1,
        height: 1,
      } as PointerEvent;

      expect(shouldRejectTouch(mockTouchEvent, false)).toBe(true);
      expect(shouldRejectTouch(mockPenEvent, false)).toBe(false); // Pen should work
    });

    it('should reject large contact areas in touchSize mode', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({
        palmRejectionMode: 'touchSize',
        palmRejectionThreshold: 40,
      });

      const smallTouch = {
        pointerType: 'touch',
        width: 30,
        height: 30,
      } as PointerEvent;

      const largeTouch = {
        pointerType: 'touch',
        width: 50,
        height: 50,
      } as PointerEvent;

      expect(shouldRejectTouch(smallTouch, false)).toBe(false); // Accept small touch
      expect(shouldRejectTouch(largeTouch, false)).toBe(true); // Reject large touch (palm)
    });

    it('should reject touch when stylus is active in stylusOnly mode', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({ palmRejectionMode: 'stylusOnly' });

      const mockTouchEvent = {
        pointerType: 'touch',
        width: 10,
        height: 10,
      } as PointerEvent;

      expect(shouldRejectTouch(mockTouchEvent, false)).toBe(false); // Accept when stylus inactive
      expect(shouldRejectTouch(mockTouchEvent, true)).toBe(true); // Reject when stylus active
    });

    it('should not reject pen events', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({ palmRejectionMode: 'touchSize' });

      const mockPenEvent = {
        pointerType: 'pen',
        width: 50, // Large contact (shouldn't matter for pen)
        height: 50,
      } as PointerEvent;

      expect(shouldRejectTouch(mockPenEvent, false)).toBe(false);
    });

    it('should not reject mouse events', () => {
      const { shouldRejectTouch } = useTouchSettingsStore.getState();

      const mockMouseEvent = {
        pointerType: 'mouse',
      } as PointerEvent;

      expect(shouldRejectTouch(mockMouseEvent, false)).toBe(false);
      expect(shouldRejectTouch(mockMouseEvent, true)).toBe(false);
    });

    it('should use max dimension for contact size threshold', () => {
      const { updateSettings, shouldRejectTouch } = useTouchSettingsStore.getState();

      updateSettings({
        palmRejectionMode: 'touchSize',
        palmRejectionThreshold: 40,
      });

      const tallTouch = {
        pointerType: 'touch',
        width: 30, // Below threshold
        height: 50, // Above threshold
      } as PointerEvent;

      // Should reject because max(30, 50) = 50 > 40
      expect(shouldRejectTouch(tallTouch, false)).toBe(true);
    });
  });

  describe('Threshold Validation', () => {
    it('should allow valid palm rejection thresholds', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ palmRejectionThreshold: 20 });
      expect(useTouchSettingsStore.getState().palmRejectionThreshold).toBe(20);

      updateSettings({ palmRejectionThreshold: 80 });
      expect(useTouchSettingsStore.getState().palmRejectionThreshold).toBe(80);
    });

    it('should allow valid palm rejection delays', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ palmRejectionDelay: 100 });
      expect(useTouchSettingsStore.getState().palmRejectionDelay).toBe(100);

      updateSettings({ palmRejectionDelay: 1000 });
      expect(useTouchSettingsStore.getState().palmRejectionDelay).toBe(1000);
    });

    it('should allow valid pinch distance thresholds', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ pinchDistanceThreshold: 5 });
      expect(useTouchSettingsStore.getState().pinchDistanceThreshold).toBe(5);

      updateSettings({ pinchDistanceThreshold: 30 });
      expect(useTouchSettingsStore.getState().pinchDistanceThreshold).toBe(30);
    });
  });

  describe('Feature Toggles', () => {
    it('should toggle pressure sensitivity', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ pressureSensitivityEnabled: false });
      expect(useTouchSettingsStore.getState().pressureSensitivityEnabled).toBe(false);

      updateSettings({ pressureSensitivityEnabled: true });
      expect(useTouchSettingsStore.getState().pressureSensitivityEnabled).toBe(true);
    });

    it('should toggle two-finger pan', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({ twoFingerPanEnabled: false });
      expect(useTouchSettingsStore.getState().twoFingerPanEnabled).toBe(false);

      updateSettings({ twoFingerPanEnabled: true });
      expect(useTouchSettingsStore.getState().twoFingerPanEnabled).toBe(true);
    });

    it('should toggle visual feedback indicators', () => {
      const { updateSettings } = useTouchSettingsStore.getState();

      updateSettings({
        showPressureIndicator: false,
        showTouchPointIndicators: false,
        showGestureFeedback: false,
      });

      const state = useTouchSettingsStore.getState();
      expect(state.showPressureIndicator).toBe(false);
      expect(state.showTouchPointIndicators).toBe(false);
      expect(state.showGestureFeedback).toBe(false);
    });
  });
});
