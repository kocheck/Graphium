import Konva from 'konva';
import { Stage, Layer, Line, Rect, Transformer, Group, Text, Circle } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { processImage, ProcessingHandle } from '../../utils/AssetProcessor';
import { snapToGrid } from '../../utils/grid';
import { createGridGeometry } from '../../utils/gridGeometry';
import { useGameStore, Drawing } from '../../store/gameStore';
import { usePreferencesStore } from '../../store/preferencesStore';
import { useTouchSettingsStore } from '../../store/touchSettingsStore';
import { simplifyPath, snapPointToPaths } from '../../utils/pathOptimization';
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
import MeasurementOverlay from './MeasurementOverlay';
import MovementRangeOverlay from './MovementRangeOverlay';
import { resolveTokenData } from '../../hooks/useTokenData';

import URLImage from './URLImage';
import PressureSensitiveLine from './PressureSensitiveLine';

import { MeasurementMode, Measurement } from '../../types/measurement';
import {
  euclideanDistance,
  pixelsToFeet,
  calculateConeVertices,
  DistanceMode
} from '../../utils/measurement';

// Zoom constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
export const BLUR_FILTERS = [Konva.Filters.Blur, Konva.Filters.Brighten]; // Static reference to prevent unnecessary cache invalidation
const ZOOM_SCALE_BY = 1.1;
const MIN_PINCH_DISTANCE = 0.001; // Guard against near-zero division or very small distances that could cause extreme scale changes
const VIEWPORT_CLAMP_PADDING = 1000; // Padding around map bounds for viewport constraints
const DEFAULT_BOUNDS_SIZE = 5000; // Default bounds size when no map is present

// Helper functions for touch/pinch calculations
const calculatePinchDistance = (touch1: Touch, touch2: Touch): number => {
    return Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
    );
};

const calculatePinchCenter = (touch1: Touch, touch2: Touch): { x: number, y: number } => {
    return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
    };
};

/**
 * Pointer Event Abstraction Utilities
 *
 * These helpers provide a unified interface for extracting coordinates and pressure
 * from PointerEvent, MouseEvent, and TouchEvent, enabling a single code path
 * for mouse, touch, and stylus input.
 *
 * Benefits:
 * - Single event handler logic for all input types
 * - Automatic pressure detection for stylus/pen devices
 * - Multi-touch gesture detection
 * - Backward compatible with existing mouse code
 */

/**
 * Get the pointer position from a Konva event
 *
 * Extracts the canvas-relative pointer position from any pointer event type.
 * Works with PointerEvent, MouseEvent, and TouchEvent.
 *
 * @param e - Konva event object wrapping pointer/mouse/touch event
 * @returns {x, y} position relative to canvas, or null if stage not found
 *
 * @example
 * const handlePointerDown = (e) => {
 *   const pos = getPointerPosition(e);
 *   if (pos) {
 *     console.log(`Pointer at ${pos.x}, ${pos.y}`);
 *   }
 * };
 */
const getPointerPosition = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
  const stage = e.target.getStage();
  if (!stage) return null;

  return stage.getRelativePointerPosition();
};

/**
 * Get pressure value from a pointer event (for pressure-sensitive drawing)
 *
 * Extracts pointer pressure for stylus/pen input. Returns 0.5 for mouse
 * (no pressure sensitivity), or actual pressure value for pen/touch devices.
 *
 * Pressure values range from 0.0 (no pressure) to 1.0 (maximum pressure).
 * Mouse events default to 0.5 for consistent stroke width.
 *
 * @param e - Konva event object wrapping pointer/mouse/touch event
 * @returns Pressure value (0.0 - 1.0)
 *
 * @example
 * const handlePointerMove = (e) => {
 *   const pressure = getPointerPressure(e);
 *   const dynamicWidth = baseWidth * (0.5 + pressure * 0.5);
 * };
 */
const getPointerPressure = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): number => {
  const evt = e.evt;
  // Type guard: Check if this is a PointerEvent with pressure property
  if ('pressure' in evt && typeof evt.pressure === 'number') {
    return evt.pressure;
  }
  return 0.5; // Default pressure for mouse/touch without pressure info
};

/**
 * Check if the event is a multi-touch gesture (2+ fingers)
 *
 * Detects multi-touch gestures (pinch-zoom, two-finger pan) to distinguish
 * them from single-pointer interactions (drawing, dragging).
 *
 * Used to prevent single-touch handlers from interfering with multi-touch
 * gestures like pinch-to-zoom.
 *
 * @param e - Konva event object wrapping pointer/mouse/touch event
 * @returns true if 2+ fingers detected, false otherwise
 *
 * @example
 * const handlePointerDown = (e) => {
 *   if (isMultiTouchGesture(e)) {
 *     return; // Let gesture handlers handle this
 *   }
 *   // Process single-pointer interaction
 * };
 */
