import Konva from 'konva';
import { Stage, Layer, Line, Rect, Transformer, Group, Text, Circle } from 'react-konva';
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
import { createGridGeometry } from '../../utils/gridGeometry';

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
const CanvasManager = ({
  tool = 'select',
  color = '#df4b26',
  doorOrientation = 'horizontal',
  isWorldView = false,
  onSelectionChange,
  // measurementMode = 'ruler', // Unused currently
}: CanvasManagerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Atomic selectors to prevent infinite re-render loops and avoid useShallow crashes
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

  // DIAGNOSTIC REPORT - Copy/paste this entire block for debugging
  console.log('═══════════════════════════════════════════════════════');
  if (import.meta.env.DEV) {
    console.log('🎮 CANVAS MANAGER DIAGNOSTIC REPORT');
    console.log('═══════════════════════════════════════════════════════');
    console.log(
      '🖥️  VIEW MODE:',
      isWorldView ? '🌍 WORLD VIEW (Player)' : '🎨 DM VIEW (Architect)',
    );
    console.log('☀️  DAYLIGHT MODE:', isDaylightMode ? '✅ ON (no fog)' : '❌ OFF (fog enabled)');
    console.log('');
    console.log('📊 COUNTS:');
    console.log(`  - Total Tokens: ${tokens.length}`);
    console.log(`  - PC Tokens: ${tokens.filter((t) => t.type === 'PC').length}`);
    console.log(`  - NPC Tokens: ${tokens.filter((t) => t.type === 'NPC').length}`);
    console.log(`  - Doors: ${doors.length}`);
    console.log(`  - Stairs: ${stairs.length}`);
    console.log(`  - Wall Drawings: ${drawings.filter((d) => d.tool === 'wall').length}`);
    console.log(`  - Active Vision Polygons: ${activeVisionPolygons.length}`);
    console.log('');
    console.log('🔍 VISION SETUP:');
    const pcTokens = tokens.filter((t) => t.type === 'PC');
    if (pcTokens.length === 0) {
      console.log('  ⚠️ NO PC TOKENS! Add a PC token to enable vision.');
    } else {
      pcTokens.forEach((t) => {
        const hasVision = (t.visionRadius ?? 0) > 0;
        console.log(
          `  - ${t.name || 'PC'}: Vision = ${t.visionRadius || 'NOT SET'} ${hasVision ? '✅' : '❌ SET VISION RADIUS!'}`,
        );
      });
    }
    console.log('');
    console.log('🚪 DOOR STATUS:');
    if (doors.length === 0) {
      console.log('  ℹ️  No doors placed yet. Press D to place doors.');
    } else {
      console.log(`  - Total: ${doors.length}`);
      console.log(`  - Closed (blocking): ${doors.filter((d) => !d.isOpen).length}`);
      console.log(`  - Open (transparent): ${doors.filter((d) => d.isOpen).length}`);
    }
    console.log('');
    console.log(
      '✅ FOG WILL RENDER:',
      !isDaylightMode && isWorldView ? 'YES' : `NO (${isDaylightMode ? 'Daylight ON' : 'DM View'})`,
    );
    console.log('═══════════════════════════════════════════════════════');
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

  // Preferences

  const touchSettings = useTouchSettingsStore();

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

  const updateDrawingTransform = useGameStore((s) => s.updateDrawingTransform);
  const setActiveMeasurement = useGameStore((s) => s.setActiveMeasurement);
  const showToast = useGameStore((s) => s.showToast);

  // Tools State
  const isDrawing = useRef(false);
  const currentLine = useRef<Drawing | null>(null);
  const [tempLine, setTempLine] = useState<Drawing | null>(null);
  const tempLineRef = useRef<Konva.Line | null>(null);

  // Door Tool
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
  const selectionRectRef = useRef<Konva.Rect | null>(null);
  const selectionRectCoordsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  // const [hoveredCell, setHoveredCell] = useState<{ q: number; r: number } | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const animationFrameRef = useRef<number | null>(null); // RAF handle for throttling
  const drawingAnimationFrameRef = useRef<number | null>(null); // RAF handle for drawing

  // Ghost / Duplication State
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isMKeyPressed, setIsMKeyPressed] = useState(false); // Logic: Hold M to measure

  // Tool state helpers for disabled Konva drag events (defined once to prevent re-renders)
  const emptyDragHandler = useCallback(() => {}, []);

  // Navigation State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
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

  // --- Refactored Hooks ---

  // Refs to break circular dependency between hooks
  const shouldRejectRef = useRef<
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => boolean
  >(() => false);
  const trackStylusRef = useRef<
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void
  >(() => {});

  const {
    handleTokenPointerDown,
    handleTokenPointerMove: internalHandleTokenPointerMove,
    handleTokenPointerUp,
    dragPositionsRef,
    tokenNodesRef, // Keep relevant refs
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
      // newPos.x = - (Center * Scale - ScreenW/2)
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
      if (!containerRef.current) return;

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
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Track Alt Key (always track, even in inputs, for drag operations)
      // Disabled in World View to prevent duplication
      if (e.key === 'Alt' && !isWorldView) {
        setIsAltPressed(true);
      }

      // Ignore other operations if typing in an input
      if (isEditableElement(e.target)) return;

      // Delete/Backspace - remove selected items
      // BLOCKED in World View (players cannot delete tokens/drawings)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isWorldView) return; // Block deletion in World View
        if (selectedIds.length > 0) {
          removeTokens(selectedIds);
          removeDrawings(selectedIds);
          setSelectedIds([]);
        }
      }

      // Escape - clear active measurement
      if (e.key === 'Escape') {
        if (isWorldView) return; // Block in World View
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

    const handleKeyUp = (e: KeyboardEvent) => {
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
    const handleResize = () => {
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
  const handleTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    // ONLY handle 2+ finger gestures (pinch-to-zoom)
    if (touches.length === 2) {
      e.evt.preventDefault();
      const touch1 = touches[0];
      const touch2 = touches[1];
      lastPinchDistance.current = calculatePinchDistance(touch1, touch2);
      lastPinchCenter.current = calculatePinchCenter(touch1, touch2);
    } else if (touches.length === 1 && tool !== 'select') {
      // If using a drawing tool with a single finger, prevent default
      // to stop scrolling/text selection
      e.evt.preventDefault();
    }
    // Single-touch events are handled by handlePointerDown
  };

  const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    // ONLY handle 2-finger gestures (pinch-to-zoom or two-finger pan)
    if (touches.length === 2) {
      e.evt.preventDefault();

      if (lastPinchDistance.current && lastPinchCenter.current) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = calculatePinchDistance(touch1, touch2);
        const center = calculatePinchCenter(touch1, touch2);

        // Prevent division by zero
        if (lastPinchDistance.current < MIN_PINCH_DISTANCE) return;

        // Calculate distance change to determine gesture type
        const distanceChange = Math.abs(distance - lastPinchDistance.current);
        const isPinchGesture = distanceChange > PINCH_DISTANCE_THRESHOLD;

        if (isPinchGesture) {
          // PINCH-TO-ZOOM: Fingers moving together/apart
          const stageRect = containerRef.current?.getBoundingClientRect();
          if (!stageRect) return;

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

  const handleTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    // Reset gesture state when fewer than 2 fingers remain
    if (touches.length < 2) {
      lastPinchDistance.current = null;
      lastPinchCenter.current = null;
      lastPanCenter.current = null;
    }
    // Single-touch events are handled by handlePointerUp
  };

  const handleDragOver = (e: React.DragEvent) => {
    // BLOCKED in World View (no file drops allowed)
    if (isWorldView) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    // BLOCKED in World View (no file drops allowed)
    if (isWorldView) return;
    e.preventDefault();

    const stageRect = containerRef.current?.getBoundingClientRect();
    if (!stageRect) return;

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
        const data = JSON.parse(jsonData);
        if (data.type === 'LIBRARY_TOKEN') {
          // Create token instance with reference to library item
          // Metadata (scale, type, visionRadius, name) will be inherited from library
          addToken({
            id: crypto.randomUUID(),
            x,
            y,
            src: data.src,
            libraryItemId: data.libraryItemId, // Reference to prototype
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
      // Create Object URL for cropping
      const objectUrl = URL.createObjectURL(file);
      setPendingCrop({ src: objectUrl, x, y });
    }
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!pendingCrop) return;
    handleCropSave(blob);
  };

  const handleCropSave = async (blob: Blob) => {
    if (!pendingCrop) return;

    try {
      // Convert blob to base64 for storage/rendering
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;

        // Add as a new token
        addToken({
          id: crypto.randomUUID(),
          x: pendingCrop.x,
          y: pendingCrop.y,
          src: base64data,
          name: 'New Token',
          type: 'NPC',
          scale: 1,
        });

        setPendingCrop(null);
      };
    } catch (error) {
      console.error('Error saving cropped image:', error);
      showToast('Failed to save token image', 'error');
    }
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

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

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
      // Cancel pending animation frames on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (drawingAnimationFrameRef.current) {
        cancelAnimationFrame(drawingAnimationFrameRef.current);
        drawingAnimationFrameRef.current = null;
      }
    };
  }, []); // Run only on mount/unmount

  const centerOnPCTokens = useCallback(() => {
    const pcTokens = resolvedTokens.filter((t) => t.type === 'PC');
    if (pcTokens.length === 0) return;

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

    setScale(newScale);
    setPosition(clampedPos);
  }, [resolvedTokens, gridSize, size, clampPosition]);

  // Navigate to a specific world coordinate (used by minimap)
  const navigateToWorldPosition = useCallback(
    (worldX: number, worldY: number) => {
      // Calculate the stage position needed to center this world coordinate
      const newX = -(worldX * scale - size.width / 2);
      const newY = -(worldY * scale - size.height / 2);

      // Clamp to valid bounds
      const clampedPos = clampPosition({ x: newX, y: newY }, scale);
      setPosition(clampedPos);
    },
    [scale, size, clampPosition],
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
            onCancel={() => setPendingCrop(null)}
          />
        </AssetProcessingErrorBoundary>
      )}

      <Stage
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
            const clamped = clampPosition(rawPos, scale);
            // If clamped is different, we snap back
            setPosition(clamped);
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
              onSelect={() => {}}
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
              key: line.id,
              id: line.id,
              name: 'drawing' as const,
              points: line.points,
              x: line.x || 0,
              y: line.y || 0,
              // Apply uniform scaling (line.scale is a single number applied to both axes)
              scaleX: line.scale || 1,
              scaleY: line.scale || 1,
              stroke: line.tool === 'wall' && isWorldView ? '#000000' : line.color,
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
                      const dx = x - (drawing.x || 0);
                      const dy = y - (drawing.y || 0);
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
                // Drawings utilize `points` but usually we just move the node (x,y).
                // However, for persistence we should probably update the `points` OR store x,y offset.
                // But `Line` points are absolute.
                // If we move the Node, Konva applies a transform (x,y).
                // We should use `updateDrawingTransform`.
                updateDrawingTransform(line.id, x, y, line.scale || 1);

                setItemsForDuplication([]);
              },
            };

            // Use pressure-sensitive rendering if pressure data is available
            const hasPressureData = line.pressures && line.pressures.length > 0;

            // Render pressure-sensitive line or regular line with type-safe props
            if (hasPressureData) {
              return (
                <PressureSensitiveLine
                  {...commonProps}
                  {...eventHandlers}
                  pressures={line.pressures}
                  pressureRange={touchSettings.getPressureRange()}
                />
              );
            } else {
              return (
                <Line
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

        {/* Layer 3: Tokens, Doors & UI
          NOTE: tokenLayerRef is used for low-level performance optimizations during
          token drag updates via direct Konva batchDraw() calls instead of full React re-renders */}
        <Layer ref={tokenLayerRef}>
          {/* Doors (Rendered after fog layer so they're visible on top of fog) */}
          {(() => {
            console.log('[CanvasManager] About to render DoorLayer with', doors.length, 'doors');
            return <DoorLayer doors={doors} isWorldView={isWorldView} onToggleDoor={toggleDoor} />;
          })()}

          {/* Door Preview - Show preview when hovering with door tool */}
          {doorPreviewPos && tool === 'door' && !isWorldView && (
            <Rect
              x={doorPreviewPos.x - gridSize / 2}
              y={doorPreviewPos.y - gridSize / 2}
              width={doorOrientation === 'horizontal' ? gridSize : gridSize / 5}
              height={doorOrientation === 'horizontal' ? gridSize / 5 : gridSize}
              fill="rgba(255, 255, 255, 0.5)"
              stroke="white"
              strokeWidth={2}
              listening={false}
            />
          )}

          {/* Snap Preview - Show where tokens will snap when released */}
          {isDraggingToken &&
            Array.from(snapPreviewPositionsRef.current.entries()).map(([tokenId, snapPos]) => {
              const token = resolvedTokens.find((t) => t.id === tokenId);
              if (!token) return null;

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
                    stroke="rgba(37, 99, 235, 0.6)" // Blue accent color
                    strokeWidth={2}
                    listening={false}
                    dash={[8, 4]}
                    closed={true}
                  />
                  {/* Inner fill - actual grid cell shape */}
                  <Line
                    points={cellPoints}
                    fill="rgba(37, 99, 235, 0.1)"
                    listening={false}
                    closed={true}
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
                  onSelect={() => {}}
                />
              ))}

          {/* Movement Range Overlay - Shows reachable cells for selected token (Hold M key) */}
          {isMKeyPressed &&
            !isWorldView &&
            selectedIds.length === 1 &&
            (() => {
              const selectedToken = resolvedTokens.find((t) => t.id === selectedIds[0]);
              if (!selectedToken) return null;

              // Use drag position if token is being dragged
              const dragPos = dragPositionsRef.current.get(selectedToken.id);
              const tokenPos = dragPos || { x: selectedToken.x, y: selectedToken.y };

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
            const getVisualProps = () => {
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
                  shadowColor: 'rgba(0, 0, 0, 0.6)',
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
                  shadowColor: 'rgba(0, 0, 0, 0.4)',
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
            const safeScale = token.scale || 1;
            const tokenHeight = gridSize * safeScale;

            /**
             * Isometric "Standing" Offset
             *
             * Visual goal:
             * - In ISOMETRIC view we want tokens to appear as if they are standing upright on
             *   the diamond-shaped tile, with their "feet" anchored to the tile center, rather
             *   than lying flat in the middle of the cell.
             *
             * Geometry:
             * - Our token image is rendered centered on (displayX, displayY).
             * - tokenHeight represents the rendered token height in pixels for this grid cell:
             *       tokenHeight = gridSize * safeScale
             *   so any change to token.scale or gridSize automatically affects this value.
             * - By shifting the image up by half its rendered height (tokenHeight / 2), we move
             *   the bottom edge of the token image down to where the center of the isometric
             *   tile is drawn, creating the illusion that the token is standing on that point.
             *
             * Scaling behavior:
             * - Because the offset is derived from tokenHeight (which already includes safeScale),
             *   larger tokens are moved proportionally further up, keeping their feet aligned
             *   with the same ground plane as smaller tokens.
             *
             * If the isometric anchoring convention changes (e.g., using a different vertical
             * anchor point or a non-centered token sprite), this offset calculation should be
             * updated accordingly.
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
                      stroke="#2563eb"
                      strokeWidth={3}
                      shadowColor="#2563eb"
                      shadowBlur={8}
                      shadowEnabled={true}
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
              fill="rgba(37, 99, 235, 0.3)"
              stroke="#2563eb"
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
              fill="rgba(255, 0, 0, 0.2)"
              stroke="red"
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
    </div>
  );
};

export default React.memo(CanvasManager);
