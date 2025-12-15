import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { useRef, useEffect, useState } from 'react';
import useImage from 'use-image';
import { processImage } from '../../utils/AssetProcessor';
import { snapToGrid } from '../../utils/grid';
import { useGameStore } from '../../store/gameStore';
import GridOverlay from './GridOverlay';
import ImageCropper from '../ImageCropper';

/**
 * URLImage renders a draggable token image on the Konva canvas
 *
 * This is a specialized Konva Image component that handles the custom `media://`
 * protocol used by Electron to serve local file:// assets securely. React-Konva's
 * Image component requires native HTMLImageElement instances, which we obtain via
 * the `use-image` hook with protocol conversion.
 *
 * **Why protocol conversion is needed:**
 * - Electron's security model blocks direct file:// access from renderer
 * - Main process registers custom `media://` protocol (see electron/main.ts:94-97)
 * - Protocol handler translates media:// → file:// in privileged context
 * - This pattern prevents local file system exposure to web content
 *
 * **Draggable behavior:**
 * - Token images are draggable by default (enabled by `draggable` prop)
 * - Currently no drag constraints (can be dragged anywhere on canvas)
 * - Future: Implement grid snapping during drag (onDragEnd handler)
 * - Future: Implement collision detection (prevent overlapping tokens)
 *
 * @param src - Image URL (file:// for local assets, https:// for library tokens)
 * @param x - X position in pixels on the canvas
 * @param y - Y position in pixels on the canvas
 * @param width - Rendered width in pixels (usually gridSize * token.scale)
 * @param height - Rendered height in pixels (usually gridSize * token.scale)
 * @returns Konva Image component with draggable token
 *
 * @example
 * // Render a token at grid position (100, 100) with 1x1 cell size
 * <URLImage
 *   src="file:///Users/.../temp_assets/goblin.webp"
 *   x={100}
 *   y={100}
 *   width={50}  // gridSize * scale (50 * 1)
 *   height={50}
 * />
 */
const URLImage = ({ src, x, y, width, height }: any) => {
  // Convert file:// → media:// for Electron protocol handler
  const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;

  // Load image via hook (handles async loading, caching, errors)
  const [img] = useImage(safeSrc);

  return (
    <KonvaImage
      image={img}
      x={x}
      y={y}
      width={width}
      height={height}
      draggable  // Tokens can be moved by dragging
    />
  );
};

/**
 * Props for CanvasManager component
 *
 * @property tool - Currently active tool ('select', 'marker', or 'eraser')
 *                  - 'select': Pan canvas, drag tokens, no drawing
 *                  - 'marker': Draw red freehand strokes (5px)
 *                  - 'eraser': Erase drawings (20px, destination-out composite)
 */
interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser';
}

/**
 * CanvasManager is the core battlemap canvas component
 *
 * This is the largest and most complex component in Hyle. It orchestrates all
 * battlemap interactions including drag-and-drop uploads, token placement, drawing
 * tools, image cropping, and canvas rendering via Konva/React-Konva.
 *
 * **Key responsibilities:**
 * 1. **Drag-and-drop handling**: Accepts library tokens (JSON) and file uploads
 * 2. **Image cropping workflow**: Shows modal cropper for uploaded files
 * 3. **Drawing tool implementation**: Marker and eraser with mouse event handling
 * 4. **Canvas rendering**: Konva Stage/Layer with grid, tokens, and drawings
 * 5. **Responsive sizing**: Adjusts canvas to fill container on window resize
 *
 * **Drag-and-drop dual-path logic:**
 * ```
 * User drops something on canvas
 *   ↓
 * Check for JSON data (library token)
 *   → If found: Add token immediately (no cropping)
 *   → If not found: Check for file upload
 *     → If file: Show ImageCropper modal
 *       → On confirm: Process crop → Add token
 * ```
 *
 * **Drawing tool pattern:**
 * - MouseDown: Start drawing, create temp line with initial point
 * - MouseMove: Append points to temp line, update React state for preview
 * - MouseUp/MouseLeave: Commit temp line to store, clear temp state
 * - Performance: Temp line rendered locally, only committed on MouseUp to reduce IPC
 *
 * **Tool modes:**
 * - 'select': Stage is draggable (pan canvas), tokens are draggable, no drawing
 * - 'marker': Stage not draggable, draw red strokes (5px), source-over composite
 * - 'eraser': Stage not draggable, draw black strokes (20px), destination-out composite
 *
 * @param tool - Active tool mode from App.tsx toolbar state
 * @returns Full-screen canvas with interactive battlemap
 *
 * @example
 * // In App.tsx
 * const [tool, setTool] = useState<'select' | 'marker' | 'eraser'>('select');
 * <CanvasManager tool={tool} />
 */
