import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

/**
 * Props for ImageCropper component
 *
 * @property imageSrc - Object URL (blob:...) for the uploaded image to crop
 * @property onConfirm - Callback with cropped image blob (WebP format, quality=1)
 * @property onCancel - Callback to close cropper without saving
 */
interface ImageCropperProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

/**
 * ImageCropper provides a modal UI for cropping uploaded token images
 *
 * This component wraps the react-easy-crop library to provide an intuitive
 * cropping interface for user-uploaded images. It's shown as a modal overlay
 * when users drag-and-drop image files onto the canvas (not for library tokens).
 *
 * **Workflow:**
 * 1. User drops image file on canvas
 * 2. CanvasManager creates Object URL and opens this modal
 * 3. User adjusts crop area and zoom (1x-3x)
 * 4. User clicks "Crop & Import"
 * 5. getCroppedImg() extracts cropped pixels to WebP blob
 * 6. onConfirm(blob) called → CanvasManager.handleCropConfirm()
 * 7. Modal closes, blob processed and saved as token
 *
 * **Aspect ratio:**
 * Fixed to 1:1 (square) because tokens are rendered in square grid cells.
 * This ensures tokens don't appear stretched when displayed on the battlemap.
 *
 * **Why WebP:**
 * - Smaller file size than PNG (30-50% reduction)
 * - Supports transparency (needed for tokens with no background)
 * - Native browser support (quality=1 preserves crop fidelity)
 *
 * **User interactions:**
 * - Drag to pan crop area
 * - Scroll/pinch to zoom (1x-3x range)
 * - Slider to adjust zoom precisely
 * - Cancel button closes without saving
 * - "Crop & Import" button confirms and processes crop
 *
 * @param imageSrc - Object URL from CanvasManager (created via URL.createObjectURL)
 * @param onConfirm - Called with cropped WebP blob when user clicks "Crop & Import"
 * @param onCancel - Called when user clicks "Cancel" or wants to abort crop
 * @returns Full-screen modal overlay with cropping interface
 *
 * @example
 * // In CanvasManager.handleDrop()
 * const objectUrl = URL.createObjectURL(file);
 * setPendingCrop({ src: objectUrl, x: 100, y: 150 });
 *
 * // Renders in CanvasManager JSX:
 * {pendingCrop && (
 *   <ImageCropper
 *     imageSrc={pendingCrop.src}
 *     onConfirm={handleCropConfirm}
 *     onCancel={() => setPendingCrop(null)}
 *   />
 * )}
 */
const ImageCropper = ({ imageSrc, onConfirm, onCancel }: ImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 }); // Crop area position
  const [zoom, setZoom] = useState(1); // Zoom level (1x-3x)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null); // Pixel coordinates for extraction

  /**
   * Callback fired when crop area changes
   *
   * react-easy-crop provides both normalized crop area (0-1 range) and pixel
   * coordinates. We save the pixel coordinates because getCroppedImg() needs
   * exact pixel positions for canvas.drawImage().
   *
   * @param _croppedArea - Normalized crop area (0-1 range, not used)
   * @param croppedAreaPixels - Pixel coordinates { x, y, width, height }
   */
  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  /**
   * Processes the crop and calls onConfirm with resulting blob
   *
   * Extracts the cropped region using canvas operations (see getCroppedImg()),
   * converts to WebP blob, and passes to parent's onConfirm callback.
   *
   * @example
   * // User clicks "Crop & Import"
   * // croppedAreaPixels = { x: 150, y: 200, width: 400, height: 400 }
   * // getCroppedImg() → WebP blob (45KB)
   * // onConfirm(blob) → CanvasManager.handleCropConfirm(blob)
   */
  const handleSave = async () => {
    try {
      if (!croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImage) {
        onConfirm(croppedImage);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-[90vw] h-[80vh] bg-neutral-800 rounded-lg overflow-hidden flex flex-col">
        <div className="relative flex-1 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            // Optional: user could toggle aspect ratio? Let's genericize for now or default square for tokens
            // Actually tokens are often freeform. Let's not enforce aspect if possible,
            // but react-easy-crop enforces a view aspect.
            // We can leave aspect undefined to allow free movement BUT it crops to the box.
            // Let's force 1:1 for Tokens usually, but maybe give option?
            // "User isnt required to upload an image with the correct aspect ratio" implies they want to fix it.
            // Let's stick to 1:1 for generic tokens for now as they snap to square grid.
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-4 flex justify-between items-center bg-neutral-900 border-t border-neutral-700">
          <div className="flex gap-4">
            <span className="text-white text-sm">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 hover:bg-neutral-700 rounded text-white font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold"
            >
              Crop & Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Extracts the cropped region from an image and returns it as a WebP blob
 *
 * This function performs the actual cropping operation using HTML5 Canvas API.
 * It loads the source image, creates a canvas sized to the crop area, draws the
 * cropped region, and converts it to a WebP blob for further processing.
 *
 * **Algorithm:**
 * 1. Load source image via createImage() helper
 * 2. Create canvas element with crop dimensions
 * 3. Use ctx.drawImage() with 9 params to extract crop region:
 *    - Source: pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height
 *    - Dest: 0, 0, pixelCrop.width, pixelCrop.height (top-left of canvas)
 * 4. Convert canvas to WebP blob (quality=1 for maximum fidelity)
 *
 * **Why canvas approach:**
 * - No external dependencies for image manipulation
 * - Efficient (uses GPU-accelerated rendering)
 * - Direct blob output (no intermediate files)
 * - Preserves transparency (needed for tokens)
 *
 * @param imageSrc - Object URL (blob:...) pointing to original uploaded image
 * @param pixelCrop - Crop region { x, y, width, height } in pixels
 * @returns Promise resolving to WebP blob of cropped image, or null on error
 *
 * @example
 * // User crops a 400x400 region from uploaded image
 * const blob = await getCroppedImg(
 *   'blob:http://localhost:5173/abc123',
 *   { x: 150, y: 200, width: 400, height: 400 }
 * );
 * // Returns: Blob { size: 45632, type: 'image/webp' }
 */
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob | null> {
  // Load source image (waits for async load)
  const image = await createImage(imageSrc);

  // Create canvas sized to crop area
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Extract cropped region from source image
  // drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
  // s = source (crop region from original), d = destination (canvas)
  ctx.drawImage(
    image,
    pixelCrop.x, // Source x
    pixelCrop.y, // Source y
    pixelCrop.width, // Source width
    pixelCrop.height, // Source height
    0, // Destination x (top-left of canvas)
    0, // Destination y (top-left of canvas)
    pixelCrop.width, // Destination width (no scaling)
    pixelCrop.height, // Destination height (no scaling)
  );

  // Convert canvas to WebP blob (quality=1 for maximum fidelity)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      'image/webp',
      1,
    );
  });
}

/**
 * Loads an image from a URL as a Promise
 *
 * Wraps the Image() constructor and load event in a Promise for async/await usage.
 * This is a common pattern for handling image loading in modern JavaScript.
 *
 * @param url - Image URL (Object URL from URL.createObjectURL or http:// URL)
 * @returns Promise resolving to loaded HTMLImageElement
 * @throws Rejects if image fails to load (network error, invalid format, etc.)
 *
 * @example
 * const img = await createImage('blob:http://localhost:5173/abc123');
 * // img is now ready to use with canvas.drawImage()
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

export default ImageCropper;
