import { useState, useRef, useEffect } from 'react';
import type React from 'react';

import type { Drawing } from '../../../types/domain';

interface UseCanvasDrawingReturn {
  isDrawing: React.MutableRefObject<boolean>;
  currentLine: React.MutableRefObject<Drawing | null>;
  tempLine: Drawing | null;
  setTempLine: React.Dispatch<React.SetStateAction<Drawing | null>>;
  /** Placeholder ref — Konva.Line removed; PixiJS mesh managed imperatively in PressureSensitiveLine */
  tempLineRef: React.MutableRefObject<null>;
  drawingAnimationFrameRef: React.MutableRefObject<number | null>;
  doorPreviewPos: { x: number; y: number } | null;
  setDoorPreviewPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  isMeasuring: React.MutableRefObject<boolean>;
  measurementStart: React.MutableRefObject<{ x: number; y: number } | null>;
  calibrationStart: React.MutableRefObject<{ x: number; y: number } | null>;
  calibrationRect: { x: number; y: number; width: number; height: number } | null;
  setCalibrationRect: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; width: number; height: number } | null>
  >;
}

/**
 * Manages drawing-related state and refs for canvas drawing tools.
 *
 * Groups all state used by marker/eraser/wall strokes, door preview,
 * measurement tracking, and calibration rectangle into a single hook.
 * The actual drawing logic lives in useCanvasInteraction — this hook
 * only holds the state that useCanvasInteraction needs as ref/state inputs.
 *
 * @returns Drawing state refs and state setters consumed by useCanvasInteraction
 */
export function useCanvasDrawing(): UseCanvasDrawingReturn {
  // Drawing tool refs (used by useCanvasInteraction for stroke tracking)
  const isDrawing = useRef(false);
  const currentLine = useRef<Drawing | null>(null);
  const [tempLine, setTempLine] = useState<Drawing | null>(null);
  // Konva.Line removed — PixiJS mesh managed imperatively in PressureSensitiveLine
  const tempLineRef = useRef<null>(null);
  const drawingAnimationFrameRef = useRef<number | null>(null);

  // Door tool preview position (snapped to grid)
  const [doorPreviewPos, setDoorPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Measurement tool state
  const isMeasuring = useRef(false);
  const measurementStart = useRef<{ x: number; y: number } | null>(null);

  // Calibration tool state
  const calibrationStart = useRef<{ x: number; y: number } | null>(null);
  const [calibrationRect, setCalibrationRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Cleanup: Cancel pending drawing animation frame on unmount
  useEffect(() => {
    return () => {
      if (drawingAnimationFrameRef.current) {
        cancelAnimationFrame(drawingAnimationFrameRef.current);
        drawingAnimationFrameRef.current = null;
      }
    };
  }, []);

  return {
    // Drawing refs
    isDrawing,
    currentLine,
    tempLine,
    setTempLine,
    tempLineRef,
    drawingAnimationFrameRef,
    // Door preview
    doorPreviewPos,
    setDoorPreviewPos,
    // Measurement
    isMeasuring,
    measurementStart,
    // Calibration
    calibrationStart,
    calibrationRect,
    setCalibrationRect,
  };
}