const isMultiTouchGesture = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): boolean => {
  const evt = e.evt;
  // Type guard: Check if this is a TouchEvent with touches array
  return 'touches' in evt && Array.isArray(evt.touches) && evt.touches.length >= 2;
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
  measurementMode?: MeasurementMode;
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
  measurementMode = 'ruler'
}: CanvasManagerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Atomic selectors to prevent infinite re-render loops and avoid useShallow crashes
  const map = useGameStore(s => s.map);
  const tokens = useGameStore(s => s.tokens);
  const tokenLibrary = useGameStore(useShallow(s => s.campaign.tokenLibrary));
  const drawings = useGameStore(s => s.drawings);
  const doors = useGameStore(s => s.doors);
  const stairs = useGameStore(s => s.stairs);
  const gridSize = useGameStore(s => s.gridSize);
  const gridType = useGameStore(s => s.gridType);
  const gridColor = useGameStore(s => s.gridColor);
  const isCalibrating = useGameStore(s => s.isCalibrating);
  const isDaylightMode = useGameStore(s => s.isDaylightMode);
  const activeVisionPolygons = useGameStore(s => s.activeVisionPolygons);

  // DIAGNOSTIC REPORT - Copy/paste this entire block for debugging
  console.log('═══════════════════════════════════════════════════════');
  if (import.meta.env.DEV) {
    console.log('🎮 CANVAS MANAGER DIAGNOSTIC REPORT');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🖥️  VIEW MODE:', isWorldView ? '🌍 WORLD VIEW (Player)' : '🎨 DM VIEW (Architect)');
    console.log('☀️  DAYLIGHT MODE:', isDaylightMode ? '✅ ON (no fog)' : '❌ OFF (fog enabled)');
    console.log('');
    console.log('📊 COUNTS:');
    console.log(`  - Total Tokens: ${tokens.length}`);
    console.log(`  - PC Tokens: ${tokens.filter(t => t.type === 'PC').length}`);
    console.log(`  - NPC Tokens: ${tokens.filter(t => t.type === 'NPC').length}`);
    console.log(`  - Doors: ${doors.length}`);
    console.log(`  - Stairs: ${stairs.length}`);
    console.log(`  - Wall Drawings: ${drawings.filter(d => d.tool === 'wall').length}`);
    console.log(`  - Active Vision Polygons: ${activeVisionPolygons.length}`);
    console.log('');
    console.log('🔍 VISION SETUP:');
    const pcTokens = tokens.filter(t => t.type === 'PC');
    if (pcTokens.length === 0) {
      console.log('  ⚠️ NO PC TOKENS! Add a PC token to enable vision.');
    } else {
      pcTokens.forEach(t => {
        const hasVision = (t.visionRadius ?? 0) > 0;
        console.log(`  - ${t.name || 'PC'}: Vision = ${t.visionRadius || 'NOT SET'} ${hasVision ? '✅' : '❌ SET VISION RADIUS!'}`);
      });
    }
    console.log('');
    console.log('🚪 DOOR STATUS:');
    if (doors.length === 0) {
      console.log('  ℹ️  No doors placed yet. Press D to place doors.');
    } else {
      console.log(`  - Total: ${doors.length}`);
      console.log(`  - Closed (blocking): ${doors.filter(d => !d.isOpen).length}`);
      console.log(`  - Open (transparent): ${doors.filter(d => d.isOpen).length}`);
    }
    console.log('');
    console.log('✅ FOG WILL RENDER:', !isDaylightMode && isWorldView ? 'YES' : `NO (${isDaylightMode ? 'Daylight ON' : 'DM View'})`);
    console.log('═══════════════════════════════════════════════════════');
  }

  // Resolve token data by merging instance properties with library defaults
  // This implements the Prototype/Instance pattern where tokens can inherit
  // properties (scale, type, visionRadius, name) from their library prototypes
  const resolvedTokens = useMemo(
    () => tokens.map(token => resolveTokenData(token, tokenLibrary)),
    [tokens, tokenLibrary]
  );

  // Preferences
  const wallToolPrefs = usePreferencesStore(s => s.wallTool);
  const touchSettings = useTouchSettingsStore();

  // Touch/Stylus tracking for palm rejection
  const stylusActiveRef = useRef(false); // Track if stylus is currently being used
  const lastStylusLiftTimeRef = useRef(0); // Timestamp of last stylus lift (for smartDelay palm rejection)

  // Measurement state
  const activeMeasurement = useGameStore(s => s.activeMeasurement);
  const dmMeasurement = useGameStore(s => s.dmMeasurement);

  // Actions - these are stable
  const addToken = useGameStore(s => s.addToken);
  const addDrawing = useGameStore(s => s.addDrawing);
  const addDoor = useGameStore(s => s.addDoor);
  const updateTokenPosition = useGameStore(s => s.updateTokenPosition);
  const updateTokenTransform = useGameStore(s => s.updateTokenTransform);
  const removeTokens = useGameStore(s => s.removeTokens);
  const removeDrawings = useGameStore(s => s.removeDrawings);
  const setGridType = useGameStore(s => s.setGridType);
  const toggleDoor = useGameStore(s => s.toggleDoor);
  const setIsCalibrating = useGameStore(s => s.setIsCalibrating);
  const updateMapTransform = useGameStore(s => s.updateMapTransform);
  const updateDrawingTransform = useGameStore(s => s.updateDrawingTransform);
  const setActiveMeasurement = useGameStore(s => s.setActiveMeasurement);
  const showToast = useGameStore(s => s.showToast);

  const isDrawing = useRef(false);
  const currentLine = useRef<Drawing | null>(null); // Current drawing data (source of truth)
  const [tempLine, setTempLine] = useState<Drawing | null>(null); // React state for initial render
  const tempLineRef = useRef<Konva.Line | null>(null); // Direct Konva ref for performance updates
  const drawingAnimationFrameRef = useRef<number | null>(null); // RAF handle for drawing

  // Door Tool State
  const [doorPreviewPos, setDoorPreviewPos] = useState<{ x: number, y: number } | null>(null);

  // Measurement State
  const isMeasuring = useRef(false);
  const measurementStart = useRef<{ x: number, y: number } | null>(null);

  // Calibration State
  const calibrationStart = useRef<{x: number, y: number} | null>(null);
  const [calibrationRect, setCalibrationRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  // Cropping State
  const [pendingCrop, setPendingCrop] = useState<{ src: string, x: number, y: number } | null>(null);

  // Asset Processing State - Track active processing to prevent worker leaks
  const processingHandleRef = useRef<ProcessingHandle | null>(null);

  // Selection & Drag State
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number, isVisible: boolean }>({ x: 0, y: 0, width: 0, height: 0, isVisible: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const transformerRef = useRef<any>(null);
  const selectionStart = useRef<{x: number, y: number} | null>(null);
  const selectionRectRef = useRef<Konva.Rect | null>(null); // Direct ref to Konva Rect for performance
  const selectionRectCoordsRef = useRef<{ x: number, y: number, width: number, height: number }>({ x: 0, y: 0, width: 0, height: 0 }); // Coords during drag
  const animationFrameRef = useRef<number | null>(null); // RAF handle for throttling
  const tokenLayerRef = useRef<Konva.Layer | null>(null); // Direct ref to token layer for drag updates

  // Ghost / Duplication State
  const [itemsForDuplication, setItemsForDuplication] = useState<string[]>([]);
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Real-time Drag Tracking (for performance and multi-user sync)
  const dragPositionsRef = useRef<Map<string, { x: number, y: number }>>(new Map());
  const [draggingTokenIds, setDraggingTokenIds] = useState<Set<string>>(new Set());
  const dragBroadcastThrottleRef = useRef<Map<string, number>>(new Map());
  const dragStartOffsetsRef = useRef<Map<string, { x: number, y: number }>>(new Map()); // For multi-token drag
  const DRAG_BROADCAST_THROTTLE_MS = 16; // ~60fps
  const tokenNodesRef = useRef<Map<string, any>>(new Map()); // Direct refs to Konva nodes for smooth drag without React re-renders
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null); // Track hovered token for interactive feedback
  const [hoveredCell, setHoveredCell] = useState<{ q: number; r: number } | null>(null); // Track hovered grid cell for highlight
  const snapPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map()); // Snap preview positions for dragged tokens

  // Press-and-Hold Drag State (threshold-based drag detection)
  const DRAG_THRESHOLD = 5; // pixels - minimum movement to trigger drag
  const [tokenMouseDownStart, setTokenMouseDownStart] = useState<{ x: number, y: number, tokenId: string, stagePos: { x: number, y: number } } | null>(null);
  const [isDraggingWithThreshold, setIsDraggingWithThreshold] = useState(false);

  // Empty handlers for disabled Konva drag events (defined once to prevent re-renders)
  const emptyDragHandler = useCallback(() => {}, []);


  // Navigation State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Movement Range State
  const [isMKeyPressed, setIsMKeyPressed] = useState(false);

  // Theme-aware text color for contrast
  const textColor = useThemeColor('--app-text-primary');

  // Touch/Pinch State
  const lastPinchDistance = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number, y: number } | null>(null);
  const lastPanCenter = useRef<{ x: number, y: number } | null>(null);

  // Use pinch distance threshold from settings (user-configurable)
  // Clamp to reasonable range (5-50 pixels) to prevent gesture detection issues
  const PINCH_DISTANCE_THRESHOLD = Math.min(
    Math.max(touchSettings.pinchDistanceThreshold, 5),
    50
  );

  /**
   * Track stylus usage for palm rejection
   *
   * Updates internal refs when a pen/stylus input is detected.
   * Should be called on pointer down events.
   *
   * @param e - Konva event object
   */
  const trackStylusUsage = useCallback((e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): void => {
    const evt = e.evt;
    if ('pointerType' in evt && evt.pointerType === 'pen') {
      stylusActiveRef.current = true;
    }
  }, []);

  /**
   * Enhanced pointer pressure extractor with settings support
   *
   * Applies user-configured pressure curve and respects pressure sensitivity toggle.
   * When pressure sensitivity is disabled, returns constant 0.5 for uniform stroke width.
   *
   * @param e - Konva event object
   * @returns Adjusted pressure value (0.0 - 1.0)
   */
  const getPointerPressureWithSettings = useCallback((e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): number => {
    // If pressure sensitivity is disabled, return constant pressure
    if (!touchSettings.pressureSensitivityEnabled) {
      return 0.5;
    }

    // Get raw pressure
    const rawPressure = getPointerPressure(e);

    // Apply pressure curve multiplier
    const { min, max } = touchSettings.getPressureRange();
    const range = max - min;
    return min + (rawPressure * range);
  }, [touchSettings]);

  /**
   * Check if this pointer event should be rejected (palm rejection)
   *
   * Implements multiple palm rejection strategies based on user settings:
   * - off: Accept all input
   * - touchSize: Reject large contact areas (palms)
   * - stylusOnly: Reject touch when stylus is active
   * - smartDelay: Reject touch shortly after stylus lift
   *
   * @param e - Konva event object
   * @returns true if event should be rejected, false if should be processed
   */
  const shouldRejectPointerEvent = useCallback((e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): boolean => {
    const evt = e.evt;

    // Type guard: Only PointerEvent has pointerType property
    if (!('pointerType' in evt)) {
      return false; // MouseEvent/TouchEvent - don't reject
    }

    // Desktop-only mode: reject all touch input
    if (touchSettings.desktopOnlyMode && evt.pointerType === 'touch') {
      return true;
    }

    // Use the store's rejection logic (safe guard: pointerType exists, so this is a PointerEvent)
    // EXCEPTION: If using a drawing tool (marker/wall/eraser) and NO stylus is active,
    // be lenient with palm rejection (assume finger drawing).
    // This allows thumb/finger drawing on mobile to work even if the touch contact is large.
    if (tool !== 'select' && !stylusActiveRef.current && evt.pointerType === 'touch') {
        // Desktop-only mode is already handled above with an early return.
        // Here we explicitly allow finger touches when drawing without an active stylus.
        return false;
    }

    const shouldReject = touchSettings.shouldRejectTouch(evt as PointerEvent, stylusActiveRef.current);

    // Additional smart delay logic (time-based, not in store)
    if (touchSettings.palmRejectionMode === 'smartDelay' && evt.pointerType === 'touch') {
      const timeSinceStylusLift = Date.now() - lastStylusLiftTimeRef.current;
      if (timeSinceStylusLift < touchSettings.palmRejectionDelay) {
        return true;
      }
    }

    return shouldReject;
  }, [touchSettings]);

  /**
   * Track stylus lift for smart delay palm rejection
   */
  const handleStylusLift = useCallback((e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    const evt = e.evt;
    if ('pointerType' in evt && evt.pointerType === 'pen') {
      stylusActiveRef.current = false;
      lastStylusLiftTimeRef.current = Date.now();
    }
  }, []);

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
    if (isDraggingWithThreshold) {
      return 'grabbing';
    }
    if (tool === 'select') {
      return 'default';
    }
    return 'crosshair';
  }, [isSpacePressed, isDragging, isDraggingWithThreshold, tool]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Helper function to clamp viewport position within bounds
  const clampPosition = useCallback((newPos: { x: number, y: number }, newScale: number) => {
      // Calculate bounds including both map and token positions
      // This ensures we can navigate to tokens even if they're outside the map
      let bounds = {
          minX: -DEFAULT_BOUNDS_SIZE,
          maxX: DEFAULT_BOUNDS_SIZE,
          minY: -DEFAULT_BOUNDS_SIZE,
          maxY: DEFAULT_BOUNDS_SIZE
      };

      if (map) {
          bounds = {
              minX: map.x,
              maxX: map.x + (map.width * map.scale),
              minY: map.y,
              maxY: map.y + (map.height * map.scale)
          };
      }

      // Expand bounds to include PC tokens (so we can always navigate to party)
      const pcTokens = resolvedTokens.filter(t => t.type === 'PC');
      if (pcTokens.length > 0) {
          pcTokens.forEach(token => {
              const tokenSize = gridSize * token.scale;
              bounds.minX = Math.min(bounds.minX, token.x);
              bounds.minY = Math.min(bounds.minY, token.y);
              bounds.maxX = Math.max(bounds.maxX, token.x + tokenSize);
              bounds.maxY = Math.max(bounds.maxY, token.y + tokenSize);
          });
      }

      const viewportCenterX = (-newPos.x + size.width/2) / newScale;
      const viewportCenterY = (-newPos.y + size.height/2) / newScale;

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
          x: -(clampedCenterX * newScale - size.width/2),
          y: -(clampedCenterY * newScale - size.height/2)
      };
  }, [map, tokens, gridSize, size.width, size.height]);

  // Reusable zoom function
  const performZoom = useCallback((newScale: number, centerX: number, centerY: number, currentScale: number, currentPos: { x: number, y: number }) => {
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
  }, [size.width, size.height, map, clampPosition]);

  // Keyboard zoom (centered on viewport)
  const handleKeyboardZoom = useCallback((zoomIn: boolean) => {
      if (!containerRef.current) return;

      const centerX = size.width / 2;
      const centerY = size.height / 2;
      const newScale = zoomIn ? scale * ZOOM_SCALE_BY : scale / ZOOM_SCALE_BY;

      performZoom(newScale, centerX, centerY, scale, position);
  }, [scale, position, size.width, size.height, performZoom]);

    // Consolidated keyboard event handling for canvas operations
  useEffect(() => {
    const isEditableElement = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        el.isContentEditable
      );
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
      if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
          e.preventDefault();
          setIsMKeyPressed(true);
      }

      // Grid type shortcuts (DM only) - 1-5 keys
      if (!isWorldView && !e.repeat) {
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
  }, [selectedIds, removeTokens, removeDrawings, handleKeyboardZoom]);

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
                      y: position.y + dy
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
                const fgColor = computedStyles.getPropertyValue('--app-text-primary')?.trim() || '#ffffff';

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

    // Cancel any previous processing
    if (processingHandleRef.current) {
      processingHandleRef.current.cancel();
      processingHandleRef.current = null;
    }

    try {
        const file = new File([blob], "token.webp", { type: 'image/webp' });

        // If Shift is held during drop (simulated here by checking state or just assumption),
        // we could process as MAP. But determining "Shift was held" during async drop/crop is hard.
        // For now, we assume TOKEN from crop.

        // Start processing and store handle for cleanup
        const handle = processImage(file, 'TOKEN'); // Default to Token for now
        processingHandleRef.current = handle;

        const src = await handle.promise;

        // Clear handle after successful completion
        processingHandleRef.current = null;

        addToken({
          id: crypto.randomUUID(),
          x: pendingCrop.x,
          y: pendingCrop.y,
          src,
          scale: 1,
        });

        // Note: Users can add tokens to library via Sidebar or Library Manager
        // TODO: In future, add UI to swap to Map or set 'processImage' type based on user choice
    } catch (err) {
        console.error("Crop save failed", err);
        // Clear handle on error
        processingHandleRef.current = null;
    } finally {
        setPendingCrop(null);
    }
  };

  // Throttle utility for drag broadcasts
  const throttleDragBroadcast = useCallback((tokenId: string, x: number, y: number) => {
    const now = Date.now();
    const lastBroadcast = dragBroadcastThrottleRef.current.get(tokenId) || 0;

    if (now - lastBroadcast >= DRAG_BROADCAST_THROTTLE_MS) {
      dragBroadcastThrottleRef.current.set(tokenId, now);

      // Broadcast to World View via IPC
      const ipcRenderer = window.ipcRenderer;
      if (ipcRenderer && !isWorldView) {
        ipcRenderer.send('SYNC_WORLD_STATE', {
          type: 'TOKEN_DRAG_MOVE',
          payload: { id: tokenId, x, y }
        });
      }
    }
  }, [isWorldView]);

  // Token Pointer Handlers (Threshold-based Press-and-Hold)
  // Migrated to Pointer Events API for unified mouse/touch/pen support
  const handleTokenPointerDown = useCallback((e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>, tokenId: string) => {
    // Track stylus usage for palm rejection (must happen before rejection check)
    trackStylusUsage(e);

    // Palm rejection - reject unwanted touch input
    if (shouldRejectPointerEvent(e)) return;

    if (tool !== 'select') return;

    // Ignore multi-touch gestures (let gesture handlers handle those)
    if (isMultiTouchGesture(e)) return;

    // Record the initial pointer position and the token's starting stage position
    const pointerPos = getPointerPosition(e);
    if (!pointerPos) return;

    const token = resolvedTokens.find(t => t.id === tokenId);
    if (!token) return;

    e.evt.stopPropagation();

    // Store the initial pointer position and token position
    setTokenMouseDownStart({
      x: pointerPos.x,
      y: pointerPos.y,
      tokenId,
      stagePos: { x: token.x, y: token.y }
    });
    setIsDraggingWithThreshold(false);
  }, [tool, resolvedTokens, shouldRejectPointerEvent]);

  const handleTokenPointerMove = useCallback((e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    // Palm rejection - reject unwanted touch input
    if (shouldRejectPointerEvent(e)) return;

    if (!tokenMouseDownStart || tool !== 'select') return;

    // Ignore multi-touch gestures
    if (isMultiTouchGesture(e)) return;

    const pointerPos = getPointerPosition(e);
    if (!pointerPos) return;

    // Calculate distance moved
    const dx = pointerPos.x - tokenMouseDownStart.x;
    const dy = pointerPos.y - tokenMouseDownStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If we've moved more than the threshold, start dragging
    if (!isDraggingWithThreshold && distance > DRAG_THRESHOLD) {
      setIsDraggingWithThreshold(true);

      const tokenId = tokenMouseDownStart.tokenId;

      // If token is not already selected, select it immediately for fluid drag behavior
      // This allows "grab and drag" in one motion without requiring a separate click to select
      let tokenIds: string[];
      if (selectedIds.includes(tokenId)) {
        tokenIds = selectedIds;
      } else {
        // Select the token immediately when starting to drag it
        tokenIds = e.evt.shiftKey ? [...selectedIds, tokenId] : [tokenId];
        setSelectedIds(tokenIds);
      }

      const primaryToken = resolvedTokens.find(t => t.id === tokenId);
      if (!primaryToken) return;

      // Initialize drag state
      setDraggingTokenIds(new Set(tokenIds));
      setItemsForDuplication(tokenIds);

      // Store initial offsets for multi-token drag
      dragStartOffsetsRef.current.clear();
      tokenIds.forEach(id => {
        const token = resolvedTokens.find(t => t.id === id);
        if (token) {
          if (id === tokenId) {
            dragStartOffsetsRef.current.set(id, { x: 0, y: 0 });
          } else {
            dragStartOffsetsRef.current.set(id, {
              x: token.x - primaryToken.x,
              y: token.y - primaryToken.y
            });
          }
        }
      });

      // Broadcast drag start to World View
      const ipcRenderer = window.ipcRenderer;
      if (ipcRenderer && !isWorldView) {
        tokenIds.forEach(id => {
          const token = resolvedTokens.find(t => t.id === id);
          if (token) {
            ipcRenderer.send('SYNC_WORLD_STATE', {
              type: 'TOKEN_DRAG_START',
              payload: { id, x: token.x, y: token.y }
            });
          }
        });
      }
    }

    // If we're dragging, update positions
    if (isDraggingWithThreshold) {
      const tokenId = tokenMouseDownStart.tokenId;
      const worldDx = dx;
      const worldDy = dy;
      const newX = tokenMouseDownStart.stagePos.x + worldDx;
      const newY = tokenMouseDownStart.stagePos.y + worldDy;

      // Update drag position for primary token
      dragPositionsRef.current.set(tokenId, { x: newX, y: newY });
      throttleDragBroadcast(tokenId, newX, newY);

      // Calculate snap preview position for primary token
      const token = resolvedTokens.find(t => t.id === tokenId);
      if (token) {
        const width = gridSize * token.scale;
        const height = gridSize * token.scale;
        const snapped = snapToGrid(newX, newY, gridSize, gridType, width, height);
        snapPreviewPositionsRef.current.set(tokenId, snapped);
      }

      // Update multi-token positions
      const tokenIds = selectedIds.includes(tokenId) ? selectedIds : [tokenId];
      if (tokenIds.length > 1) {
        tokenIds.forEach(id => {
          if (id !== tokenId) {
            const offset = dragStartOffsetsRef.current.get(id);
            if (offset) {
              const offsetX = newX + offset.x;
              const offsetY = newY + offset.y;
              dragPositionsRef.current.set(id, { x: offsetX, y: offsetY });
              throttleDragBroadcast(id, offsetX, offsetY);

              // Calculate snap preview position for this token
              const otherToken = resolvedTokens.find(t => t.id === id);
              if (otherToken) {
                const width = gridSize * otherToken.scale;
                const height = gridSize * otherToken.scale;
                const snapped = snapToGrid(offsetX, offsetY, gridSize, gridType, width, height);
                snapPreviewPositionsRef.current.set(id, snapped);
              }

              // Directly update Konva node position (no React re-render needed)
              // This creates intentional desynchronization between Konva and React state for performance.
              // dragPositionsRef maintains the source of truth, ensuring React reconciliation uses
              // correct positions if re-renders occur during drag.
              const node = tokenNodesRef.current.get(id);
              if (node) {
                node.x(offsetX);
                node.y(offsetY);
              }
            }
          }
        });
      }

      // Directly update Konva node position for primary token (no React re-render needed)
      // This creates intentional desynchronization between Konva and React state for performance.
      // dragPositionsRef maintains the source of truth, ensuring React reconciliation uses
      // correct positions if re-renders occur during drag.
      const node = tokenNodesRef.current.get(tokenId);
      if (node) {
        node.x(newX);
        node.y(newY);
      }

      // Batch redraw the layer for smooth visual updates
      if (tokenLayerRef.current) {
        tokenLayerRef.current.batchDraw();
      }
    }
  }, [tokenMouseDownStart, isDraggingWithThreshold, tool, resolvedTokens, selectedIds, setSelectedIds, throttleDragBroadcast, isWorldView]);

  const handleTokenPointerUp = useCallback((e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    if (!tokenMouseDownStart) return;

    const tokenId = tokenMouseDownStart.tokenId;
    const token = resolvedTokens.find(t => t.id === tokenId);
    if (!token) {
      setTokenMouseDownStart(null);
      setIsDraggingWithThreshold(false);
      return;
    }

    // If we were dragging, finalize the drag
    if (isDraggingWithThreshold) {
      const tokenIds = selectedIds.includes(tokenId) ? selectedIds : [tokenId];
      const committedPositions = new Map<string, { x: number, y: number }>();

      // Get the final position and snap to grid
      const dragPos = dragPositionsRef.current.get(tokenId);
      if (dragPos) {
        const width = gridSize * token.scale;
        const height = gridSize * token.scale;
        const snapped = snapToGrid(dragPos.x, dragPos.y, gridSize, gridType, width, height);

        // Handle multi-token drag end
        if (tokenIds.length > 1) {
          const offsetX = snapped.x - dragPos.x;
          const offsetY = snapped.y - dragPos.y;

          tokenIds.forEach(id => {
            const t = resolvedTokens.find(tk => tk.id === id);
            if (t) {
              const dragPosForToken = dragPositionsRef.current.get(id) ?? { x: t.x, y: t.y };
              const newX = dragPosForToken.x + offsetX;
              const newY = dragPosForToken.y + offsetY;
              const snappedPos = snapToGrid(newX, newY, gridSize, gridType, gridSize * t.scale, gridSize * t.scale);
              updateTokenPosition(id, snappedPos.x, snappedPos.y);
              committedPositions.set(id, { x: snappedPos.x, y: snappedPos.y });
            }
          });
        } else {
          updateTokenPosition(tokenId, snapped.x, snapped.y);
          committedPositions.set(tokenId, { x: snapped.x, y: snapped.y });
        }

        // Broadcast drag end to World View
        const ipcRenderer = window.ipcRenderer;
        if (ipcRenderer && !isWorldView) {
          tokenIds.forEach(id => {
            const pos = committedPositions.get(id);
            if (pos) {
              ipcRenderer.send('SYNC_WORLD_STATE', {
                type: 'TOKEN_DRAG_END',
                payload: { id, x: pos.x, y: pos.y }
              });
            }
          });
        }

        // Duplication Logic (Option/Alt + Drag)
        if (isAltPressed && !isWorldView) {
          tokenIds.forEach(id => {
            const t = tokens.find(tk => tk.id === id);
            const pos = committedPositions.get(id);
            if (t && pos) {
              addToken({ ...t, id: crypto.randomUUID(), x: pos.x, y: pos.y });
            }
          });
        }
      }

      // Clear drag state
      tokenIds.forEach(id => {
        dragPositionsRef.current.delete(id);
        dragBroadcastThrottleRef.current.delete(id);
        dragStartOffsetsRef.current.delete(id);
      });
      setDraggingTokenIds(new Set());
      setItemsForDuplication([]);
    } else {
      // No drag occurred - treat as selection click
      e.evt.stopPropagation();
      if (e.evt.shiftKey) {
        if (selectedIds.includes(tokenId)) {
          setSelectedIds(selectedIds.filter(id => id !== tokenId));
        } else {
          setSelectedIds([...selectedIds, tokenId]);
        }
      } else {
        setSelectedIds([tokenId]);
      }
    }

    // Reset drag state
    setTokenMouseDownStart(null);
    setIsDraggingWithThreshold(false);
    snapPreviewPositionsRef.current.clear(); // Clear snap preview positions
  }, [tokenMouseDownStart, isDraggingWithThreshold, resolvedTokens, tokens, selectedIds, setSelectedIds, gridSize, isAltPressed, isWorldView, updateTokenPosition, addToken, throttleDragBroadcast, shouldRejectPointerEvent]);

  // Drawing Handlers (Pointer Events - unified mouse/touch/pen support)
  const handlePointerDown = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    // Track stylus usage for palm rejection (must happen before rejection check)
    trackStylusUsage(e);

    // Palm rejection - reject unwanted touch input
    if (shouldRejectPointerEvent(e)) return;

    // Enforce preventDefault for drawing tools to prevent scrolling/navigation
    // This is critical for mobile touch drawing
    // Only apply to actual touch events, not synthetic test events (pointerType check)
    // CSS touch-action provides additional protection
    if (tool !== 'select' && e.evt.cancelable && 'pointerType' in e.evt && e.evt.pointerType === 'touch') {
        e.evt.preventDefault();
    }

    if (isSpacePressed) return; // Allow panning

    // Ignore multi-touch gestures (zoom/pan)
    if (isMultiTouchGesture(e)) return;

    // DOOR TOOL - Do nothing on pointer down, wait for pointer up
    if (tool === 'door') {
      console.log('[CanvasManager] Door tool active - ignoring pointerDown');
      return;
    }

    // Clear active measurement when clicking (unless we're starting a new measurement)
    if (tool !== 'measure' && activeMeasurement) {
        setActiveMeasurement(null);
    }

    // CALIBRATION LOGIC
    // BLOCKED in World View (players cannot calibrate grid)
    if (isCalibrating) {
        if (isWorldView) return; // Block calibration in World View
        const pos = getPointerPosition(e);
        if (!pos) return;
        calibrationStart.current = { x: pos.x, y: pos.y };
        setCalibrationRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
        return;
    }

    // If measure tool, start measurement
    if (tool === 'measure') {
        if (isWorldView) return; // Block measurement creation in World View
        isMeasuring.current = true;
        const pos = getPointerPosition(e);
        if (!pos) return;
        measurementStart.current = { x: pos.x, y: pos.y };
        return;
    }

    // If marker/eraser/wall, draw
    // BLOCKED in World View (players cannot draw)
    if (tool !== 'select') {
        if (isWorldView) return; // Block drawing tools in World View
        isDrawing.current = true;
        const pos = getPointerPosition(e);
        if (!pos) return;

        // Get initial pressure for pressure-sensitive drawing (with user settings applied)
        const pressure = getPointerPressureWithSettings(e);

        // Set color and size based on tool type
        let drawColor = color;
        let drawSize = 5;

        if (tool === 'eraser') {
            drawColor = '#000000';
            drawSize = 20;
        } else if (tool === 'wall') {
            drawColor = '#ff0000'; // Red color for walls (visible in DM view only)
            drawSize = 8;
        }

        currentLine.current = {
            id: crypto.randomUUID(),
            tool: tool,
            points: [pos.x, pos.y],
            color: drawColor,
            size: drawSize,
            // Only capture pressure if pressure sensitivity is enabled (performance optimization)
            pressures: touchSettings.pressureSensitivityEnabled ? [pressure] : undefined,
        };
        return;
    }

    // Select Tool Logic
    const clickedOnStage = e.target === e.target.getStage();
    const clickedOnMap = e.target.id() === 'map';

    if (clickedOnStage || clickedOnMap) {
        // Start Selection Rect
        const pos = getPointerPosition(e);
        if (!pos) return;

        selectionStart.current = { x: pos.x, y: pos.y };

        // Use refs for performance - avoid React state updates during drag
        selectionRectCoordsRef.current = {
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0
        };

        // Only set visibility state once (not on every move)
        setSelectionRect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            isVisible: true
        });

        // Clear selection if not modified (shift-click to add to selection)
        const evt = e.evt;
        if (!('shiftKey' in evt) || !evt.shiftKey) {
             setSelectedIds([]);
        }
    } else {
         // Clicked on item? Handled by onClick on item itself usually,
         // but if we are in select tool and dragging, we might want to start dragging that item.
         // Konva handles dragging automatically if draggable=true.
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    // Palm rejection - reject unwanted touch input
    if (shouldRejectPointerEvent(e)) return;

    // Enforce preventDefault for drawing tools to prevent scrolling/navigation
    // Only apply to actual touch events, not synthetic test events (pointerType check)
    // CSS touch-action provides additional protection
    if (tool !== 'select' && e.evt.cancelable && 'pointerType' in e.evt && e.evt.pointerType === 'touch') {
        e.evt.preventDefault();
    }

    if (isSpacePressed) return;

    // Ignore multi-touch gestures
    if (isMultiTouchGesture(e)) return;

    // Update hovered cell for grid highlight (only if grid is visible)
    if (gridType !== 'HIDDEN' && gridType !== 'DOTS') {
      const pos = getPointerPosition(e);
      if (pos) {
        const geometry = createGridGeometry(gridType);
        const cell = geometry.pixelToGrid(pos.x, pos.y, gridSize);
        setHoveredCell(cell);
      }
    }

    // DOOR TOOL PREVIEW - Show preview while hovering
    if (tool === 'door' && !isWorldView) {
      const pos = getPointerPosition(e);
      if (!pos) return;

      // Snap to grid for preview
      const snapped = snapToGrid(pos.x, pos.y, gridSize, gridType);

      setDoorPreviewPos(snapped);
      return;
    } else {
      // Clear door preview when not using door tool
      setDoorPreviewPos(null);
    }

    // Handle token dragging with threshold
    if (tokenMouseDownStart) {
      handleTokenPointerMove(e);
      return;
    }

    // Handle measurement tool
    if (tool === 'measure' && isMeasuring.current && measurementStart.current) {
        const pos = getPointerPosition(e);
        if (!pos) return;
        const origin = measurementStart.current;

        let measurement: Measurement;

        switch (measurementMode) {
            case 'ruler': {
                const distanceFeet = pixelsToFeet(
                    euclideanDistance(origin, pos),
                    gridSize,
                    DistanceMode.EUCLIDEAN
                );
                measurement = {
                    id: 'active',
                    type: 'ruler',
                    origin,
                    end: pos,
                    distanceFeet
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
                    radiusFeet
                };
                break;
            }
            case 'cone': {
                const vertices = calculateConeVertices(origin, pos);
                const lengthFeet = pixelsToFeet(
                    euclideanDistance(origin, pos),
                    gridSize,
                    DistanceMode.EUCLIDEAN
                );
                measurement = {
                    id: 'active',
                    type: 'cone',
                    origin,
                    target: pos,
                    lengthFeet,
                    angleDegrees: 53,
                    vertices
                };
                break;
            }
        }

        setActiveMeasurement(measurement);
        return;
    }

    if (tool !== 'select') {
        // BLOCKED in World View (no drawing tools)
        if (isWorldView) return;
        if (!isDrawing.current) return;
        let point = getPointerPosition(e);
        if (!point) return;
        const cur = currentLine.current;

        // Guard against null currentLine
        if (!cur) return;

        // Shift-key axis locking: Lock to horizontal or vertical
        const evt = e.evt;
        if ('shiftKey' in evt && evt.shiftKey && cur.points.length >= 2) {
            const startX = cur.points[0];
            const startY = cur.points[1];
            const dx = Math.abs(point.x - startX);
            const dy = Math.abs(point.y - startY);

            if (dx > dy) {
                // Lock to horizontal (X axis)
                point = { x: point.x, y: startY };
            } else {
                // Lock to vertical (Y axis)
                point = { x: startX, y: point.y };
            }
        }

        // Performance optimization: Skip consecutive duplicate points to reduce memory and render overhead
        // Note: This only deduplicates consecutive points, not all duplicates in the array
        const lastIdx = cur.points.length - 2;
        if (lastIdx >= 0 && cur.points[lastIdx] === point.x && cur.points[lastIdx + 1] === point.y) {
            return; // Skip consecutive duplicate point
        }

        // Get pressure for this point (with user settings applied)
        const pressure = getPointerPressureWithSettings(e);

        // Performance optimization: Use push (in-place mutation) instead of concat (array copy)
        // This reduces GC pressure and is faster for large stroke collections
        //
        // IMMUTABILITY EXCEPTION: This mutates currentLine.current.points/pressures directly, which
        // violates the general immutability pattern established in the codebase. This is
        // acceptable here because:
        // 1. currentLine.current is a ref, not Zustand state
        // 2. The arrays are never shared with React state during drawing
        // 3. The performance benefit is significant for smooth drawing (60fps target)
        // 4. The mutation is isolated to the drawing operation
        cur.points.push(point.x, point.y);
        if (cur.pressures) {
            cur.pressures.push(pressure);
        }

        // Cancel previous animation frame
        if (drawingAnimationFrameRef.current) {
            cancelAnimationFrame(drawingAnimationFrameRef.current);
        }

        // Throttle visual updates with RAF
        drawingAnimationFrameRef.current = requestAnimationFrame(() => {
            // Update Konva shape directly
            if (tempLineRef.current) {
                tempLineRef.current.points(cur.points);
                tempLineRef.current.getLayer()?.batchDraw();
            } else {
                // Initial render - need to set state to create the component
                setTempLine({...cur});
            }
        });
        return;
    }

    // CALIBRATION LOGIC
    if (isCalibrating && calibrationStart.current) {
        const pos = getPointerPosition(e);
        if (!pos) return;
        const x = Math.min(pos.x, calibrationStart.current.x);
        const y = Math.min(pos.y, calibrationStart.current.y);
        const width = Math.abs(pos.x - calibrationStart.current.x);
        const height = Math.abs(pos.y - calibrationStart.current.y);
        setCalibrationRect({ x, y, width, height });
        return;
    }

    // Selection Rect Update - Use refs + RAF for performance
    if (selectionStart.current) {
        const pos = getPointerPosition(e);
        if (!pos) return;
        const x = Math.min(pos.x, selectionStart.current.x);
        const y = Math.min(pos.y, selectionStart.current.y);
        const width = Math.abs(pos.x - selectionStart.current.x);
        const height = Math.abs(pos.y - selectionStart.current.y);

        // Store coords in ref (no re-render)
        selectionRectCoordsRef.current = { x, y, width, height };

        // Cancel previous animation frame to avoid stacking updates
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        // Throttle visual updates with RAF (~60fps max)
        animationFrameRef.current = requestAnimationFrame(() => {
            // Update Konva shape directly without triggering React re-render
            if (selectionRectRef.current) {
                selectionRectRef.current.x(x);
                selectionRectRef.current.y(y);
                selectionRectRef.current.width(width);
                selectionRectRef.current.height(height);
                selectionRectRef.current.getLayer()?.batchDraw();
            }
        });
    }
  };

  const handlePointerUp = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    // Track stylus lift for smart delay palm rejection
    handleStylusLift(e);

    // Ignore multi-touch gestures
    if (isMultiTouchGesture(e)) return;

    // DOOR TOOL LOGIC - Click to place
    // BLOCKED in World View (players cannot place doors)
    if (tool === 'door' && !isWorldView) {
      const clickedOnStage = e.target === e.target.getStage();
      const clickedOnMap = e.target.id() === 'map';

      if (clickedOnStage || clickedOnMap) {
        const pos = getPointerPosition(e);
        if (!pos) return;

        // Snap to grid
        const snapped = snapToGrid(pos.x, pos.y, gridSize, gridType);

        // Create door at snapped position
        const newDoor = {
          id: crypto.randomUUID(),
          x: snapped.x,
          y: snapped.y,
          orientation: doorOrientation,
          isOpen: false,
          isLocked: false,
          size: gridSize, // Door size matches grid size
        };

        console.log('[CanvasManager] Attempting to place door:', newDoor);
        addDoor(newDoor);
        console.log('[CanvasManager] Door placed successfully! Total doors should now be:', doors.length + 1);
      }
      return;
    }

    // Handle token pointer up (drag end or selection)
    if (tokenMouseDownStart) {
      handleTokenPointerUp(e);
      return;
    }

    // MEASUREMENT LOGIC
    if (tool === 'measure' && isMeasuring.current) {
        isMeasuring.current = false;
        measurementStart.current = null;
        // Keep the measurement visible until user clicks elsewhere or hits Esc
        // The measurement will be cleared in the next mousedown or by Esc key
        return;
    }

    // CALIBRATION LOGIC
    // BLOCKED in World View
    if (isCalibrating && calibrationStart.current && calibrationRect) {
         if (isWorldView) return; // Block calibration in World View
         if (calibrationRect.width > 5 && calibrationRect.height > 5 && map) {
             // Calibration: Scale and align the map so the drawn box represents one grid cell.
             // 1. Calculate scale factor: gridSize / drawn box size
             // 2. Apply scale to map
             // 3. Shift map position so the scaled box aligns with the nearest grid line
             // Using average of dimensions handles non-square rectangles reasonably.
             // This works best when users draw approximately square boxes around grid cells.
             const avgDim = (calibrationRect.width + calibrationRect.height) / 2;
             const scaleFactor = gridSize / avgDim;
             const newScale = map.scale * scaleFactor;

             // Calculate position adjustment after rescaling
             const relX = calibrationRect.x - map.x;
             const relY = calibrationRect.y - map.y;

             const newRelX = relX * scaleFactor;
             const newRelY = relY * scaleFactor;

             const currentProjectedX = map.x + newRelX;
             const currentProjectedY = map.y + newRelY;

             const targetX = Math.round(currentProjectedX / gridSize) * gridSize;
             const targetY = Math.round(currentProjectedY / gridSize) * gridSize;

             const mapAdjustmentX = targetX - currentProjectedX;
             const mapAdjustmentY = targetY - currentProjectedY;

             // Use atomic update to avoid intermediate render states
             updateMapTransform(newScale, map.x + mapAdjustmentX, map.y + mapAdjustmentY);
         }

         setCalibrationRect(null);
         calibrationStart.current = null;
         setIsCalibrating(false);
         return;
    }

    if (tool !== 'select') {
         // BLOCKED in World View (no drawing tools)
         if (isWorldView) return;
         if (!isDrawing.current) return;
         isDrawing.current = false;

         // Cancel any pending drawing animation frame
         if (drawingAnimationFrameRef.current) {
             cancelAnimationFrame(drawingAnimationFrameRef.current);
             drawingAnimationFrameRef.current = null;
         }

         if (currentLine.current) {
             let processedLine: Drawing = { ...currentLine.current };

             // Apply path smoothing for wall tool (if enabled)
             if (processedLine.tool === 'wall' && wallToolPrefs.enableSmoothing) {
                 const originalPoints = processedLine.points;
                 const smoothedPoints = simplifyPath(originalPoints, wallToolPrefs.smoothingEpsilon);

                 // Only use smoothed version if it has enough points
                 if (smoothedPoints.length >= wallToolPrefs.minPoints * 2) {
                     processedLine = { ...processedLine, points: smoothedPoints };
                 }
             }

             // Apply geometry snapping for wall tool (if enabled)
             if (processedLine.tool === 'wall' && wallToolPrefs.enableSnapping) {
                 const existingWallPaths = drawings
                     .filter(d => d.tool === 'wall')
                     .map(w => w.points);

                 if (existingWallPaths.length > 0 && processedLine.points.length >= 4) {
                     const points = [...processedLine.points];

                     // Snap start point
                     const startPoint = { x: points[0], y: points[1] };
                     const startSnap = snapPointToPaths(startPoint, existingWallPaths, wallToolPrefs.snapThreshold);

                     if (startSnap.snapped) {
                         points[0] = startSnap.point.x;
                         points[1] = startSnap.point.y;
                     }

                     // Snap end point
                     const endIdx = points.length - 2;
                     const endPoint = { x: points[endIdx], y: points[endIdx + 1] };
                     const endSnap = snapPointToPaths(endPoint, existingWallPaths, wallToolPrefs.snapThreshold);

                     if (endSnap.snapped) {
                         points[endIdx] = endSnap.point.x;
                         points[endIdx + 1] = endSnap.point.y;
                     }

                     processedLine = { ...processedLine, points };
                 }
             }

             addDrawing(processedLine);
             currentLine.current = null;
             setTempLine(null); // Clear visual line from canvas
         }
         return;
    }

    // End Selection
    if (selectionRect.isVisible) {
        // Cancel any pending animation frame
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // Calculate Intersection
        const stage = e.target.getStage();
        if (!stage) return; // Guard against null stage

        // Use the ref coords (most up-to-date) instead of state
        const box = selectionRectCoordsRef.current;

        // Commit final state to React
        setSelectionRect({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            isVisible: false
        });

        // Transform selection box to Window/Stage-Container coordinates to match getClientRect()
        // box is in World Coordinates (Layer Local)
        // We need it in Stage Container Coordinates
        const scaleX = stage.scaleX();
        const scaleY = stage.scaleY();
        const stageX = stage.x();
        const stageY = stage.y();

        const clientBox = {
            x: box.x * scaleX + stageX,
            y: box.y * scaleY + stageY,
            width: box.width * scaleX,
            height: box.height * scaleY
        };

        // Find all shapes that intersect with selection rect
        const shapes = stage.find('.token, .drawing');
        const selected = shapes.filter((shape: any) => {
            if (!shape.id()) return false;
            // shape.getClientRect() returns rect relative to stage container by default
            return Konva.Util.haveIntersection(clientBox, shape.getClientRect());
        });

        setSelectedIds(selected.map((n: any) => n.id()));
        selectionStart.current = null;
    }
  };

  // Calculate visible bounds in CANVAS coordinates (unscaled)
  // Memoized to prevent recalculation on every render
  // The Stage is transformed by scale and position (-x, -y).
  // Visible region top-left: -position.x / scale, -position.y / scale
  // Visible region dimensions: size.width / scale, size.height / scale
  const visibleBounds = useMemo(() => ({
      x: -position.x / scale,
      y: -position.y / scale,
      width: size.width / scale,
      height: size.height / scale
  }), [position.x, position.y, scale, size.width, size.height]);

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
            const selectedNodes = stage.find((node: any) => selectedIds.includes(node.id()));
            transformerRef.current.nodes(selectedNodes);
            transformerRef.current.getLayer().batchDraw();
        }
    }
  }, [selectedIds]); // Only update when selection changes; nodes are automatically updated by React Konva

  // Cleanup: Cancel any active image processing on unmount
  // CRITICAL: Prevents worker leak if component unmounts during processing
  useEffect(() => {
    return () => {
      if (processingHandleRef.current) {
        console.log('[CanvasManager] Cancelling in-flight image processing on unmount');
        processingHandleRef.current.cancel();
        processingHandleRef.current = null;
      }
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
    const pcTokens = resolvedTokens.filter(t => t.type === 'PC');
    if (pcTokens.length === 0) return;

    // Calculate bounds of all PC tokens
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    pcTokens.forEach(token => {
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
    const newX = - (centerX * newScale - size.width / 2);
    const newY = - (centerY * newScale - size.height / 2);

    // For "Center on Party", we want to allow navigation to tokens even if they're
    // outside the map bounds. The viewport constraints will still prevent going too far.
    // We'll apply a modified clamp that considers both map and token positions.
    const clampedPos = clampPosition({ x: newX, y: newY }, newScale);

    setScale(newScale);
    setPosition(clampedPos);
  }, [resolvedTokens, gridSize, size, clampPosition]);

  // Navigate to a specific world coordinate (used by minimap)
  const navigateToWorldPosition = useCallback((worldX: number, worldY: number) => {
    // Calculate the stage position needed to center this world coordinate
    const newX = -(worldX * scale - size.width / 2);
    const newY = -(worldY * scale - size.height / 2);

    // Clamp to valid bounds
    const clampedPos = clampPosition({ x: newX, y: newY }, scale);
    setPosition(clampedPos);
  }, [scale, size, clampPosition]);

  return (
    <div
        ref={containerRef}
        className="canvas-container w-full h-full overflow-hidden relative"
        style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
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

            <GridOverlay visibleBounds={visibleBounds} gridSize={gridSize} type={gridType} stroke={gridColor} hoveredCell={hoveredCell} />

            {/* Movement Range Overlay - Shows reachable cells for selected token (Hold M key) */}
            {isMKeyPressed && !isWorldView && selectedIds.length === 1 && (() => {
              const selectedToken = resolvedTokens.find(t => t.id === selectedIds[0]);
              if (!selectedToken) return null;

              // Use drag position if token is being dragged
              const dragPos = dragPositionsRef.current.get(selectedToken.id);
              const tokenPos = dragPos || { x: selectedToken.x, y: selectedToken.y };

              // Default movement speed: 30ft (standard for D&D Medium creatures)
              // TODO: Make this configurable per token
              const movementSpeed = 30;

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
        </Layer>

        {/* Fog of War Layer (World View only) - Renders Overlay */}
        {(() => {
          const shouldRenderFog = isWorldView && !isDaylightMode;
          console.log('[CanvasManager] Fog condition:', { isWorldView, isDaylightMode, shouldRenderFog });
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

        {/* Layer 2: Drawings (Separate layer so Eraser doesn't erase map) */}
        <Layer>
            {isAltPressed && drawings.filter(d => itemsForDuplication.includes(d.id)).map(ghostLine => (
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
                    opacity={ghostLine.tool === 'wall' && isWorldView ? 0 : 0.5}
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
                    stroke: line.color,
                    strokeWidth: line.size,
                    lineCap: 'round' as const,
                    opacity: line.tool === 'wall' && isWorldView ? 0 : 1,
                    globalCompositeOperation: line.tool === 'eraser' ? 'destination-out' as const : 'source-over' as const,
                    draggable: tool === 'select' && line.tool !== 'wall',
                };

                // Event handlers (shared by both component types)
                const eventHandlers = {
                    onClick: (e: KonvaEventObject<MouseEvent>) => {
                        if (tool === 'select' && line.tool !== 'wall') {
                            e.evt.stopPropagation();
                            if (e.evt.shiftKey) {
                                if (selectedIds.includes(line.id)) {
                                    setSelectedIds(selectedIds.filter(id => id !== line.id));
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
                            idsToDuplicate.forEach(id => {
                                // Only duplicate drawings here; tokens are handled in their own handler.
                                const drawing = drawings.find(d => d.id === id);
                                if (drawing) {
                                    // Calculate drag offset and apply to all points
                                    // Points array format: [x1, y1, x2, y2, ...] (alternating x,y coordinates)
                                    const points = drawing.points;
                                    const dx = x - (drawing.x || 0);
                                    const dy = y - (drawing.y || 0);
                                    // Offset all points by (dx, dy)
                                    const newPoints = points.map((val, idx) =>
                                        idx % 2 === 0 ? val + dx : val + dy // Even indices are X, odd are Y
                                    );
                                    addDrawing({ ...drawing, id: crypto.randomUUID(), points: newPoints, x: 0, y: 0 });
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
                    }
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
                    opacity={tempLine.tool === 'wall' && isWorldView ? 0 : 1}
                    globalCompositeOperation={
                        tempLine.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                />
            )}

            {/* Stairs (Architectural elements, rendered with drawings) */}
            <StairsLayer
                stairs={stairs}
                isWorldView={isWorldView}
            />
        </Layer>

        {/* Layer 3: Tokens, Doors & UI
          NOTE: tokenLayerRef is used for low-level performance optimizations during
          token drag updates via direct Konva batchDraw() calls instead of full React re-renders */}
        <Layer ref={tokenLayerRef}>
            {/* Doors (Rendered after fog layer so they're visible on top of fog) */}
            {(() => {
              console.log('[CanvasManager] About to render DoorLayer with', doors.length, 'doors');
              return (
                <DoorLayer
                    doors={doors}
                    isWorldView={isWorldView}
                    onToggleDoor={toggleDoor}
                />
              );
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
            {isDraggingWithThreshold && Array.from(snapPreviewPositionsRef.current.entries()).map(([tokenId, snapPos]) => {
              const token = resolvedTokens.find(t => t.id === tokenId);
              if (!token) return null;

              const size = gridSize * token.scale;

              return (
                <Group key={`snap-preview-${tokenId}`}>
                  {/* Outer ring */}
                  <Circle
                    x={snapPos.x + size / 2}
                    y={snapPos.y + size / 2}
                    radius={size / 2 + 4}
                    stroke="rgba(37, 99, 235, 0.6)" // Blue accent color
                    strokeWidth={2}
                    listening={false}
                    dash={[8, 4]}
                  />
                  {/* Inner fill */}
                  <Circle
                    x={snapPos.x + size / 2}
                    y={snapPos.y + size / 2}
                    radius={size / 2}
                    fill="rgba(37, 99, 235, 0.1)"
                    listening={false}
                  />
                </Group>
              );
            })}

            {isAltPressed && resolvedTokens.filter(t => itemsForDuplication.includes(t.id)).map(ghostToken => (
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
                      activeVisionPolygons
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
                    y={displayY}
                    width={gridSize * safeScale}
                    height={gridSize * safeScale}
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
                {isSelected && (
                  <Rect
                    x={displayX}
                    y={displayY}
                    width={gridSize * safeScale}
                    height={gridSize * safeScale}
                    stroke="#2563eb"
                    strokeWidth={3}
                    shadowColor="#2563eb"
                    shadowBlur={8}
                    shadowEnabled={true}
                    listening={false}
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
                    width={(gridSize * safeScale) * 2}
                    x={displayX - (gridSize * safeScale) / 2}
                    y={displayY + (gridSize * safeScale) + 8}
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
                        const token = resolvedTokens.find(t => t.id === node.id());
                        if (token) {
                            // Multiply current scale by transformation scale
                            const newScale = token.scale * transformScale;
                            updateTokenTransform(
                                node.id(),
                                node.x(),
                                node.y(),
                                newScale
                            );
                        }

                        // Reset scale to 1 since the new scale is stored
                        node.scaleX(1);
                        node.scaleY(1);
                    } else if (node.name() === 'drawing') {
                        // Handle drawing (Line) transformation
                        // Use average of scaleX and scaleY for uniform scaling
                        const transformScale = (scaleX + scaleY) / 2;
                        const drawing = drawings.find(d => d.id === node.id());
                        if (drawing) {
                            // Multiply current scale by transformation scale, or set to transformScale if not previously scaled
                            const newScale = (drawing.scale || 1) * transformScale;
                            updateDrawingTransform(
                                node.id(),
                                node.x(),
                                node.y(),
                                newScale
                            );
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
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

export default CanvasManager;
