import Konva from 'konva';
import { Stage, Layer, Line, Rect, Transformer, Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { snapToGrid } from '../../utils/grid';
import { useGameStore, DEFAULT_GRID_COLOR, Drawing } from '../../store/gameStore';
import { useTouchSettingsStore } from '../../store/touchSettingsStore';
import { isRectInAnyPolygon } from '../../types/geometry';
import GridOverlay from './GridOverlay';
import ImageCropper from '../ImageCropper';
import TokenErrorBoundary from './TokenErrorBoundary';
import AssetProcessingErrorBoundary from '../AssetProcessingErrorBoundary';
import FogOfWarLayer from './FogOfWarLayer';
import { useThemeColor } from '../../hooks/useThemeColor';
import DoorLayer from './DoorLayer';
import StairsLayer from './StairsLayer';
import PaperNoiseOverlay from './PaperNoiseOverlay';
import Minimap from './Minimap';
import MinimapErrorBoundary from './MinimapErrorBoundary';
import CanvasOverlayErrorBoundary from './CanvasOverlayErrorBoundary';
import { useTokenDrag } from './hooks/useTokenDrag';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import MeasurementOverlay from './MeasurementOverlay';
import MovementRangeOverlay from './MovementRangeOverlay';
import { resolveTokenData, DEFAULT_MOVEMENT_SPEED } from '../../hooks/useTokenData';
import URLImage from './URLImage';
import PressureSensitiveLine from './PressureSensitiveLine';

// Zoom constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SCALE_BY = 1.1;
const MIN_PINCH_DISTANCE = 0.001; // Guard against near-zero division
const VIEWPORT_CLAMP_PADDING = 1000; // Padding around map bounds for viewport constraints

// Helper functions for touch/pinch calculations
const calculatePinchDistance = (touch1: Touch, touch2: Touch): number => {
  return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
};

const calculatePinchCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
};

/**
 * Creates a clipping function for token rendering based on grid type
 * This clips tokens to the appropriate shape (hex, diamond, or square)
 */
const createTokenClipFunc = (
  gridType: GridType,
  displayX: number,
  displayY: number,
  gridSize: number,
  scale: number,
) => {
  return (ctx: CanvasRenderingContext2D) => {
    if (gridType.startsWith('HEX')) {
      const s = gridSize * scale;
      const r = s / Math.sqrt(3);
      const cx = displayX + s / 2;
      const cy = displayY + s / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = ((gridType === 'HEX_V' ? 0 : 30) * Math.PI) / 180 + (i * 60 * Math.PI) / 180;
        if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
    } else if (gridType.startsWith('ISO')) {
      const s = gridSize * scale;
      const cx = displayX + s / 2;
      ctx.beginPath();
      ctx.moveTo(cx, displayY);
      ctx.lineTo(displayX + s, displayY + s / 2);
      ctx.lineTo(cx, displayY + s);
      ctx.lineTo(displayX, displayY + s / 2);
      ctx.closePath();
    } else {
      ctx.rect(displayX, displayY, gridSize * scale, gridSize * scale);
    }
  };
};

interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
  color?: string;
  doorOrientation?: 'horizontal' | 'vertical';
  isWorldView?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  measurementMode?: 'ruler' | 'blast' | 'cone';
}

