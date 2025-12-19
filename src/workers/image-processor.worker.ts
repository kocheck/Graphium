/**
 * Image Processing Web Worker
 *
 * **PERFORMANCE OPTIMIZATION:** This worker offloads CPU-intensive image processing
 * from the main thread, preventing UI freezes during asset imports.
 *
 * **Benefits:**
 * - Non-blocking: UI remains responsive during processing
 * - Parallel: Multiple workers can process multiple images simultaneously
 * - Progress: Reports progress back to main thread for UI feedback
 *
 * **Processing Pipeline:**
 * 1. Receive File from main thread
 * 2. Create ImageBitmap (20% progress)
 * 3. Resize to max dimensions (40% progress)
 * 4. Convert to WebP format (80% progress)
 * 5. Send ArrayBuffer back to main thread (100% progress)
 */

export type AssetType = 'MAP' | 'TOKEN';

interface ProcessImageMessage {
  type: 'PROCESS_IMAGE';
  file: File;
  assetType: AssetType;
  fileName: string;
}

interface ProgressMessage {
  type: 'PROGRESS';
  progress: number;
  fileName: string;
}

interface CompleteMessage {
  type: 'COMPLETE';
  buffer: ArrayBuffer;
  fileName: string;
  originalName: string;
}

interface ErrorMessage {
  type: 'ERROR';
  error: string;
  fileName: string;
}

// Maximum dimensions for different asset types
const MAX_MAP_DIMENSION = 4096;
const MAX_TOKEN_DIMENSION = 512;

/**
 * Process image in Web Worker (non-blocking)
 */
self.onmessage = async (event: MessageEvent<ProcessImageMessage>) => {
  const { file, assetType, fileName } = event.data;

  try {
    // Progress: 0% - Starting
    postMessage({
      type: 'PROGRESS',
      progress: 0,
      fileName
    } as ProgressMessage);

    // Step 1: Create bitmap from file (efficient image decode)
    const bitmap = await createImageBitmap(file);
    postMessage({
      type: 'PROGRESS',
      progress: 20,
      fileName
    } as ProgressMessage);

    const maxDim = assetType === 'MAP' ? MAX_MAP_DIMENSION : MAX_TOKEN_DIMENSION;

    let width = bitmap.width;
    let height = bitmap.height;

    // Step 2: Calculate new dimensions (preserve aspect ratio)
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

    postMessage({
      type: 'PROGRESS',
      progress: 40,
      fileName
    } as ProgressMessage);

    // Step 3: Draw to OffscreenCanvas (faster than DOM canvas)
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get 2D context from OffscreenCanvas');
    }

    // Draw resized image to canvas
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Clean up bitmap (free memory)
    bitmap.close();

    postMessage({
      type: 'PROGRESS',
      progress: 60,
      fileName
    } as ProgressMessage);

    // Step 4: Convert to WebP blob (85% quality = good balance)
    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.85,
    });

    postMessage({
      type: 'PROGRESS',
      progress: 80,
      fileName
    } as ProgressMessage);

    // Step 5: Convert blob to ArrayBuffer for transfer
    const buffer = await blob.arrayBuffer();

    postMessage({
      type: 'PROGRESS',
      progress: 90,
      fileName
    } as ProgressMessage);

    // Step 6: Send result back to main thread with transferable ArrayBuffer
    postMessage({
      type: 'COMPLETE',
      buffer,
      fileName,
      originalName: file.name
    } as CompleteMessage, { transfer: [buffer] });

  } catch (error) {
    // Send error back to main thread
    postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName
    } as ErrorMessage);
  }
};

// Type safety for TypeScript
export {};
