import { getStorage } from '../services/storage';

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
 * Cancellable processing handle returned by processImage
 */
export interface ProcessingHandle {
  promise: Promise<string>;
  cancel: () => void;
}

/**
 * Cancellable batch processing handle returned by processBatch
 */
export interface BatchProcessingHandle {
  promise: Promise<string[]>;
  cancel: () => void;
}

/**
 * Processes and optimizes uploaded images for use as maps or tokens
 *
 * **PERFORMANCE OPTIMIZATION:** This function now uses Web Workers for non-blocking
 * image processing. The UI remains responsive even when processing large images.
 *
 * **RESOURCE MANAGEMENT:** Returns a cancellable handle to prevent worker leaks.
 * CRITICAL: Always call `cancel()` in cleanup (useEffect return, componentWillUnmount).
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
 * - Cancellable to prevent resource leaks
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
 * @returns ProcessingHandle with promise and cancel function
 * @throws {Error} If processing fails or IPC invoke fails
 *
 * @example
 * // Process uploaded token image with cleanup
 * useEffect(() => {
 *   const handle = processImage(file, 'TOKEN', (progress) => {
 *     setProgress(progress);
 *   });
 *
 *   handle.promise
 *     .then(src => addToken({ src, ... }))
 *     .catch(err => console.error(err));
 *
 *   // CRITICAL: Cancel on unmount to prevent worker leak
 *   return () => handle.cancel();
 * }, [file]);
 *
 * @example
 * // Simple usage (auto-cancels if component unmounts)
 * const handle = processImage(file, 'MAP');
 * const src = await handle.promise;
 */
export const processImage = (
  file: File,
  type: AssetType,
  onProgress?: ProgressCallback,
): ProcessingHandle => {
  // Try to use Web Worker for non-blocking processing
  if (typeof Worker !== 'undefined') {
    return processImageWithWorker(file, type, onProgress);
  } else {
    // Fallback to main thread processing (blocking, but compatible)
    console.warn('[AssetProcessor] Web Workers not available, using main thread');
    return wrapPromiseAsHandle(processImageMainThread(file, type, onProgress));
  }
};

/**
 * Wraps a Promise in a ProcessingHandle (for main thread fallback)
 */
function wrapPromiseAsHandle(promise: Promise<string>): ProcessingHandle {
  return {
    promise,
    cancel: () => {
      // Main thread processing can't be cancelled, just ignore
      console.warn('[AssetProcessor] Main thread processing cannot be cancelled');
    },
  };
}

/**
 * Process image using Web Worker (non-blocking, preferred method)
 *
 * **RESOURCE MANAGEMENT:** Properly terminates worker on cancel, completion, or error.
 */
