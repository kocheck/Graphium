import { useState, useRef, useEffect } from 'react';
import type React from 'react';

import type { Graphics } from 'pixi.js';

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pure function — returns true when two axis-aligned rectangles overlap.
 * Adjacent rects (touching edges) are NOT considered overlapping.
 */
// eslint-disable-next-line import/no-unused-modules
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

interface UseCanvasSelectionReturn {
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  hoveredTokenId: string | null;
  setHoveredTokenId: React.Dispatch<React.SetStateAction<string | null>>;
  selectionRect: SelectionRect;
  setSelectionRect: React.Dispatch<React.SetStateAction<SelectionRect>>;
  selectionStart: React.MutableRefObject<{ x: number; y: number } | null>;
  /** PixiJS Graphics node that renders the drag-select rectangle. */
  selectionRectRef: React.MutableRefObject<Graphics | null>;
  selectionRectCoordsRef: React.MutableRefObject<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  /**
   * No-op placeholder — transformer is wired into TokenLayer in Task 2.4.
   * Typed as `null` to satisfy call-sites that check `.current` before use.
   */
  transformerRef: React.MutableRefObject<null>;
  animationFrameRef: React.MutableRefObject<number | null>;
}

/**
 * Manages selection state for canvas tokens and drawings.
 *
 * Groups selection rectangle (drag-select), hovered token tracking,
 * and animation frame ref into a cohesive hook.
 *
 * The Konva Transformer has been removed; multi-select transform handles
 * are handled by TokenLayer (PixiJS) as of Task 2.4.
 *
 * @param options.onSelectionChange - Optional callback notified when selectedIds changes
 * @returns Selection state, refs, and setters consumed by CanvasManager and useCanvasInteraction
 */
// eslint-disable-next-line import/no-unused-modules
export function useCanvasSelection({
  onSelectionChange,
}: {
  onSelectionChange?: (selectedIds: string[]) => void;
}): UseCanvasSelectionReturn {
  // Selection rectangle for drag-select
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isVisible: false,
  });
  // PixiJS Graphics node — replaces Konva.Rect ref
  const selectionRectRef = useRef<Graphics | null>(null);
  const selectionRectCoordsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Selected items and hover tracking
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  // No-op transformer ref — transformer moves to TokenLayer in Task 2.4
  const transformerRef = useRef<null>(null);

  // RAF handle for throttling selection rect updates
  const animationFrameRef = useRef<number | null>(null);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Cleanup: Cancel pending animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  return {
    // Selection state
    selectedIds,
    setSelectedIds,
    hoveredTokenId,
    setHoveredTokenId,
    // Selection rectangle
    selectionRect,
    setSelectionRect,
    selectionStart,
    selectionRectRef,
    selectionRectCoordsRef,
    // Transformer (no-op until Task 2.4)
    transformerRef,
    // Animation frame
    animationFrameRef,
  };
}
