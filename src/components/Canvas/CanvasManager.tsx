import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import type React from 'react';

import { Stage, Layer, Transformer } from 'react-konva';
import { useShallow } from 'zustand/shallow';

import ConnectedMinimap from './ConnectedMinimap';
import DrawingLayer from './DrawingLayer';
import { IsolatedGridOverlay } from './GridOverlay';
import AssetProcessingErrorBoundary from '../AssetProcessingErrorBoundary';
import ImageCropper from '../ImageCropper';
import CanvasOverlayErrorBoundary from './CanvasOverlayErrorBoundary';
import DoorLayer from './DoorLayer';
import FogOfWarLayer from './FogOfWarLayer';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useTokenDrag } from './hooks/useTokenDrag';
import OverlayLayer from './OverlayLayer';
import PaperNoiseOverlay from './PaperNoiseOverlay';
import TokenLayer from './TokenLayer';
import URLImage from './URLImage';
import { useThemeColor } from '../../hooks/useThemeColor';
import { resolveTokenData } from '../../hooks/useTokenData';
import { useGameStore, DEFAULT_GRID_COLOR } from '../../store/gameStore';
import { usePointerOverlayStore } from '../../store/pointerOverlayStore';
import { useTouchSettingsStore } from '../../store/touchSettingsStore';
import { snapToGrid } from '../../utils/grid';
import { recordCanvasCommit } from '../../utils/perfCounters';
import { registerTokenLayer } from '../../utils/tokenNodeRegistry';

import type { Drawing } from '../../store/gameStore';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

