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
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  onSelect: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (x: number, y: number) => void;
}

const URLImage = ({ src, x, y, width, height, id, onSelect, onDragEnd }: URLImageProps) => {
  const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;
  const [img] = useImage(safeSrc);

  return (
    <KonvaImage
      name="token"
      id={id}
      image={img}
      x={x}
      y={y}
      width={width}
      height={height}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onDragEnd(e.target.x(), e.target.y());
      }}
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
  const { tokens, drawings, gridSize, addToken, addDrawing, updateTokenPosition, updateTokenTransform } = useGameStore();

  const isDrawing = useRef(false);
  const currentLine = useRef<any>(null); // Temp line points
  const [tempLine, setTempLine] = useState<any>(null);

  // Cropping State
  const [pendingCrop, setPendingCrop] = useState<{ src: string, x: number, y: number } | null>(null);

  // Selection State
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number, isVisible: boolean }>({ x: 0, y: 0, width: 0, height: 0, isVisible: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const transformerRef = useRef<any>(null);
  const selectionStart = useRef<{x: number, y: number} | null>(null);

  // Navigation State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Touch/Pinch State
  const lastPinchDistance = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number, y: number } | null>(null);

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

      setScale(constrainedScale);
      setPosition(newPos);
  }, []);

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
          const newPos = {
              x: stage.x() - e.evt.deltaX,
              y: stage.y() - e.evt.deltaY,
          };
          setPosition(newPos);
      }
  };

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
    const rawX = e.clientX - stageRect.left;
    const rawY = e.clientY - stageRect.top;
    const { x, y } = snapToGrid(rawX, rawY, gridSize);

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
        // Convert blob to file-like object or modify ProcessImage to accept Blob
        const file = new File([blob], "token.webp", { type: 'image/webp' });

        // We can reuse processImage but it expects resizing logic.
        // Since we already cropped and likely want to keep that quality or just format it,
        // Let's modify processImage to just save if it's already a blob?
        // Or just let processImage handle the standardized resizing (max 512px) + saving.
        // Yes, let processImage optimize it for storage.
        const src = await processImage(file, 'TOKEN');

        addToken({
          id: crypto.randomUUID(),
          x: pendingCrop.x,
          y: pendingCrop.y,
          src,
          scale: 1,
        });
    } catch (err) {
        console.error("Crop save failed", err);
    } finally {
        setPendingCrop(null);
    }
  };

  // Drawing Handlers
  const handleMouseDown = (e: any) => {
    if (isSpacePressed) return; // Allow panning

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
    if (clickedOnStage) {
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

    // Selection Rect Update
    if (selectionRect.isVisible && selectionStart.current) {
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

        // Find all shapes that intersect with selection rect
        const shapes = stage.find('.token, .drawing');
        const selected = shapes.filter((shape: any) =>
            shape.id() && Konva.Util.haveIntersection(box, shape.getClientRect())
        );
        setSelectedIds(selected.map((n: any) => n.id()));
        selectionStart.current = null;
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
  }, [selectedIds, tokens, drawings]); // Update when selection or items change

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
        onDragEnd={(e) => {
            if (e.target === e.target.getStage()) {
                setPosition({ x: e.target.x(), y: e.target.y() });
            }
        }}
        style={{ cursor: isSpacePressed ? 'grab' : (tool === 'select' ? 'default' : 'crosshair') }}
      >
        <Layer>
            <GridOverlay width={size.width} height={size.height} gridSize={gridSize} />

            {/* Drawings */}
            {drawings.map((line) => (
                <Line
                    key={line.id}
                    id={line.id}
                    name="drawing" // name for selection
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.size}
                    tension={0.5}
                    lineCap="round"
                    globalCompositeOperation={
                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                    onClick={(e) => {
                        if (tool === 'select') {
                            if (e.evt.shiftKey) {
                                if (!selectedIds.includes(line.id)) {
                                    setSelectedIds([...selectedIds, line.id]);
                                }
                            } else {
                                setSelectedIds([line.id]);
                            }
                        }
                    }}
                />
            ))}

            {/* Tokens */}
            {tokens.map((token) => (
                <URLImage
                    key={token.id}
                    id={token.id}
                    src={token.src}
                    x={token.x}
                    y={token.y}
                    width={gridSize * token.scale}
                    height={gridSize * token.scale}
                    onSelect={(e) => {
                         if (tool === 'select') {
                             if (e.evt.shiftKey) {
                                 if (!selectedIds.includes(token.id)) {
                                     setSelectedIds([...selectedIds, token.id]);
                                 }
                             } else {
                                 setSelectedIds([token.id]);
                             }
                         }
                    }}
                    onDragEnd={(x, y) => {
                        updateTokenPosition(token.id, x, y);
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

            {/* Transformer */}
            <Transformer
                ref={transformerRef}
                boundBoxFunc={(_oldBox, newBox) => {
                    return newBox;
                }}
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
                    }
                }}
            />
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasManager;