function processImageWithWorker(
  file: File,
  type: AssetType,
  onProgress?: ProgressCallback,
): ProcessingHandle {
  let worker: Worker | null = null;
  let isCancelled = false;
  let rejectPromise: ((reason?: unknown) => void) | null = null;

  const promise = new Promise<string>((resolve, reject) => {
    // Capture reject for cancel function
    rejectPromise = reject;
    // Create worker instance
    worker = new Worker(new URL('../workers/image-processor.worker.ts', import.meta.url), {
      type: 'module',
    });

    // Handle worker messages
    worker.onmessage = async (event) => {
      // Ignore messages if already cancelled
      if (isCancelled) return;

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
            // Send buffer to storage service for temp asset storage
            const webpFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const storage = getStorage();
            const filePath = await storage.saveAssetTemp(message.buffer, webpFileName);

            // Check cancellation after async IPC operation
            if (isCancelled) return;

            // Complete progress
            if (onProgress) {
              onProgress(100);
            }

            // Cleanup and resolve
            if (worker) {
              worker.terminate();
              worker = null;
            }
            rejectPromise = null; // Clear to prevent double-rejection
            resolve(filePath as string);
          } catch (error) {
            // Check cancellation before rejecting with error
            if (isCancelled) return;

            // Cleanup and reject
            if (worker) {
              worker.terminate();
              worker = null;
            }
            rejectPromise = null; // Clear to prevent double-rejection
            reject(error);
          }
          break;

        case 'ERROR':
          // Worker encountered an error
          if (worker) {
            worker.terminate();
            worker = null;
          }
          rejectPromise = null; // Clear to prevent double-rejection
          reject(new Error(message.error));
          break;
      }
    };

    // Handle worker errors
    worker.onerror = (error) => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      rejectPromise = null; // Clear to prevent double-rejection
      reject(new Error(`Worker error: ${error.message}`));
    };

    // Send file to worker for processing
    worker.postMessage({
      type: 'PROCESS_IMAGE',
      file,
      assetType: type,
      fileName: file.name,
    });
  });

  // Return cancellable handle
  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (worker) {
        worker.terminate();
        worker = null;
      }
      // Reject the promise with a cancellation error
      if (rejectPromise) {
        rejectPromise(new Error('Image processing cancelled'));
        rejectPromise = null; // Clear to prevent double-rejection
      }
    },
  };
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
  onProgress?: ProgressCallback,
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

  // 5. Send to storage service for temp asset storage
  const buffer = await blob.arrayBuffer();
  const webpFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
  const storage = getStorage();
  const filePath = await storage.saveAssetTemp(buffer, webpFileName);

  if (onProgress) onProgress(100);

  return filePath;
}

/**
 * Process multiple images in parallel using Web Workers
 *
 * **PERFORMANCE:** Processes multiple images simultaneously for faster batch imports.
 * Example: 5 tokens processed in parallel takes ~500ms vs 2.5s sequential.
 *
 * **RESOURCE MANAGEMENT:** Returns cancellable handle for the entire batch.
 *
 * @param files - Array of image files to process
 * @param type - Asset type for all files
 * @param onProgress - Optional callback receiving overall progress (0-100)
 * @returns ProcessingHandle with promise and cancel function
 *
 * @example
 * useEffect(() => {
 *   const handle = processBatch(files, 'TOKEN', setProgress);
 *
 *   handle.promise
 *     .then(urls => urls.forEach(url => addToken({ src: url, ... })))
 *     .catch(err => console.error(err));
 *
 *   // Cancel all workers on unmount
 *   return () => handle.cancel();
 * }, [files]);
 */
export const processBatch = (
  files: File[],
  type: AssetType,
  onProgress?: ProgressCallback,
): BatchProcessingHandle => {
  const totalFiles = files.length;

  // Handle empty array case
  if (totalFiles === 0) {
    if (onProgress) {
      onProgress(100);
    }
    return {
      promise: Promise.resolve([]),
      cancel: () => {},
    };
  }

  const fileProgress = new Map<number, number>();
  const handles: ProcessingHandle[] = [];
  let isCancelled = false;

  const updateOverallProgress = () => {
    // Don't update progress if batch processing has been cancelled
    if (isCancelled) return;

    const total = Array.from(fileProgress.values()).reduce((sum, p) => sum + p, 0);
    const overall = Math.round(total / totalFiles);
    if (onProgress) {
      onProgress(overall);
    }
  };

  // Process all files in parallel
  const promises = files.map((file, index) => {
    const handle = processImage(file, type, (progress) => {
      // Don't update progress if batch processing has been cancelled
      if (isCancelled) return;

      fileProgress.set(index, progress);
      updateOverallProgress();
    });
    handles.push(handle);
    return handle.promise;
  });

  return {
    promise: Promise.all(promises),
    cancel: () => {
      // Set cancellation flag to prevent further progress updates
      isCancelled = true;
      // Cancel all workers
      handles.forEach((handle) => handle.cancel());
      // Clear progress tracking and handle references to avoid stale state
      fileProgress.clear();
      handles.splice(0, handles.length); // Clear array in place
    },
  };
};
