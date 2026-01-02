/**
 * TouchVisualFeedback Component
 *
 * Provides real-time visual feedback for touch and stylus interactions:
 * - Pressure Indicator: Shows current stylus pressure as a scaling circle
 * - Touch Point Indicators: Shows all active touch points during multi-touch gestures
 * - Gesture Mode Feedback: Shows current gesture mode ("Pan Mode", "Pinch Mode")
 *
 * All feedback elements are controlled by user settings (useTouchSettingsStore).
 * Renders as a HUD overlay above the canvas.
 */

import { useMemo } from 'react';
import { useTouchSettingsStore } from '../../store/touchSettingsStore';

export interface TouchVisualFeedbackProps {
  /** Current pointer pressure (0.0 - 1.0), or null if not drawing */
  pressure: number | null;

  /** Current pointer position for pressure indicator */
  pointerPosition: { x: number; y: number } | null;

  /** Active touch points for multi-touch indicators */
  touchPoints: Array<{ id: number; x: number; y: number }>;

  /** Current gesture mode, if active */
  gestureMode: 'pan' | 'pinch' | null;

  /** Container bounds for positioning (canvas dimensions) */
  containerBounds: { width: number; height: number };
}

const TouchVisualFeedback = ({
  pressure,
  pointerPosition,
  touchPoints,
  gestureMode,
  containerBounds
}: TouchVisualFeedbackProps) => {
  const settings = useTouchSettingsStore();

  // Calculate pressure indicator size (10-40px based on pressure)
  const pressureIndicatorSize = useMemo(() => {
    if (!pressure) return 0;
    const minSize = 10;
    const maxSize = 40;
    return minSize + (pressure * (maxSize - minSize));
  }, [pressure]);

  // Pressure indicator color changes with pressure (blue -> green -> red)
  const pressureIndicatorColor = useMemo(() => {
    if (!pressure) return '#3b82f6';

    if (pressure < 0.33) {
      // Low pressure: blue
      return '#3b82f6';
    } else if (pressure < 0.66) {
      // Medium pressure: green
      return '#10b981';
    } else {
      // High pressure: red
      return '#ef4444';
    }
  }, [pressure]);

  // Gesture mode label and color
  const gestureModeInfo = useMemo(() => {
    if (!gestureMode) return null;

    if (gestureMode === 'pan') {
      return { label: 'Pan Mode', color: '#3b82f6' };
    } else if (gestureMode === 'pinch') {
      return { label: 'Pinch/Zoom Mode', color: '#10b981' };
    }
    return null;
  }, [gestureMode]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50"
      style={{ width: containerBounds.width, height: containerBounds.height }}
    >
      {/* Pressure Indicator */}
      {settings.showPressureIndicator && pressure !== null && pointerPosition && (
        <div
          className="absolute transition-all duration-75"
          style={{
            left: pointerPosition.x + 30, // Offset from cursor
            top: pointerPosition.y - 30,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Pressure circle */}
          <div
            className="rounded-full opacity-80 border-2 border-white shadow-lg transition-all duration-75"
            style={{
              width: pressureIndicatorSize,
              height: pressureIndicatorSize,
              backgroundColor: pressureIndicatorColor,
            }}
          />

          {/* Pressure value text */}
          <div
            className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 text-xs font-mono px-2 py-0.5 rounded shadow-md whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
            }}
          >
            {(pressure * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Multi-Touch Point Indicators */}
      {settings.showTouchPointIndicators && touchPoints.length > 0 && (
        <>
          {touchPoints.map((point, index) => (
            <div
              key={point.id}
              className="absolute"
              style={{
                left: point.x,
                top: point.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Touch point circle */}
              <div
                className="rounded-full opacity-60 border-2 border-white shadow-lg"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#6366f1', // Indigo
                }}
              />

              {/* Touch point number */}
              <div
                className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm"
              >
                {index + 1}
              </div>
            </div>
          ))}

          {/* Connection line between two touch points */}
          {touchPoints.length === 2 && (
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: 'none' }}
            >
              <line
                x1={touchPoints[0].x}
                y1={touchPoints[0].y}
                x2={touchPoints[1].x}
                y2={touchPoints[1].y}
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.5"
              />
            </svg>
          )}
        </>
      )}

      {/* Gesture Mode Feedback */}
      {settings.showGestureFeedback && gestureModeInfo && (
        <div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg font-semibold text-sm animate-fade-in"
          style={{
            backgroundColor: gestureModeInfo.color,
            color: 'white',
          }}
        >
          {gestureModeInfo.label}
        </div>
      )}
    </div>
  );
};

export default TouchVisualFeedback;
