import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';

import Konva from 'konva';

import { useCanvasInteraction } from './useCanvasInteraction';

import type { Measurement } from '../../../types/measurement';
import type { Drawing } from '../../../store/gameStore';
import type { GridCell } from '../../../types/grid';

vi.mock('../../../store/touchSettingsStore', () => ({
  useTouchSettingsStore: () => ({
    desktopOnlyMode: false,
    palmRejectionMode: 'off',
    palmRejectionDelay: 0,
    pressureSensitivityEnabled: false,
    shouldRejectTouch: () => false,
  }),
}));

vi.mock('../../../store/preferencesStore', () => ({
  usePreferencesStore: (selector: (s: { wallTool: Record<string, unknown> }) => unknown) =>
    selector({
      wallTool: {
        enableSmoothing: false,
        enableSnapping: false,
        smoothingEpsilon: 3,
        snapThreshold: 10,
        minPoints: 2,
      },
    }),
}));

function createPointerEvent(
  overrides: Partial<{
    x: number;
    y: number;
    shiftKey: boolean;
  }> = {},
  findResults: any[] = [],
) {
  const pos = { x: overrides.x ?? 100, y: overrides.y ?? 100 };
  return {
    evt: {
      pointerType: 'mouse',
      cancelable: true,
      shiftKey: overrides.shiftKey ?? false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      touches: undefined,
    },
    target: {
      getStage: () => ({
        getRelativePointerPosition: () => pos,
        getPointerPosition: () => pos,
        scaleX: () => 1,
        scaleY: () => 1,
        x: () => 0,
        y: () => 0,
        find: () => findResults,
      }),
      id: () => 'map',
    },
  } as any;
}

