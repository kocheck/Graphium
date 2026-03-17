/**
 * useToolState — Tool selection, drawing mode, and tool keyboard shortcuts
 *
 * Manages the active tool (select/marker/eraser/wall/door/measure),
 * marker colors, door orientation, wall color/thickness, and measurement mode.
 * Registers keyboard shortcuts for tool switching (V, M, E, W, D, R, I, arrows).
 *
 * @see src/App.tsx for the consumer
 * @see src/components/Canvas/CanvasManager.tsx for tool behavior
 */

import { useState, useEffect, useRef } from 'react';

import { useGameStore } from '../store/gameStore';

import type { HexColor, PixelSize } from '../types/domain';

// eslint-disable-next-line import/no-unused-modules
export type ToolType = 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
// eslint-disable-next-line import/no-unused-modules
export type MeasurementMode = 'ruler' | 'blast' | 'cone';
// eslint-disable-next-line import/no-unused-modules
export type DoorOrientation = 'horizontal' | 'vertical';

interface UseToolStateOptions {
  /** Whether the current window is the Architect (DM) view */
  isArchitectView: boolean;
}

export interface UseToolStateReturn {
  // Tool selection
  tool: ToolType;
  setTool: (tool: ToolType) => void;

  // Marker colors
  color: HexColor;
  setColor: (color: HexColor) => void;
  handleColorChange: (newColor: HexColor) => void;
  recentColors: HexColor[];
  colorInputRef: React.RefObject<HTMLInputElement>;

  // Door state
  doorOrientation: DoorOrientation;
  setDoorOrientation: React.Dispatch<React.SetStateAction<DoorOrientation>>;

  // Wall tool color and stroke width — applied to both manual canvas drawing
  // and procedural dungeon generation (DungeonGeneratorDialog)
  wallColor: HexColor;
  setWallColor: (color: HexColor) => void;
  wallSize: PixelSize;
  setWallSize: (size: PixelSize) => void;

  // Measurement state
  measurementMode: MeasurementMode;
  setMeasurementMode: (mode: MeasurementMode) => void;
  broadcastMeasurement: boolean;
  setBroadcastMeasurement: (broadcast: boolean) => void;
}

export function useToolState({ isArchitectView }: UseToolStateOptions): UseToolStateReturn {
  // Active tool (controls CanvasManager behavior)
  const [tool, setTool] = useState<ToolType>('select');

  // Marker color state
  const [color, setColor] = useState<HexColor>('#df4b26' as HexColor);
  const [recentColors, setRecentColors] = useState<HexColor[]>([
    '#df4b26' as HexColor,
    '#3b82f6' as HexColor,
    '#22c55e' as HexColor,
  ]);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = (newColor: HexColor): void => {
    setColor(newColor);
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== newColor.toLowerCase());
      return [newColor, ...filtered].slice(0, 3);
    });
  };

  // Door orientation
  const [doorOrientation, setDoorOrientation] = useState<DoorOrientation>('horizontal');

  // Wall tool color and stroke width
  const [wallColor, setWallColor] = useState<HexColor>('#ff0000' as HexColor);
  const [wallSize, setWallSize] = useState<PixelSize>(8 as PixelSize);

  // Measurement mode
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('ruler');
  const broadcastMeasurement = useGameStore((state) => state.broadcastMeasurement);
  const setBroadcastMeasurement = useGameStore((state) => state.setBroadcastMeasurement);
  const setActiveMeasurement = useGameStore((state) => state.setActiveMeasurement);

  // Clear active measurement when mode changes to prevent confusion
  useEffect(() => {
    setActiveMeasurement(null);
  }, [measurementMode, setActiveMeasurement]);

  // Tool keyboard shortcuts (Architect View only)
  useEffect(() => {
    if (!isArchitectView) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Arrow keys toggle door orientation
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (tool === 'door') {
          e.preventDefault();
          setDoorOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 'm':
          setTool('marker');
          break;
        case 'e':
          setTool('eraser');
          break;
        case 'w':
          setTool('wall');
          break;
        case 'd':
          setTool('door');
          break;
        case 'r':
          // If door tool is active, rotate door orientation
          // Otherwise, switch to measure tool
          if (tool === 'door') {
            setDoorOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
          } else {
            setTool('measure');
          }
          break;
        case 'i':
          colorInputRef.current?.click();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isArchitectView, tool]);

  return {
    tool,
    setTool,
    color,
    setColor,
    handleColorChange,
    recentColors,
    colorInputRef,
    doorOrientation,
    setDoorOrientation,
    wallColor,
    setWallColor,
    wallSize,
    setWallSize,
    measurementMode,
    setMeasurementMode,
    broadcastMeasurement,
    setBroadcastMeasurement,
  };
}
