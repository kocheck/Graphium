import { useCallback, useMemo, useRef } from 'react';

import Konva from 'konva';

import { usePreferencesStore } from '../../../store/preferencesStore';
import { useTouchSettingsStore } from '../../../store/touchSettingsStore';
import { snapToGrid } from '../../../utils/grid';
import { createGridGeometry } from '../../../utils/gridGeometry';
import {
  calculateConeVertices,
  DistanceMode,
  euclideanDistance,
  pixelsToFeet,
} from '../../../utils/measurement';
import { simplifyPath, snapPointToPaths } from '../../../utils/pathOptimization';
import { getPointerPosition, getPointerPressure, isMultiTouchGesture } from '../CanvasUtils';

import type { Drawing, Door, GridType, MapConfig } from '../../../store/gameStore';
import type { GridCell } from '../../../types/grid';
import type { Measurement, MeasurementMode } from '../../../types/measurement';
import type { KonvaEventObject } from 'konva/lib/Node';

interface UseCanvasInteractionProps {
  tool: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
  measurementMode: MeasurementMode;
  isSpacePressed: boolean;
  isWorldView: boolean;
  isCalibrating: boolean;
  color: string;
  handleTokenPointerDown: (
    e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
    tokenId: string,
  ) => void;
  handleTokenPointerMove: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void;
  handleTokenPointerUp: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveMeasurement: (m: Measurement | null) => void;
  isMeasuring: React.MutableRefObject<boolean>;
  measurementStart: React.MutableRefObject<{ x: number; y: number } | null>;
  isDrawing: React.MutableRefObject<boolean>;
  currentLine: React.MutableRefObject<Drawing | null>;
  selectionStart: React.MutableRefObject<{ x: number; y: number } | null>;
  selectionRectCoordsRef: React.MutableRefObject<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  selectionRectRef: React.MutableRefObject<Konva.Rect | null>;
  animationFrameRef: React.MutableRefObject<number | null>;
  setSelectionRect: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    isVisible: boolean;
  }) => void;
  stylusActiveRef: React.MutableRefObject<boolean>;
  lastStylusLiftTimeRef: React.MutableRefObject<number>;
  setTempLine: (line: Drawing | null) => void;
  tempLineRef: React.MutableRefObject<Konva.Line | null>;
  drawingAnimationFrameRef: React.MutableRefObject<number | null>;
  setDoorPreviewPos: (pos: { x: number; y: number } | null) => void;
  gridType: GridType;
  gridSize: number;
  doorOrientation: 'horizontal' | 'vertical';
  addDoor: (door: Door) => void;
  calibrationStart: React.MutableRefObject<{ x: number; y: number } | null>;
  calibrationRect: { x: number; y: number; width: number; height: number } | null;
  setCalibrationRect: (
    rect: { x: number; y: number; width: number; height: number } | null,
  ) => void;
  setIsCalibrating: (isCalibrating: boolean) => void;
  map: MapConfig | null;
  updateMapTransform: (scale: number, x: number, y: number) => void;
  addDrawing: (drawing: Drawing) => void;
  drawings: Drawing[];
  setHoveredCell: (cell: GridCell | null) => void;
}

