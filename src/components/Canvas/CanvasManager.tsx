import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import type React from 'react';

import { Stage, Layer, Line, Rect, Transformer, Group, Text, Circle } from 'react-konva';
import { useShallow } from 'zustand/shallow';

// eslint-disable-next-line import/no-named-as-default
import CanvasAccessibility from './CanvasAccessibility';
import CanvasOverlayErrorBoundary from './CanvasOverlayErrorBoundary';
import DoorContextMenu from './DoorContextMenu';
import DoorLayer from './DoorLayer';
import FogOfWarLayer from './FogOfWarLayer';
import GridOverlay from './GridOverlay';
import ImageCropper from '../Dialogs/ImageCropper';
import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import { useCanvasDrop } from './hooks/useCanvasDrop';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { useTokenDrag } from './hooks/useTokenDrag';
// eslint-disable-next-line import/no-named-as-default
import MeasurementOverlay from './MeasurementOverlay';
import Minimap from './Minimap';
import MinimapErrorBoundary from './MinimapErrorBoundary';
import MovementRangeOverlay from './MovementRangeOverlay';
import PaperNoiseOverlay from './PaperNoiseOverlay';
import PressureSensitiveLine from './PressureSensitiveLine';
import StairsLayer from './StairsLayer';
import URLImage from './URLImage';
import { useThemeColor } from '../../hooks/useThemeColor';
import { resolveTokenData, DEFAULT_MOVEMENT_SPEED } from '../../hooks/useTokenData';
import { useGameStore } from '../../store/gameStore';
import { useTouchSettingsStore } from '../../store/touchSettingsStore';
import { useUiStore } from '../../store/uiStore';
import { DEFAULT_GRID_COLOR } from '../../types/domain';
import { isRectInAnyPolygon } from '../../types/geometry';
import { createGridGeometry } from '../../utils/gridGeometry';
import AssetProcessingErrorBoundary from '../ErrorBoundaries/AssetProcessingErrorBoundary';
import TokenErrorBoundary from '../ErrorBoundaries/TokenErrorBoundary';

import type { KonvaEventObject } from 'konva/lib/Node';

// Enable to log canvas state diagnostics to console on each render
const DEBUG_CANVAS = false;

// Canvas rendering colors — sourced from theme tokens (see theme.css)
// Konva renders to <canvas>, so CSS variables aren't available directly.
// These constants mirror the tokens defined in theme.css.
const CANVAS_COLORS = {
  markerDefault: '#df4b26', // --app-canvas-marker-default
  selectionFill: 'rgba(37, 99, 235, 0.3)', // --app-canvas-selection-fill
  selectionStroke: '#2563eb', // --app-canvas-selection-stroke
  snapFill: 'rgba(37, 99, 235, 0.1)', // --app-canvas-snap-fill
  snapStroke: 'rgba(37, 99, 235, 0.6)', // --app-canvas-snap-stroke
  calibrationFill: 'rgba(255, 0, 0, 0.2)', // --app-canvas-calibration-fill
  calibrationStroke: '#ef4444', // --app-canvas-calibration-stroke (using ef4444 instead of 'red')
  doorPreviewFill: 'rgba(255, 255, 255, 0.5)', // --app-door-preview-fill
  doorPreviewStroke: 'white', // --app-door-preview-stroke
  wallStroke: '#000000', // --app-wall-stroke
  snapTargetStroke: '#2563eb', // --app-canvas-selection-stroke (reused)
  tokenShadowHover: 'rgba(0, 0, 0, 0.6)', // --app-token-shadow-hover
  tokenShadow: 'rgba(0, 0, 0, 0.4)', // --app-token-shadow
} as const;

// Zoom constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SCALE_BY = 1.1;
const MIN_PINCH_DISTANCE = 0.001; // Guard against near-zero division or very small distances that could cause extreme scale changes
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
 * Props for CanvasManager component
 *
 * @property {string} tool - Active drawing/interaction tool (select, marker, eraser, wall, door, measure)
 * @property {string} color - Color for marker tool (hex format)
 * @property {string} doorOrientation - Orientation for door placement (horizontal, vertical)
 * @property {boolean} isWorldView - If true, restricts interactions for player-facing World View
 * @property {MeasurementMode} measurementMode - Active measurement mode (ruler, blast, cone)
 */
interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
  color?: string;
  doorOrientation?: 'horizontal' | 'vertical';
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
// eslint-disable-next-line max-lines-per-function, complexity
function CanvasManager({
  tool = 'select',
  color = CANVAS_COLORS.markerDefault,
  doorOrientation = 'horizontal',
  isWorldView = false,
  onSelectionChange,
  // measurementMode = 'ruler', // Unused currently
}: CanvasManagerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // --- Store Selectors (atomic to prevent infinite re-render loops) ---
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
  const touchSettings = useTouchSettingsStore();
  const stylusActiveRef = useRef(false);
  const lastStylusLiftTimeRef = useRef(0);

  // Measurement state
  const activeMeasurement = useGameStore((s) => s.activeMeasurement);
  const dmMeasurement = useGameStore((s) => s.dmMeasurement);

  // Store actions (stable references from Zustand)
  const addToken = useGameStore((s) => s.addToken);
  const addDrawing = useGameStore((s) => s.addDrawing);
  const updateTokenTransform = useGameStore((s) => s.updateTokenTransform);
  const removeTokens = useGameStore((s) => s.removeTokens);
  const removeDrawings = useGameStore((s) => s.removeDrawings);
  const setGridType = useGameStore((s) => s.setGridType);
  const toggleDoor = useGameStore((s) => s.toggleDoor);
  const addDoor = useGameStore((s) => s.addDoor);
  const removeDoor = useGameStore((s) => s.removeDoor);
  const removeDoors = useGameStore((s) => s.removeDoors);
  const updateDoorLock = useGameStore((s) => s.updateDoorLock);
  const updateDrawingTransform = useGameStore((s) => s.updateDrawingTransform);
  const setActiveMeasurement = useGameStore((s) => s.setActiveMeasurement);
  const showToast = useUiStore((s) => s.showToast);

  // --- Extracted Hooks ---

  // Drawing/measurement/calibration state (refs + state for useCanvasInteraction)
  const {
    isDrawing,
    currentLine,
    tempLine,
    setTempLine,
    tempLineRef,
    drawingAnimationFrameRef,
    doorPreviewPos,
    setDoorPreviewPos,
    isMeasuring,
    measurementStart,
    calibrationStart,
    calibrationRect,
    setCalibrationRect,
  } = useCanvasDrawing();

  // Selection state (selectedIds, transformer, selection rect)
  const {
    selectedIds,
    setSelectedIds,
    hoveredTokenId,
    setHoveredTokenId,
    selectionRect,
    setSelectionRect,
    selectionStart,
    selectionRectRef,
    selectionRectCoordsRef,
    transformerRef,
  } = useCanvasSelection({ onSelectionChange });

  // Stable no-op handler for disabled Konva drag events (defined once to prevent re-renders)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const emptyDragHandler = useCallback(() => {}, []);

  // Door context menu state
  const [doorContextMenu, setDoorContextMenu] = useState<{
    doorId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleDoorContextMenu = useCallback((doorId: string, screenX: number, screenY: number) => {
    if (!containerRef.current) {
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    setDoorContextMenu({
      doorId,
      x: screenX - rect.left,
      y: screenY - rect.top,
    });
  }, []);

  const closeDoorContextMenu = useCallback(() => {
    setDoorContextMenu(null);
  }, []);

  // --- Navigation State ---
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Theme-aware text color for contrast
  const textColor = useThemeColor('--app-text-primary');

  // Theme-aware grid color (Adaptive default)
  const defaultGridColor = useThemeColor('--app-grid-color');
  const resolvedGridColor = gridColor === DEFAULT_GRID_COLOR ? defaultGridColor : gridColor;

  // Touch/Pinch State
  const lastPinchDistance = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const lastPanCenter = useRef<{ x: number; y: number } | null>(null);

  // Use pinch distance threshold from settings (user-configurable)
  // Clamp to reasonable range (5-50 pixels) to prevent gesture detection issues
  const PINCH_DISTANCE_THRESHOLD = Math.min(Math.max(touchSettings.pinchDistanceThreshold, 5), 50);

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
  const { isAltPressed, isMKeyPressed, isSpacePressed } = useCanvasKeyboard({
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

  // --- Existing Interaction Hooks ---

  // Refs to break circular dependency between useTokenDrag and useCanvasInteraction
  const shouldRejectRef = useRef<
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => boolean
  >(() => false);
  const trackStylusRef = useRef<
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  >(() => {});

  const {
    handleTokenPointerDown,
    handleTokenPointerMove: internalHandleTokenPointerMove,
    handleTokenPointerUp,
    dragPositionsRef,
    tokenNodesRef,
    draggingTokenIds,
    itemsForDuplication,
    setItemsForDuplication,
    snapPreviewPositionsRef,
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
    doorOrientation,
    addDoor,
    calibrationStart,
    setCalibrationRect,
    setSelectedIds,
    setActiveMeasurement,
    addDrawing,
  });

  // Destructure handlers from canvasInteraction
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    trackStylusUsage,
    shouldRejectPointerEvent,
  } = canvasInteraction;

  // Update refs with actual handlers (breaks circular dependency)
  useEffect(() => {
    shouldRejectRef.current = shouldRejectPointerEvent;
    trackStylusRef.current = trackStylusUsage;
  }, [shouldRejectPointerEvent, trackStylusUsage]);

  /**
   * Determines the appropriate cursor style based on current interaction state.
   * Priority order: space+panning → space → token dragging → select → crosshair
   */
  const getCursorStyle = useCallback((): React.CSSProperties['cursor'] => {
    if (isSpacePressed && isDragging) {
      return 'grabbing';
    }
    if (isSpacePressed) {
      return 'grab';
    }
    if (isDraggingToken) {
      return 'grabbing';
    }
    if (tool === 'select') {
      return 'default';
    }
    return 'crosshair';
  }, [isSpacePressed, isDragging, isDraggingToken, tool]);

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

  // --- Multi-Touch Gesture Handlers ---
  // These handlers ONLY process multi-touch gestures (2+ fingers).
  // Single-touch interactions are handled by the unified pointer event handlers
  // (handlePointerDown/Move/Up) which support mouse, touch, and pen input.

  const handleTouchStart = (e: KonvaEventObject<TouchEvent>): void => {
    const touches = e.evt.touches;
    // ONLY handle 2+ finger gestures (pinch-to-zoom)
    if (touches.length === 2) {
      e.evt.preventDefault();
      const touch1 = touches[0];
      const touch2 = touches[1];
      if (!touch1 || !touch2) {
        return;
      }
      lastPinchDistance.current = calculatePinchDistance(touch1, touch2);
      lastPinchCenter.current = calculatePinchCenter(touch1, touch2);
    } else if (touches.length === 1 && tool !== 'select') {
      // If using a drawing tool with a single finger, prevent default
      // to stop scrolling/text selection
      e.evt.preventDefault();
    }
    // Single-touch events are handled by handlePointerDown
  };

  const handleTouchMove = (e: KonvaEventObject<TouchEvent>): void => {
    const touches = e.evt.touches;
    // ONLY handle 2-finger gestures (pinch-to-zoom or two-finger pan)
    if (touches.length === 2) {
      e.evt.preventDefault();

      if (lastPinchDistance.current && lastPinchCenter.current) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        if (!touch1 || !touch2) {
          return;
        }
        const distance = calculatePinchDistance(touch1, touch2);
        const center = calculatePinchCenter(touch1, touch2);

        // Prevent division by zero
        if (lastPinchDistance.current < MIN_PINCH_DISTANCE) {
          return;
        }

        // Calculate distance change to determine gesture type
        const distanceChange = Math.abs(distance - lastPinchDistance.current);
        const isPinchGesture = distanceChange > PINCH_DISTANCE_THRESHOLD;

        if (isPinchGesture) {
          // PINCH-TO-ZOOM: Fingers moving together/apart
          const stageRect = containerRef.current?.getBoundingClientRect();
          if (!stageRect) {
            return;
          }

          const canvasX = center.x - stageRect.left;
          const canvasY = center.y - stageRect.top;

          // Calculate scale change
          const scaleChange = distance / lastPinchDistance.current;
          const newScale = scale * scaleChange;

          // Use the pinch center for zoom
          performZoom(newScale, canvasX, canvasY, scale, position);

          lastPinchDistance.current = distance;
          lastPinchCenter.current = center;
          lastPanCenter.current = null; // Reset pan tracking
        } else if (lastPanCenter.current) {
          // TWO-FINGER PAN: Fingers moving together without changing distance
          const dx = center.x - lastPanCenter.current.x;
          const dy = center.y - lastPanCenter.current.y;

          // Update canvas position (pan)
          const newPos = {
            x: position.x + dx,
            y: position.y + dy,
          };

          // Clamp to valid bounds and update position
          const clampedPos = clampPosition(newPos, scale);
          setPosition(clampedPos);

          lastPanCenter.current = center;
        } else {
          // Initialize pan tracking
          lastPanCenter.current = center;
        }
      }
    } else if (touches.length === 1 && tool !== 'select') {
      // If using a drawing tool with a single finger, prevent default
      // to stop scrolling/text selection while drawing
      e.evt.preventDefault();
    }
    // Single-touch events are handled by handlePointerMove
  };

  const handleTouchEnd = (e: KonvaEventObject<TouchEvent>): void => {
    const touches = e.evt.touches;
    // Reset gesture state when fewer than 2 fingers remain
    if (touches.length < 2) {
      lastPinchDistance.current = null;
      lastPinchCenter.current = null;
      lastPanCenter.current = null;
    }
    // Single-touch events are handled by handlePointerUp
  };

  // --- Viewport Calculations ---

  // Calculate visible bounds in CANVAS coordinates (unscaled)
  // Memoized to prevent recalculation on every render
  const visibleBounds = useMemo(
    () => ({
      x: -position.x / scale,
      y: -position.y / scale,
      width: size.width / scale,
      height: size.height / scale,
    }),
    [position.x, position.y, scale, size.width, size.height],
  );

  const handleWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) {
      return;
    }

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    // Zoom with Ctrl/Cmd + scroll
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const newScale = e.evt.deltaY < 0 ? oldScale * ZOOM_SCALE_BY : oldScale / ZOOM_SCALE_BY;
      performZoom(newScale, pointer.x, pointer.y, oldScale, { x: stage.x(), y: stage.y() });
    } else {
      // Pan
      const rawNewPos = {
        x: stage.x() - e.evt.deltaX,
        y: stage.y() - e.evt.deltaY,
      };
      const clampedPos = clampPosition(rawNewPos, scale);
      setPosition(clampedPos);
    }
  };

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

      <Stage
        width={size.width}
        height={size.height}
        pixelRatio={PERFORMANCE_CONFIG.maxPixelRatio}
        draggable={isSpacePressed}
        // Unified Pointer Events API - handles mouse, touch, and pen input
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        // Multi-touch gestures (pinch-to-zoom) - 2+ fingers only
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onDragStart={(e) => {
          if (e.target === e.target.getStage()) {
            setIsDragging(true);
          }
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            const rawPos = { x: e.target.x(), y: e.target.y() };
            const clamped = clampPosition(rawPos, scale);
            setPosition(clamped);
            setIsDragging(false);
          }
        }}
        onDragMove={(e) => {
          // Intentionally no-op during drag — clamp only on drag end for smooth UX
          if (e.target === e.target.getStage()) {
            // No action needed here; see onDragEnd above.
          }
        }}
        style={{
          cursor: getCursorStyle(),
        }}
      >
        {/* Layer 1: Background & Map (Listening False to let internal events pass to Stage for selection) */}
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
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              onSelect={() => {}}
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              onDragEnd={() => {}}
            />
          )}

          {/* Paper Noise Texture Overlay - Adds texture to entire canvas background */}
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

        {/* Fog of War Layer moved below Drawings Layer to correct occlusion */}

        {/* Layer 2: Drawings (Separate layer so Eraser doesn't erase map) */}
        <Layer>
          {isAltPressed &&
            drawings
              .filter((d) => itemsForDuplication.includes(d.id))
              .map((ghostLine) => (
                <Line
                  key={`ghost-${ghostLine.id}`}
                  id={`ghost-${ghostLine.id}`}
                  name="ghost-drawing"
                  points={ghostLine.points}
                  stroke={ghostLine.color}
                  strokeWidth={ghostLine.size}
                  tension={0.5}
                  lineCap="round"
                  dash={ghostLine.tool === 'wall' ? [10, 5] : undefined}
                  opacity={
                    ghostLine.tool === 'wall' && isWorldView
                      ? 1 // Always visible
                      : 0.5
                  }
                  listening={false}
                />
              ))}

          {drawings.map((line) => {
            // Common props shared by both component types
            const commonProps = {
              id: line.id,
              name: 'drawing' as const,
              points: line.points,
              x: line.x ?? 0,
              y: line.y ?? 0,
              // Apply uniform scaling (line.scale is a single number applied to both axes)
              scaleX: line.scale ?? 1,
              scaleY: line.scale ?? 1,
              stroke: line.tool === 'wall' && isWorldView ? CANVAS_COLORS.wallStroke : line.color,
              strokeWidth:
                line.tool === 'wall' && isWorldView
                  ? 6 // Fixed thickness for World View
                  : line.size,
              lineCap: 'round' as const,
              // Always visible in World View (unless fog covers it)
              opacity: 1,
              globalCompositeOperation:
                line.tool === 'eraser' ? ('destination-out' as const) : ('source-over' as const),
              draggable: tool === 'select' && line.tool !== 'wall',
            };

            // Event handlers (shared by both component types)
            const eventHandlers = {
              onClick: (e: KonvaEventObject<MouseEvent>) => {
                if (tool === 'select' && line.tool !== 'wall') {
                  e.evt.stopPropagation();
                  if (e.evt.shiftKey) {
                    if (selectedIds.includes(line.id)) {
                      setSelectedIds(selectedIds.filter((id) => id !== line.id));
                    } else {
                      setSelectedIds([...selectedIds, line.id]);
                    }
                  } else {
                    setSelectedIds([line.id]);
                  }
                }
              },
              onDragStart: () => {
                if (selectedIds.includes(line.id)) {
                  setItemsForDuplication(selectedIds);
                } else {
                  setItemsForDuplication([line.id]);
                }
              },
              onDragEnd: (e: KonvaEventObject<MouseEvent>) => {
                const node = e.target;
                const x = node.x();
                const y = node.y();

                // Duplication Logic (Option/Alt + Drag)
                // BLOCKED in World View (players cannot duplicate drawings)
                // Use isAltPressed state for consistency instead of e.evt.altKey
                if (isAltPressed && !isWorldView) {
                  const idsToDuplicate = selectedIds.includes(line.id) ? selectedIds : [line.id];
                  idsToDuplicate.forEach((id) => {
                    // Only duplicate drawings here; tokens are handled in their own handler.
                    const drawing = drawings.find((d) => d.id === id);
                    if (drawing) {
                      // Calculate drag offset and apply to all points
                      // Points array format: [x1, y1, x2, y2, ...] (alternating x,y coordinates)
                      const points = drawing.points;
                      const dx = x - (drawing.x ?? 0);
                      const dy = y - (drawing.y ?? 0);
                      // Offset all points by (dx, dy)
                      const newPoints = points.map(
                        (val, idx) => (idx % 2 === 0 ? val + dx : val + dy), // Even indices are X, odd are Y
                      );
                      addDrawing({
                        ...drawing,
                        id: crypto.randomUUID(),
                        points: newPoints,
                        x: 0,
                        y: 0,
                      });
                    }
                  });
                }

                // Update Position (Transform)
                updateDrawingTransform(line.id, x, y, line.scale ?? 1);

                setItemsForDuplication([]);
              },
            };

            // Use pressure-sensitive rendering if pressure data is available
            const hasPressureData = line.pressures && line.pressures.length > 0;

            // Render pressure-sensitive line or regular line with type-safe props
            if (hasPressureData) {
              return (
                <PressureSensitiveLine
                  key={line.id}
                  {...commonProps}
                  {...eventHandlers}
                  pressures={line.pressures}
                  pressureRange={touchSettings.getPressureRange()}
                />
              );
            } else {
              return (
                <Line
                  key={line.id}
                  {...commonProps}
                  {...eventHandlers}
                  tension={0.5}
                  dash={line.tool === 'wall' ? [10, 5] : undefined}
                />
              );
            }
          })}
          {/* Temp Line */}
          {tempLine && (
            <Line
              ref={tempLineRef}
              points={tempLine.points}
              stroke={tempLine.color}
              strokeWidth={tempLine.size}
              tension={0.5}
              lineCap="round"
              dash={tempLine.tool === 'wall' ? [10, 5] : undefined}
              opacity={1}
              globalCompositeOperation={
                tempLine.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          )}

          {/* Stairs (Architectural elements, rendered with drawings) */}
          <StairsLayer stairs={stairs} isWorldView={isWorldView} />
        </Layer>

        {/* Fog of War Layer (World View only) - Renders Overlay */}
        {/* Rendered AFTER Drawings so walls are properly hidden by fog */}
        {(() => {
          const shouldRenderFog = isWorldView && !isDaylightMode;
          return shouldRenderFog ? (
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
          ) : null;
        })()}

        {/* Layer 3: Tokens, Doors & UI */}
        <Layer>
          {/* Doors (Rendered after fog layer so they're visible on top of fog) */}
          <DoorLayer
            doors={doors}
            isWorldView={isWorldView}
            tool={tool}
            selectedIds={selectedIds}
            onToggleDoor={toggleDoor}
            onDeleteDoor={removeDoor}
            onDoorContextMenu={handleDoorContextMenu}
          />

          {/* Door Preview - Show preview when hovering with door tool */}
          {doorPreviewPos && tool === 'door' && !isWorldView && (
            <Rect
              x={doorPreviewPos.x - gridSize / 2}
              y={doorPreviewPos.y - gridSize / 2}
              width={doorOrientation === 'horizontal' ? gridSize : gridSize / 5}
              height={doorOrientation === 'horizontal' ? gridSize / 5 : gridSize}
              fill={CANVAS_COLORS.doorPreviewFill}
              stroke={CANVAS_COLORS.doorPreviewStroke}
              strokeWidth={2}
              listening={false}
            />
          )}

          {/* Snap Preview - Show where tokens will snap when released */}
          {isDraggingToken &&
            Array.from(snapPreviewPositionsRef.current.entries()).map(([tokenId, snapPos]) => {
              const token = resolvedTokens.find((t) => t.id === tokenId);
              if (!token) {
                return null;
              }

              const size = gridSize * token.scale;

              // Get the grid cell that the token will snap to
              const geometry = createGridGeometry(gridType);
              const snapCell = geometry.pixelToGrid(
                snapPos.x + size / 2,
                snapPos.y + size / 2,
                gridSize,
              );

              // Get the vertices of the grid cell for the snap preview
              const cellVertices = geometry.getCellVertices(snapCell, gridSize);
              const cellPoints = cellVertices.flatMap((v) => [v.x, v.y]);

              return (
                <Group key={`snap-preview-${tokenId}`}>
                  {/* Outer ring - actual grid cell shape */}
                  <Line
                    points={cellPoints}
                    stroke={CANVAS_COLORS.snapStroke}
                    strokeWidth={2}
                    listening={false}
                    dash={[8, 4]}
                    closed
                  />
                  {/* Inner fill - actual grid cell shape */}
                  <Line
                    points={cellPoints}
                    fill={CANVAS_COLORS.snapFill}
                    listening={false}
                    closed
                  />
                </Group>
              );
            })}

          {isAltPressed &&
            resolvedTokens
              .filter((t) => itemsForDuplication.includes(t.id))
              .map((ghostToken) => (
                <URLImage
                  key={`ghost-${ghostToken.id}`}
                  id={`ghost-${ghostToken.id}`} // Unique ID
                  src={ghostToken.src}
                  x={ghostToken.x}
                  y={ghostToken.y}
                  width={gridSize * ghostToken.scale}
                  height={gridSize * ghostToken.scale}
                  scaleX={1}
                  scaleY={1}
                  draggable={false}
                  listening={false}
                  opacity={0.5}
                  name="ghost-token"
                  // No-op handlers
                  // eslint-disable-next-line @typescript-eslint/no-empty-function
                  onSelect={() => {}}
                />
              ))}

          {/* Movement Range Overlay - Shows reachable cells for selected token (Hold M key) */}
          {isMKeyPressed &&
            !isWorldView &&
            selectedIds.length === 1 &&
            (() => {
              const selectedToken = resolvedTokens.find((t) => t.id === selectedIds[0]);
              if (!selectedToken) {
                return null;
              }

              // Use drag position if token is being dragged
              const dragPos = dragPositionsRef.current.get(selectedToken.id);
              const tokenPos = dragPos ?? { x: selectedToken.x, y: selectedToken.y };

              // Movement speed is resolved from token data
              const movementSpeed = selectedToken.movementSpeed ?? DEFAULT_MOVEMENT_SPEED;

              return (
                <CanvasOverlayErrorBoundary overlayName="MovementRangeOverlay">
                  <MovementRangeOverlay
                    tokenPosition={tokenPos}
                    movementSpeed={movementSpeed}
                    gridSize={gridSize}
                    gridType={gridType}
                  />
                </CanvasOverlayErrorBoundary>
              );
            })()}

          {resolvedTokens.map((token) => {
            // Use drag position if available (for real-time visual feedback)
            const dragPos = dragPositionsRef.current.get(token.id);
            const displayX = dragPos ? dragPos.x : token.x;
            const displayY = dragPos ? dragPos.y : token.y;
            const isDragging = draggingTokenIds.has(token.id);
            const isSelected = selectedIds.includes(token.id);
            const isHovered = hoveredTokenId === token.id && tool === 'select' && !isDragging;

            // Check if token should be visible based on Fog of War rules
            // In World View with Fog of War enabled:
            // - PC tokens: Always visible (players need to see their own characters)
            // - NPC tokens: Only visible in active vision areas (hidden in explored-but-not-visible areas)
            // In DM mode (Architect View) or Daylight mode: All tokens always visible
            let isVisible = true;
            if (isWorldView && !isDaylightMode) {
              if (token.type === 'NPC') {
                // NPCs only visible in active vision
                isVisible = isRectInAnyPolygon(
                  displayX,
                  displayY,
                  gridSize * token.scale,
                  gridSize * token.scale,
                  activeVisionPolygons,
                );
              }
              // PC tokens always visible (type === 'PC' or undefined)
            }

            // Don't render tokens that aren't visible
            if (!isVisible) {
              return null;
            }

            /**
             * Visual Effects & Performance
             *
             * Tokens render with dynamic shadows and scaling for visual feedback:
             * - Hover state: Enhanced shadow (12px blur) + 2% scale increase
             * - Dragging state: Strong shadow (20px blur) + 5% scale + opacity change
             *
             * Performance optimizations:
             * - shadowForStrokeEnabled=false (only shadow fills, not strokes)
             * - RAF-throttled batchDraw() during drag (limited to browser refresh rate, typically 60fps)
             * - Konva-level caching for complex visual effects
             * - Resting state has no shadow to reduce continuous rendering cost
             */
            const getVisualProps = (): {
              shadowForStrokeEnabled: boolean;
              scaleX: number;
              scaleY: number;
              opacity?: number;
              shadowColor?: string;
              shadowBlur?: number;
              shadowOffsetX?: number;
              shadowOffsetY?: number;
            } => {
              // Common performance optimization: disable shadow for strokes
              const baseShadowProps = {
                shadowForStrokeEnabled: false, // Performance: Only shadow fill, not stroke
              };

              if (isDragging) {
                return {
                  ...baseShadowProps,
                  opacity: 0.5,
                  scaleX: 1.05,
                  scaleY: 1.05,
                  shadowColor: CANVAS_COLORS.tokenShadowHover,
                  shadowBlur: 20,
                  shadowOffsetX: 5,
                  shadowOffsetY: 5,
                };
              }
              if (isHovered) {
                return {
                  ...baseShadowProps,
                  scaleX: 1.02,
                  scaleY: 1.02,
                  shadowColor: CANVAS_COLORS.tokenShadow,
                  shadowBlur: 12,
                  shadowOffsetX: 2,
                  shadowOffsetY: 2,
                };
              }
              // Resting state - no shadow for better performance
              return {
                ...baseShadowProps,
                scaleX: 1,
                scaleY: 1,
              };
            };

            const visualProps = getVisualProps();
            const safeScale = token.scale ?? 1;
            const tokenHeight = gridSize * safeScale;

            /**
             * Isometric "Standing" Offset
             *
             * In ISOMETRIC view, tokens appear as if standing upright on the diamond-shaped
             * tile with their "feet" anchored to the tile center. Shifting the image up by
             * half its height creates this illusion. The offset is proportional to token size.
             */
            const displayYOffset = gridType === 'ISOMETRIC' ? -(tokenHeight / 2) : 0;
            const finalDisplayY = displayY + displayYOffset;

            return (
              <Group key={token.id}>
                <TokenErrorBoundary tokenId={token.id} onShowToast={showToast}>
                  <URLImage
                    ref={(node) => {
                      if (node) {
                        tokenNodesRef.current.set(token.id, node);
                      } else {
                        tokenNodesRef.current.delete(token.id);
                      }
                    }}
                    name="token"
                    id={token.id}
                    src={token.src}
                    x={displayX}
                    y={finalDisplayY}
                    width={gridSize * safeScale}
                    height={tokenHeight}
                    draggable={false}
                    // Visual props (scaleX, scaleY, opacity, shadow) are transformation properties
                    // that multiply with base dimensions to create hover/drag feedback effects
                    {...visualProps}
                    onSelect={(e) => handleTokenPointerDown(e, token.id)}
                    onMouseEnter={() => tool === 'select' && setHoveredTokenId(token.id)}
                    onMouseLeave={() => tool === 'select' && setHoveredTokenId(null)}
                    onDragStart={emptyDragHandler}
                    onDragMove={emptyDragHandler}
                    onDragEnd={emptyDragHandler}
                  />
                  {/* Selection border - enhanced with glow effect */}
                  {/* Hide when dragging to prevent double-circle visual clutter (selection + snap preview) */}
                  {isSelected && !isDragging && (
                    <Circle
                      x={displayX + (gridSize * safeScale) / 2}
                      y={finalDisplayY + (gridSize * safeScale) / 2}
                      radius={(gridSize * safeScale) / 2 + 2}
                      stroke={CANVAS_COLORS.selectionStroke}
                      strokeWidth={3}
                      shadowColor={CANVAS_COLORS.snapTargetStroke}
                      shadowBlur={8}
                      shadowEnabled
                      listening={false}
                      dash={[8, 4]}
                    />
                  )}
                </TokenErrorBoundary>

                {/* Token Nameplate - Rendered outside ErrorBoundary to prevent nesting issues */}
                {token.name && (
                  <Text
                    text={token.name}
                    fontSize={12}
                    fontFamily="IBM Plex Sans, sans-serif"
                    fill={textColor}
                    fontStyle="bold"
                    align="center"
                    verticalAlign="middle"
                    width={gridSize * safeScale * 2}
                    x={displayX - (gridSize * safeScale) / 2}
                    y={displayY + gridSize * safeScale + 8}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {/* Selection Rect */}
          {selectionRect.isVisible && (
            <Rect
              ref={selectionRectRef}
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill={CANVAS_COLORS.selectionFill}
              stroke={CANVAS_COLORS.selectionStroke}
              listening={false}
            />
          )}

          {/* Calibration Overlay */}
          {isCalibrating && calibrationRect && (
            <Rect
              x={calibrationRect.x}
              y={calibrationRect.y}
              width={calibrationRect.width}
              height={calibrationRect.height}
              fill={CANVAS_COLORS.calibrationFill}
              stroke={CANVAS_COLORS.calibrationStroke}
              dash={[5, 5]}
              listening={false}
            />
          )}

          {/* Measurement Overlay - Shows active measurement (Architect View) or DM's broadcast (World View) */}
          <CanvasOverlayErrorBoundary overlayName="MeasurementOverlay">
            <MeasurementOverlay
              measurement={isWorldView ? dmMeasurement : activeMeasurement}
              gridSize={gridSize}
            />
          </CanvasOverlayErrorBoundary>

          {/* Transformer: BLOCKED in World View (players cannot scale/rotate) */}
          {!isWorldView && (
            <Transformer
              ref={transformerRef}
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
                  const transformScale = (scaleX + scaleY) / 2;
                  const drawing = drawings.find((d) => d.id === node.id());
                  if (drawing) {
                    const newScale = (drawing.scale ?? 1) * transformScale;
                    updateDrawingTransform(node.id(), node.x(), node.y(), newScale);
                  }
                  // Reset scale to 1 since the new scale is stored
                  node.scaleX(1);
                  node.scaleY(1);
                }
              }}
            />
          )}
        </Layer>
      </Stage>

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
