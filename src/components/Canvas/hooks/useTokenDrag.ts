import { useState, useRef, useCallback } from 'react';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useGameStore } from '../../../store/gameStore';
import { snapToGrid } from '../../../utils/grid';
import { Token } from '../../../store/gameStore';
import { getPointerPosition, isMultiTouchGesture } from '../CanvasUtils';

interface UseTokenDragProps {
  tool: string;
  isWorldView?: boolean;
  isAltPressed: boolean;
  gridSize: number;
  gridType: string;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  resolvedTokens: Token[];
  shouldRejectPointerEvent: (
    e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
  ) => boolean;
  trackStylusUsage: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void;
}

export const useTokenDrag = ({
  tool,
  isWorldView = false,
  isAltPressed,
  gridSize,
  gridType,
  selectedIds,
  setSelectedIds,
  resolvedTokens,
  shouldRejectPointerEvent,
  trackStylusUsage,
}: UseTokenDragProps) => {
  // Refs for performance (direct manipulation)
  const dragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragStartOffsetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragBroadcastThrottleRef = useRef<Map<string, number>>(new Map());
  const snapPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const tokenNodesRef = useRef<Map<string, Konva.Node>>(new Map());
  const tokenLayerRef = useRef<Konva.Layer>(null); // We need a way to set this from outside or pass it

  // State
  const [draggingTokenIds, setDraggingTokenIds] = useState<Set<string>>(new Set());
  const [itemsForDuplication, setItemsForDuplication] = useState<string[]>([]);

  // Press-and-Hold / Threshold Drag State
  const DRAG_THRESHOLD = 5;
  const DRAG_BROADCAST_THROTTLE_MS = 16;
  const [tokenMouseDownStart, setTokenMouseDownStart] = useState<{
    x: number;
    y: number;
    tokenId: string;
    stagePos: { x: number; y: number };
  } | null>(null);
  const [isDraggingWithThreshold, setIsDraggingWithThreshold] = useState(false);

  // Actions
  const updateTokenPosition = useGameStore((s) => s.updateTokenPosition);
  const addToken = useGameStore((s) => s.addToken);

  // Throttle utility
  const throttleDragBroadcast = useCallback(
    (tokenId: string, x: number, y: number) => {
      const now = Date.now();
      const lastBroadcast = dragBroadcastThrottleRef.current.get(tokenId) || 0;

      if (now - lastBroadcast >= DRAG_BROADCAST_THROTTLE_MS) {
        dragBroadcastThrottleRef.current.set(tokenId, now);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ipcRenderer = (window as any).ipcRenderer;
        if (ipcRenderer && !isWorldView) {
          ipcRenderer.send('SYNC_WORLD_STATE', {
            type: 'TOKEN_DRAG_MOVE',
            payload: { id: tokenId, x, y },
          });
        }
      }
    },
    [isWorldView],
  );

  const handleTokenPointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>, tokenId: string) => {
      trackStylusUsage(e);
      if (shouldRejectPointerEvent(e)) return;
      if (tool !== 'select') return;
      if (isMultiTouchGesture(e)) return;

      const pointerPos = getPointerPosition(e);
      if (!pointerPos) return;

      const token = resolvedTokens.find((t) => t.id === tokenId);
      if (!token) return;

      e.evt.stopPropagation();

      setTokenMouseDownStart({
        x: pointerPos.x,
        y: pointerPos.y,
        tokenId,
        stagePos: { x: token.x, y: token.y },
      });
      setIsDraggingWithThreshold(false);
    },
    [tool, resolvedTokens, shouldRejectPointerEvent, trackStylusUsage],
  );

  const handleTokenPointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
      if (shouldRejectPointerEvent(e)) return;
      if (!tokenMouseDownStart || tool !== 'select') return;
      if (isMultiTouchGesture(e)) return;

      const pointerPos = getPointerPosition(e);
      if (!pointerPos) return;

      const dx = pointerPos.x - tokenMouseDownStart.x;
      const dy = pointerPos.y - tokenMouseDownStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!isDraggingWithThreshold && distance > DRAG_THRESHOLD) {
        setIsDraggingWithThreshold(true);
        const tokenId = tokenMouseDownStart.tokenId;

        let tokenIds: string[];
        if (selectedIds.includes(tokenId)) {
          tokenIds = selectedIds;
        } else {
          tokenIds = e.evt.shiftKey ? [...selectedIds, tokenId] : [tokenId];
          setSelectedIds(tokenIds);
        }

        const primaryToken = resolvedTokens.find((t) => t.id === tokenId);
        if (!primaryToken) return;

        setDraggingTokenIds(new Set(tokenIds));
        setItemsForDuplication(tokenIds);

        dragStartOffsetsRef.current.clear();
        tokenIds.forEach((id) => {
          const token = resolvedTokens.find((t) => t.id === id);
          if (token) {
            if (id === tokenId) {
              dragStartOffsetsRef.current.set(id, { x: 0, y: 0 });
            } else {
              dragStartOffsetsRef.current.set(id, {
                x: token.x - primaryToken.x,
                y: token.y - primaryToken.y,
              });
            }
          }
        });

        const ipcRenderer = window.ipcRenderer;
        if (ipcRenderer && !isWorldView) {
          tokenIds.forEach((id) => {
            const token = resolvedTokens.find((t) => t.id === id);
            if (token) {
              ipcRenderer.send('SYNC_WORLD_STATE', {
                type: 'TOKEN_DRAG_START',
                payload: { id, x: token.x, y: token.y },
              });
            }
          });
        }
      }

      if (isDraggingWithThreshold) {
        const tokenId = tokenMouseDownStart.tokenId;
        const newX = tokenMouseDownStart.stagePos.x + dx;
        const newY = tokenMouseDownStart.stagePos.y + dy;

        dragPositionsRef.current.set(tokenId, { x: newX, y: newY });
        throttleDragBroadcast(tokenId, newX, newY);

        const token = resolvedTokens.find((t) => t.id === tokenId);
        if (token) {
          const safeScale = token.scale ?? 1;
          const width = gridSize * safeScale;
          const height = gridSize * safeScale;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const snapped = snapToGrid(newX, newY, gridSize, gridType as any, width, height);
          snapPreviewPositionsRef.current.set(tokenId, snapped);
        }

        // Multi-token
        const tokenIds = selectedIds.includes(tokenId) ? selectedIds : [tokenId];
        if (tokenIds.length > 1) {
          tokenIds.forEach((id) => {
            if (id !== tokenId) {
              const offset = dragStartOffsetsRef.current.get(id);
              if (offset) {
                const offsetX = newX + offset.x;
                const offsetY = newY + offset.y;
                dragPositionsRef.current.set(id, { x: offsetX, y: offsetY });
                throttleDragBroadcast(id, offsetX, offsetY);

                const otherToken = resolvedTokens.find((t) => t.id === id);
                if (otherToken) {
                  const otherSafeScale = otherToken.scale ?? 1;
                  const snapped = snapToGrid(
                    offsetX,
                    offsetY,
                    gridSize,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    gridType as any,
                    gridSize * otherSafeScale,
                    gridSize * otherSafeScale,
                  );
                  snapPreviewPositionsRef.current.set(id, snapped);
                }

                const node = tokenNodesRef.current.get(id);
                if (node) {
                  node.x(offsetX);
                  node.y(offsetY);
                }
              }
            }
          });
        }

        const node = tokenNodesRef.current.get(tokenId);
        if (node) {
          node.x(newX);
          node.y(newY);
        }

        if (tokenLayerRef.current) {
          tokenLayerRef.current.batchDraw();
        }
      }
    },
    [
      shouldRejectPointerEvent,
      tokenMouseDownStart,
      tool,
      isDraggingWithThreshold,
      selectedIds,
      resolvedTokens,
      setSelectedIds,
      gridSize,
      gridType,
      isWorldView,
      throttleDragBroadcast,
    ],
  );

  const handleTokenPointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
      if (!tokenMouseDownStart) return;

      const tokenId = tokenMouseDownStart.tokenId;
      const token = resolvedTokens.find((t) => t.id === tokenId);

      if (!token) {
        setTokenMouseDownStart(null);
        setIsDraggingWithThreshold(false);
        return;
      }

      if (isDraggingWithThreshold) {
        const tokenIds = selectedIds.includes(tokenId) ? selectedIds : [tokenId];
        const committedPositions = new Map<string, { x: number; y: number }>();
        const dragPos = dragPositionsRef.current.get(tokenId);

        if (dragPos) {
          const safeScale = token.scale ?? 1;
          const width = gridSize * safeScale;
          const height = gridSize * safeScale;
          const snapped = snapToGrid(
            dragPos.x,
            dragPos.y,
            gridSize,
            gridType as never, // Cast to never to bypass strict string check if necessary, or just remove if compatible
            width,
            height,
          );

          if (tokenIds.length > 1) {
            const offsetX = snapped.x - dragPos.x;
            const offsetY = snapped.y - dragPos.y;

            tokenIds.forEach((id) => {
              const t = resolvedTokens.find((tk) => tk.id === id);
              if (t) {
                const tSafeScale = t.scale ?? 1;
                const dragPosForToken = dragPositionsRef.current.get(id) ?? { x: t.x, y: t.y };
                const newX = dragPosForToken.x + offsetX;
                const newY = dragPosForToken.y + offsetY;
                const snappedPos = snapToGrid(
                  newX,
                  newY,
                  gridSize,
                  gridType as never,
                  gridSize * tSafeScale,
                  gridSize * tSafeScale,
                );
                updateTokenPosition(id, snappedPos.x, snappedPos.y);
                committedPositions.set(id, snappedPos);
              }
            });
          } else {
            updateTokenPosition(tokenId, snapped.x, snapped.y);
            committedPositions.set(tokenId, snapped);
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ipcRenderer = (window as any).ipcRenderer;
          if (ipcRenderer && !isWorldView) {
            tokenIds.forEach((id) => {
              const pos = committedPositions.get(id);
              if (pos) {
                ipcRenderer.send('SYNC_WORLD_STATE', {
                  type: 'TOKEN_DRAG_END',
                  payload: { id, x: pos.x, y: pos.y },
                });
              }
            });
          }

          if (isAltPressed && !isWorldView) {
            tokenIds.forEach((id) => {
              const t = resolvedTokens.find((tk) => tk.id === id);
              const pos = committedPositions.get(id);
              if (t && pos) {
                addToken({ ...t, id: crypto.randomUUID(), x: pos.x, y: pos.y });
              }
            });
          }
        }

        dragPositionsRef.current.delete(tokenId); // Should clear all?
        tokenIds.forEach((id) => {
          dragPositionsRef.current.delete(id);
          dragBroadcastThrottleRef.current.delete(id);
          dragStartOffsetsRef.current.delete(id);
        });
        setDraggingTokenIds(new Set());
        setItemsForDuplication([]);
      } else {
        // Selection Click
        e.evt.stopPropagation();
        if (e.evt.shiftKey) {
          if (selectedIds.includes(tokenId)) {
            setSelectedIds(selectedIds.filter((id) => id !== tokenId));
          } else {
            setSelectedIds([...selectedIds, tokenId]);
          }
        } else {
          setSelectedIds([tokenId]);
        }
      }

      setTokenMouseDownStart(null);
      setIsDraggingWithThreshold(false);
      snapPreviewPositionsRef.current.clear();
    },
    [
      tokenMouseDownStart,
      resolvedTokens,
      isDraggingWithThreshold,
      selectedIds,
      gridSize,
      gridType,
      isWorldView,
      isAltPressed,
      updateTokenPosition,
      addToken,
      setSelectedIds,
    ],
  );

  return {
    handleTokenPointerDown,
    handleTokenPointerMove,
    handleTokenPointerUp,
    dragPositionsRef,
    tokenNodesRef,
    draggingTokenIds,
    itemsForDuplication,
    setItemsForDuplication,
    snapPreviewPositionsRef,
    tokenLayerRef,
    isDragging: isDraggingWithThreshold,
  };
};
