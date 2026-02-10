import { useState, useRef, useEffect } from 'react';

import type Konva from 'konva';

/**
 * Manages selection state for canvas tokens and drawings.
 *
 * Groups selection rectangle (drag-select), hovered token tracking,
 * Konva Transformer ref, and animation frame ref into a cohesive hook.
 * Handles selection-change notification to parent and Transformer node
 * updates when selection changes.
 *
 * @param options.onSelectionChange - Optional callback notified when selectedIds changes
 * @returns Selection state, refs, and setters consumed by CanvasManager and useCanvasInteraction
 */
export function useCanvasSelection({
  onSelectionChange,
}: {
  onSelectionChange?: (selectedIds: string[]) => void;
}) {
  // Selection rectangle for drag-select
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    isVisible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, isVisible: false });
  const selectionRectRef = useRef<Konva.Rect | null>(null);
  const selectionRectCoordsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Selected items and hover tracking
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  // Konva Transformer reference (for scale/rotate handles in Architect View)
  const transformerRef = useRef<Konva.Transformer | null>(null);

  // RAF handle for throttling selection rect updates
  const animationFrameRef = useRef<number | null>(null);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Update Transformer nodes when selection changes
  useEffect(() => {
    if (transformerRef.current) {
      const stage = transformerRef.current.getStage();
      if (stage) {
        const selectedNodes = stage.find((node: Konva.Node) => selectedIds.includes(node.id()));
        transformerRef.current.nodes(selectedNodes);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedIds]);

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
    // Transformer
    transformerRef,
    // Animation frame
    animationFrameRef,
  };
}
