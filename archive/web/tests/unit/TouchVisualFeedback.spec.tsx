/**
 * Component Tests for TouchVisualFeedback
 *
 * Tests the TouchVisualFeedback component including:
 * - Pressure indicator rendering
 * - Touch point indicators
 * - Gesture mode feedback
 * - Settings-based visibility
 * - Edge cases and null handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TouchVisualFeedback from '../../src/components/Canvas/TouchVisualFeedback';
import { useTouchSettingsStore } from '../../src/store/touchSettingsStore';

describe('TouchVisualFeedback', () => {
  const defaultProps = {
    pressure: null,
    pointerPosition: null,
    touchPoints: [],
    gestureMode: null as 'pan' | 'pinch' | null,
    containerBounds: { width: 800, height: 600 },
  };

  beforeEach(() => {
    // Reset settings to defaults
    const { resetToDefaults } = useTouchSettingsStore.getState();
    resetToDefaults();
  });

  describe('Pressure Indicator', () => {
    it('should render pressure indicator when pressure is active and setting enabled', () => {
      const props = {
        ...defaultProps,
        pressure: 0.5,
        pointerPosition: { x: 100, y: 100 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // Should render pressure circle and percentage
      const pressureText = container.textContent;
      expect(pressureText).toContain('50%'); // 0.5 * 100 = 50%
    });

    it('should not render pressure indicator when pressure is null', () => {
      const props = {
        ...defaultProps,
        pressure: null,
        pointerPosition: { x: 100, y: 100 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).not.toContain('%');
    });

    it('should not render pressure indicator when setting disabled', () => {
      const { updateSettings } = useTouchSettingsStore.getState();
      updateSettings({ showPressureIndicator: false });

      const props = {
        ...defaultProps,
        pressure: 0.75,
        pointerPosition: { x: 100, y: 100 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).not.toContain('75%');
    });

    it('should display correct pressure percentage', () => {
      const testCases = [
        { pressure: 0.0, expected: '0%' },
        { pressure: 0.25, expected: '25%' },
        { pressure: 0.5, expected: '50%' },
        { pressure: 0.75, expected: '75%' },
        { pressure: 1.0, expected: '100%' },
      ];

      testCases.forEach(({ pressure, expected }) => {
        const props = {
          ...defaultProps,
          pressure,
          pointerPosition: { x: 100, y: 100 },
        };

        const { container, unmount } = render(<TouchVisualFeedback {...props} />);
        expect(container.textContent).toContain(expected);
        unmount();
      });
    });

    it('should not render when pointerPosition is null', () => {
      const props = {
        ...defaultProps,
        pressure: 0.5,
        pointerPosition: null,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).not.toContain('50%');
    });
  });

  describe('Touch Point Indicators', () => {
    it('should render touch point indicators when enabled', () => {
      const props = {
        ...defaultProps,
        touchPoints: [
          { id: 1, x: 100, y: 100 },
          { id: 2, x: 200, y: 200 },
        ],
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // Should show numbered indicators
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
    });

    it('should not render touch points when setting disabled', () => {
      const { updateSettings } = useTouchSettingsStore.getState();
      updateSettings({ showTouchPointIndicators: false });

      const props = {
        ...defaultProps,
        touchPoints: [
          { id: 1, x: 100, y: 100 },
          { id: 2, x: 200, y: 200 },
        ],
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).not.toContain('1');
      expect(container.textContent).not.toContain('2');
    });

    it('should render connection line for two touch points', () => {
      const props = {
        ...defaultProps,
        touchPoints: [
          { id: 1, x: 100, y: 100 },
          { id: 2, x: 200, y: 200 },
        ],
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // Should have SVG line element
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();

      const line = container.querySelector('line');
      expect(line).toBeInTheDocument();
    });

    it('should not render connection line for single touch point', () => {
      const props = {
        ...defaultProps,
        touchPoints: [{ id: 1, x: 100, y: 100 }],
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      const line = container.querySelector('line');
      expect(line).not.toBeInTheDocument();
    });

    it('should not render connection line for more than two points', () => {
      const props = {
        ...defaultProps,
        touchPoints: [
          { id: 1, x: 100, y: 100 },
          { id: 2, x: 200, y: 200 },
          { id: 3, x: 300, y: 300 },
        ],
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // Should render 3 indicators but no line
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');

      const line = container.querySelector('line');
      expect(line).not.toBeInTheDocument();
    });

    it('should handle empty touch points array', () => {
      const props = {
        ...defaultProps,
        touchPoints: [],
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).toBe('');
    });
  });

  describe('Gesture Mode Feedback', () => {
    it('should render pan mode label when active', () => {
      const props = {
        ...defaultProps,
        gestureMode: 'pan' as const,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).toContain('Pan Mode');
    });

    it('should render pinch mode label when active', () => {
      const props = {
        ...defaultProps,
        gestureMode: 'pinch' as const,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).toContain('Pinch/Zoom Mode');
    });

    it('should not render gesture mode when null', () => {
      const props = {
        ...defaultProps,
        gestureMode: null,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).not.toContain('Mode');
    });

    it('should not render gesture mode when setting disabled', () => {
      const { updateSettings } = useTouchSettingsStore.getState();
      updateSettings({ showGestureFeedback: false });

      const props = {
        ...defaultProps,
        gestureMode: 'pan' as const,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).not.toContain('Pan Mode');
    });
  });

  describe('Multiple Indicators', () => {
    it('should render all active indicators simultaneously', () => {
      const props = {
        ...defaultProps,
        pressure: 0.5,
        pointerPosition: { x: 100, y: 100 },
        touchPoints: [
          { id: 1, x: 150, y: 150 },
          { id: 2, x: 250, y: 250 },
        ],
        gestureMode: 'pan' as const,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // Should show pressure indicator
      expect(container.textContent).toContain('50%');

      // Should show touch points
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');

      // Should show gesture mode
      expect(container.textContent).toContain('Pan Mode');
    });

    it('should handle partial indicator visibility based on settings', () => {
      const { updateSettings } = useTouchSettingsStore.getState();
      updateSettings({
        showPressureIndicator: true,
        showTouchPointIndicators: false,
        showGestureFeedback: false,
      });

      const props = {
        ...defaultProps,
        pressure: 0.5,
        pointerPosition: { x: 100, y: 100 },
        touchPoints: [{ id: 1, x: 150, y: 150 }],
        gestureMode: 'pan' as const,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // Only pressure should show
      expect(container.textContent).toContain('50%');
      expect(container.textContent).not.toContain('1');
      expect(container.textContent).not.toContain('Pan Mode');
    });
  });

  describe('Desktop-Only Mode', () => {
    it('should not render any indicators when desktop-only mode enabled', () => {
      const { updateSettings } = useTouchSettingsStore.getState();
      updateSettings({ desktopOnlyMode: true });

      const props = {
        ...defaultProps,
        pressure: 0.5,
        pointerPosition: { x: 100, y: 100 },
        touchPoints: [{ id: 1, x: 150, y: 150 }],
        gestureMode: 'pan' as const,
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // All indicators should be disabled
      expect(container.textContent).not.toContain('50%');
      expect(container.textContent).not.toContain('1');
      expect(container.textContent).not.toContain('Pan Mode');
    });
  });

  describe('Container Bounds', () => {
    it('should apply container bounds to root div', () => {
      const props = {
        ...defaultProps,
        containerBounds: { width: 1920, height: 1080 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      const rootDiv = container.firstChild as HTMLElement;

      expect(rootDiv.style.width).toBe('1920px');
      expect(rootDiv.style.height).toBe('1080px');
    });

    it('should handle small container bounds', () => {
      const props = {
        ...defaultProps,
        containerBounds: { width: 320, height: 240 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      const rootDiv = container.firstChild as HTMLElement;

      expect(rootDiv.style.width).toBe('320px');
      expect(rootDiv.style.height).toBe('240px');
    });
  });

  describe('Edge Cases', () => {
    it('should handle pressure value of 0', () => {
      const props = {
        ...defaultProps,
        pressure: 0,
        pointerPosition: { x: 100, y: 100 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).toContain('0%');
    });

    it('should handle pressure value of 1', () => {
      const props = {
        ...defaultProps,
        pressure: 1,
        pointerPosition: { x: 100, y: 100 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).toContain('100%');
    });

    it('should handle pointer position at origin', () => {
      const props = {
        ...defaultProps,
        pressure: 0.5,
        pointerPosition: { x: 0, y: 0 },
      };

      const { container } = render(<TouchVisualFeedback {...props} />);
      expect(container.textContent).toContain('50%');
    });

    it('should handle touch points with same coordinates', () => {
      const props = {
        ...defaultProps,
        touchPoints: [
          { id: 1, x: 100, y: 100 },
          { id: 2, x: 100, y: 100 },
        ],
      };

      const { container } = render(<TouchVisualFeedback {...props} />);

      // Should still render both points
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
    });
  });
});
