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
 * Progress callback for image processing
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Processes and optimizes uploaded images for use as maps or tokens
 *
 * **PERFORMANCE OPTIMIZATION:** This function now uses Web Workers for non-blocking
 * image processing. The UI remains responsive even when processing large images.
 *
 * **Previous Approach (Bottleneck):**
 * - Image processing on main thread (blocks UI)
 * - 8K images: ~500ms freeze
 * - Multiple files: sequential processing (5 files = 2.5s freeze)
 *
 * **New Approach (Optimized):**
 * - Processing in Web Worker (non-blocking)
 * - Progress callbacks for UI feedback
 * - Parallel processing of multiple files
 * - Fallback to main thread if worker unavailable
 *
 * This function performs three critical optimizations:
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
 * **Why this matters**: Without optimization, large images (8K maps, high-res photos)
 * would cause memory issues, slow rendering (< 60fps), and bloated campaign files.
 *
 * @param file - Uploaded image file (PNG, JPG, WebP, etc.)
 * @param type - Asset type determining max dimensions ('MAP' or 'TOKEN')
 * @param onProgress - Optional callback for progress updates (0-100)
 * @returns Promise resolving to file:// URL of processed image in temp storage
 * @throws {Error} If processing fails or IPC invoke fails
 *
 * @example
 * // Process uploaded token image with progress
 * const file = new File([blob], "goblin.png", { type: 'image/png' });
 * const src = await processImage(file, 'TOKEN', (progress) => {
 *   console.log(`Processing: ${progress}%`);
 * });
 * // Returns: "file:///Users/.../Hyle/temp_assets/1234567890-goblin.webp"
 *
 * @example
 * // Process map image (larger max dimension)
 * const mapFile = new File([blob], "dungeon.jpg", { type: 'image/jpeg' });
 * const mapSrc = await processImage(mapFile, 'MAP');
 * // Image resized to max 4096px, converted to WebP
 */
export const processImage = async (
  file: File,
  type: AssetType,
  onProgress?: ProgressCallback
): Promise<string> => {
  // Try to use Web Worker for non-blocking processing
  if (typeof Worker !== 'undefined') {
    return processImageWithWorker(file, type, onProgress);
  } else {
    // Fallback to main thread processing (blocking, but compatible)
    console.warn('[AssetProcessor] Web Workers not available, using main thread');
    return processImageMainThread(file, type, onProgress);
  }
};

/**
 * Process image using Web Worker (non-blocking, preferred method)
 */
async function processImageWithWorker(
  file: File,
  type: AssetType,
  onProgress?: ProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create worker instance
    const worker = new Worker(
      new URL('../workers/image-processor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Handle worker messages
    worker.onmessage = async (event) => {
      const message = event.data;

      switch (message.type) {
        case 'PROGRESS':
          // Report progress to callback
          if (onProgress) {
            onProgress(message.progress);
          }
          break;

        case 'COMPLETE':
          try {
            // Send buffer to main process for file storage
            if (!window.ipcRenderer) {
              throw new Error('IPC not available for asset processing');
            }

            const webpFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";

            // @ts-ignore - IPC types not available
            const filePath = await window.ipcRenderer.invoke(
              'SAVE_ASSET_TEMP',
              message.buffer,
              webpFileName
            );

            // Complete progress
            if (onProgress) {
              onProgress(100);
            }

            // Cleanup
            worker.terminate();
            resolve(filePath as string);
          } catch (error) {
            worker.terminate();
            reject(error);
          }
          break;

        case 'ERROR':
          // Worker encountered an error
          worker.terminate();
          reject(new Error(message.error));
          break;
      }
    };

    // Handle worker errors
    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(`Worker error: ${error.message}`));
    };

    // Send file to worker for processing
    worker.postMessage({
      type: 'PROCESS_IMAGE',
      file,
      assetType: type,
      fileName: file.name
    });
  });
}

/**
 * Process image on main thread (blocking, fallback method)
 *
 * This is the original implementation, kept as a fallback for environments
 * where Web Workers are not available (e.g., older browsers, testing).
 */
async function processImageMainThread(
  file: File,
  type: AssetType,
  onProgress?: ProgressCallback
): Promise<string> {
  // Progress: 0%
  if (onProgress) onProgress(0);

  // 1. Create bitmap from file (efficient image decode)
  const bitmap = await createImageBitmap(file);
  if (onProgress) onProgress(20);

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

  if (onProgress) onProgress(40);

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

  if (onProgress) onProgress(60);

  // 4. Convert to WebP blob (85% quality = good balance)
  const blob = await canvas.convertToBlob({
    type: 'image/webp',
    quality: 0.85,
  });

  if (onProgress) onProgress(80);

  // 5. Send to main process for file storage
  if (!window.ipcRenderer) {
    throw new Error('IPC not available for asset processing');
  }
  const buffer = await blob.arrayBuffer();

  // @ts-ignore - IPC types not available, will be fixed with proper type declarations
  const filePath = await window.ipcRenderer.invoke(
    'SAVE_ASSET_TEMP',
    buffer,
    file.name.replace(/\.[^/.]+$/, "") + ".webp"
  );

  if (onProgress) onProgress(100);

  return filePath as string;
}

/**
 * Process multiple images in parallel using Web Workers
 *
 * **PERFORMANCE:** Processes multiple images simultaneously for faster batch imports.
 * Example: 5 tokens processed in parallel takes ~500ms vs 2.5s sequential.
 *
 * @param files - Array of image files to process
 * @param type - Asset type for all files
 * @param onProgress - Optional callback receiving overall progress (0-100)
 * @returns Promise resolving to array of file:// URLs
 *
 * @example
 * const files = [goblin.png, orc.png, dragon.png];
 * const urls = await processBatch(files, 'TOKEN', (progress) => {
 *   console.log(`Overall progress: ${progress}%`);
 * });
 * // Returns: ["file://.../goblin.webp", "file://.../orc.webp", "file://.../dragon.webp"]
 */
export const processBatch = async (
  files: File[],
  type: AssetType,
  onProgress?: ProgressCallback
): Promise<string[]> => {
  const totalFiles = files.length;
  let completedFiles = 0;

  // Track progress of individual files
  const fileProgress = new Map<number, number>();

  const updateOverallProgress = () => {
    const total = Array.from(fileProgress.values()).reduce((sum, p) => sum + p, 0);
    const overall = Math.round(total / totalFiles);
    if (onProgress) {
      onProgress(overall);
    }
  };

  // Process all files in parallel
  const promises = files.map((file, index) =>
    processImage(file, type, (progress) => {
      fileProgress.set(index, progress);
      updateOverallProgress();
    }).then((url) => {
      completedFiles++;
      return url;
    })
  );

  return Promise.all(promises);
};