// Zoom constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SCALE_BY = 1.1;
const MIN_PINCH_DISTANCE = 0.001; // Guard against near-zero division or very small distances that could cause extreme scale changes
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
 * CanvasManager - Main canvas component for battlemap rendering and interaction
 *
 * This component handles all canvas rendering (map, tokens, drawings, grid) and user
 * interactions (panning, zooming, drawing, token manipulation). It operates in two modes
 * based on the window type:
 *
 * **Architect View (DM Mode):**
 * - Full editing capabilities (draw, erase, add/remove tokens)
 * - File drop support (drag images onto canvas)
 * - Calibration tools (grid alignment)
 * - Token transformation (scale, rotate)
 * - Token duplication (Alt+drag)
 * - Delete tokens/drawings (Delete/Backspace)
 *
 * **World View (Player Mode):**
 * - ✅ ALLOWED: Pan canvas (mouse drag, space+drag, wheel scroll)
 * - ✅ ALLOWED: Zoom (ctrl+wheel, pinch, +/- keys)
 * - ✅ ALLOWED: Select and drag tokens (for DM to demonstrate movement)
 * - ❌ BLOCKED: Drawing tools (marker, eraser, wall)
 * - ❌ BLOCKED: File drops (add tokens/maps)
 * - ❌ BLOCKED: Calibration mode
 * - ❌ BLOCKED: Token transformation (scale, rotate)
 * - ❌ BLOCKED: Token duplication (Alt+drag)
 * - ❌ BLOCKED: Delete tokens/drawings
 *
 * **Interaction Restriction Pattern:**
 * When `isWorldView={true}`, interaction handlers check the flag and return early
 * to prevent editing operations. Navigation (pan/zoom) remains fully functional.
 *
 * @param {CanvasManagerProps} props - Component props
 * @returns Canvas with interactive battlemap
 *
 * @see {@link file://../../utils/useWindowType.ts useWindowType} for window detection
 * @see {@link file://../../App.tsx App.tsx} for UI sanitization
 */
// eslint-disable-next-line max-lines-per-function, complexity
function CanvasManager({
  tool = 'select',
  color = '#df4b26',
  doorOrientation = 'horizontal',
  isWorldView = false,
  onSelectionChange,
  measurementMode = 'ruler',
}: CanvasManagerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Atomic selectors to prevent infinite re-render loops and avoid useShallow crashes
  const map = useGameStore((s) => s.map);
  const tokenLibrary = useGameStore(useShallow((s) => s.campaign.tokenLibrary));
  const drawings = useGameStore((s) => s.drawings);
  const doors = useGameStore((s) => s.doors);
  const stairs = useGameStore((s) => s.stairs);
  const gridSize = useGameStore((s) => s.gridSize);
  const gridType = useGameStore((state) => state.gridType);
  const gridColor = useGameStore((state) => state.gridColor);
  const isCalibrating = useGameStore((s) => s.isCalibrating);
  const isDaylightMode = useGameStore((state) => state.isDaylightMode);

  // Preferences

  const pinchDistanceThreshold = useTouchSettingsStore((s) => s.pinchDistanceThreshold);
  const getPressureRange = useTouchSettingsStore((s) => s.getPressureRange);

  // Touch/Stylus tracking for palm rejection
  const stylusActiveRef = useRef(false); // Track if stylus is currently being used
  const lastStylusLiftTimeRef = useRef(0); // Timestamp of last stylus lift (for smartDelay palm rejection)

  // Measurement state
  const activeMeasurement = useGameStore((s) => s.activeMeasurement);
  const dmMeasurement = useGameStore((s) => s.dmMeasurement);

  // Actions - these are stable
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
  const setIsCalibrating = useGameStore((s) => s.setIsCalibrating);
  const updateMapTransform = useGameStore((s) => s.updateMapTransform);
  const showToast = useGameStore((s) => s.showToast);

  // Tools State
  const isDrawing = useRef(false);
  const currentLine = useRef<Drawing | null>(null);
  const [tempLine, setTempLine] = useState<Drawing | null>(null);
  const tempLineRef = useRef<Konva.Line | null>(null);

  const setDoorPreviewPos = usePointerOverlayStore((s) => s.setDoorPreviewPos);

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
  const pendingCropUrlRef = useRef<string | null>(null);
  const revokePendingCropUrl = useCallback(() => {
    if (pendingCropUrlRef.current) {
      URL.revokeObjectURL(pendingCropUrlRef.current);
      pendingCropUrlRef.current = null;
    }
  }, []);

  // Selection & Drag State
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    isVisible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, isVisible: false });
  const selectionRectRef = useRef<Konva.Rect | null>(null);
  const selectionRectCoordsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const setHoveredCell = usePointerOverlayStore((s) => s.setHoveredCell);
  const setHoveredTokenId = usePointerOverlayStore((s) => s.setHoveredTokenId);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const animationFrameRef = useRef<number | null>(null); // RAF handle for throttling
  const drawingAnimationFrameRef = useRef<number | null>(null); // RAF handle for drawing

  // Ghost / Duplication State
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isMKeyPressed, setIsMKeyPressed] = useState(false); // Logic: Hold M to measure

  // Tool state helpers for disabled Konva drag events (defined once to prevent re-renders)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const emptyDragHandler = useCallback((): void => {}, []);

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

  // Navigation State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const liveScaleRef = useRef(1);
  const livePosRef = useRef({ x: 0, y: 0 });
  const cameraCommitTimerRef = useRef<number | null>(null);
  const cameraGestureRef = useRef(false);

  const applyCameraToStage = useCallback((pos: { x: number; y: number }, nextScale: number) => {
    const stage = stageRef.current;
    if (stage) {
      stage.x(pos.x);
      stage.y(pos.y);
      stage.scale({ x: nextScale, y: nextScale });
      stage.batchDraw();
    }
    livePosRef.current = pos;
    liveScaleRef.current = nextScale;
  }, []);

  const commitCameraReact = useCallback((immediate: boolean) => {
    const flush = (): void => {
      cameraCommitTimerRef.current = null;
      setScale(liveScaleRef.current);
      setPosition(livePosRef.current);
    };
    if (immediate) {
      if (cameraCommitTimerRef.current !== null) {
        window.clearTimeout(cameraCommitTimerRef.current);
        cameraCommitTimerRef.current = null;
      }
      flush();
      return;
    }
    if (cameraCommitTimerRef.current !== null) {
      return;
    }
    cameraCommitTimerRef.current = window.setTimeout(flush, 100);
  }, []);

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
  const PINCH_DISTANCE_THRESHOLD = Math.min(Math.max(pinchDistanceThreshold, 5), 50);

  // --- Refactored Hooks ---

  // Refs to break circular dependency between hooks
  const shouldRejectRef = useRef<
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => boolean
  >(() => false);
  const trackStylusRef = useRef<
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  >((): void => {});

  const {
    handleTokenPointerDown,
    handleTokenPointerMove: internalHandleTokenPointerMove,
    handleTokenPointerUp,
    dragPositionsRef,
    draggingTokenIds,
    itemsForDuplication,
    setItemsForDuplication,
    snapPreviewPositionsRef,
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
    shouldRejectPointerEvent: (e) => shouldRejectRef.current(e),
    trackStylusUsage: (e) => trackStylusRef.current(e),
  });

  const canvasInteraction = useCanvasInteraction({
    tool,
    measurementMode,
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
    setSelectedIds,
    setActiveMeasurement,
    addDrawing,
    drawings,
    setHoveredCell,
  });

  // Destructure handlers from canvasInteraction
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    trackStylusUsage,
    shouldRejectPointerEvent,
  } = canvasInteraction;

  // Update refs with actual handlers
  useEffect(() => {
    shouldRejectRef.current = shouldRejectPointerEvent;
    trackStylusRef.current = trackStylusUsage;
  }, [shouldRejectPointerEvent, trackStylusUsage]);

  /**
   * Determines the appropriate cursor style based on current interaction state.
   * Priority order (highest to lowest):
   * 1. Space + panning (isDragging) → 'grabbing'
   * 2. Space pressed (ready to pan) → 'grab'
   * 3. Token dragging → 'grabbing'
   * 4. Select tool → 'default'
   * 5. Other tools (marker, eraser, wall) → 'crosshair'
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

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Helper function to clamp viewport position within bounds
  const clampPosition = useCallback(
    (newPos: { x: number; y: number }, newScale: number) => {
      // Calculate bounds including both map and token positions
      // This ensures we can navigate to tokens even if they're outside the map
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
      const { tokens, campaign } = useGameStore.getState();
      const pcTokens = tokens
        .map((token) => resolveTokenData(token, campaign.tokenLibrary))
        .filter((t) => t.type === 'PC');
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
      // newPos.x = - (Center * Scale - ScreenW/2)
      return {
        x: -(clampedCenterX * newScale - size.width / 2),
        y: -(clampedCenterY * newScale - size.height / 2),
      };
    },
    [map, gridSize, size.width, size.height],
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

      applyCameraToStage(clampedPos, constrainedScale);
      cameraGestureRef.current = true;
      commitCameraReact(false);
    },
    [clampPosition, applyCameraToStage, commitCameraReact],
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

  // Consolidated keyboard event handling for canvas operations
  useEffect(() => {
    const isEditableElement = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) {
        return false;
      }
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    };

    // eslint-disable-next-line complexity
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Track Alt Key (always track, even in inputs, for drag operations)
      // Disabled in World View to prevent duplication
      if (e.key === 'Alt' && !isWorldView) {
        setIsAltPressed(true);
      }

      // Ignore other operations if typing in an input
      if (isEditableElement(e.target)) {
        return;
      }

      // Delete/Backspace - remove selected items
      // BLOCKED in World View (players cannot delete tokens/drawings)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isWorldView) {
          return;
        } // Block deletion in World View
        if (selectedIds.length > 0) {
          removeTokens(selectedIds);
          removeDrawings(selectedIds);
          removeDoors(selectedIds);
          setSelectedIds([]);
        }
      }

      // Escape - clear active measurement
      if (e.key === 'Escape') {
        if (isWorldView) {
          return;
        } // Block in World View
        if (activeMeasurement) {
          setActiveMeasurement(null);
        }
      }

      // Space - enable pan mode
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Zoom in with + or =
      if ((e.code === 'Equal' || e.code === 'NumpadAdd') && !e.repeat) {
        e.preventDefault();
        handleKeyboardZoom(true);
      }

      // Zoom out with -
      if ((e.code === 'Minus' || e.code === 'NumpadSubtract') && !e.repeat) {
        e.preventDefault();
        handleKeyboardZoom(false);
      }

      // M key - show movement range overlay
      if ((e.key === 'm' || e.key === 'M') && !e.repeat && !isEditableElement(e.target)) {
        e.preventDefault();
        setIsMKeyPressed(true);
      }

      // Grid type shortcuts (DM only) - 1-5 keys
      if (!isWorldView && !e.repeat && !isEditableElement(e.target)) {
        if (e.key === '1') {
          e.preventDefault();
          setGridType('LINES');
          showToast('Grid: Square - Lines', 'success');
        } else if (e.key === '2') {
          e.preventDefault();
          setGridType('DOTS');
          showToast('Grid: Square - Dots', 'success');
        } else if (e.key === '3') {
          e.preventDefault();
          setGridType('HEXAGONAL');
          showToast('Grid: Hexagonal', 'success');
        } else if (e.key === '4') {
          e.preventDefault();
          setGridType('ISOMETRIC');
          showToast('Grid: Isometric', 'success');
        } else if (e.key === '5') {
          e.preventDefault();
          setGridType('HIDDEN');
          showToast('Grid: Hidden', 'success');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      // Always track Alt key release
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }

      // Space key release
      if (!isEditableElement(e.target) && e.code === 'Space') {
        setIsSpacePressed(false);
      }

      // M key release
      if (!isEditableElement(e.target) && (e.key === 'm' || e.key === 'M')) {
        setIsMKeyPressed(false);
      }
    };

    const handleBlur = (): void => {
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
    removeDoors,
    handleKeyboardZoom,
    activeMeasurement,
    isWorldView,
    setActiveMeasurement,
    setGridType,
    showToast,
  ]);

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

  // handleWheel moved to below to use clamp logic

  /**
   * Multi-Touch Gesture Handlers
   *
   * These handlers ONLY process multi-touch gestures (2+ fingers).
   * Single-touch interactions are handled by the unified pointer event handlers
   * (handlePointerDown/Move/Up) which support mouse, touch, and pen input.
   *
   * This separation ensures:
   * - Two-finger pinch-to-zoom works correctly
   * - Single-finger drawing/dragging uses pointer events
   * - No event conflicts between touch and pointer APIs
   */
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
          applyCameraToStage(clampedPos, scale);
          cameraGestureRef.current = true;
          commitCameraReact(false);

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
      if (cameraGestureRef.current) {
        cameraGestureRef.current = false;
        commitCameraReact(true);
      }
    }
    // Single-touch events are handled by handlePointerUp
  };

  const handleDragOver = (e: React.DragEvent): void => {
    // BLOCKED in World View (no file drops allowed)
    if (isWorldView) {
      return;
    }
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent): void => {
    // BLOCKED in World View (no file drops allowed)
    if (isWorldView) {
      return;
    }
    e.preventDefault();

    const stageRect = containerRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }

    // 1. Get pointer relative to the container DOM element
    const pointerX = e.clientX - stageRect.left;
    const pointerY = e.clientY - stageRect.top;

    // 2. Transform into World Coordinates (reverse stage transform)
    // Stage Transform: Screen = World * Scale + Position
    // World = (Screen - Position) / Scale
    const worldX = (pointerX - position.x) / scale;
    const worldY = (pointerY - position.y) / scale;

    // Initial snap for drop (assuming standard 1x1 if unknown, or center on mouse)
    // We don't know image size yet, so we snap top-left to grid line nearby.
    // Use WORLD coordinates for snapping.
    const { x, y } = snapToGrid(worldX, worldY, gridSize, gridType);

    // Check for JSON (Library Item or Generic Token)
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        interface DroppedTokenData {
          type: string;
          src?: string;
          libraryItemId?: string;
        }
        const data = JSON.parse(jsonData) as DroppedTokenData;
        if (data.type === 'LIBRARY_TOKEN') {
          // Create token instance with reference to library item
          // Metadata (scale, type, visionRadius, name) will be inherited from library
          addToken({
            id: crypto.randomUUID(),
            x,
            y,
            src: data.src ?? '',
            libraryItemId: data.libraryItemId,
            // scale, type, visionRadius, name are NOT set - they inherit from library
          });
          return;
        } else if (data.type === 'GENERIC_TOKEN') {
          // Create a generic placeholder token with an SVG data URL.
          // Colors are derived from CSS variables so the token matches the current theme.
          const rootElement = document.documentElement;
          const computedStyles = getComputedStyle(rootElement);
          const bgColor = computedStyles.getPropertyValue('--app-bg-subtle')?.trim() || '#6b7280';
          const fgColor =
            computedStyles.getPropertyValue('--app-text-primary')?.trim() || '#ffffff';

          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="${bgColor}" rx="16"/><circle cx="64" cy="45" r="18" fill="${fgColor}"/><path d="M64 70 C 40 70 28 82 28 92 L 28 108 L 100 108 L 100 92 C 100 82 88 70 64 70 Z" fill="${fgColor}"/></svg>`;
          const genericTokenSvg = `data:image/svg+xml;base64,${btoa(svg)}`;

          addToken({
            id: crypto.randomUUID(),
            x,
            y,
            src: genericTokenSvg,
            name: 'Generic Token',
            type: 'NPC',
            scale: 1,
            // No libraryItemId - standalone token
          });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file) {
        return;
      }
      revokePendingCropUrl();
      const objectUrl = URL.createObjectURL(file);
      pendingCropUrlRef.current = objectUrl;
      setPendingCrop({ src: objectUrl, x, y });
    }
  };

  const handleCropConfirm = (blob: Blob): void => {
    if (!pendingCrop) {
      return;
    }
    void handleCropSave(blob);
  };

  const handleCropSave = (blob: Blob): void => {
    if (!pendingCrop) {
      return;
    }

    const { x, y } = pendingCrop;
    // Unmount cropper first so it doesn't keep a revoked blob: URL around
    setPendingCrop(null);
    revokePendingCropUrl();

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        showToast('Failed to save token image', 'error');
        return;
      }

      addToken({
        id: crypto.randomUUID(),
        x,
        y,
        src: reader.result,
        name: 'New Token',
        type: 'NPC',
        scale: 1,
      });

      // pendingCrop already cleared above
    };
    reader.onerror = () => {
      showToast('Failed to save token image', 'error');
    };
    reader.readAsDataURL(blob);
  };

  // Calculate visible bounds in CANVAS coordinates (unscaled)
  // Memoized to prevent recalculation on every render
  // The Stage is transformed by scale and position (-x, -y).
  // Visible region top-left: -position.x / scale, -position.y / scale
  // Visible region dimensions: size.width / scale, size.height / scale
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
      const clampedPos = clampPosition(rawNewPos, oldScale);
      applyCameraToStage(clampedPos, oldScale);
      cameraGestureRef.current = true;
      commitCameraReact(false);
    }
  };

  useEffect(() => {
    registerTokenLayer(tokenLayerRef.current);
    return () => {
      registerTokenLayer(null);
    };
  });

  useEffect(() => {
    const start = performance.now();
    const frame = requestAnimationFrame(() => {
      recordCanvasCommit(performance.now() - start);
    });
    return () => cancelAnimationFrame(frame);
  });

  useEffect(() => {
    if (!cameraGestureRef.current || !stageRef.current) {
      return;
    }
    applyCameraToStage(livePosRef.current, liveScaleRef.current);
  });

  // Update Transformer nodes
  useEffect(() => {
    if (transformerRef.current) {
      const stage = transformerRef.current.getStage();
      if (stage) {
        const selectedNodes = stage.find((node: Konva.Node) => selectedIds.includes(node.id()));
        transformerRef.current.nodes(selectedNodes);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedIds]); // Only update when selection changes; nodes are automatically updated by React Konva

  // Cleanup: Cancel any active image processing on unmount
  // CRITICAL: Prevents worker leak if component unmounts during processing
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (drawingAnimationFrameRef.current) {
        cancelAnimationFrame(drawingAnimationFrameRef.current);
        drawingAnimationFrameRef.current = null;
      }
      revokePendingCropUrl();
    };
  }, [revokePendingCropUrl]);

  const centerOnPCTokens = useCallback(() => {
    const { tokens, campaign } = useGameStore.getState();
    const pcTokens = tokens
      .map((token) => resolveTokenData(token, campaign.tokenLibrary))
      .filter((t) => t.type === 'PC');
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

    // Also ensure we don't zoom out too much
    newScale = Math.max(newScale, MIN_SCALE);

    // Calculate center of the bounds
    const centerX = minX + boundsWidth / 2;
    const centerY = minY + boundsHeight / 2;

    // Calculate position to center the bounds
    // Position formula: - (Center * Scale - ScreenCenter)
    const newX = -(centerX * newScale - size.width / 2);
    const newY = -(centerY * newScale - size.height / 2);

    // For "Center on Party", we want to allow navigation to tokens even if they're
    // outside the map bounds. The viewport constraints will still prevent going too far.
    // We'll apply a modified clamp that considers both map and token positions.
    const clampedPos = clampPosition({ x: newX, y: newY }, newScale);

    applyCameraToStage(clampedPos, newScale);
    commitCameraReact(true);
  }, [gridSize, size, clampPosition, applyCameraToStage, commitCameraReact]);

  // Navigate to a specific world coordinate (used by minimap)
  const navigateToWorldPosition = useCallback(
    (worldX: number, worldY: number) => {
      // Calculate the stage position needed to center this world coordinate
      const newX = -(worldX * scale - size.width / 2);
      const newY = -(worldY * scale - size.height / 2);

      // Clamp to valid bounds
      const clampedPos = clampPosition({ x: newX, y: newY }, scale);
      applyCameraToStage(clampedPos, scale);
      commitCameraReact(true);
    },
    [scale, size, clampPosition, applyCameraToStage, commitCameraReact],
  );

  return (
    <div
      ref={containerRef}
      className="canvas-container w-full h-full overflow-hidden relative"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {pendingCrop && (
        <AssetProcessingErrorBoundary>
          <ImageCropper
            imageSrc={pendingCrop.src}
            onConfirm={handleCropConfirm}
            onCancel={() => {
              revokePendingCropUrl();
              setPendingCrop(null);
            }}
          />
        </AssetProcessingErrorBoundary>
      )}

      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
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
            // When space-drag ends, we should ensure we are clamped.
            // React-Konva Draggable updates the internal node position, but not our state "position" until we sync it?
            // Or does it?
            // We typically need to sync state onDragEnd.
            const rawPos = { x: e.target.x(), y: e.target.y() };
            const clamped = clampPosition(rawPos, liveScaleRef.current);
            applyCameraToStage(clamped, liveScaleRef.current);
            commitCameraReact(true);
            setIsDragging(false);
          }
        }}
        onDragMove={(e) => {
          // We intentionally do NOT clamp the stage position in real time during drag.
          // Real-time clamping can cause jittery or unnatural movement, especially if the user drags quickly or hits the edge.
          // Instead, we allow free dragging and only clamp the position on drag end (see onDragEnd above).
          // This provides a smoother and more predictable user experience.
          if (e.target === e.target.getStage()) {
            // No action needed here; see comment above.
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
              onSelect={emptyDragHandler}
              onDragEnd={emptyDragHandler}
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

          <IsolatedGridOverlay
            visibleBounds={visibleBounds}
            gridSize={gridSize}
            type={gridType}
            stroke={resolvedGridColor}
          />
        </Layer>

        {/* Fog of War Layer moved below Drawings Layer to correct occlusion */}

        {/* Layer 2: Drawings (Separate layer so Eraser doesn't erase map) */}
        <Layer>
          <DrawingLayer
            drawings={drawings}
            stairs={stairs}
            tool={tool}
            selectedIds={selectedIds}
            isWorldView={isWorldView}
            isAltPressed={isAltPressed}
            itemsForDuplication={itemsForDuplication}
            tempLine={tempLine}
            tempLineRef={tempLineRef}
            pressureRange={getPressureRange()}
            onSelectIds={setSelectedIds}
            onDragStart={(id) => {
              setItemsForDuplication(selectedIds.includes(id) ? selectedIds : [id]);
            }}
            onDragEnd={(id, x, y) => {
              const drawing = drawings.find((d) => d.id === id);
              if (isAltPressed && !isWorldView && drawing) {
                const idsToDuplicate = selectedIds.includes(id) ? selectedIds : [id];
                idsToDuplicate.forEach((dupId) => {
                  const source = drawings.find((d) => d.id === dupId);
                  if (source) {
                    const dx = x - (source.x ?? 0);
                    const dy = y - (source.y ?? 0);
                    const newPoints = source.points.map((val, idx) =>
                      idx % 2 === 0 ? val + dx : val + dy,
                    );
                    addDrawing({
                      ...source,
                      id: crypto.randomUUID(),
                      points: newPoints,
                      x: 0,
                      y: 0,
                    });
                  }
                });
              }
              updateDrawingTransform(id, x, y, drawing?.scale ?? 1);
              setItemsForDuplication([]);
            }}
          />
        </Layer>

        {/* Fog of War Layer (World View only) - Renders Overlay */}
        {/* Rendered AFTER Drawings so walls are properly hidden by fog */}
        {(() => {
          const shouldRenderFog = isWorldView && !isDaylightMode;
          return shouldRenderFog ? (
            <Layer listening={false}>
              <FogOfWarLayer
                drawings={drawings}
                doors={doors}
                gridSize={gridSize}
                visibleBounds={visibleBounds}
                map={map}
              />
            </Layer>
          ) : null;
        })()}

        {/* Layer 3: Tokens, Doors & UI
          NOTE: tokenLayerRef is used for low-level performance optimizations during
          token drag updates via direct Konva batchDraw() calls instead of full React re-renders */}
        <Layer ref={tokenLayerRef}>
          <DoorLayer
            doors={doors}
            isWorldView={isWorldView}
            tool={tool}
            selectedIds={selectedIds}
            onToggleDoor={toggleDoor}
            onDeleteDoor={removeDoor}
            onDoorContextMenu={handleDoorContextMenu}
          />

          <TokenLayer
            tokenLibrary={tokenLibrary}
            gridSize={gridSize}
            gridType={gridType}
            isWorldView={isWorldView}
            isDaylightMode={isDaylightMode}
            tool={tool}
            selectedIds={selectedIds}
            draggingTokenIds={draggingTokenIds}
            dragPositions={dragPositionsRef.current}
            ghostTokenIds={itemsForDuplication}
            showGhosts={isAltPressed}
            textColor={textColor}
            onSelect={handleTokenPointerDown}
            onHover={setHoveredTokenId}
            onShowToast={showToast}
          />

          <OverlayLayer
            tool={tool}
            isWorldView={isWorldView}
            doorOrientation={doorOrientation}
            gridSize={gridSize}
            gridType={gridType}
            isDraggingToken={isDraggingToken}
            snapPreviewPositionsRef={snapPreviewPositionsRef}
            selectedIds={selectedIds}
            isMKeyPressed={isMKeyPressed}
            dragPositionsRef={dragPositionsRef}
            selectionRect={selectionRect}
            selectionRectRef={selectionRectRef}
            isCalibrating={!!isCalibrating}
            calibrationRect={calibrationRect}
            measurement={isWorldView ? dmMeasurement : activeMeasurement}
          />

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
                  const raw = useGameStore.getState().tokensById[node.id()];
                  const token = raw
                    ? resolveTokenData(raw, useGameStore.getState().campaign.tokenLibrary)
                    : undefined;
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
          <ConnectedMinimap
            position={position}
            scale={scale}
            viewportSize={size}
            onNavigate={navigateToWorldPosition}
          />
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
            <>
              {/* Invisible backdrop to close menu on outside click */}
              <div className="fixed inset-0 z-40" onClick={closeDoorContextMenu} />
              <div
                className="absolute z-50 bg-[var(--app-bg-secondary)] border border-[var(--app-border)] rounded-lg shadow-lg py-1 min-w-[160px]"
                style={{ left: doorContextMenu.x, top: doorContextMenu.y }}
              >
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-[var(--app-text-primary)] hover:bg-[var(--app-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={door.isLocked}
                  onClick={() => {
                    toggleDoor(door.id);
                    closeDoorContextMenu();
                  }}
                >
                  {door.isOpen ? 'Close Door' : 'Open Door'}
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-[var(--app-text-primary)] hover:bg-[var(--app-bg-tertiary)]"
                  onClick={() => {
                    updateDoorLock(door.id, !door.isLocked);
                    closeDoorContextMenu();
                  }}
                >
                  {door.isLocked ? 'Unlock Door' : 'Lock Door'}
                </button>
                <div className="border-t border-[var(--app-border)] my-1" />
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[var(--app-bg-tertiary)]"
                  onClick={() => {
                    removeDoor(door.id);
                    closeDoorContextMenu();
                  }}
                >
                  Delete Door
                </button>
              </div>
            </>
          );
        })()}
    </div>
  );
}

export default memo(CanvasManager);
