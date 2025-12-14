import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Transformer } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useRef, useEffect, useState, useCallback } from 'react';
import useImage from 'use-image';
import { processImage } from '../../utils/AssetProcessor';
import { snapToGrid } from '../../utils/grid';
import { useGameStore } from '../../store/gameStore';
import GridOverlay from './GridOverlay';
import ImageCropper from '../ImageCropper';

// Zoom constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SCALE_BY = 1.1;
const MIN_PINCH_DISTANCE = 0.001; // Guard against division by zero
const VIEWPORT_CLAMP_PADDING = 1000; // Padding around map bounds for viewport constraints

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

interface URLImageProps {
  name?: string;
  src: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  id: string;
  onSelect?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragStart?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
  draggable: boolean;
  opacity?: number;
  listening?: boolean;
}

const URLImage = ({ src, x, y, width, height, scaleX, scaleY, id, onSelect, onDragEnd, onDragStart, draggable, name, opacity, listening }: URLImageProps) => {
  const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;
  const [img, status] = useImage(safeSrc);

  useEffect(() => {
  }, [id, status]);

  return (
    <KonvaImage
      name={name} // Use passed name, usually 'token' or 'map-image'
      id={id} // Ensure ID is passed down!
      image={img}
      x={x}
      y={y}
      width={width}
      height={height}
      scaleX={scaleX}
      scaleY={scaleY}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      opacity={opacity}
      listening={listening}
    />
  );
};


interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser';
  color?: string;
}

