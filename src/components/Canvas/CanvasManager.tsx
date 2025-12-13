import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Transformer } from 'react-konva';
import { useRef, useEffect, useState } from 'react';
import useImage from 'use-image';
import { processImage } from '../../utils/AssetProcessor';
import { snapToGrid } from '../../utils/grid';
import { useGameStore } from '../../store/gameStore';
import GridOverlay from './GridOverlay';
import ImageCropper from '../ImageCropper';

const URLImage = ({ src, x, y, width, height, id, isSelected, onSelect }: any) => {
  const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;
  const [img] = useImage(safeSrc);
  const shapeRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && shapeRef.current) {
        // manually attach transformer? No, simpler to rely on name lookup in parent
    }
  }, [isSelected]);

  return (
    <KonvaImage
      ref={shapeRef}
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
  const { tokens, drawings, gridSize, addToken, addDrawing } = useGameStore();

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.repeat) {
            setIsSpacePressed(true);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            setIsSpacePressed(false);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWheel = (e: any) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      // Zoom
      if (e.evt.ctrlKey || e.evt.metaKey) {
          const scaleBy = 1.1;
          const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

          const mousePointTo = {
              x: (pointer.x - stage.x()) / oldScale,
              y: (pointer.y - stage.y()) / oldScale,
          };

          const newPos = {
              x: pointer.x - mousePointTo.x * newScale,
              y: pointer.y - mousePointTo.y * newScale,
          };

          setScale(newScale);
          setPosition(newPos);
      } else {
          // Pan
          const newPos = {
              x: stage.x() - e.evt.deltaX,
              y: stage.y() - e.evt.deltaY,
          };
          setPosition(newPos);
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
        const newSelectedIds: string[] = [];

        // Check tokens
        stage.find('.token').forEach((node: any) => {
            // simple bounding box intersection? or center point?
            // node.getClientRect() is relative to stage if not passed attrs
            // Let's use simple logic: if node center is inside box
            // node.getClientRect() is relative to stage if not passed attrs
            // Better: use Konva's HaveIntersection logic or checking overlap
            // For simplicity, check if node x,y is within box
            if (Konva.Util.haveIntersection(box, node.getClientRect())) {
                 newSelectedIds.push(node.id());
            }
        });
        // Check drawings? (Assuming drawings are named with 'drawing')
        // We need to name lines too.

        setSelectionRect({ ...selectionRect, isVisible: false });
        // NOTE: Actually implement intersection properly below in effect or here
        // Using Transformer 'nodes' prop is easiest if we have IDs

        // Find all shapes that intersect with selection rect
        const shapes = stage.find('.token, .drawing');
        const selected = shapes.filter((shape: any) =>
            Konva.Util.haveIntersection(box, shape.getClientRect())
        );
        setSelectedIds(selected.map((n: any) => n.id()));
        selectionStart.current = null;
    }
  };

  // Update Transformer nodes
  useEffect(() => {
    if (transformerRef.current && containerRef.current) {
        // We need direct access to stage to find nodes, but refs inside loop are tricky.
        // Assuming we render Transformer *after* nodes, it can find them?
        // Actually, we can use userGameStore or just query selector since `Stage` is available via ref or context?
        // Best approach in React-Konva: get the stage instance or use document logic if desperate,
        // but here we are inside the component.
        // We can't easily query stage inside render side-effect without ref to stage.
        // Let's use `onTransformEnd` or similar to update store.

        // Wait, React-Konva Transformer accepts `nodes` prop.
        // We need the actual Konva Nodes.
        const stage = transformerRef.current.getStage();
        if(stage) {
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
                    name="drawing" // ID for selection
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.size}
                    tension={0.5}
                    lineCap="round"
                    globalCompositeOperation={
                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                    draggable={tool === 'select'}
                    onClick={() => {
                        if (tool === 'select') setSelectedIds([line.id]);
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
                    isSelected={selectedIds.includes(token.id)}
                    onSelect={() => {
                         if (tool === 'select') setSelectedIds([token.id]);
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
                    // Start simple
                    return newBox;
                }}
            />
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasManager;
