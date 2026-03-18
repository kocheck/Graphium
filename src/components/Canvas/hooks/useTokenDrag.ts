import { useState, useRef, useCallback } from 'react';
import type React from 'react';

import { useGameStore } from '../../../store/gameStore';
import { snapToGrid } from '../../../utils/grid';

import type { Token, GridType } from '../../../types/domain';
import type { FederatedPointerEvent } from 'pixi.js';

/**
 * snapPositionToGrid — exported for unit testing.
 * Simple square-grid snap using Math.round.
 * For hexagonal/isometric grids, use snapToGrid from utils/grid.ts instead.
 */
export function snapPositionToGrid(
  pos: { x: number; y: number },
  gridSize: number,
): { x: number; y: number } {
  return {
    x: Math.round(pos.x / gridSize) * gridSize,
    y: Math.round(pos.y / gridSize) * gridSize,
  };
}

interface UseTokenDragReturn {
  handleTokenPointerDown: (e: FederatedPointerEvent, tokenId: string) => void;
  handleTokenPointerMove: (e: FederatedPointerEvent) => void;
  handleTokenPointerUp: (e: FederatedPointerEvent) => void;
  dragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  draggingTokenIds: Set<string>;
  itemsForDuplication: string[];
  setItemsForDuplication: React.Dispatch<React.SetStateAction<string[]>>;
  snapPreviewPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  isDragging: boolean;
}

interface UseTokenDragProps {
  tool: string;
  isWorldView?: boolean;
  isAltPressed: boolean;
  gridSize: number;
  gridType: GridType;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  resolvedTokens: Token[];
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
}

// eslint-disable-next-line max-lines-per-function
export const useTokenDrag = ({
  tool,
  isWorldView = false,
  isAltPressed,
  gridSize,
  gridType,
  selectedIds,
  setSelectedIds,
  resolvedTokens,
  screenToWorld,
}: UseTokenDragProps): UseTokenDragReturn => {
  // Refs for performance (direct manipulation)
  const dragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragStartOffsetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragBroadcastThrottleRef = useRef<Map<string, number>>(new Map());
  const snapPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

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
    worldPos: { x: number; y: number };
  } | null>(null);
  const [isDraggingWithThreshold, setIsDraggingWithThreshold] = useState(false);

  // Actions
  const updateTokenPosition = useGameStore((s) => s.updateTokenPosition);
  const addToken = useGameStore((s) => s.addToken);

  // Throttle utility
  const throttleDragBroadcast = useCallback(
    (tokenId: string, x: number, y: number) => {
      const now = Date.now();
      const lastBroadcast = dragBroadcastThrottleRef.current.get(tokenId) ?? 0;

      if (now - lastBroadcast >= DRAG_BROADCAST_THROTTLE_MS) {
        dragBroadcastThrottleRef.current.set(tokenId, now);

        if (window.ipcRenderer && !isWorldView) {
          window.ipcRenderer.send('SYNC_WORLD_STATE', {
            type: 'TOKEN_DRAG_MOVE',
            payload: { id: tokenId, x, y },
          });
        }
      }
    },
    [isWorldView],
  );

  const handleTokenPointerDown = useCallback(
    (e: FederatedPointerEvent, tokenId: string) => {
      // Guard: only primary pointer button (left click / primary touch)
      if (e.button !== undefined && e.button !== 0) {
        return;
      }
      if (tool !== 'select') {
        return;
      }

      const token = resolvedTokens.find((t) => t.id === tokenId);
      if (!token) {
        return;
      }

      // stopPropagation is not available on PixiTouch — guard before calling
      if ('stopPropagation' in e.nativeEvent) {
        e.nativeEvent.stopPropagation();
      }

      setTokenMouseDownStart({
        x: e.global.x,
        y: e.global.y,
        tokenId,
        worldPos: { x: token.x, y: token.y },
      });
      setIsDraggingWithThreshold(false);
    },
    [tool, resolvedTokens],
  );

  const handleTokenPointerMove = useCallback(
    (e: FederatedPointerEvent) => {
      if (!tokenMouseDownStart || tool !== 'select') {
        return;
      }

      // dx/dy in screen space for threshold check
      const dx = e.global.x - tokenMouseDownStart.x;
      const dy = e.global.y - tokenMouseDownStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!isDraggingWithThreshold && distance > DRAG_THRESHOLD) {
        setIsDraggingWithThreshold(true);
        const tokenId = tokenMouseDownStart.tokenId;

        let tokenIds: string[];
        if (selectedIds.includes(tokenId)) {
          tokenIds = selectedIds;
        } else {
          tokenIds = e.nativeEvent.shiftKey ? [...selectedIds, tokenId] : [tokenId];
          setSelectedIds(tokenIds);
        }

        const primaryToken = resolvedTokens.find((t) => t.id === tokenId);
        if (!primaryToken) {
          return;
        }

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

        // Convert current screen pointer to world space, then compute delta from token's
        // stored world-space origin to get the new world-space position
        const currentWorld = screenToWorld(e.global.x, e.global.y);
        const originWorld = screenToWorld(tokenMouseDownStart.x, tokenMouseDownStart.y);
        const worldDx = currentWorld.x - originWorld.x;
        const worldDy = currentWorld.y - originWorld.y;

        const newX = tokenMouseDownStart.worldPos.x + worldDx;
        const newY = tokenMouseDownStart.worldPos.y + worldDy;

        dragPositionsRef.current.set(tokenId, { x: newX, y: newY });
        throttleDragBroadcast(tokenId, newX, newY);

        const token = resolvedTokens.find((t) => t.id === tokenId);
        if (token) {
          const safeScale = token.scale ?? 1;
          const width = gridSize * safeScale;
          const height = gridSize * safeScale;
          const snapped = snapToGrid(newX, newY, gridSize, gridType, width, height);
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
                    gridType,
                    gridSize * otherSafeScale,
                    gridSize * otherSafeScale,
                  );
                  snapPreviewPositionsRef.current.set(id, snapped);
                }
              }
            }
          });
        }
      }
    },
    [
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
      screenToWorld,
    ],
  );

  const handleTokenPointerUp = useCallback(
    (e: FederatedPointerEvent) => {
      if (!tokenMouseDownStart) {
        return;
      }

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
          const snapped = snapToGrid(dragPos.x, dragPos.y, gridSize, gridType, width, height);

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
                  gridType,
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

          if (window.ipcRenderer && !isWorldView) {
            tokenIds.forEach((id) => {
              const pos = committedPositions.get(id);
              if (pos) {
                window.ipcRenderer?.send('SYNC_WORLD_STATE', {
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

        tokenIds.forEach((id) => {
          dragPositionsRef.current.delete(id);
          dragBroadcastThrottleRef.current.delete(id);
          dragStartOffsetsRef.current.delete(id);
        });
        setDraggingTokenIds(new Set());
        setItemsForDuplication([]);
      } else {
        // Selection Click
        if ('stopPropagation' in e.nativeEvent) {
          e.nativeEvent.stopPropagation();
        }
        if (e.nativeEvent.shiftKey) {
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
    draggingTokenIds,
    itemsForDuplication,
    setItemsForDuplication,
    snapPreviewPositionsRef,
    isDragging: isDraggingWithThreshold,
  };
};
