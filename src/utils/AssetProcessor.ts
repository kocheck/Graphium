/**
 * Type of asset being processed - determines maximum dimensions
 *
 * - MAP: Background map images (max 4096px for 4K display support)
 * - TOKEN: Character/creature tokens (max 512px for performance)
 */
export type AssetType = 'MAP' | 'TOKEN';

/**
 * Maximum dimension for map images in pixels
 *
 * Set to 4096px to support 4K displays without quality loss while preventing
 * excessive memory usage. Maps larger than this are resized proportionally.
 */
const MAX_MAP_DIMENSION = 4096;

/**
 * Maximum dimension for token images in pixels
 *
 * Set to 512px as tokens are displayed at grid cell size (typically 50-100px).
 * This provides plenty of quality while keeping file sizes small and rendering fast.
 */
const MAX_TOKEN_DIMENSION = 512;

/**
 * Processes and optimizes uploaded images for use as maps or tokens
 *
 * This function is the core of Hyle's asset pipeline. It performs three critical
 * optimizations to ensure performance and reasonable file sizes:
 *
 * 1. **Resize**: Constrains images to maximum dimensions while preserving aspect ratio
 *    - Maps: 4096px max (4K display support)
 *    - Tokens: 512px max (sufficient quality for grid cells)
 *
 * 2. **Format conversion**: Converts all images to WebP format
 *    - 30-50% smaller than PNG/JPEG
 *    - Supports transparency (needed for tokens)
 *    - Quality set to 85% (balance between size and visual quality)
 *
 * 3. **Storage**: Saves to Electron's temp directory and returns file:// URL
 *    - Stored in app.getPath('userData')/temp_assets/
 *    - Filename format: {timestamp}-{originalName}.webp
 *
 * **Performance**: Uses OffscreenCanvas for faster processing (no DOM reflow).
 *
 * **Why this matters**: Without optimization, large images (8K maps, high-res photos)
 * would cause memory issues, slow rendering (< 60fps), and bloated campaign files.
 *
 * @param file - Uploaded image file (PNG, JPG, WebP, etc.)
 * @param type - Asset type determining max dimensions ('MAP' or 'TOKEN')
 * @returns Promise resolving to file:// URL of processed image in temp storage
 * @throws {Error} If OffscreenCanvas context cannot be created (rare browser issue)
 * @throws {Error} If IPC invoke 'SAVE_ASSET_TEMP' fails (Electron main process error)
 *
 * @example
 * // Process uploaded token image
 * const file = new File([blob], "goblin.png", { type: 'image/png' });
 * const src = await processImage(file, 'TOKEN');
 * // Returns: "file:///Users/.../Hyle/temp_assets/1234567890-goblin.webp"
 *
 * @example
 * // Process map image (larger max dimension)
 * const mapFile = new File([blob], "dungeon.jpg", { type: 'image/jpeg' });
 * const mapSrc = await processImage(mapFile, 'MAP');
 * // Image resized to max 4096px, converted to WebP
 */
export const processImage = async (file: File, type: AssetType): Promise<string> => {
  // 1. Create bitmap from file (efficient image decode)
  const bitmap = await createImageBitmap(file);
  const maxDim = type === 'MAP' ? MAX_MAP_DIMENSION : MAX_TOKEN_DIMENSION;

  let width = bitmap.width;
  let height = bitmap.height;

  // 2. Calculate new dimensions (preserve aspect ratio)
  if (width > maxDim || height > maxDim) {
    const ratio = width / height;
    if (width > height) {
      // Landscape: constrain width
      width = maxDim;
      height = Math.round(maxDim / ratio);
    } else {
      // Portrait or square: constrain height
      height = maxDim;
      width = Math.round(maxDim * ratio);
    }
  }

  // 3. Draw to OffscreenCanvas (faster than DOM canvas)
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get 2D context from OffscreenCanvas');
  }

  // Draw resized image to canvas
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Clean up bitmap (free memory)
  bitmap.close();

  // 4. Convert to WebP blob (85% quality = good balance)
  const blob = await canvas.convertToBlob({
    type: 'image/webp',
    quality: 0.85,
  });

  // 5. Send to main process for file storage
  const buffer = await blob.arrayBuffer();
  // @ts-ignore - IPC types not available, will be fixed with proper type declarations
  const filePath = await window.ipcRenderer.invoke('SAVE_ASSET_TEMP', buffer, file.name.replace(/\.[^/.]+$/, "") + ".webp");

  return filePath as string;
};