export const useCanvasInteraction = ({
  tool,
  measurementMode,
  isSpacePressed,
  isWorldView,
  isCalibrating,
  color,
  handleTokenPointerMove,
  handleTokenPointerUp,
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
  gridType,
  gridSize,
  doorOrientation,
  addDoor,
  calibrationStart,
  calibrationRect,
  setCalibrationRect,
  setIsCalibrating,
  map,
  updateMapTransform,
  addDrawing,
  drawings,
  setHoveredCell,
}: UseCanvasInteractionProps) => {
  const touchSettings = useTouchSettingsStore();
  const wallToolPrefs = usePreferencesStore((s) => s.wallTool);
  const gridGeometry = useMemo(() => createGridGeometry(gridType), [gridType]);
  const lastHoveredCellRef = useRef<GridCell | null>(null);
  const lastDoorPreviewRef = useRef<{ x: number; y: number } | null>(null);

  const updateHoveredCell = (cell: GridCell | null) => {
    const prev = lastHoveredCellRef.current;
    if (cell === null && prev === null) {
      return;
    }
    if (cell && prev && cell.q === prev.q && cell.r === prev.r) {
      return;
    }
    lastHoveredCellRef.current = cell;
    setHoveredCell(cell);
  };

  const updateDoorPreview = (pos: { x: number; y: number } | null) => {
    const prev = lastDoorPreviewRef.current;
    if (pos === null) {
      if (prev !== null) {
        lastDoorPreviewRef.current = null;
        setDoorPreviewPos(null);
      }
      return;
    }
    if (prev && prev.x === pos.x && prev.y === pos.y) {
      return;
    }
    lastDoorPreviewRef.current = pos;
    setDoorPreviewPos(pos);
  };

  const shouldRejectPointerEvent = useCallback(
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): boolean => {
      const evt = e.evt;
      if (!('pointerType' in evt)) {
        return false;
      }

      if (touchSettings.desktopOnlyMode && evt.pointerType === 'touch') {
        return true;
      }

      if (tool !== 'select' && !stylusActiveRef.current && evt.pointerType === 'touch') {
        return false;
      }

      const shouldReject = touchSettings.shouldRejectTouch(evt, stylusActiveRef.current);

      if (touchSettings.palmRejectionMode === 'smartDelay' && evt.pointerType === 'touch') {
        const timeSinceStylusLift = Date.now() - lastStylusLiftTimeRef.current;
        if (timeSinceStylusLift < touchSettings.palmRejectionDelay) {
          return true;
        }
      }

      return shouldReject;
    },
    [touchSettings, tool, stylusActiveRef, lastStylusLiftTimeRef],
  );

  const trackStylusUsage = useCallback(
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): void => {
      const evt = e.evt;
      if ('pointerType' in evt && evt.pointerType === 'pen') {
        stylusActiveRef.current = true;
      }
    },
    [stylusActiveRef],
  );

  const handlePointerDown = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    trackStylusUsage(e);
    if (shouldRejectPointerEvent(e)) {
      return;
    }

    if (
      tool !== 'select' &&
      e.evt.cancelable &&
      'pointerType' in e.evt &&
      e.evt.pointerType === 'touch'
    ) {
      e.evt.preventDefault();
    }

    if (isSpacePressed) {
      return;
    }
    if (isMultiTouchGesture(e)) {
      return;
    }

    if (tool === 'door') {
      if (isWorldView) {
        return;
      }
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }
      const snapped = snapToGrid(pos.x, pos.y, gridSize, gridType);
      const newDoor: Door = {
        id: crypto.randomUUID(),
        x: snapped.x,
        y: snapped.y,
        orientation: doorOrientation,
        isOpen: false,
        isLocked: false,
        size: gridSize,
      };
      addDoor(newDoor);
      updateDoorPreview(null);
      return;
    }

    if (tool !== 'measure' && !isWorldView) {
      setActiveMeasurement(null);
    }

    if (isCalibrating) {
      if (isWorldView) {
        return;
      }
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }
      calibrationStart.current = { x: pos.x, y: pos.y };
      setCalibrationRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    if (tool === 'measure') {
      if (isWorldView) {
        return;
      }
      isMeasuring.current = true;
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }
      measurementStart.current = { x: pos.x, y: pos.y };
      return;
    }

    if (tool !== 'select') {
      if (isWorldView) {
        return;
      }
      isDrawing.current = true;
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }

      const pressure = getPointerPressure(e);
      let drawColor = color;
      let drawSize = 5;

      if (tool === 'eraser') {
        drawColor = '#000000';
        drawSize = 20;
      } else if (tool === 'wall') {
        drawColor = '#ff0000';
        drawSize = 8;
      }

      currentLine.current = {
        id: crypto.randomUUID(),
        tool: tool,
        points: [pos.x, pos.y],
        color: drawColor,
        size: drawSize,
        pressures: touchSettings.pressureSensitivityEnabled ? [pressure] : undefined,
      };
      return;
    }

    const clickedOnStage = e.target === e.target.getStage();
    const clickedOnMap = e.target.id() === 'map';

    if (clickedOnStage || clickedOnMap) {
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }

      selectionStart.current = { x: pos.x, y: pos.y };
      selectionRectCoordsRef.current = { x: pos.x, y: pos.y, width: 0, height: 0 };
      setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0, isVisible: true });

      const evt = e.evt;
      if (!('shiftKey' in evt) || !evt.shiftKey) {
        setSelectedIds([]);
      }
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    if (shouldRejectPointerEvent(e)) {
      return;
    }

    if (
      tool !== 'select' &&
      e.evt.cancelable &&
      'pointerType' in e.evt &&
      e.evt.pointerType === 'touch'
    ) {
      e.evt.preventDefault();
    }

    if (isSpacePressed) {
      return;
    }
    if (isMultiTouchGesture(e)) {
      return;
    }

    // Grid cell hover highlight (Architect only; skip DOTS/HIDDEN)
    if (!isWorldView && gridType !== 'HIDDEN' && gridType !== 'DOTS') {
      const hoverPos = getPointerPosition(e);
      if (hoverPos) {
        updateHoveredCell(gridGeometry.pixelToGrid(hoverPos.x, hoverPos.y, gridSize));
      }
    } else {
      updateHoveredCell(null);
    }

    if (tool === 'door' && !isWorldView) {
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }
      const snapped = snapToGrid(pos.x, pos.y, gridSize, gridType);
      updateDoorPreview({ x: snapped.x, y: snapped.y });
      return;
    } else {
      updateDoorPreview(null);
    }

    handleTokenPointerMove(e);

    if (tool === 'measure' && isMeasuring.current && measurementStart.current) {
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }
      const origin = measurementStart.current;

      let measurement: Measurement;
      switch (measurementMode) {
        case 'ruler': {
          const distanceFeet = pixelsToFeet(
            euclideanDistance(origin, pos),
            gridSize,
            DistanceMode.EUCLIDEAN,
          );
          measurement = {
            id: 'active',
            type: 'ruler',
            origin,
            end: pos,
            distanceFeet,
          };
          break;
        }
        case 'blast': {
          const radius = euclideanDistance(origin, pos);
          const radiusFeet = pixelsToFeet(radius, gridSize, DistanceMode.EUCLIDEAN);
          measurement = {
            id: 'active',
            type: 'blast',
            origin,
            radius,
            radiusFeet,
          };
          break;
        }
        case 'cone': {
          const vertices = calculateConeVertices(origin, pos);
          const lengthFeet = pixelsToFeet(
            euclideanDistance(origin, pos),
            gridSize,
            DistanceMode.EUCLIDEAN,
          );
          measurement = {
            id: 'active',
            type: 'cone',
            origin,
            target: pos,
            lengthFeet,
            angleDegrees: 53,
            vertices,
          };
          break;
        }
        default: {
          return;
        }
      }

      setActiveMeasurement(measurement);
      return;
    }

    if (isCalibrating && calibrationStart.current) {
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }
      const x = Math.min(pos.x, calibrationStart.current.x);
      const y = Math.min(pos.y, calibrationStart.current.y);
      const width = Math.abs(pos.x - calibrationStart.current.x);
      const height = Math.abs(pos.y - calibrationStart.current.y);
      setCalibrationRect({ x, y, width, height });
      return;
    }

    if (selectionStart.current) {
      const pos = getPointerPosition(e);
      if (!pos) {
        return;
      }
      const x = Math.min(pos.x, selectionStart.current.x);
      const y = Math.min(pos.y, selectionStart.current.y);
      const width = Math.abs(pos.x - selectionStart.current.x);
      const height = Math.abs(pos.y - selectionStart.current.y);

      selectionRectCoordsRef.current = { x, y, width, height };

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        if (selectionRectRef.current) {
          selectionRectRef.current.x(x);
          selectionRectRef.current.y(y);
          selectionRectRef.current.width(width);
          selectionRectRef.current.height(height);
          selectionRectRef.current.getLayer()?.batchDraw();
        }
      });
      return;
    }

    if (tool !== 'select') {
      if (isWorldView) {
        return;
      }
      if (!isDrawing.current) {
        return;
      }
      let point = getPointerPosition(e);
      if (!point) {
        return;
      }
      const cur = currentLine.current;
      if (!cur) {
        return;
      }

      if (e.evt.shiftKey && cur.points.length >= 2) {
        const startX = cur.points[0]!;
        const startY = cur.points[1]!;
        const dx = Math.abs(point.x - startX);
        const dy = Math.abs(point.y - startY);

        if (dx > dy) {
          point = { x: point.x, y: startY };
        } else {
          point = { x: startX, y: point.y };
        }
      }

      // Skip consecutive duplicate points
      const lastIdx = cur.points.length - 2;
      if (lastIdx >= 0 && cur.points[lastIdx] === point.x && cur.points[lastIdx + 1] === point.y) {
        return;
      }

      cur.points.push(point.x, point.y);
      if (cur.pressures) {
        cur.pressures.push(getPointerPressure(e));
      }

      if (drawingAnimationFrameRef.current) {
        cancelAnimationFrame(drawingAnimationFrameRef.current);
      }

      drawingAnimationFrameRef.current = requestAnimationFrame(() => {
        if (tempLineRef.current) {
          tempLineRef.current.points(cur.points);
          tempLineRef.current.getLayer()?.batchDraw();
        } else {
          setTempLine({ ...cur });
        }
      });
    }
  };

  const handlePointerUp = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    trackStylusUsage(e);

    if (isMultiTouchGesture(e)) {
      return;
    }

    handleTokenPointerUp(e);

    if (isMeasuring.current) {
      isMeasuring.current = false;
      measurementStart.current = null;
      // Keep measurement visible until next click / Esc
      return;
    }

    if (isCalibrating && calibrationStart.current && calibrationRect) {
      if (isWorldView) {
        return;
      }
      if (calibrationRect.width > 5 && calibrationRect.height > 5 && map) {
        const avgDim = (calibrationRect.width + calibrationRect.height) / 2;
        const scaleFactor = gridSize / avgDim;
        const newScale = map.scale * scaleFactor;

        const relX = calibrationRect.x - map.x;
        const relY = calibrationRect.y - map.y;
        const newRelX = relX * scaleFactor;
        const newRelY = relY * scaleFactor;

        const currentProjectedX = map.x + newRelX;
        const currentProjectedY = map.y + newRelY;

        const targetX = Math.round(currentProjectedX / gridSize) * gridSize;
        const targetY = Math.round(currentProjectedY / gridSize) * gridSize;

        updateMapTransform(
          newScale,
          map.x + (targetX - currentProjectedX),
          map.y + (targetY - currentProjectedY),
        );
      }

      setCalibrationRect(null);
      calibrationStart.current = null;
      setIsCalibrating(false);
      return;
    }

    if (isDrawing.current) {
      if (isWorldView) {
        return;
      }
      isDrawing.current = false;

      if (drawingAnimationFrameRef.current) {
        cancelAnimationFrame(drawingAnimationFrameRef.current);
        drawingAnimationFrameRef.current = null;
      }

      if (currentLine.current) {
        let processedLine: Drawing = { ...currentLine.current };

        if (processedLine.tool === 'wall' && wallToolPrefs.enableSmoothing) {
          const smoothedPoints = simplifyPath(processedLine.points, wallToolPrefs.smoothingEpsilon);
          if (smoothedPoints.length >= wallToolPrefs.minPoints * 2) {
            processedLine = { ...processedLine, points: smoothedPoints };
          }
        }

        if (processedLine.tool === 'wall' && wallToolPrefs.enableSnapping) {
          const existingWallPaths = drawings.filter((d) => d.tool === 'wall').map((w) => w.points);

          if (existingWallPaths.length > 0 && processedLine.points.length >= 4) {
            const points = [...processedLine.points];

            const startPoint = { x: points[0]!, y: points[1]! };
            const startSnap = snapPointToPaths(
              startPoint,
              existingWallPaths,
              wallToolPrefs.snapThreshold,
            );
            if (startSnap.snapped) {
              points[0] = startSnap.point.x;
              points[1] = startSnap.point.y;
            }

            const endIdx = points.length - 2;
            const endPoint = { x: points[endIdx]!, y: points[endIdx + 1]! };
            const endSnap = snapPointToPaths(
              endPoint,
              existingWallPaths,
              wallToolPrefs.snapThreshold,
            );
            if (endSnap.snapped) {
              points[endIdx] = endSnap.point.x;
              points[endIdx + 1] = endSnap.point.y;
            }

            processedLine = { ...processedLine, points };
          }
        }

        addDrawing(processedLine);
        currentLine.current = null;
        setTempLine(null);
      }
      return;
    }

    if (selectionStart.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const stage = e.target.getStage();
      const box = selectionRectCoordsRef.current;

      setSelectionRect({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        isVisible: false,
      });

      if (stage && (box.width > 2 || box.height > 2)) {
        const clientBox = {
          x: box.x * stage.scaleX() + stage.x(),
          y: box.y * stage.scaleY() + stage.y(),
          width: box.width * stage.scaleX(),
          height: box.height * stage.scaleY(),
        };

        const shapes = stage.find('.token, .drawing');
        const selected = shapes.filter((shape) => {
          if (!shape.id()) {
            return false;
          }
          return Konva.Util.haveIntersection(clientBox, shape.getClientRect());
        });

        const evt = e.evt;
        const additive = 'shiftKey' in evt && evt.shiftKey;
        const newIds = selected.map((n) => n.id());

        if (additive) {
          setSelectedIds((prev) => Array.from(new Set([...prev, ...newIds])));
        } else {
          setSelectedIds(newIds);
        }
      }

      selectionStart.current = null;
    }
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    shouldRejectPointerEvent,
    trackStylusUsage,
  };
};
