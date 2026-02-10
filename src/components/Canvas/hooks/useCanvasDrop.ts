import { useState, useCallback } from 'react';

import { snapToGrid } from '../../../utils/grid';

import type { Token, GridType } from '../../../types/domain';

/** Pending crop state for images dropped onto the canvas */
export interface PendingCrop {
  src: string;
  x: number;
  y: number;
}

interface UseCanvasDropProps {
  isWorldView: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  position: { x: number; y: number };
  scale: number;
  gridSize: number;
  gridType: GridType;
  addToken: (token: Token) => void;
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

/**
 * Handles file drop and image crop operations on the canvas.
 *
 * Processes three drop types:
 * - LIBRARY_TOKEN: Creates a token instance referencing a library prototype
 * - GENERIC_TOKEN: Creates a themed placeholder token (SVG with CSS vars)
 * - File drop: Opens the image cropper for token creation
 *
 * BLOCKED in World View (players cannot add tokens via drag-and-drop).
 *
 * @returns Drop event handlers, crop handlers, and pending crop state
 */
export function useCanvasDrop({
  isWorldView,
  containerRef,
  position,
  scale,
  gridSize,
  gridType,
  addToken,
  showToast,
}: UseCanvasDropProps) {
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      // BLOCKED in World View (no file drops allowed)
      if (isWorldView) {
        return;
      }
      e.preventDefault();
    },
    [isWorldView],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      // BLOCKED in World View (no file drops allowed)
      if (isWorldView) {
        return;
      }
      e.preventDefault();

      const stageRect = containerRef.current?.getBoundingClientRect();
      if (!stageRect) {
        return;
      }

      // Get pointer relative to the container DOM element
      const pointerX = e.clientX - stageRect.left;
      const pointerY = e.clientY - stageRect.top;

      // Transform into World Coordinates (reverse stage transform)
      // Stage Transform: Screen = World * Scale + Position
      // World = (Screen - Position) / Scale
      const worldX = (pointerX - position.x) / scale;
      const worldY = (pointerY - position.y) / scale;

      // Snap to grid in world coordinates
      const { x, y } = snapToGrid(worldX, worldY, gridSize, gridType);

      // Check for JSON (Library Item or Generic Token)
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        try {
          const data = JSON.parse(jsonData) as {
            type?: string;
            src?: string;
            libraryItemId?: string;
          };
          if (data.type === 'LIBRARY_TOKEN' && data.src && data.libraryItemId) {
            // Create token instance with reference to library item
            // Metadata (scale, type, visionRadius, name) will be inherited from library
            addToken({
              id: crypto.randomUUID(),
              x,
              y,
              src: data.src,
              libraryItemId: data.libraryItemId,
            });
            return;
          } else if (data.type === 'GENERIC_TOKEN') {
            // Create a generic placeholder token with an SVG data URL.
            // Colors are derived from CSS variables so the token matches the current theme.
            const rootElement = document.documentElement;
            const computedStyles = getComputedStyle(rootElement);
            const bgColor = computedStyles.getPropertyValue('--app-bg-subtle')?.trim() || '#6b7280';
            const fgColor =
              computedStyles.getPropertyValue('--app-text-primary')?.trim() || '#ffffff';

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="${bgColor}" rx="16"/><circle cx="64" cy="45" r="18" fill="${fgColor}"/><path d="M64 70 C 40 70 28 82 28 92 L 28 108 L 100 108 L 100 92 C 100 82 88 70 64 70 Z" fill="${fgColor}"/></svg>`;
            const genericTokenSvg = `data:image/svg+xml;base64,${btoa(svg)}`;

            addToken({
              id: crypto.randomUUID(),
              x,
              y,
              src: genericTokenSvg,
              name: 'Generic Token',
              type: 'NPC',
              scale: 1,
            });
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]!;
        // Create Object URL for cropping
        const objectUrl = URL.createObjectURL(file);
        setPendingCrop({ src: objectUrl, x, y });
      }
    },
    [isWorldView, containerRef, position, scale, gridSize, gridType, addToken],
  );

  const handleCropConfirm = useCallback(
    (blob: Blob) => {
      if (!pendingCrop) {
        return;
      }

      try {
        // Convert blob to base64 for storage/rendering
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;

          addToken({
            id: crypto.randomUUID(),
            x: pendingCrop.x,
            y: pendingCrop.y,
            src: base64data,
            name: 'New Token',
            type: 'NPC',
            scale: 1,
          });

          // Revoke the object URL to prevent memory leak
          URL.revokeObjectURL(pendingCrop.src);
          setPendingCrop(null);
        };
      } catch (error) {
        console.error('Error saving cropped image:', error);
        showToast('Failed to save token image', 'error');
      }
    },
    [pendingCrop, addToken, showToast],
  );

  /** Cancel pending crop and clean up object URL */
  const handleCropCancel = useCallback(() => {
    if (pendingCrop) {
      URL.revokeObjectURL(pendingCrop.src);
    }
    setPendingCrop(null);
  }, [pendingCrop]);

  return {
    handleDragOver,
    handleDrop,
    handleCropConfirm,
    handleCropCancel,
    pendingCrop,
    setPendingCrop,
  };
}