const CanvasManager = ({
  tool = 'select',
  color = '#df4b26',
  doorOrientation = 'horizontal',
  isWorldView = false,
  onSelectionChange,
}: CanvasManagerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Atomic selectors
  const map = useGameStore((s) => s.map);
  const tokens = useGameStore((s) => s.tokens);
  const tokenLibrary = useGameStore(useShallow((s) => s.campaign.tokenLibrary));
  const drawings = useGameStore((s) => s.drawings);
  const doors = useGameStore((s) => s.doors);
  const stairs = useGameStore((s) => s.stairs);
  const gridSize = useGameStore((s) => s.gridSize);
  const gridType = useGameStore((state) => state.gridType);
  const gridColor = useGameStore((state) => state.gridColor);
  const isCalibrating = useGameStore((s) => s.isCalibrating);
  const isDaylightMode = useGameStore((state) => state.isDaylightMode);
  const activeVisionPolygons = useGameStore((state) => state.activeVisionPolygons);
  const activeMeasurement = useGameStore((s) => s.activeMeasurement);

  const addToken = useGameStore((s) => s.addToken);
  const addDrawing = useGameStore((s) => s.addDrawing);
  const removeTokens = useGameStore((s) => s.removeTokens);
  const removeDrawings = useGameStore((s) => s.removeDrawings);
  const setGridType = useGameStore((s) => s.setGridType);
  const toggleDoor = useGameStore((s) => s.toggleDoor);
  const updateDrawingTransform = useGameStore((s) => s.updateDrawingTransform);
  const updateTokenTransform = useGameStore((s) => s.updateTokenTransform);
  const setActiveMeasurement = useGameStore((s) => s.setActiveMeasurement);
  const showToast = useGameStore((s) => s.showToast);

  const touchSettings = useTouchSettingsStore();
  const stylusActiveRef = useRef(false);
  const lastStylusLiftTimeRef = useRef(0);

  // Tools State
  const isDrawing = useRef(false);
  const currentLine = useRef<Drawing | null>(null);
  const [tempLine, setTempLine] = useState<Drawing | null>(null);
  const tempLineRef = useRef<Konva.Line | null>(null);
  const [doorPreviewPos, setDoorPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Measurement
  const isMeasuring = useRef(false);
  const measurementStart = useRef<{ x: number; y: number } | null>(null);

  // Calibration
  const calibrationStart = useRef<{ x: number; y: number } | null>(null);
  const [calibrationRect, setCalibrationRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Cropping
  const [pendingCrop, setPendingCrop] = useState<{ src: string; x: number; y: number } | null>(
    null,
  );

  // Selection & Drag State
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    isVisible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, isVisible: false });
  const selectionRectCoordsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const drawingAnimationFrameRef = useRef<number | null>(null);

  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isMKeyPressed, setIsMKeyPressed] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const resolvedGridColor =
    gridColor === DEFAULT_GRID_COLOR ? useThemeColor('--app-grid-color') : gridColor;

  const lastPinchDistance = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const lastPanCenter = useRef<{ x: number; y: number } | null>(null);
  const PINCH_DISTANCE_THRESHOLD = Math.min(Math.max(touchSettings.pinchDistanceThreshold, 5), 50);

  // Resolve Tokens
  const resolvedTokens = useMemo(() => {
    const mapped = tokens.map((token) => resolveTokenData(token, tokenLibrary));
    if (gridType.startsWith('ISO')) {
      return mapped.sort((a, b) => a.y - b.y);
    }
    return mapped;
  }, [tokens, tokenLibrary, gridType]);

  // Hook Dependencies Refs
  const shouldRejectRef = useRef<(e: KonvaEventObject<any>) => boolean>(() => false);
  const trackStylusRef = useRef<(e: KonvaEventObject<any>) => void>(() => {});

  const {
    handleTokenPointerDown,
    handleTokenPointerMove: internalHandleTokenPointerMove,
    handleTokenPointerUp,
    dragPositionsRef,
    tokenNodesRef,
    snapPreviewNodesRef,
    draggingTokenIds,
    itemsForDuplication,
    tokenLayerRef,
    isDragging: isDraggingToken,
  } = useTokenDrag({
    tool,
    isWorldView,
    isAltPressed,
    gridSize,
    gridType,
    selectedIds,
    setSelectedIds,
    resolvedTokens,
    shouldRejectPointerEvent: (e) => shouldRejectRef.current(e),
    trackStylusUsage: (e) => trackStylusRef.current(e),
  });

  const canvasInteraction = useCanvasInteraction({
    tool,
    isSpacePressed,
    isWorldView,
    isCalibrating: !!isCalibrating,
    color,
    handleTokenPointerDown,
    handleTokenPointerMove: internalHandleTokenPointerMove,
    handleTokenPointerUp,
    isMeasuring,
    measurementStart,
    isDrawing,
    currentLine,
    selectionStart,
    selectionRectCoordsRef,
    setSelectionRect,
    stylusActiveRef,
    lastStylusLiftTimeRef,
    setTempLine,
    tempLineRef,
    drawingAnimationFrameRef,
    doorPreviewPos,
    setDoorPreviewPos,
    gridType,
    gridSize,
    calibrationStart,
    setCalibrationRect,
    setSelectedIds,
    setActiveMeasurement,
    addDrawing,
  });

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    trackStylusUsage,
    shouldRejectPointerEvent,
  } = canvasInteraction;

  useEffect(() => {
    shouldRejectRef.current = shouldRejectPointerEvent;
    trackStylusRef.current = trackStylusUsage;
  }, [shouldRejectPointerEvent, trackStylusUsage]);

  const getCursorStyle = useCallback((): React.CSSProperties['cursor'] => {
    if (isSpacePressed && isDragging) return 'grabbing';
    if (isSpacePressed) return 'grab';
    if (isDraggingToken) return 'grabbing';
    if (tool === 'select') return 'default';
    return 'crosshair';
  }, [isSpacePressed, isDragging, isDraggingToken, tool]);

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedIds);
  }, [selectedIds, onSelectionChange]);

  const clampPosition = useCallback(
    (newPos: { x: number; y: number }, newScale: number) => {
      let bounds = { minX: -5000, maxX: 5000, minY: -5000, maxY: 5000 };
      if (map) {
        bounds = {
          minX: map.x,
          maxX: map.x + map.width * map.scale,
          minY: map.y,
          maxY: map.y + map.height * map.scale,
        };
      }
      const pcTokens = resolvedTokens.filter((t) => t.type === 'PC');
      pcTokens.forEach((token) => {
        const tokenSize = gridSize * token.scale;
        bounds.minX = Math.min(bounds.minX, token.x);
        bounds.minY = Math.min(bounds.minY, token.y);
        bounds.maxX = Math.max(bounds.maxX, token.x + tokenSize);
        bounds.maxY = Math.max(bounds.maxY, token.y + tokenSize);
      });

      const viewportCenterX = (-newPos.x + size.width / 2) / newScale;
      const viewportCenterY = (-newPos.y + size.height / 2) / newScale;
      const allowedMinX = bounds.minX - VIEWPORT_CLAMP_PADDING;
      const allowedMaxX = bounds.maxX + VIEWPORT_CLAMP_PADDING;
      const allowedMinY = bounds.minY - VIEWPORT_CLAMP_PADDING;
      const allowedMaxY = bounds.maxY + VIEWPORT_CLAMP_PADDING;
      const clampedCenterX = Math.max(allowedMinX, Math.min(allowedMaxX, viewportCenterX));
      const clampedCenterY = Math.max(allowedMinY, Math.min(allowedMaxY, viewportCenterY));
      return {
        x: -(clampedCenterX * newScale - size.width / 2),
        y: -(clampedCenterY * newScale - size.height / 2),
      };
    },
    [map, gridSize, size.width, size.height, resolvedTokens],
  );

  const performZoom = useCallback(
    (
      newScale: number,
      centerX: number,
      centerY: number,
      currentScale: number,
      currentPos: { x: number; y: number },
    ) => {
      const constrainedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      const pointTo = {
        x: (centerX - currentPos.x) / currentScale,
        y: (centerY - currentPos.y) / currentScale,
      };
      const newPos = {
        x: centerX - pointTo.x * constrainedScale,
        y: centerY - pointTo.y * constrainedScale,
      };
      const clampedPos = clampPosition(newPos, constrainedScale);
      setScale(constrainedScale);
      setPosition(clampedPos);
    },
    [clampPosition],
  );

  const handleKeyboardZoom = useCallback(
    (zoomIn: boolean) => {
      if (!containerRef.current) return;
      performZoom(
        zoomIn ? scale * ZOOM_SCALE_BY : scale / ZOOM_SCALE_BY,
        size.width / 2,
        size.height / 2,
        scale,
        position,
      );
    },
    [scale, position, size.width, size.height, performZoom],
  );

  useEffect(() => {
    const isEditableElement = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (['input', 'textarea'].includes(el.tagName.toLowerCase()) || el.isContentEditable);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !isWorldView) setIsAltPressed(true);
      if (isEditableElement(e.target)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isWorldView && selectedIds.length > 0) {
        removeTokens(selectedIds);
        removeDrawings(selectedIds);
        setSelectedIds([]);
      }
      if (e.key === 'Escape' && !isWorldView && activeMeasurement) setActiveMeasurement(null);
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.code === 'Equal' || e.code === 'NumpadAdd') && !e.repeat) {
        e.preventDefault();
        handleKeyboardZoom(true);
      }
      if ((e.code === 'Minus' || e.code === 'NumpadSubtract') && !e.repeat) {
        e.preventDefault();
        handleKeyboardZoom(false);
      }
      if (e.key.toLowerCase() === 'm' && !e.repeat) {
        e.preventDefault();
        setIsMKeyPressed(true);
      }
      // Grid shortcuts
      if (!isWorldView && !e.repeat) {
        if (e.key === '1') {
          e.preventDefault();
          setGridType('LINES');
          showToast('Grid: Square - Lines', 'success');
        }
        if (e.key === '2') {
          e.preventDefault();
          setGridType('DOTS');
          showToast('Grid: Square - Dots', 'success');
        }
        if (e.key === '3') {
          e.preventDefault();
          setGridType('HEX_H');
          showToast('Grid: Hex (H)', 'success');
        }
        if (e.key === '4') {
          e.preventDefault();
          setGridType('HEX_V');
          showToast('Grid: Hex (V)', 'success');
        }
        if (e.key === '5') {
          e.preventDefault();
          setGridType('ISO_H');
          showToast('Grid: Iso (H)', 'success');
        }
        if (e.key === '6') {
          e.preventDefault();
          setGridType('ISO_V');
          showToast('Grid: Iso (V)', 'success');
        }
        if (e.key === '7') {
          e.preventDefault();
          setGridType('HIDDEN');
          showToast('Grid: Hidden', 'success');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.code === 'Space') setIsSpacePressed(false);
      if (e.key.toLowerCase() === 'm') setIsMKeyPressed(false);
    };
    const handleBlur = () => {
      setIsSpacePressed(false);
      setIsAltPressed(false);
      setIsMKeyPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    selectedIds,
    removeTokens,
    removeDrawings,
    handleKeyboardZoom,
    activeMeasurement,
    isWorldView,
    setActiveMeasurement,
    setGridType,
    showToast,
  ]);

  useEffect(() => {
    const handleResize = () =>
      containerRef.current &&
      setSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      lastPinchDistance.current = calculatePinchDistance(touches[0], touches[1]);
      lastPinchCenter.current = calculatePinchCenter(touches[0], touches[1]);
    } else if (touches.length === 1 && tool !== 'select') {
      e.evt.preventDefault();
    }
  };

  const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      if (lastPinchDistance.current && lastPinchCenter.current) {
        const distance = calculatePinchDistance(touches[0], touches[1]);
        const center = calculatePinchCenter(touches[0], touches[1]);
        if (lastPinchDistance.current < MIN_PINCH_DISTANCE) return;
        const distanceChange = Math.abs(distance - lastPinchDistance.current);
        const isPinchGesture = distanceChange > PINCH_DISTANCE_THRESHOLD;
        if (isPinchGesture) {
          const stageRect = containerRef.current?.getBoundingClientRect();
          if (!stageRect) return;
          const canvasX = center.x - stageRect.left;
          const canvasY = center.y - stageRect.top;
          performZoom(
            scale * (distance / lastPinchDistance.current),
            canvasX,
            canvasY,
            scale,
            position,
          );
          lastPinchDistance.current = distance;
          lastPinchCenter.current = center;
          lastPanCenter.current = null;
        } else if (lastPanCenter.current) {
          const dx = center.x - lastPanCenter.current.x;
          const dy = center.y - lastPanCenter.current.y;
          setPosition(clampPosition({ x: position.x + dx, y: position.y + dy }, scale));
          lastPanCenter.current = center;
        } else {
          lastPanCenter.current = center;
        }
      }
    } else if (touches.length === 1 && tool !== 'select') e.evt.preventDefault();
  };

  const handleTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) {
      lastPinchDistance.current = null;
      lastPinchCenter.current = null;
      lastPanCenter.current = null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isWorldView) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (isWorldView) return;
    e.preventDefault();
    const stageRect = containerRef.current?.getBoundingClientRect();
    if (!stageRect) return;
    const pointerX = e.clientX - stageRect.left;
    const pointerY = e.clientY - stageRect.top;
    const worldX = (pointerX - position.x) / scale;
    const worldY = (pointerY - position.y) / scale;
    const { x, y } = snapToGrid(worldX, worldY, gridSize, gridType, undefined, undefined);

    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        const data = JSON.parse(jsonData);
        if (data.type === 'LIBRARY_TOKEN') {
          addToken({
            id: crypto.randomUUID(),
            x,
            y,
            src: data.src,
            libraryItemId: data.libraryItemId,
          });
          return;
        } else if (data.type === 'GENERIC_TOKEN') {
          const root = document.documentElement;
          const style = getComputedStyle(root);
          const bg = style.getPropertyValue('--app-bg-subtle')?.trim() || '#6b7280';
          const fg = style.getPropertyValue('--app-text-primary')?.trim() || '#ffffff';
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="${bg}" rx="16"/><circle cx="64" cy="45" r="18" fill="${fg}"/><path d="M64 70 C 40 70 28 82 28 92 L 28 108 L 100 108 L 100 92 C 100 82 88 70 64 70 Z" fill="${fg}"/></svg>`;
          addToken({
            id: crypto.randomUUID(),
            x,
            y,
            src: `data:image/svg+xml;base64,${btoa(svg)}`,
            name: 'Generic Token',
            type: 'NPC',
            scale: 1,
          });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (e.dataTransfer.files?.length > 0) {
      const file = e.dataTransfer.files[0];
      setPendingCrop({ src: URL.createObjectURL(file), x, y });
    }
  };

  const handleCropConfirm = (blob: Blob) => {
    if (!pendingCrop) return;
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      addToken({
        id: crypto.randomUUID(),
        x: pendingCrop.x,
        y: pendingCrop.y,
        src: reader.result as string,
        name: 'New Token',
        type: 'NPC',
        scale: 1,
      });
      setPendingCrop(null);
    };
  };

  const visibleBounds = useMemo(
    () => ({
      x: -position.x / scale,
      y: -position.y / scale,
      width: size.width / scale,
      height: size.height / scale,
    }),
    [position, scale, size],
  );

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (e.evt.ctrlKey || e.evt.metaKey) {
      performZoom(
        e.evt.deltaY < 0 ? oldScale * ZOOM_SCALE_BY : oldScale / ZOOM_SCALE_BY,
        pointer.x,
        pointer.y,
        oldScale,
        { x: stage.x(), y: stage.y() },
      );
    } else {
      setPosition(
        clampPosition({ x: stage.x() - e.evt.deltaX, y: stage.y() - e.evt.deltaY }, scale),
      );
    }
  };

  useEffect(() => {
    if (transformerRef.current) {
      const stage = transformerRef.current.getStage();
      if (stage) {
        const selectedNodes = stage.find((node: Konva.Node) => selectedIds.includes(node.id()));
        transformerRef.current.nodes(selectedNodes);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedIds]);

  return (
    <div
      ref={containerRef}
      className="canvas-container w-full h-full overflow-hidden relative"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {pendingCrop && (
        <AssetProcessingErrorBoundary>
          <ImageCropper
            imageSrc={pendingCrop.src}
            onConfirm={handleCropConfirm}
            onCancel={() => setPendingCrop(null)}
          />
        </AssetProcessingErrorBoundary>
      )}
      <Stage
        width={size.width}
        height={size.height}
        draggable={isSpacePressed}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onDragStart={(e) => {
          if (e.target === e.target.getStage()) setIsDragging(true);
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setPosition(clampPosition({ x: e.target.x(), y: e.target.y() }, scale));
            setIsDragging(false);
          }
        }}
        style={{ cursor: getCursorStyle() }}
      >
        <Layer listening={false}>
          {map && (
            <URLImage
              key="bg-map"
              name="map-image"
              id="map"
              src={map.src}
              x={map.x}
              y={map.y}
              width={map.width}
              height={map.height}
              scaleX={map.scale}
              scaleY={map.scale}
              draggable={false}
              onSelect={() => {}}
            />
          )}
          <CanvasOverlayErrorBoundary overlayName="PaperNoiseOverlay">
            <PaperNoiseOverlay
              x={map ? map.x : visibleBounds.x}
              y={map ? map.y : visibleBounds.y}
              width={map ? map.width : visibleBounds.width}
              height={map ? map.height : visibleBounds.height}
              scaleX={map ? map.scale : 1}
              scaleY={map ? map.scale : 1}
              opacity={0.25}
            />
          </CanvasOverlayErrorBoundary>
          <GridOverlay
            visibleBounds={visibleBounds}
            gridSize={gridSize}
            type={gridType}
            stroke={resolvedGridColor}
            hoveredCell={null}
          />
        </Layer>
        <Layer>
          {/* Ghost Drawings (Alt+drag preview) */}
          {isAltPressed &&
            drawings
              .filter((d) => itemsForDuplication.includes(d.id))
              .map((ghost) => (
                <Line
                  key={`ghost-${ghost.id}`}
                  points={ghost.points}
                  stroke={ghost.color}
                  strokeWidth={ghost.size}
                  tension={0.5}
                  lineCap="round"
                  dash={ghost.tool === 'wall' ? [10, 5] : undefined}
                  opacity={0.5}
                  listening={false}
                />
              ))}

          {/* Drawings */}
          {drawings.map((line) => {
            const strokeColor = isWorldView && line.tool === 'wall' ? '#000000' : line.color;
            const hasPressureData = line.pressures && line.pressures.length > 0;
            const isDraggable = tool === 'select' && line.tool !== 'wall';

            const handleClick = (e: KonvaEventObject<MouseEvent>) => {
              if (tool === 'select') {
                e.evt.stopPropagation();
                setSelectedIds([line.id]);
              }
            };

            const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
              updateDrawingTransform(line.id, e.target.x(), e.target.y(), 1);
            };

            if (hasPressureData) {
              return (
                <PressureSensitiveLine
                  key={line.id}
                  id={line.id}
                  points={line.points}
                  pressures={line.pressures}
                  stroke={strokeColor}
                  strokeWidth={line.size}
                  draggable={isDraggable}
                  onClick={handleClick}
                  onDragEnd={handleDragEnd}
                />
              );
            } else {
              return (
                <Line
                  key={line.id}
                  id={line.id}
                  points={line.points}
                  stroke={strokeColor}
                  strokeWidth={line.size}
                  tension={0.5}
                  lineCap="round"
                  dash={line.tool === 'wall' ? [10, 5] : undefined}
                  draggable={isDraggable}
                  onClick={handleClick}
                  onDragEnd={handleDragEnd}
                />
              );
            }
          })}

          {tempLine && (
            <Line
              ref={tempLineRef}
              points={tempLine.points}
              stroke={tempLine.color}
              strokeWidth={tempLine.size}
              tension={0.5}
              lineCap="round"
            />
          )}
          <StairsLayer stairs={stairs} isWorldView={isWorldView} />
        </Layer>
        {isWorldView && !isDaylightMode && (
          <Layer listening={false}>
            <FogOfWarLayer
              tokens={resolvedTokens}
              drawings={drawings}
              doors={doors}
              gridSize={gridSize}
              visibleBounds={visibleBounds}
              map={map}
            />
          </Layer>
        )}
        <Layer ref={tokenLayerRef}>
          <DoorLayer doors={doors} isWorldView={isWorldView} onToggleDoor={toggleDoor} />
          {doorPreviewPos && tool === 'door' && !isWorldView && (
            <Rect
              x={doorPreviewPos.x - gridSize / 2}
              y={doorPreviewPos.y - gridSize / 2}
              width={doorOrientation === 'horizontal' ? gridSize : gridSize / 5}
              height={doorOrientation === 'horizontal' ? gridSize / 5 : gridSize}
              fill="white"
              opacity={0.5}
            />
          )}
          {/* Snap Preview */}
          {isDraggingToken &&
            Array.from(draggingTokenIds).map((tid) => {
              // We render the line initially with no points. The performant ref-based update loop in useTokenDrag
              // will update the points on the very next frame/move event.
              return (
                <Line
                  key={`snap-${tid}`}
                  ref={(node) => {
                    if (node) snapPreviewNodesRef.current.set(tid, node);
                    else snapPreviewNodesRef.current.delete(tid);
                  }}
                  points={[]}
                  stroke="blue"
                  dash={[8, 4]}
                  closed
                  strokeWidth={2}
                />
              );
            })}
          {/* Ghost Tokens */}
          {isAltPressed &&
            resolvedTokens
              .filter((t) => itemsForDuplication.includes(t.id))
              .map((g) => (
                <URLImage
                  key={`ghost-${g.id}`}
                  id={`ghost-${g.id}`}
                  src={g.src}
                  x={g.x}
                  y={g.y}
                  width={gridSize * g.scale}
                  height={gridSize * g.scale}
                  opacity={0.5}
                  draggable={false}
                />
              ))}
          {isMKeyPressed &&
            !isWorldView &&
            selectedIds.length === 1 &&
            (() => {
              const selectedToken = resolvedTokens.find((t) => t.id === selectedIds[0]);
              if (!selectedToken) {
                return null;
              }
              const movementSpeed = selectedToken.movementSpeed ?? DEFAULT_MOVEMENT_SPEED;
              return (
                <MovementRangeOverlay
                  tokenPosition={selectedToken}
                  movementSpeed={movementSpeed}
                  gridSize={gridSize}
                  gridType={gridType}
                />
              );
            })()}

          {resolvedTokens.map((token) => {
            const dragPos = dragPositionsRef.current.get(token.id);
            const displayX = dragPos ? dragPos.x : token.x;
            const displayY = dragPos ? dragPos.y : token.y;
            const isSelected = selectedIds.includes(token.id);
            if (
              isWorldView &&
              !isDaylightMode &&
              token.type === 'NPC' &&
              !isRectInAnyPolygon(
                displayX,
                displayY,
                gridSize * token.scale,
                gridSize * token.scale,
                activeVisionPolygons,
              )
            )
              return null;

            const displayYOffset = gridType.startsWith('ISO') ? -((gridSize * token.scale) / 2) : 0;
            const finalDisplayY = displayY + displayYOffset;
            const safeScale = token.scale || 1;
            const isHex = gridType.startsWith('HEX');
            const renderWidth = gridSize * safeScale * (isHex ? 1.1547 : 1);
            const renderX = displayX - (renderWidth - gridSize * safeScale) / 2;
            const renderY = finalDisplayY - (renderWidth - gridSize * safeScale) / 2;

            return (
              <Group key={token.id}>
                <TokenErrorBoundary tokenId={token.id} onShowToast={showToast}>
                  <Group
                    clipFunc={createTokenClipFunc(
                      gridType,
                      displayX,
                      finalDisplayY,
                      gridSize,
                      safeScale,
                    )}
                  >
                    <URLImage
                      ref={(node) => {
                        if (node) tokenNodesRef.current.set(token.id, node);
                        else tokenNodesRef.current.delete(token.id);
                      }}
                      id={token.id}
                      src={token.src}
                      x={renderX}
                      y={renderY}
                      width={renderWidth}
                      height={renderWidth}
                      name="token"
                      draggable={false}
                      onSelect={(e) => handleTokenPointerDown(e, token.id)}
                    />
                  </Group>
                </TokenErrorBoundary>
                {isSelected &&
                  (() => {
                    // const geo = createGridGeometry(gridType);
                    // To draw the selection highlight correctly, we need the grid cell at the token's position
                    // const centerX = displayX + gridSize * safeScale / 2;
                    // const centerY = finalDisplayY + gridSize * safeScale / 2;
                    // Note: pixelToGrid expects world coordinates.
                    // const cell = geo.pixelToGrid(centerX, centerY, gridSize);
                    // getCellVertices returns vertices relative to the cell center? No, absolute world coords?
                    // Actually getCellVertices usually returns vertices for that cell.
                    // But if the token is large (scale > 1), we might want a box around the whole token?
                    // For now, let's just stick to a Rect for squares, and a simple Hex outline for hexes.
                    // Actually, let's use the same path logic as clipFunc or geometry.
                    // geometry.getCellVertices return points for 1x1 cell.
                    // For scaled tokens, we might need to scale the vertices.
                    // Simpler: Just render a Line with generated points based on type.
                    let points: number[] = [];
                    if (gridType.startsWith('HEX')) {
                      const s = gridSize * safeScale;
                      const r = s / Math.sqrt(3);
                      const cx = displayX + s / 2,
                        cy = finalDisplayY + s / 2;
                      for (let i = 0; i < 6; i++) {
                        const a =
                          ((gridType === 'HEX_V' ? 0 : 30) * Math.PI) / 180 +
                          (i * 60 * Math.PI) / 180;
                        points.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
                      }
                    } else if (gridType.startsWith('ISO')) {
                      const s = gridSize * safeScale;
                      points = [
                        displayX + s / 2,
                        finalDisplayY,
                        displayX + s,
                        finalDisplayY + s / 2,
                        displayX + s / 2,
                        finalDisplayY + s,
                        displayX,
                        finalDisplayY + s / 2,
                      ];
                    } else {
                      const s = gridSize * safeScale;
                      points = [
                        displayX,
                        finalDisplayY,
                        displayX + s,
                        finalDisplayY,
                        displayX + s,
                        finalDisplayY + s,
                        displayX,
                        finalDisplayY + s,
                      ];
                    }

                    return (
                      <Line
                        points={points}
                        closed
                        stroke="#00aaff"
                        strokeWidth={2}
                        listening={false}
                      />
                    );
                  })()}
              </Group>
            );
          })}
        </Layer>
        {isCalibrating && calibrationRect && (
          <Layer>
            <Rect
              x={calibrationRect.x}
              y={calibrationRect.y}
              width={calibrationRect.width}
              height={calibrationRect.height}
              stroke="yellow"
              strokeWidth={2}
              dash={[5, 5]}
            />
          </Layer>
        )}
        <Layer listening={false}>
          {activeMeasurement && (
            <MeasurementOverlay measurement={activeMeasurement} gridSize={gridSize} />
          )}
          {selectionRect.isVisible && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(0, 161, 255, 0.3)"
              stroke="#00a1ff"
            />
          )}
        </Layer>
        <Layer>
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(_oldBox, newBox) => newBox}
            onTransformEnd={(e) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // Update token transform in store
              if (node.name() === 'token') {
                // Use average of scaleX and scaleY for uniform scaling
                const transformScale = (scaleX + scaleY) / 2;
                const token = resolvedTokens.find((t) => t.id === node.id());
                if (token) {
                  // Multiply current scale by transformation scale
                  const newScale = token.scale * transformScale;
                  updateTokenTransform(node.id(), node.x(), node.y(), newScale);
                }

                // Reset scale to 1 since the new scale is stored
                node.scaleX(1);
                node.scaleY(1);
              } else if (node.name() === 'drawing') {
                // Handle drawing (Line) transformation
                // Use average of scaleX and scaleY for uniform scaling
                const transformScale = (scaleX + scaleY) / 2;
                const drawing = drawings.find((d) => d.id === node.id());
                if (drawing) {
                  // Multiply current scale by transformation scale, or set to transformScale if not previously scaled
                  const newScale = (drawing.scale || 1) * transformScale;
                  updateDrawingTransform(node.id(), node.x(), node.y(), newScale);
                }
                // Reset scale to 1 since the new scale is stored
                node.scaleX(1);
                node.scaleY(1);
              }
            }}
          />
        </Layer>
      </Stage>
      {isCalibrating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium z-50 flex items-center gap-3">
          <span>
            Draw a box around ONE {gridType.includes('HEX') ? 'Hex' : 'Square'} to calibrate
          </span>
          <button
            className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs transition-colors"
            onClick={() => {
              /* Handled via start/stop in store interaction */ useGameStore
                .getState()
                .setIsCalibrating(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      <MinimapErrorBoundary>
        <Minimap
          map={map}
          tokens={resolvedTokens}
          onNavigate={(x, y) =>
            setPosition(
              clampPosition(
                { x: -(x * scale - size.width / 2), y: -(y * scale - size.height / 2) },
                scale,
              ),
            )
          }
          position={{ x: position.x, y: position.y }}
          scale={scale}
          viewportSize={size}
        />
      </MinimapErrorBoundary>
    </div>
  );
};
export default React.memo(CanvasManager);
