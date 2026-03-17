import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import type React from 'react';

import { Application } from '@pixi/react';
import { useShallow } from 'zustand/shallow';

// eslint-disable-next-line import/no-named-as-default
import CanvasAccessibility from './CanvasAccessibility';
// TODO Phase 5: CanvasOverlayErrorBoundary — import CanvasOverlayErrorBoundary from './CanvasOverlayErrorBoundary';
import DoorContextMenu from './DoorContextMenu';
// TODO Phase 5: DoorLayer — import DoorLayer from './DoorLayer';
// TODO Phase 3: FogOfWarLayer — import FogOfWarLayer from './FogOfWarLayer';
// TODO Phase 1: GridOverlay — import GridOverlay from './GridOverlay';
import ImageCropper from '../Dialogs/ImageCropper';
// TODO Phase 4: useCanvasDrawing — import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import { useCanvasDrop } from './hooks/useCanvasDrop';
// TODO Phase 5: useCanvasInteraction — import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
// TODO Phase 2: useCanvasSelection — import { useCanvasSelection } from './hooks/useCanvasSelection';
// TODO Phase 2: useTokenDrag — import { useTokenDrag } from './hooks/useTokenDrag';
// TODO Phase 5: MeasurementOverlay — import MeasurementOverlay from './MeasurementOverlay';
import Minimap from './Minimap';
import MinimapErrorBoundary from './MinimapErrorBoundary';
// TODO Phase 5: MovementRangeOverlay — import MovementRangeOverlay from './MovementRangeOverlay';
// TODO Phase 1: PaperNoiseOverlay — import PaperNoiseOverlay from './PaperNoiseOverlay';
// TODO Phase 4: PressureSensitiveLine — import PressureSensitiveLine from './PressureSensitiveLine';
// TODO Phase 5: StairsLayer — import StairsLayer from './StairsLayer';
// TODO Phase 1: URLImage (map background) — import URLImage from './URLImage';
import { useThemeColor } from '../../hooks/useThemeColor';
import { resolveTokenData } from '../../hooks/useTokenData';
// TODO Phase 2: DEFAULT_MOVEMENT_SPEED — re-add when token rendering is re-implemented
import { useGameStore } from '../../store/gameStore';
// TODO Phase 1: useTouchSettingsStore — re-add when PixiJS viewport touch/stylus is implemented
// import { useTouchSettingsStore } from '../../store/touchSettingsStore';
import { useUiStore } from '../../store/uiStore';
import { DEFAULT_GRID_COLOR } from '../../types/domain';
// TODO Phase 2/3: isRectInAnyPolygon — import { isRectInAnyPolygon } from '../../types/geometry';
// TODO Phase 2: createGridGeometry — import { createGridGeometry } from '../../utils/gridGeometry';
import AssetProcessingErrorBoundary from '../ErrorBoundaries/AssetProcessingErrorBoundary';
// TODO Phase 2: TokenErrorBoundary — import TokenErrorBoundary from '../ErrorBoundaries/TokenErrorBoundary';

import type { HexColor, PixelSize } from '../../types/domain';
import type { Application as PixiApplication } from 'pixi.js';
// TODO Phase 1: GridCell — import type { GridCell } from '../../types/grid';

// Enable to log canvas state diagnostics to console on each render
const DEBUG_CANVAS = false;

