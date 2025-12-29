import Konva from 'konva';
import { Stage, Layer, Line, Rect, Transformer } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { processImage, ProcessingHandle } from '../../utils/AssetProcessor';
import { snapToGrid } from '../../utils/grid';
import { useGameStore, Drawing } from '../../store/gameStore';
import { usePreferencesStore } from '../../store/preferencesStore';
import { simplifyPath, snapPointToPaths } from '../../utils/pathOptimization';
import { isRectInAnyPolygon } from '../../types/geometry';
import GridOverlay from './GridOverlay';
import ImageCropper from '../ImageCropper';
import TokenErrorBoundary from './TokenErrorBoundary';
import AssetProcessingErrorBoundary from '../AssetProcessingErrorBoundary';
import FogOfWarLayer from './FogOfWarLayer';
import DoorLayer from './DoorLayer';
import StairsLayer from './StairsLayer';
import PaperNoiseOverlay from './PaperNoiseOverlay';
import Minimap from './Minimap';
import MinimapErrorBoundary from './MinimapErrorBoundary';
import MeasurementOverlay from './MeasurementOverlay';
import { resolveTokenData } from '../../hooks/useTokenData';

import URLImage from './URLImage';

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

  // Get grid color from CSS variable (theme-aware)
  const [gridColor, setGridColor] = useState('#222');

  useEffect(() => {
    const updateGridColor = () => {
      const computedColor = getComputedStyle(document.documentElement).getPropertyValue('--app-border-default').trim();
      if (computedColor) {
        setGridColor(computedColor);
      }
    };

    // Initial color
    updateGridColor();

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateGridColor();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  // Atomic selectors to prevent infinite re-render loops and avoid useShallow crashes
  const map = useGameStore(s => s.map);
  const tokens = useGameStore(s => s.tokens);
  const tokenLibrary = useGameStore(useShallow(s => s.campaign.tokenLibrary));
  const drawings = useGameStore(s => s.drawings);
  const doors = useGameStore(s => s.doors);
  const stairs = useGameStore(s => s.stairs);
  const gridSize = useGameStore(s => s.gridSize);
  const gridType = useGameStore(s => s.gridType);
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
  const toggleDoor = useGameStore(s => s.toggleDoor);
  const setIsCalibrating = useGameStore(s => s.setIsCalibrating);
  const updateMapTransform = useGameStore(s => s.updateMapTransform);
  const updateDrawingTransform = useGameStore(s => s.updateDrawingTransform);
  const setActiveMeasurement = useGameStore(s => s.setActiveMeasurement);

  const isDrawing = useRef(false);
  const currentLine = useRef<Drawing | null>(null); // Temp line points
  const [tempLine, setTempLine] = useState<Drawing | null>(null);

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

  // Ghost / Duplication State
  const [itemsForDuplication, setItemsForDuplication] = useState<string[]>([]);
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Real-time Drag Tracking (for performance and multi-user sync)
  const dragPositionsRef = useRef<Map<string, { x: number, y: number }>>(new Map());
  const [draggingTokenIds, setDraggingTokenIds] = useState<Set<string>>(new Set());
  const dragBroadcastThrottleRef = useRef<Map<string, number>>(new Map());
  const dragStartOffsetsRef = useRef<Map<string, { x: number, y: number }>>(new Map()); // For multi-token drag
  const DRAG_BROADCAST_THROTTLE_MS = 16; // ~60fps

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

  // Touch/Pinch State
  const lastPinchDistance = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number, y: number } | null>(null);

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
    };

    const handleBlur = () => {
        setIsSpacePressed(false);
        setIsAltPressed(false);
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

  // Touch event handlers for pinch-to-zoom
  const handleTouchStart = (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length === 2) {
          e.evt.preventDefault();
          const touch1 = touches[0];
          const touch2 = touches[1];
          lastPinchDistance.current = calculatePinchDistance(touch1, touch2);
          lastPinchCenter.current = calculatePinchCenter(touch1, touch2);
      }
  };

  const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length === 2) {
          e.evt.preventDefault();

          if (lastPinchDistance.current && lastPinchCenter.current) {
              const touch1 = touches[0];
              const touch2 = touches[1];
              const distance = calculatePinchDistance(touch1, touch2);
              const center = calculatePinchCenter(touch1, touch2);

              // Prevent division by zero
              if (lastPinchDistance.current < MIN_PINCH_DISTANCE) return;

              // Convert viewport coordinates to canvas coordinates
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
          }
      }
  };

  const handleTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length < 2) {
          lastPinchDistance.current = null;
          lastPinchCenter.current = null;
      }
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
    const { x, y } = snapToGrid(worldX, worldY, gridSize);

    // Check for JSON (Library Item)
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

  // Token Mouse Handlers (Threshold-based Press-and-Hold)
  const handleTokenMouseDown = useCallback((e: KonvaEventObject<MouseEvent>, tokenId: string) => {
    if (tool !== 'select') return;

    // Record the initial pointer position and the token's starting stage position
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPos = stage.getRelativePointerPosition();
    if (!pointerPos) return;

    const token = resolvedTokens.find(t => t.id === tokenId);
    if (!token) return;

    e.evt.stopPropagation();

    // Store the initial mouse position and token position
    setTokenMouseDownStart({
      x: pointerPos.x,
      y: pointerPos.y,
      tokenId,
      stagePos: { x: token.x, y: token.y }
    });
    setIsDraggingWithThreshold(false);
  }, [tool, resolvedTokens]);

  const handleTokenMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!tokenMouseDownStart || tool !== 'select') return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPos = stage.getRelativePointerPosition();
    if (!pointerPos) return;

    // Calculate distance moved
    const dx = pointerPos.x - tokenMouseDownStart.x;
    const dy = pointerPos.y - tokenMouseDownStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If we've moved more than the threshold, start dragging
    if (!isDraggingWithThreshold && distance > DRAG_THRESHOLD) {
      setIsDraggingWithThreshold(true);

      const tokenId = tokenMouseDownStart.tokenId;
      const tokenIds = selectedIds.includes(tokenId) ? selectedIds : [tokenId];
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
            }
          }
        });
      }
    }
  }, [tokenMouseDownStart, isDraggingWithThreshold, tool, resolvedTokens, selectedIds, throttleDragBroadcast, isWorldView]);

  const handleTokenMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
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
        const snapped = snapToGrid(dragPos.x, dragPos.y, gridSize, width, height);

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
              const snappedPos = snapToGrid(newX, newY, gridSize, gridSize * t.scale, gridSize * t.scale);
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
  }, [tokenMouseDownStart, isDraggingWithThreshold, resolvedTokens, tokens, selectedIds, gridSize, isAltPressed, isWorldView, updateTokenPosition, addToken, throttleDragBroadcast]);

  // Drawing Handlers
  const handleMouseDown = (e: any) => {
    if (isSpacePressed) return; // Allow panning

    // DOOR TOOL - Do nothing on mouse down, wait for mouse up
    if (tool === 'door') {
      console.log('[CanvasManager] Door tool active - ignoring mouseDown');
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
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
        calibrationStart.current = { x: pos.x, y: pos.y };
        setCalibrationRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
        return;
    }

    // If measure tool, start measurement
    if (tool === 'measure') {
        if (isWorldView) return; // Block measurement creation in World View
        isMeasuring.current = true;
        const pos = e.target.getStage().getRelativePointerPosition();
        measurementStart.current = { x: pos.x, y: pos.y };
        return;
    }

    // If marker/eraser/wall, draw
    // BLOCKED in World View (players cannot draw)
    if (tool !== 'select') {
        if (isWorldView) return; // Block drawing tools in World View
        isDrawing.current = true;
        const pos = e.target.getStage().getRelativePointerPosition();

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
        };
        return;
    }

    // Select Tool Logic
    const clickedOnStage = e.target === e.target.getStage();
    const clickedOnMap = e.target.id() === 'map';

    if (clickedOnStage || clickedOnMap) {
        // Start Selection Rect
        const pos = e.target.getStage().getRelativePointerPosition();
        selectionStart.current = { x: pos.x, y: pos.y };
        setSelectionRect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            isVisible: true
        });
        // Clear selection if not modified? (e.g. shift click logic could be added)
        if (!e.evt.shiftKey) {
             setSelectedIds([]);
        }
    } else {
         // Clicked on item? Handled by onClick on item itself usually,
         // but if we are in select tool and dragging, we might want to start dragging that item.
         // Konva handles dragging automatically if draggable=true.
    }
  };

  const handleMouseMove = (e: any) => {
    if (isSpacePressed) return;

    // DOOR TOOL PREVIEW - Show preview while hovering
    if (tool === 'door' && !isWorldView) {
      const stage = e.target.getStage();
      const pos = stage.getRelativePointerPosition();

      // Snap to grid for preview
      const snapped = snapToGrid(pos.x, pos.y, gridSize);

      setDoorPreviewPos(snapped);
      return;
    } else {
      // Clear door preview when not using door tool
      setDoorPreviewPos(null);
    }

    // Handle token dragging with threshold
    if (tokenMouseDownStart) {
      handleTokenMouseMove(e);
      return;
    }

    // Handle measurement tool
    if (tool === 'measure' && isMeasuring.current && measurementStart.current) {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
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
        const stage = e.target.getStage();
        let point = stage.getRelativePointerPosition();
        const cur = currentLine.current;

        // Guard against null currentLine
        if (!cur) return;

        // Shift-key axis locking: Lock to horizontal or vertical
        if (e.evt.shiftKey && cur.points.length >= 2) {
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

        cur.points = cur.points.concat([point.x, point.y]);
        setTempLine({...cur});
        return;
    }

    // CALIBRATION LOGIC
    if (isCalibrating && calibrationStart.current) {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
        const x = Math.min(pos.x, calibrationStart.current.x);
        const y = Math.min(pos.y, calibrationStart.current.y);
        const width = Math.abs(pos.x - calibrationStart.current.x);
        const height = Math.abs(pos.y - calibrationStart.current.y);
        setCalibrationRect({ x, y, width, height });
        return;
    }

    // Selection Rect Update
    if (selectionStart.current) {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
        const x = Math.min(pos.x, selectionStart.current.x);
        const y = Math.min(pos.y, selectionStart.current.y);
        const width = Math.abs(pos.x - selectionStart.current.x);
        const height = Math.abs(pos.y - selectionStart.current.y);
        setSelectionRect({ x, y, width, height, isVisible: true });
    }
  };

  const handleMouseUp = (e: any) => {
    // DOOR TOOL LOGIC - Click to place
    // BLOCKED in World View (players cannot place doors)
    if (tool === 'door' && !isWorldView) {
      const clickedOnStage = e.target === e.target.getStage();
      const clickedOnMap = e.target.id() === 'map';

      if (clickedOnStage || clickedOnMap) {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();

        // Snap to grid
        const snapped = snapToGrid(pos.x, pos.y, gridSize);

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

    // Handle token mouse up (drag end or selection)
    if (tokenMouseDownStart) {
      handleTokenMouseUp(e);
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
         if (tempLine) {
             let processedLine: Drawing = { ...tempLine };

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
             setTempLine(null);
         }
         return;
    }

    // End Selection
    if (selectionRect.isVisible) {
        // Calculate Intersection
        const stage = e.target.getStage();
        const box = selectionRect;

        setSelectionRect({ ...selectionRect, isVisible: false });

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
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
        style={{ cursor: (isSpacePressed && isDragging) ? 'grabbing' : (isSpacePressed ? 'grab' : (tool === 'select' ? 'default' : 'crosshair')) }}
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

            {/* Paper Noise Texture Overlay - Adds subtle texture to map */}
            {map && (
                <PaperNoiseOverlay
                    x={map.x}
                    y={map.y}
                    width={map.width}
                    height={map.height}
                    scaleX={map.scale}
                    scaleY={map.scale}
                    opacity={0.15}
                />
            )}

            <GridOverlay visibleBounds={visibleBounds} gridSize={gridSize} type={gridType} stroke={gridColor} />
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

            {drawings.map((line) => (
                <Line
                    key={line.id}
                    id={line.id}
                    name="drawing"
                    points={line.points}
                    x={line.x || 0}
                    y={line.y || 0}
                    scaleX={line.scale || 1}
                    scaleY={line.scale || 1}
                    stroke={line.color}
                    strokeWidth={line.size}
                    tension={0.5}
                    lineCap="round"
                    dash={line.tool === 'wall' ? [10, 5] : undefined}
                    opacity={line.tool === 'wall' && isWorldView ? 0 : 1}
                    globalCompositeOperation={
                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                    draggable={tool === 'select' && line.tool !== 'wall'}
                    onClick={(e) => {
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
                    }}
                    onDragStart={() => {
                         if (selectedIds.includes(line.id)) {
                             setItemsForDuplication(selectedIds);
                         } else {
                             setItemsForDuplication([line.id]);
                         }
                     }}
                     onDragEnd={(e) => {
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
                     }}
                />
            ))}
             {/* Temp Line */}
            {tempLine && (
                <Line
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

        {/* Layer 3: Tokens, Doors & UI */}
        <Layer>
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

                return (
                <TokenErrorBoundary key={token.id} tokenId={token.id}>
                <URLImage
                    key={token.id}
                    name="token"
                    id={token.id}
                    src={token.src}
                    x={displayX}
                    y={displayY}
                    width={gridSize * token.scale}
                    height={gridSize * token.scale}
                    draggable={false}
                    opacity={isDragging ? 0.7 : undefined}
                    onSelect={(e) => handleTokenMouseDown(e, token.id)}
                    onDragStart={emptyDragHandler}
                    onDragMove={emptyDragHandler}
                    onDragEnd={emptyDragHandler}
                />
                </TokenErrorBoundary>
                );
            })}

            {/* Selection Rect */}
            {selectionRect.isVisible && (
                <Rect
                    x={selectionRect.x}
                    y={selectionRect.y}
                    width={selectionRect.width}
                    height={selectionRect.height}
                    fill="rgba(0, 161, 255, 0.3)"
                    stroke="#00a1ff"
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
            <MeasurementOverlay
                measurement={isWorldView ? dmMeasurement : activeMeasurement}
                gridSize={gridSize}
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