const CanvasManager = ({ tool = 'select' }: CanvasManagerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const { tokens, drawings, gridSize, addToken, addDrawing } = useGameStore();

  // Drawing state (marker/eraser tools)
  const isDrawing = useRef(false);  // Tracks if mouse is currently pressed while drawing
  const currentLine = useRef<any>(null);  // Mutable ref for accumulating points (not reactive)
  const [tempLine, setTempLine] = useState<any>(null);  // Reactive state for rendering preview

  // Cropping state (file upload workflow)
  const [pendingCrop, setPendingCrop] = useState<{ src: string, x: number, y: number } | null>(null);

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

  /**
   * Allows drag-and-drop by preventing default browser behavior
   *
   * Required for HTML5 drag-and-drop API. Without this, the browser would
   * navigate to the dropped file instead of triggering our custom drop handler.
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  /**
   * Handles drop events for both library tokens and file uploads
   *
   * This function implements dual-path logic to handle two different drag sources:
   *
   * **Path 1: Library tokens (from Sidebar)**
   * - Checks for JSON data in dataTransfer (set by Sidebar.handleDragStart)
   * - If type='LIBRARY_TOKEN', adds token immediately (no cropping needed)
   * - Library tokens are pre-processed, so they go straight to canvas
   *
   * **Path 2: File uploads (from OS file browser)**
   * - Checks for file data in dataTransfer.files
   * - Creates Object URL for cropping UI (browser memory, not saved yet)
   * - Opens ImageCropper modal at drop position
   * - On crop confirm → processImage() → addToken()
   *
   * **Grid snapping:**
   * Both paths snap the drop position to the grid using snapToGrid(). This ensures
   * tokens always align to tactical grid cells (important for D&D 5-foot squares).
   *
   * @param e - React drag event with dataTransfer containing JSON or file data
   *
   * @example
   * // Library token drop (from Sidebar)
   * // dataTransfer.getData('application/json') returns:
   * // { "type": "LIBRARY_TOKEN", "src": "https://konvajs.org/assets/lion.png" }
   * // Result: Token added immediately at snapped grid position
   *
   * @example
   * // File upload drop (from OS file browser)
   * // dataTransfer.files[0] = File { name: "goblin.png", type: "image/png", ... }
   * // Result: ImageCropper modal opens → User crops → Token added
   */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();

    // Calculate drop position relative to canvas container
    const stageRect = containerRef.current?.getBoundingClientRect();
    if (!stageRect) return;
    const rawX = e.clientX - stageRect.left;
    const rawY = e.clientY - stageRect.top;

    // Snap to nearest grid intersection
    const { x, y } = snapToGrid(rawX, rawY, gridSize);

    // PATH 1: Check for JSON data (Library token from Sidebar)
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.type === 'LIBRARY_TOKEN') {
                // Add token immediately (no cropping for library items)
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

    // PATH 2: Check for file upload (from OS file browser)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Create temporary Object URL for cropping UI (browser memory only)
      const objectUrl = URL.createObjectURL(file);
      // Open cropper modal with drop position saved
      setPendingCrop({ src: objectUrl, x, y });
    }
  };

  /**
   * Processes cropped image and adds it as a token to the battlemap
   *
   * This is the callback handler for ImageCropper.onConfirm(). It receives the
   * cropped image as a WebP blob, processes it through the asset pipeline, and
   * adds the resulting token at the saved drop position.
   *
   * **Asset processing workflow:**
   * 1. Convert blob to File object (required by processImage API)
   * 2. Call processImage() to resize (max 512px) and save to temp storage
   * 3. processImage returns file:// URL pointing to saved WebP in userData/temp_assets/
   * 4. Add token to store with saved x/y position and file:// URL
   * 5. Close cropper modal (setPendingCrop(null))
   *
   * **Why process after cropping:**
   * User cropping isolates the subject (removes background), but the crop might
   * still be large (e.g., 2048px). processImage() ensures it's resized to 512px max
   * and stored in a consistent location with optimized WebP compression.
   *
   * @param blob - Cropped image blob from ImageCropper (WebP format, quality=1)
   *
   * @example
   * // ImageCropper calls this after user clicks "Crop & Import"
   * // blob = Blob { size: 45632, type: 'image/webp' }
   * // pendingCrop = { src: 'blob:...', x: 100, y: 150 }
   * // Result: Token added at (100, 150) with src='file:///...temp_assets/1234-token.webp'
   */
  const handleCropConfirm = async (blob: Blob) => {
    if (!pendingCrop) return;

    try {
        // Convert blob to File object (processImage expects File API)
        const file = new File([blob], "token.webp", { type: 'image/webp' });

        // Process: resize to max 512px, save to temp storage, return file:// URL
        // (Even though we cropped, we still need to resize and save to disk)
        const src = await processImage(file, 'TOKEN');

        // Add token at saved drop position
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
        // Close cropper modal (clears pendingCrop state)
        setPendingCrop(null);
    }
  };

  /**
   * Starts a new drawing stroke when mouse is pressed
   *
   * Initializes a new line drawing with the first point at the cursor position.
   * The line is stored in both a mutable ref (currentLine) for fast updates and
   * React state (tempLine) for rendering the preview stroke.
   *
   * **Tool-specific behavior:**
   * - 'marker': Red stroke, 5px width, source-over composite (draws on top)
   * - 'eraser': Black stroke, 20px width, destination-out composite (erases)
   * - 'select': Ignores mouse events (no drawing)
   *
   * **Performance pattern:**
   * We don't commit to store yet (that would trigger IPC on every mousedown).
   * Instead, we accumulate points locally and commit on MouseUp for efficiency.
   *
   * @param e - Konva mouse event with stage reference
   */
  const handleMouseDown = (e: any) => {
    if (tool === 'select') return;  // No drawing in select mode

    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();

    // Initialize new line with first point
    currentLine.current = {
        id: crypto.randomUUID(),
        tool: tool,
        points: [pos.x, pos.y],  // Flat array: [x1, y1, x2, y2, ...]
        color: tool === 'eraser' ? '#000000' : '#df4b26',  // Red marker, black eraser
        size: tool === 'eraser' ? 20 : 5,  // Thick eraser, thin marker
    };
  };

  /**
   * Appends points to the active drawing stroke as mouse moves
   *
   * Continuously extends the current line with new points while the mouse is
   * moving with the button pressed. Updates React state to trigger re-render
   * and show the stroke preview to the user.
   *
   * **Update pattern:**
   * - currentLine.current (ref) is mutated directly for performance
   * - setTempLine() creates new object to trigger React re-render
   * - This provides smooth preview without store commits on every move
   *
   * **Performance note:**
   * This fires many times per second while drawing. Committing to store here
   * would cause excessive IPC messages to World Window. Instead, we use local
   * state for preview and only commit the final stroke on MouseUp.
   *
   * @param e - Konva mouse event with pointer position
   */
  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || tool === 'select') return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const cur = currentLine.current;

    // Append new point to flat points array [x1, y1, x2, y2, ...]
    cur.points = cur.points.concat([point.x, point.y]);

    // Update React state to render preview (creates new object for re-render)
    setTempLine({...cur});
  };

  /**
   * Commits the completed drawing stroke to the store
   *
   * Finalizes the drawing when the mouse button is released or leaves the canvas.
   * Commits the accumulated stroke to the Zustand store, which triggers IPC sync
   * to the World Window and clears the temporary preview state.
   *
   * **Why commit on MouseUp:**
   * - Reduces IPC traffic (1 message per stroke instead of hundreds)
   * - Improves performance (no store updates during drawing)
   * - Still feels instant to user (preview via tempLine during draw)
   *
   * **Sync behavior:**
   * addDrawing() triggers Zustand subscription in SyncManager, which sends IPC
   * to main process, which broadcasts to World Window (see SyncManager.tsx:101-112).
   *
   * **Note:** Also called on MouseLeave to ensure strokes are committed even if
   * the user drags outside the canvas and releases there.
   */
  const handleMouseUp = () => {
    if (!isDrawing.current || tool === 'select') return;

    isDrawing.current = false;

    // Commit stroke to store (triggers IPC sync to World Window)
    if (tempLine) {
        addDrawing(tempLine);
        setTempLine(null);  // Clear preview
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
                <URLImage
                    key={token.id}
                    src={token.src}
                    x={token.x}
                    y={token.y}
                    width={gridSize * token.scale}
                    height={gridSize * token.scale}
                />
            ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasManager;