// Canvas rendering colors — sourced from theme tokens (see theme.css)
// Konva renders to <canvas>, so CSS variables aren't available directly.
// These constants mirror the tokens defined in theme.css.
const CANVAS_COLORS = {
  markerDefault: '#df4b26', // --app-canvas-marker-default
  selectionFill: 'rgba(140, 105, 20, 0.25)', // --app-canvas-selection-fill
  selectionStroke: '#8c6914', // --app-canvas-selection-stroke
  snapFill: 'rgba(140, 105, 20, 0.1)', // --app-canvas-snap-fill
  snapStroke: 'rgba(140, 105, 20, 0.55)', // --app-canvas-snap-stroke
  calibrationFill: 'rgba(229, 72, 77, 0.2)', // --app-canvas-calibration-fill
  calibrationStroke: '#e5484d', // --app-canvas-calibration-stroke
  doorPreviewFill: 'rgba(247, 237, 218, 0.5)', // --app-door-preview-fill
  doorPreviewStroke: '#f7edda', // --app-door-preview-stroke
  wallStroke: '#1c1007', // --app-wall-stroke
  snapTargetStroke: '#8c6914', // --app-canvas-selection-stroke (reused)
  tokenShadowHover: 'rgba(28, 16, 7, 0.6)', // --app-token-shadow-hover
  tokenShadow: 'rgba(28, 16, 7, 0.4)', // --app-token-shadow
} as const;

// Zoom constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SCALE_BY = 1.1;
// TODO Phase 1: MIN_PINCH_DISTANCE — re-enable when PixiJS viewport touch gestures are implemented
// const MIN_PINCH_DISTANCE = 0.001;
const VIEWPORT_CLAMP_PADDING = 1000; // Padding around map bounds for viewport constraints

/**
 * Performance budget configuration for low-end device detection.
 *
 * - `maxPixelRatio`: Cap canvas resolution to avoid GPU memory pressure.
 *   Default Konva uses `window.devicePixelRatio` (often 2-3 on modern displays),
 *   which quadruples pixel count. Capping at 2 is sufficient for crisp rendering.
 *   On detected low-end devices (≤4GB RAM or ≤4 CPU cores), drops to 1.
 * - `isLowEnd`: True when device has limited memory or CPU cores. Used to
 *   reduce visual effects that stress the GPU/CPU.
 *
 * Detection uses `navigator.deviceMemory` (Chrome/Edge) and
 * `navigator.hardwareConcurrency` (all modern browsers).
 */
const PERFORMANCE_CONFIG = (() => {
  const nav = navigator as { deviceMemory?: number };
  const memoryGB = nav.deviceMemory; // undefined on Firefox/Safari
  const cores = navigator.hardwareConcurrency; // available in all modern browsers
  const isLowEnd = (memoryGB !== undefined && memoryGB <= 4) || (cores !== undefined && cores <= 4);
  return {
    maxPixelRatio: isLowEnd ? 1 : Math.min(window.devicePixelRatio, 2),
    isLowEnd,
  };
})();

// TODO Phase 1: Touch/pinch helpers — re-enable when PixiJS viewport touch gestures are implemented
// const calculatePinchDistance = (touch1: Touch, touch2: Touch): number => {
//   return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
// };
// const calculatePinchCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
//   return { x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2 };
// };

/**
 * Props for CanvasManager component
 *
 * @property {string} tool - Active drawing/interaction tool (select, marker, eraser, wall, door, measure)
 * @property {string} color - Color for marker tool (hex format)
 * @property {string} doorOrientation - Orientation for door placement (horizontal, vertical)
 * @property {string} wallColor - Color for wall tool strokes (hex format)
 * @property {number} wallSize - Stroke width for wall tool
 * @property {boolean} isWorldView - If true, restricts interactions for player-facing World View
 * @property {MeasurementMode} measurementMode - Active measurement mode (ruler, blast, cone)
 */
interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
  color?: HexColor;
  doorOrientation?: 'horizontal' | 'vertical';
  wallColor?: HexColor;
  wallSize?: PixelSize;
  isWorldView?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  measurementMode?: 'ruler' | 'blast' | 'cone';
}