describe('useCanvasInteraction', () => {
  const setActiveMeasurement = vi.fn();
  const setHoveredCell = vi.fn();
  const setSelectionRect = vi.fn();

  let selectedIdsState: string[] = ['orig'];
  const setSelectedIds = vi.fn((update: any) => {
    if (typeof update === 'function') {
      selectedIdsState = update(selectedIdsState);
    } else {
      selectedIdsState = update;
    }
  });
  const setCalibrationRect = vi.fn();
  const setIsCalibrating = vi.fn();
  const updateMapTransform = vi.fn();
  const addDrawing = vi.fn();
  const addDoor = vi.fn();
  const setDoorPreviewPos = vi.fn();
  const setTempLine = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    selectedIdsState = ['orig'];
  });

  function setup(overrides: Record<string, unknown> = {}) {
    return renderHook(() => {
      const isMeasuring = useRef(false);
      const measurementStart = useRef<{ x: number; y: number } | null>(null);
      const isDrawing = useRef(false);
      const currentLine = useRef<Drawing | null>(null);
      const selectionStart = useRef<{ x: number; y: number } | null>(null);
      const selectionRectCoordsRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
      const selectionRectRef = useRef(null);
      const animationFrameRef = useRef<number | null>(null);
      const calibrationStart = useRef<{ x: number; y: number } | null>(null);
      const stylusActiveRef = useRef(false);
      const lastStylusLiftTimeRef = useRef(0);
      const tempLineRef = useRef(null);
      const drawingAnimationFrameRef = useRef<number | null>(null);

      return {
        ...useCanvasInteraction({
          tool: 'measure',
          measurementMode: 'ruler',
          isSpacePressed: false,
          isWorldView: false,
          isCalibrating: false,
          color: '#df4b26',
          handleTokenPointerDown: vi.fn(),
          handleTokenPointerMove: vi.fn(),
          handleTokenPointerUp: vi.fn(),
          setSelectedIds,
          setActiveMeasurement,
          isMeasuring,
          measurementStart,
          isDrawing,
          currentLine,
          selectionStart,
          selectionRectCoordsRef,
          selectionRectRef,
          animationFrameRef,
          setSelectionRect,
          stylusActiveRef,
          lastStylusLiftTimeRef,
          setTempLine,
          tempLineRef,
          drawingAnimationFrameRef,
          setDoorPreviewPos,
          gridType: 'LINES',
          gridSize: 50,
          doorOrientation: 'horizontal',
          addDoor,
          calibrationStart,
          calibrationRect: null,
          setCalibrationRect,
          setIsCalibrating,
          map: null,
          updateMapTransform,
          addDrawing,
          drawings: [],
          setHoveredCell,
          ...overrides,
        }),
        refs: { isMeasuring, measurementStart, selectionStart, selectionRectCoordsRef },
      };
    });
  }

  it('updates active measurement while dragging ruler', () => {
    const { result } = setup();

    act(() => {
      result.current.handlePointerDown(createPointerEvent({ x: 0, y: 0 }));
    });
    expect(result.current.refs.isMeasuring.current).toBe(true);

    act(() => {
      result.current.handlePointerMove(createPointerEvent({ x: 100, y: 0 }));
    });

    expect(setActiveMeasurement).toHaveBeenCalled();
    const measurement = setActiveMeasurement.mock.calls.at(-1)?.[0] as Measurement;
    expect(measurement.type).toBe('ruler');
    expect(measurement).toMatchObject({
      origin: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      distanceFeet: 10,
    });
  });

  it('updates selection rect while marquee dragging', () => {
    const { result } = setup({ tool: 'select' });

    act(() => {
      result.current.handlePointerDown(createPointerEvent({ x: 10, y: 20 }));
    });
    expect(result.current.refs.selectionStart.current).toEqual({ x: 10, y: 20 });
    expect(setSelectionRect).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true, x: 10, y: 20 }),
    );

    act(() => {
      result.current.handlePointerMove(createPointerEvent({ x: 60, y: 80 }));
    });
    expect(result.current.refs.selectionRectCoordsRef.current).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 60,
    });
  });

  it('updates hovered cell for square grids', () => {
    const { result } = setup({ tool: 'select' });

    act(() => {
      result.current.handlePointerMove(createPointerEvent({ x: 75, y: 125 }));
    });

    expect(setHoveredCell).toHaveBeenCalledWith({ q: 1, r: 2 } satisfies GridCell);
  });

  it('grows calibration rect on move', () => {
    const { result } = setup({
      tool: 'select',
      isCalibrating: true,
      calibrationRect: { x: 0, y: 0, width: 0, height: 0 },
    });

    act(() => {
      result.current.handlePointerDown(createPointerEvent({ x: 10, y: 10 }));
    });
    act(() => {
      result.current.handlePointerMove(createPointerEvent({ x: 60, y: 70 }));
    });

    expect(setCalibrationRect).toHaveBeenCalledWith({
      x: 10,
      y: 10,
      width: 50,
      height: 60,
    });
  });

  it('keeps and unions selection on shift-marquee pointer up', () => {
    const tokenShapes = [
      { id: () => 'A', getClientRect: () => ({ x: 0, y: 0, width: 10, height: 10 }) },
      { id: () => 'B', getClientRect: () => ({ x: 0, y: 0, width: 10, height: 10 }) },
    ];
    vi.spyOn(Konva.Util, 'haveIntersection').mockReturnValue(true);

    const { result } = setup({ tool: 'select' });

    act(() => {
      result.current.handlePointerDown(
        createPointerEvent({ x: 10, y: 10, shiftKey: true }, tokenShapes),
      );
    });

    act(() => {
      result.current.handlePointerMove(
        createPointerEvent({ x: 20, y: 25, shiftKey: true }, tokenShapes),
      );
    });

    act(() => {
      result.current.handlePointerUp(
        createPointerEvent({ x: 20, y: 25, shiftKey: true }, tokenShapes),
      );
    });

    expect(selectedIdsState.sort()).toEqual(['orig', 'A', 'B'].sort());
  });

  it('updates active measurement while dragging blast', () => {
    const { result } = setup({ tool: 'measure', measurementMode: 'blast' });

    act(() => {
      result.current.handlePointerDown(createPointerEvent({ x: 0, y: 0 }));
    });

    act(() => {
      result.current.handlePointerMove(createPointerEvent({ x: 100, y: 0 }));
    });

    const measurement = setActiveMeasurement.mock.calls.at(-1)?.[0] as Measurement;
    expect(measurement.type).toBe('blast');
    expect(measurement.radius).toBe(100);
    expect(measurement.radiusFeet).toBe(10);
  });

  it('updates active measurement while dragging cone', () => {
    const { result } = setup({ tool: 'measure', measurementMode: 'cone' });

    act(() => {
      result.current.handlePointerDown(createPointerEvent({ x: 0, y: 0 }));
    });

    act(() => {
      result.current.handlePointerMove(createPointerEvent({ x: 100, y: 0 }));
    });

    const measurement = setActiveMeasurement.mock.calls.at(-1)?.[0] as Measurement;
    expect(measurement.type).toBe('cone');
    // lengthFeet should match ruler distance conversion
    expect(measurement.lengthFeet).toBe(10);
    expect(measurement.angleDegrees).toBe(53);
  });

  it('finalizes calibration on pointer up (updates map transform)', () => {
    const { result } = setup({
      tool: 'select',
      isCalibrating: true,
      calibrationRect: { x: 10, y: 10, width: 60, height: 60 },
      map: { src: 'm', x: 0, y: 0, width: 100, height: 100, scale: 1 },
    });

    act(() => {
      result.current.handlePointerDown(createPointerEvent({ x: 10, y: 10 }));
    });

    act(() => {
      result.current.handlePointerUp(createPointerEvent({ x: 10, y: 10 }));
    });

    expect(updateMapTransform).toHaveBeenCalled();
    const [newScale, newX, newY] = updateMapTransform.mock.calls[0] as [number, number, number];
    expect(newScale).toBeCloseTo(0.8333333333, 3);
    expect(newX).toBeCloseTo(-8.3333333333, 3);
    expect(newY).toBeCloseTo(-8.3333333333, 3);

    expect(setCalibrationRect).toHaveBeenCalledWith(null);
    expect(setIsCalibrating).toHaveBeenCalledWith(false);
  });
});