const CanvasManager = ({ tool = 'select', color = '#df4b26' }: CanvasManagerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Atomic selectors to prevent infinite re-render loops and avoid useShallow crashes
  const map = useGameStore(s => s.map);
  const tokens = useGameStore(s => s.tokens);
  const drawings = useGameStore(s => s.drawings);
  const gridSize = useGameStore(s => s.gridSize);
  const gridType = useGameStore(s => s.gridType);
  const isCalibrating = useGameStore(s => s.isCalibrating);

  // Actions - these are stable
  const addToken = useGameStore(s => s.addToken);
  const addDrawing = useGameStore(s => s.addDrawing);
  const updateTokenPosition = useGameStore(s => s.updateTokenPosition);
  const updateTokenTransform = useGameStore(s => s.updateTokenTransform);
  const removeTokens = useGameStore(s => s.removeTokens);
  const removeDrawings = useGameStore(s => s.removeDrawings);
  const setIsCalibrating = useGameStore(s => s.setIsCalibrating);
  const updateMapScale = useGameStore(s => s.updateMapScale);
  const updateMapPosition = useGameStore(s => s.updateMapPosition);
  const updateDrawingTransform = useGameStore(s => s.updateDrawingTransform);

  const isDrawing = useRef(false);
  const currentLine = useRef<any>(null); // Temp line points
  const [tempLine, setTempLine] = useState<any>(null);

  // Calibration State
  const calibrationStart = useRef<{x: number, y: number} | null>(null);
  const [calibrationRect, setCalibrationRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  // Cropping State
  const [pendingCrop, setPendingCrop] = useState<{ src: string, x: number, y: number } | null>(null);

  // Selection & Drag State
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number, isVisible: boolean }>({ x: 0, y: 0, width: 0, height: 0, isVisible: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const transformerRef = useRef<any>(null);
  const selectionStart = useRef<{x: number, y: number} | null>(null);

  // Ghost / Duplication State
  const [draggedItemIds, setDraggedItemIds] = useState<string[]>([]);
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Navigation State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Touch/Pinch State
  const lastPinchDistance = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number, y: number } | null>(null);

    // Handle Delete/Backspace & Alt Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track Alt Key
      if (e.key === 'Alt') {
          setIsAltPressed(true);
      }

      // Ignore if typing in an input
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedIds.length > 0) {
              removeTokens(selectedIds);
              removeDrawings(selectedIds);
              setSelectedIds([]); // Clear selection
          }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Alt') {
            setIsAltPressed(false);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, removeTokens, removeDrawings]);

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

  // Helper function to clamp viewport position within bounds
  const clampPosition = useCallback((newPos: { x: number, y: number }, newScale: number) => {
      // If no map, allow free movement? Or constrain to some large box?
      // Let's constrain to a 10000x10000 box if no map.
      // If map exists, constrain so at least a bit of the map is visible?
      // Or constrain so the center of the view cannot go too far from map?

      const bounds = map ? {
          minX: map.x,
          maxX: map.x + (map.width * map.scale),
          minY: map.y,
          maxY: map.y + (map.height * map.scale)
      } : { minX: -5000, maxX: 5000, minY: -5000, maxY: 5000 };
      // We are constraining the POSITION of the stage (which acts as the camera offset).
      // Stage X moves content right. Positive Stage X = Content Shift Right.
      // Viewport X = -StageX / Scale.
      // We want Clamp(ViewportX, BoundsMin - Buffer, BoundsMax + Buffer).

      // Let's constrain the center of the viewport.
      // Viewport Center X = (-newPos.x + size.width/2) / newScale
      // We want ViewportCenter to be within MapBounds (expanded).

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
  }, [map, size.width, size.height]);

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

  // Auto-center on map load
  const lastMapSrc = useRef<string | null>(null);
  useEffect(() => {
      if (map && map.src !== lastMapSrc.current) {
          lastMapSrc.current = map.src;
          const mapCenterX = map.x + (map.width * map.scale) / 2;
          const mapCenterY = map.y + (map.height * map.scale) / 2;
          const newX = (size.width / 2) - (mapCenterX * scale);
          const newY = (size.height / 2) - (mapCenterY * scale);
          setPosition({ x: newX, y: newY });
      } else if (!map) {
          lastMapSrc.current = null;
      }
  }, [map, size.width, size.height]); // Exclude scale to avoid re-centering on zoom

  // Keyboard zoom (centered on viewport)
  const handleKeyboardZoom = useCallback((zoomIn: boolean) => {
      if (!containerRef.current) return;

      const centerX = size.width / 2;
      const centerY = size.height / 2;
      const newScale = zoomIn ? scale * ZOOM_SCALE_BY : scale / ZOOM_SCALE_BY;

      performZoom(newScale, centerX, centerY, scale, position);
  }, [scale, position, size.width, size.height, performZoom]);

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
        if (isEditableElement(e.target)) return;

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
        if (isEditableElement(e.target)) return;
        if (e.code === 'Space') {
            setIsSpacePressed(false);
        }
    };
    const handleBlur = () => {
        setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyboardZoom]);

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
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
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
                addToken({
                    id: crypto.randomUUID(),
                    x,
                    y,
                    src: data.src,
                    scale: 1,
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

    try {
        const file = new File([blob], "token.webp", { type: 'image/webp' });

        // If Shift is held during drop (simulated here by checking state or just assumption),
        // we could process as MAP. But determining "Shift was held" during async drop/crop is hard.
        // For now, we assume TOKEN from crop.

        const src = await processImage(file, 'TOKEN'); // Default to Token for now

        addToken({
          id: crypto.randomUUID(),
          x: pendingCrop.x,
          y: pendingCrop.y,
          src,
          scale: 1,
        });

        // TODO: In future, add UI to swap to Map or set 'processImage' type based on user choice
    } catch (err) {
        console.error("Crop save failed", err);
    } finally {
        setPendingCrop(null);
    }
  };

  // Drawing Handlers
  const handleMouseDown = (e: any) => {
    if (isSpacePressed) return; // Allow panning

    // CALIBRATION LOGIC
    if (isCalibrating) {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
        calibrationStart.current = { x: pos.x, y: pos.y };
        setCalibrationRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
        return;
    }

    // If marker/eraser, draw
    if (tool !== 'select') {
        isDrawing.current = true;
        const pos = e.target.getStage().getRelativePointerPosition();
        currentLine.current = {
            id: crypto.randomUUID(),
            tool: tool,
            points: [pos.x, pos.y],
            color: tool === 'eraser' ? '#000000' : color,
            size: tool === 'eraser' ? 20 : 5,
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

    if (tool !== 'select') {
        if (!isDrawing.current) return;
        const stage = e.target.getStage();
        const point = stage.getRelativePointerPosition();
        const cur = currentLine.current;
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
    // CALIBRATION LOGIC
    if (isCalibrating && calibrationStart.current && calibrationRect) {
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

             updateMapScale(newScale);
             updateMapPosition(map.x + mapAdjustmentX, map.y + mapAdjustmentY);
         }

         setCalibrationRect(null);
         calibrationStart.current = null;
         setIsCalibrating(false);
         return;
    }

    if (tool !== 'select') {
         if (!isDrawing.current) return;
         isDrawing.current = false;
         if (tempLine) {
             addDrawing(tempLine);
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
  // The Stage is transformed by scale and position (-x, -y).
  // Visible region top-left: -position.x / scale, -position.y / scale
  // Visible region dimensions: size.width / scale, size.height / scale
  const visibleBounds = {
      x: -position.x / scale,
      y: -position.y / scale,
      width: size.width / scale,
      height: size.height / scale
  };

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

  return (
    <div
        ref={containerRef}
        className="w-full h-full bg-neutral-900 overflow-hidden relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      {pendingCrop && (
        <ImageCropper
            imageSrc={pendingCrop.src}
            onConfirm={handleCropConfirm}
            onCancel={() => setPendingCrop(null)}
        />
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
                    scaleX={map.scale}
                    scaleY={map.scale}
                    draggable={false}
                    onSelect={() => {}}
                    onDragEnd={() => {}}
                />
            )}
            <GridOverlay visibleBounds={visibleBounds} gridSize={gridSize} type={gridType} />
        </Layer>

        {/* Layer 2: Drawings (Separate layer so Eraser doesn't erase map) */}
        <Layer>
            {isAltPressed && drawings.filter(d => draggedItemIds.includes(d.id)).map(ghostLine => (
                <Line
                    key={`ghost-${ghostLine.id}`}
                    id={`ghost-${ghostLine.id}`}
                    name="ghost-drawing"
                    points={ghostLine.points}
                    stroke={ghostLine.color}
                    strokeWidth={ghostLine.size}
                    tension={0.5}
                    lineCap="round"
                    opacity={0.5}
                    listening={false}
                />
            ))}

            {drawings.map((line) => (
                <Line
                    key={line.id}
                    id={line.id}
                    name="drawing"
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.size}
                    tension={0.5}
                    lineCap="round"
                    globalCompositeOperation={
                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                    draggable={tool === 'select'}
                    onClick={(e) => {
                        if (tool === 'select') {
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
                             setDraggedItemIds(selectedIds);
                         } else {
                             setDraggedItemIds([line.id]);
                         }
                     }}
                     onDragEnd={(e) => {
                         const node = e.target;
                         const x = node.x();
                         const y = node.y();

                         // Duplication Logic (Option/Alt + Drag)
                         if (e.evt.altKey) {
                             const idsToDuplicate = selectedIds.includes(line.id) ? selectedIds : [line.id];
                             idsToDuplicate.forEach(id => {
                                 // Only duplicate drawings here; tokens are handled in their own handler.
                                 const drawing = drawings.find(d => d.id === id);
                                 if (drawing) {
                                     addDrawing({ ...drawing, id: crypto.randomUUID() });
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

                         setDraggedItemIds([]);
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
                    globalCompositeOperation={
                        tempLine.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                />
            )}
        </Layer>

        {/* Layer 3: Tokens & UI */}
        <Layer>
            {isAltPressed && tokens.filter(t => draggedItemIds.includes(t.id)).map(ghostToken => (
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

            {tokens.map((token) => (
                <URLImage
                    key={token.id}
                    name="token"
                    id={token.id}
                    src={token.src}
                    x={token.x}
                    y={token.y}
                    width={gridSize * token.scale}
                    height={gridSize * token.scale}
                    draggable={tool === 'select'}
                    onSelect={(e) => {
                         if (tool === 'select') {
                             if (e.evt.shiftKey) {
                                 if (selectedIds.includes(token.id)) {
                                     setSelectedIds(selectedIds.filter(id => id !== token.id));
                                 } else {
                                     setSelectedIds([...selectedIds, token.id]);
                                 }
                             } else {
                                 setSelectedIds([token.id]);
                             }
                         }
                    }}
                     onDragStart={() => {
                         if (selectedIds.includes(token.id)) {
                             setDraggedItemIds(selectedIds);
                         } else {
                             setDraggedItemIds([token.id]);
                         }
                     }}
                     onDragEnd={(e) => {
                         const x = e.target.x();
                         const y = e.target.y();
                         const width = gridSize * token.scale;
                         const height = gridSize * token.scale;
                         const snapped = snapToGrid(x, y, gridSize, width, height);

                         // Duplication Logic (Option/Alt + Drag)
                         if (e.evt.altKey) {
                             const idsToDuplicate = selectedIds.includes(token.id) ? selectedIds : [token.id];
                             idsToDuplicate.forEach(id => {
                                 // Only duplicate tokens here; drawings are handled in their own handler.
                                 const t = tokens.find(tk => tk.id === id);
                                 if (t) {
                                     addToken({ ...t, id: crypto.randomUUID() });
                                 }
                             });
                         }

                         updateTokenPosition(token.id, snapped.x, snapped.y);
                         setDraggedItemIds([]);
                     }}
                />
            ))}

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
                        const token = tokens.find(t => t.id === node.id());
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
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasManager;
