import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { useRef, useEffect, useState } from 'react';
import useImage from 'use-image';
import Konva from 'konva';
import { processImage } from '../../utils/AssetProcessor';
import { snapToGrid } from '../../utils/grid';
import { useGameStore, Token } from '../../store/gameStore';
import GridOverlay from './GridOverlay';
import ImageCropper from '../ImageCropper';
import TokenErrorBoundary from './TokenErrorBoundary';

interface URLImageProps {
  token: Token;
  width: number;
  height: number;
  onDuplicate: (token: Token, newX: number, newY: number) => void;
  onMove: (id: string, newX: number, newY: number) => void;
}

const URLImage = ({ token, width, height, onDuplicate, onMove }: URLImageProps) => {
  const safeSrc = token.src.startsWith('file:') ? token.src.replace('file:', 'media:') : token.src;
  const [img] = useImage(safeSrc);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const originalPos = useRef({ x: 0, y: 0 });

  // Helper function to update cursor
  const setCursor = (stage: Konva.Stage | null | undefined, cursor: string) => {
    const container = stage?.container();
    if (container) {
      container.style.cursor = cursor;
    }
  };

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    try {
      originalPos.current = { x: token.x, y: token.y };
      const altPressed = e.evt.altKey;
      setIsDuplicateMode(altPressed);
      
      // Update cursor
      if (altPressed) {
        setCursor(e.target.getStage(), 'copy');
      }
    } catch (error) {
      console.error('Error in handleDragStart:', error);
      // Reset state on error
      setIsDuplicateMode(false);
      setCursor(e.target.getStage(), 'default');
    }
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    try {
      const altPressed = e.evt.altKey;
      const wasDuplicateMode = isDuplicateMode;
      
      if (altPressed !== wasDuplicateMode) {
        setIsDuplicateMode(altPressed);
        
        // Update cursor
        setCursor(e.target.getStage(), altPressed ? 'copy' : 'grabbing');

        // If switching to duplicate mode, reset position to original
        if (altPressed) {
          e.target.position({
            x: originalPos.current.x,
            y: originalPos.current.y,
          });
        }
      }
    } catch (error) {
      console.error('Error in handleDragMove:', error);
      // Reset state on error
      setIsDuplicateMode(false);
      setCursor(e.target.getStage(), 'default');
    }
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    try {
      const newPos = e.target.position();
      const altPressed = e.evt.altKey;

      // Reset cursor
      setCursor(e.target.getStage(), 'default');

      if (altPressed) {
        // Duplicate mode - create new token at new position
        onDuplicate(token, newPos.x, newPos.y);
        // Reset dragged token to original position
        e.target.position({
          x: originalPos.current.x,
          y: originalPos.current.y,
        });
      } else {
        // Move mode - update token position
        onMove(token.id, newPos.x, newPos.y);
      }
      
      setIsDuplicateMode(false);
    } catch (error) {
      console.error('Error in handleDragEnd:', error);
      // Reset cursor on error
      setCursor(e.target.getStage(), 'default');
      setIsDuplicateMode(false);
    }
  };

  return (
    <KonvaImage
      image={img}
      x={token.x}
      y={token.y}
      width={width}
      height={height}
      draggable
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    />
  );
};

interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser';
}

const CanvasManager = ({ tool = 'select' }: CanvasManagerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const { tokens, drawings, gridSize, addToken, addDrawing, updateTokenPosition } = useGameStore();

  const isDrawing = useRef(false);
  const currentLine = useRef<any>(null); // Temp line points
  const [tempLine, setTempLine] = useState<any>(null);

  // Cropping State
  const [pendingCrop, setPendingCrop] = useState<{ src: string, x: number, y: number } | null>(null);

  // Handler for duplicating a token
  const handleTokenDuplicate = (originalToken: Token, newX: number, newY: number) => {
    try {
      const newToken: Token = {
        ...originalToken,
        id: crypto.randomUUID(),
        x: newX,
        y: newY,
      };
      addToken(newToken);
    } catch (error) {
      console.error('Error duplicating token:', error);
    }
  };

  // Handler for moving a token
  const handleTokenMove = (id: string, newX: number, newY: number) => {
    try {
      updateTokenPosition(id, newX, newY);
    } catch (error) {
      console.error('Error moving token:', error);
    }
  };

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
    if (tool === 'select') return;
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    currentLine.current = {
        id: crypto.randomUUID(),
        tool: tool,
        points: [pos.x, pos.y],
        color: tool === 'eraser' ? '#000000' : '#df4b26', // Eraser is just black for now, or globalCompositeOperation
        size: tool === 'eraser' ? 20 : 5,
    };
    // We could optimistically add to store or use local state
    // For syncing to appear "instant" we should add to store immediately?
    // But updating store on every move is heavy.
    // Better: Render currentLine locally, then commit to store on MouseUp.
    // For sync requirement: "Drawings must be synchronized to the Player View instantly".
    // "Instantly" might imply while drawing.
    // Let's commit on MouseUp for performance, or throttle updates.
    // For MVP, commit on MouseUp is safer.
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || tool === 'select') return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const cur = currentLine.current;

    // update local ref points
    cur.points = cur.points.concat([point.x, point.y]);

    // Force update? No, we need react state to re-render the temp line.
    // Actually, let's just use local state for the active line.
    setTempLine({...cur});
  };

  const handleMouseUp = () => {
    if (!isDrawing.current || tool === 'select') return;
    isDrawing.current = false;
    if (tempLine) {
        addDrawing(tempLine);
        setTempLine(null);
    }
  };

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
        draggable={tool === 'select'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Layer>
            <GridOverlay width={size.width} height={size.height} gridSize={gridSize} />

            {/* Drawings */}
            {drawings.map((line) => (
                <Line
                    key={line.id}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.size}
                    tension={0.5}
                    lineCap="round"
                    globalCompositeOperation={
                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
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

            {/* Tokens */}
            {tokens.map((token) => (
                <TokenErrorBoundary key={token.id} tokenId={token.id}>
                    <URLImage
                        token={token}
                        width={gridSize * token.scale}
                        height={gridSize * token.scale}
                        onDuplicate={handleTokenDuplicate}
                        onMove={handleTokenMove}
                    />
                </TokenErrorBoundary>
            ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasManager;