/**
 * CanvasManager - Main canvas compositor for battlemap rendering and interaction
 *
 * Composes canvas layers (map, grid, drawings, tokens, fog, UI overlays) and wires
 * interaction hooks (keyboard, drawing, selection, drag, drop). Operates in two modes:
 * Architect View (full editing) and World View (read-only navigation).
 *
 * @see useCanvasKeyboard for keyboard shortcuts and modifier key state
 * @see useCanvasDrawing for drawing/measurement/calibration state
 * @see useCanvasSelection for selection rectangle and transformer management
 * @see useCanvasDrop for file drop and image crop handling
 * @see useCanvasInteraction for unified pointer event handling
 * @see useTokenDrag for token drag-and-drop with snap preview
 */
// eslint-disable-next-line max-lines-per-function
function CanvasManager({
  tool = 'select',
  color: _color = CANVAS_COLORS.markerDefault as HexColor, // TODO Phase 4: used by drawing tool
  doorOrientation: _doorOrientation = 'horizontal', // TODO Phase 5: used by door tool
  wallColor: _wallColor = '#ff0000' as HexColor, // TODO Phase 4: used by wall tool
  wallSize: _wallSize = 8 as PixelSize, // TODO Phase 4: used by wall tool
  isWorldView = false,
  onSelectionChange: _onSelectionChange, // TODO Phase 2: used by selection hook
  // measurementMode = 'ruler', // Unused currently
}: CanvasManagerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PixiApplication | null>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // --- Store Selectors (atomic to prevent infinite re-render loops) ---
  const map = useGameStore((s) => s.map);
  const tokens = useGameStore((s) => s.tokens);
  const tokenLibrary = useGameStore(useShallow((s) => s.campaign.tokenLibrary));
  const drawings = useGameStore((s) => s.drawings);
  const doors = useGameStore((s) => s.doors);
  // TODO Phase 5: stairs — re-add when StairsLayer is implemented
  // const stairs = useGameStore((s) => s.stairs);
  const gridSize = useGameStore((s) => s.gridSize);
  const gridType = useGameStore((state) => state.gridType);
  const gridColor = useGameStore((state) => state.gridColor);
  // TODO Phase 5: isCalibrating — re-add when calibration overlay is implemented
  // const isCalibrating = useGameStore((s) => s.isCalibrating);
  const isDaylightMode = useGameStore((state) => state.isDaylightMode);
  const activeVisionPolygons = useGameStore((state) => state.activeVisionPolygons);

  // Diagnostic logging — enable DEBUG_CANVAS at file top to debug canvas state
  if (DEBUG_CANVAS && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('🎮 CANVAS DIAGNOSTIC:', {
      view: isWorldView ? 'World' : 'Architect',
      daylight: isDaylightMode,
      tokens: tokens.length,
      pc: tokens.filter((t) => t.type === 'PC').length,
      doors: doors.length,
      walls: drawings.filter((d) => d.tool === 'wall').length,
      visionPolygons: activeVisionPolygons.length,
      fog: !isDaylightMode && isWorldView,
    });
  }

  // Resolve token data by merging instance properties with library defaults
  // This implements the Prototype/Instance pattern where tokens can inherit
  // properties (scale, type, visionRadius, name) from their library prototypes
  const resolvedTokens = useMemo(() => {
    const mapped = tokens.map((token) => resolveTokenData(token, tokenLibrary));
    // For Isometric grid, sort by Y (depth) so lower tokens render on top of higher ones
    if (gridType === 'ISOMETRIC') {
      return mapped.sort((a, b) => a.y - b.y);
    }
    return mapped;
  }, [tokens, tokenLibrary, gridType]);

  // Touch/Stylus tracking for palm rejection
  // TODO Phase 1: touchSettings — re-add when PixiJS viewport touch/stylus is implemented
  // const touchSettings = useTouchSettingsStore();
  // TODO Phase 5: stylusActiveRef/lastStylusLiftTimeRef — re-add when pointer interaction is re-implemented
  // const stylusActiveRef = useRef(false);
  // const lastStylusLiftTimeRef = useRef(0);

  // Measurement state
  const activeMeasurement = useGameStore((s) => s.activeMeasurement);
  // TODO Phase 5: dmMeasurement — re-add when MeasurementOverlay is re-implemented
  // const dmMeasurement = useGameStore((s) => s.dmMeasurement);

  // Store actions (stable references from Zustand)
  const addToken = useGameStore((s) => s.addToken);
  // TODO Phase 4: addDrawing — re-add when DrawingLayer is implemented
  // const addDrawing = useGameStore((s) => s.addDrawing);
  // TODO Phase 2: updateTokenTransform — re-add when token drag is implemented
  // const updateTokenTransform = useGameStore((s) => s.updateTokenTransform);
  const removeTokens = useGameStore((s) => s.removeTokens);
  const removeDrawings = useGameStore((s) => s.removeDrawings);
  const setGridType = useGameStore((s) => s.setGridType);
  const toggleDoor = useGameStore((s) => s.toggleDoor);
  // TODO Phase 5: addDoor — re-add when door tool is implemented
  // const addDoor = useGameStore((s) => s.addDoor);
  const removeDoor = useGameStore((s) => s.removeDoor);
  const removeDoors = useGameStore((s) => s.removeDoors);
  const updateDoorLock = useGameStore((s) => s.updateDoorLock);
  // TODO Phase 4: updateDrawingTransform — re-add when DrawingLayer is implemented
  // const updateDrawingTransform = useGameStore((s) => s.updateDrawingTransform);
  const setActiveMeasurement = useGameStore((s) => s.setActiveMeasurement);
  const showToast = useUiStore((s) => s.showToast);

  // --- Extracted Hooks ---

  // TODO Phase 4: useCanvasDrawing — Drawing/measurement/calibration state
  // const {
  //   isDrawing,
  //   currentLine,
  //   tempLine,
  //   setTempLine,
  //   tempLineRef,
  //   drawingAnimationFrameRef,
  //   doorPreviewPos,
  //   setDoorPreviewPos,
  //   isMeasuring,
  //   measurementStart,
  //   calibrationStart,
  //   calibrationRect,
  //   setCalibrationRect,
  // } = useCanvasDrawing();

  // TODO Phase 2: useCanvasSelection — Selection state (selectedIds, transformer, selection rect)
  // const {
  //   selectedIds,
  //   setSelectedIds,
  //   hoveredTokenId,
  //   setHoveredTokenId,
  //   selectionRect,
  //   setSelectionRect,
  //   selectionStart,
  //   selectionRectRef,
  //   selectionRectCoordsRef,
  //   transformerRef,
  // } = useCanvasSelection({ onSelectionChange });

  // Temporary scaffolding: stub out selection state until Phase 2 re-implements it
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // TODO Phase 2: hoveredTokenId — re-add when token hover is re-implemented
  // const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  // TODO Phase 4: drawing state stubs — will be replaced by useCanvasDrawing in Phase 4
  // const doorPreviewPos = null;
  // const isMeasuring = false;
  // const isDrawing = false;
  // const tempLine = null;

  // TODO Phase 2: emptyDragHandler — re-add when token drag is re-implemented
  // const emptyDragHandler = useCallback(() => {}, []);

  // TODO Phase 1: Grid hover highlight state — re-add when GridOverlay is re-implemented
  // const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  // useEffect(() => {
  //   if (gridType === 'HIDDEN' || gridType === 'DOTS') setHoveredCell(null);
  // }, [gridType]);

  // Door context menu state
  const [doorContextMenu, setDoorContextMenu] = useState<{
    doorId: string;
    x: number;
    y: number;
  } | null>(null);

  // TODO Phase 5: handleDoorContextMenu — will be passed to DoorLayer in Phase 5
  // const handleDoorContextMenu = useCallback((doorId: string, screenX: number, screenY: number) => {
  //   if (!containerRef.current) return;
  //   const rect = containerRef.current.getBoundingClientRect();
  //   setDoorContextMenu({ doorId, x: screenX - rect.left, y: screenY - rect.top });
  // }, []);

  const closeDoorContextMenu = useCallback(() => {
    setDoorContextMenu(null);
  }, []);

  // --- Navigation State ---
  // TODO Phase 1: isDragging/setIsDragging — re-add when PixiJS viewport pan is implemented
  // const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // TODO Phase 2: textColor — re-add when token nameplates are re-implemented
  // const textColor = useThemeColor('--app-text-primary');
  void useThemeColor; // keep import alive — used by textColor in Phase 2

  // TODO Phase 1: resolvedGridColor — re-add when GridOverlay is re-implemented
  // const defaultGridColor = useThemeColor('--app-grid-color');
  // const resolvedGridColor = gridColor === DEFAULT_GRID_COLOR ? defaultGridColor : gridColor;
  void gridColor;
  void DEFAULT_GRID_COLOR; // keep imports alive for Phase 1

  // TODO Phase 1: Touch/Pinch State — re-add when PixiJS viewport touch is implemented
  // const lastPinchDistance = useRef<number | null>(null);
  // const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  // const lastPanCenter = useRef<{ x: number; y: number } | null>(null);

  // TODO Phase 1: PINCH_DISTANCE_THRESHOLD — re-add when PixiJS viewport touch is implemented
  // const PINCH_DISTANCE_THRESHOLD = Math.min(Math.max(touchSettings.pinchDistanceThreshold, 5), 50);

  // --- Navigation Functions ---

  // Helper function to clamp viewport position within bounds
  const clampPosition = useCallback(
    (newPos: { x: number; y: number }, newScale: number) => {
      // Calculate bounds including both map and token positions
      let bounds = {
        minX: -5000,
        maxX: 5000,
        minY: -5000,
        maxY: 5000,
      };

      if (map) {
        bounds = {
          minX: map.x,
          maxX: map.x + map.width * map.scale,
          minY: map.y,
          maxY: map.y + map.height * map.scale,
        };
      }

      // Expand bounds to include PC tokens (so we can always navigate to party)
      const pcTokens = resolvedTokens.filter((t) => t.type === 'PC');
      if (pcTokens.length > 0) {
        pcTokens.forEach((token) => {
          const tokenSize = gridSize * token.scale;
          bounds.minX = Math.min(bounds.minX, token.x);
          bounds.minY = Math.min(bounds.minY, token.y);
          bounds.maxX = Math.max(bounds.maxX, token.x + tokenSize);
          bounds.maxY = Math.max(bounds.maxY, token.y + tokenSize);
        });
      }

      const viewportCenterX = (-newPos.x + size.width / 2) / newScale;
      const viewportCenterY = (-newPos.y + size.height / 2) / newScale;

      // Apply padding around bounds
      const allowedMinX = bounds.minX - VIEWPORT_CLAMP_PADDING;
      const allowedMaxX = bounds.maxX + VIEWPORT_CLAMP_PADDING;
      const allowedMinY = bounds.minY - VIEWPORT_CLAMP_PADDING;
      const allowedMaxY = bounds.maxY + VIEWPORT_CLAMP_PADDING;

      // Hard clamp center
      const clampedCenterX = Math.max(allowedMinX, Math.min(allowedMaxX, viewportCenterX));
      const clampedCenterY = Math.max(allowedMinY, Math.min(allowedMaxY, viewportCenterY));

      // Convert back to Stage Position
      return {
        x: -(clampedCenterX * newScale - size.width / 2),
        y: -(clampedCenterY * newScale - size.height / 2),
      };
    },
    [map, gridSize, size.width, size.height, resolvedTokens],
  );

  // Reusable zoom function
  const performZoom = useCallback(
    (
      newScale: number,
      centerX: number,
      centerY: number,
      currentScale: number,
      currentPos: { x: number; y: number },
    ) => {
      // Apply min/max constraints
      const constrainedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      const pointTo = {
        x: (centerX - currentPos.x) / currentScale,
        y: (centerY - currentPos.y) / currentScale,
      };

      const newPos = {
        x: centerX - pointTo.x * constrainedScale,
        y: centerY - pointTo.y * constrainedScale,
      };

      // Clamp position to prevent getting lost in the void
      const clampedPos = clampPosition(newPos, constrainedScale);

      setScale(constrainedScale);
      setPosition(clampedPos);
    },
    [clampPosition],
  );

  // Keyboard zoom (centered on viewport)
  const handleKeyboardZoom = useCallback(
    (zoomIn: boolean) => {
      if (!containerRef.current) {
        return;
      }

      const centerX = size.width / 2;
      const centerY = size.height / 2;
      const newScale = zoomIn ? scale * ZOOM_SCALE_BY : scale / ZOOM_SCALE_BY;

      performZoom(newScale, centerX, centerY, scale, position);
    },
    [scale, position, size.width, size.height, performZoom],
  );

  // --- Keyboard & Drop Hooks (depend on navigation functions) ---

  // Keyboard events: modifier keys (Alt, M, Space), deletion, zoom, grid shortcuts
  // isAltPressed, isMKeyPressed, isSpacePressed will be re-used in Phases 1/2/5
  // isSpacePressed for pan cursor, isAltPressed for duplication, isMKeyPressed for movement range
  const {
    isAltPressed: _isAltPressed,
    isMKeyPressed: _isMKeyPressed,
    isSpacePressed: _isSpacePressed,
  } = useCanvasKeyboard({
    isWorldView,
    selectedIds,
    activeMeasurement,
    removeTokens,
    removeDrawings,
    removeDoors,
    handleKeyboardZoom,
    setActiveMeasurement,
    setGridType,
    setSelectedIds,
    showToast,
  });

  // File drop + image crop handling
  const { handleDragOver, handleDrop, handleCropConfirm, handleCropCancel, pendingCrop } =
    useCanvasDrop({
      isWorldView,
      containerRef,
      position,
      scale,
      gridSize,
      gridType,
      addToken,
      showToast,
    });

  // TODO Phase 2: useTokenDrag + useCanvasInteraction — Konva-based interaction hooks
  // These hooks depend on KonvaEventObject and Konva stage refs; they will be
  // re-implemented using PixiJS FederatedPointerEvent in Phase 2 and 5.

  // TODO Phase 2: useTokenDrag
  // const shouldRejectRef = useRef<
  //   (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => boolean
  // >(() => false);
  // const trackStylusRef = useRef<
  //   (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void
  // >(() => {});
  // const {
  //   handleTokenPointerDown,
  //   handleTokenPointerMove: internalHandleTokenPointerMove,
  //   handleTokenPointerUp,
  //   dragPositionsRef,
  //   tokenNodesRef,
  //   draggingTokenIds,
  //   itemsForDuplication,
  //   setItemsForDuplication,
  //   snapPreviewPositionsRef,
  //   isDragging: isDraggingToken,
  // } = useTokenDrag({ ... });

  // TODO Phase 5: useCanvasInteraction
  // const canvasInteraction = useCanvasInteraction({ ... });
  // const { handlePointerDown, handlePointerMove, handlePointerUp,
  //         trackStylusUsage, shouldRejectPointerEvent } = canvasInteraction;
  // useEffect(() => {
  //   shouldRejectRef.current = shouldRejectPointerEvent;
  //   trackStylusRef.current = trackStylusUsage;
  // }, [shouldRejectPointerEvent, trackStylusUsage]);

  // TODO Phase 2: drag/interaction state stubs — will be replaced by useTokenDrag in Phase 2
  // const dragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // const draggingTokenIds = new Set<string>();
  // TODO Phase 2: isDraggingToken — re-add when useTokenDrag is implemented
  // const isDraggingToken = false;
  // const [itemsForDuplication, setItemsForDuplication] = useState<string[]>([]);
  // const snapPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // TODO Phase 1: getCursorStyle — re-add when PixiJS viewport is wired; apply to container div
  // const getCursorStyle = useCallback((): React.CSSProperties['cursor'] => {
  //   if (isSpacePressed && isDragging) return 'grabbing';
  //   if (isSpacePressed) return 'grab';
  //   if (isDraggingToken) return 'grabbing';
  //   if (tool === 'select') return 'default';
  //   return 'crosshair';
  // }, [isSpacePressed, isDragging, isDraggingToken, tool]);

  // --- Effects ---

  useEffect(() => {
    const handleResize = (): void => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // TODO Phase 1: Multi-Touch Gesture Handlers — will be re-implemented with PixiJS viewport
  // These handlers used KonvaEventObject and Konva Stage methods (stage.scaleX(), etc.)
  // They will be replaced with PixiJS-native pan/zoom in Phase 1 (usePixiViewport).
  //
  // const handleTouchStart = (e: KonvaEventObject<TouchEvent>): void => { ... };
  // const handleTouchMove = (e: KonvaEventObject<TouchEvent>): void => { ... };
  // const handleTouchEnd = (e: KonvaEventObject<TouchEvent>): void => { ... };

  // --- Viewport Calculations ---

  // TODO Phase 1: visibleBounds — re-add when GridOverlay/PaperNoiseOverlay are re-implemented
  // const visibleBounds = useMemo(
  //   () => ({
  //     x: -position.x / scale,
  //     y: -position.y / scale,
  //     width: size.width / scale,
  //     height: size.height / scale,
  //   }),
  //   [position.x, position.y, scale, size.width, size.height],
  // );

  // TODO Phase 1: handleWheel — will be re-implemented with PixiJS viewport
  // This handler used Konva Stage methods (stage.scaleX(), stage.getPointerPosition(), etc.)
  // It will be replaced with PixiJS-native wheel zoom in Phase 1 (usePixiViewport).
  //
  // const handleWheel = (e: KonvaEventObject<WheelEvent>): void => { ... };

  const centerOnPCTokens = useCallback(() => {
    const pcTokens = resolvedTokens.filter((t) => t.type === 'PC');
    if (pcTokens.length === 0) {
      return;
    }

    // Calculate bounds of all PC tokens
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    pcTokens.forEach((token) => {
      const tokenSize = gridSize * token.scale;
      minX = Math.min(minX, token.x);
      minY = Math.min(minY, token.y);
      maxX = Math.max(maxX, token.x + tokenSize);
      maxY = Math.max(maxY, token.y + tokenSize);
    });

    // Add some padding around the tokens
    const padding = gridSize * 2;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;

    // Calculate scale to fit
    const scaleX = size.width / boundsWidth;
    const scaleY = size.height / boundsHeight;
    let newScale = Math.min(scaleX, scaleY, MAX_SCALE); // Don't zoom in too much
    newScale = Math.max(newScale, MIN_SCALE);

    // Calculate center of the bounds
    const centerX = minX + boundsWidth / 2;
    const centerY = minY + boundsHeight / 2;

    // Calculate position to center the bounds
    const newX = -(centerX * newScale - size.width / 2);
    const newY = -(centerY * newScale - size.height / 2);

    const clampedPos = clampPosition({ x: newX, y: newY }, newScale);

    setScale(newScale);
    setPosition(clampedPos);
  }, [resolvedTokens, gridSize, size, clampPosition]);

  // Navigate to a specific world coordinate (used by minimap)
  const navigateToWorldPosition = useCallback(
    (worldX: number, worldY: number) => {
      const newX = -(worldX * scale - size.width / 2);
      const newY = -(worldY * scale - size.height / 2);

      const clampedPos = clampPosition({ x: newX, y: newY }, scale);
      setPosition(clampedPos);
    },
    [scale, size, clampPosition],
  );

  // ==========================================================================
  // JSX — Canvas Layer Composition
  // ==========================================================================

  return (
    <div
      ref={containerRef}
      className="canvas-container w-full h-full overflow-hidden relative"
      role="region"
      aria-label="Game canvas"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Accessibility layer: screen reader announcements + keyboard token navigation */}
      <CanvasAccessibility
        tool={tool}
        selectedTokenIds={selectedIds}
        onSelectToken={(id) => setSelectedIds([id])}
        isWorldView={isWorldView}
      />
      {pendingCrop && (
        <AssetProcessingErrorBoundary>
          <ImageCropper
            imageSrc={pendingCrop.src}
            onConfirm={(blob) => void handleCropConfirm(blob)}
            onCancel={handleCropCancel}
          />
        </AssetProcessingErrorBoundary>
      )}

      {/* PixiJS Application — Phase 0 scaffold: blank canvas replacing Konva Stage */}
      {/* All Konva layers are commented out below as TODO items for Phases 1–5 */}
      {/* ApplicationOptions are spread as direct props per @pixi/react v8 API */}
      <Application
        width={size.width}
        height={size.height}
        onInit={(app: PixiApplication) => {
          pixiAppRef.current = app;
        }}
        background={0x1a1008}
        antialias
        resolution={PERFORMANCE_CONFIG.maxPixelRatio}
        autoDensity
      >
        {/* TODO Phase 1: GridOverlay — PixiJS Graphics grid */}
        {/* TODO Phase 1: MapBackground (was URLImage) — PixiJS Sprite for map image */}
        {/* TODO Phase 1: PaperNoiseOverlay — PixiJS TilingSprite for texture */}
        {/* TODO Phase 2: TokenLayer — PixiJS Sprite per token with FederatedPointerEvent drag */}
        {/* TODO Phase 2: SelectionRect — PixiJS Graphics selection rectangle */}
        {/* TODO Phase 2: Transformer — PixiJS resize/rotate handles */}
        {/* TODO Phase 3: FogOfWarLayer — PixiJS shader-based fog */}
        {/* TODO Phase 4: DrawingLayer — PixiJS Mesh/Graphics for pressure-sensitive lines */}
        {/* TODO Phase 4: PressureSensitiveLine — PixiJS Mesh geometry */}
        {/* TODO Phase 5: DoorLayer */}
        {/* TODO Phase 5: StairsLayer */}
        {/* TODO Phase 5: MeasurementOverlay */}
        {/* TODO Phase 5: MovementRangeOverlay */}
        {/* TODO Phase 5: DoorPreview (was Rect) */}
        {/* TODO Phase 5: SnapPreview (was Group+Line) */}
        {/* TODO Phase 5: CalibrationOverlay (was Rect) */}
      </Application>

      {/* World View Controls */}
      {isWorldView && (
        <>
          {/* Center on Party Button */}
          <div className="absolute bottom-4 right-4 z-50">
            <button
              className="bg-neutral-800 text-white border border-neutral-600 hover:bg-neutral-700 px-4 py-2 rounded shadow flex items-center gap-2"
              onClick={centerOnPCTokens}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </svg>
              Center on Party
            </button>
          </div>

          {/* Minimap for Navigation */}
          <MinimapErrorBoundary>
            <Minimap
              position={position}
              scale={scale}
              viewportSize={size}
              map={map}
              tokens={resolvedTokens}
              onNavigate={navigateToWorldPosition}
            />
          </MinimapErrorBoundary>
        </>
      )}

      {/* Door Context Menu */}
      {doorContextMenu &&
        (() => {
          const door = doors.find((d) => d.id === doorContextMenu.doorId);
          if (!door) {
            return null;
          }
          return (
            <DoorContextMenu
              door={door}
              x={doorContextMenu.x}
              y={doorContextMenu.y}
              onToggleDoor={toggleDoor}
              onUpdateDoorLock={updateDoorLock}
              onRemoveDoor={removeDoor}
              onClose={closeDoorContextMenu}
            />
          );
        })()}
    </div>
  );
}

export default memo(CanvasManager);
