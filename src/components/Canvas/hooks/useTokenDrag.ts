import type React from 'react';
import { useState, useRef, useCallback } from 'react';

import { getResolvedToken } from '../../../hooks/useTokenData';
import { useGameStore } from '../../../store/gameStore';
import { usePointerOverlayStore } from '../../../store/pointerOverlayStore';
import { snapToGrid } from '../../../utils/grid';
import { flushRafSync, queueSyncAction } from '../../../utils/rafSync';
import { stampArchitectPrevTokenPosition } from '../../../utils/syncStamp';
import { applyTokenNodePositions } from '../../../utils/tokenNodeRegistry';
import { getPointerPosition, isMultiTouchGesture } from '../CanvasUtils';

import type { GridType } from '../../../store/gameStore';
import type { SnapPreview } from '../../../store/pointerOverlayStore';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

interface UseTokenDragReturn {
  handleTokenPointerDown: (
    e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
    tokenId: string,
  ) => void;
  handleTokenPointerMove: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void;
  handleTokenPointerUp: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void;
  dragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  draggingTokenIds: Set<string>;
  itemsForDuplication: string[];
  setItemsForDuplication: (ids: string[]) => void;
  tokenLayerRef: React.MutableRefObject<Konva.Layer | null>;
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
  shouldRejectPointerEvent: (
    e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
  ) => boolean;
  trackStylusUsage: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void;
}

interface DragSize {
  width: number;
  height: number;
}

function publishSnapPreviews(previews: SnapPreview[]): void {
  usePointerOverlayStore.getState().setSnapPreviews(previews);
}

function clearSnapPreviews(): void {
  const store = usePointerOverlayStore.getState();
  if (store.snapPreviews.length > 0) {
    store.setSnapPreviews([]);
  }
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
  shouldRejectPointerEvent,
  trackStylusUsage,
}: UseTokenDragProps): UseTokenDragReturn => {
  const dragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragStartOffsetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragSizeRef = useRef<Map<string, DragSize>>(new Map());
  const tokenLayerRef = useRef<Konva.Layer | null>(null);

  const [draggingTokenIds, setDraggingTokenIds] = useState<Set<string>>(new Set());
  const [itemsForDuplication, setItemsForDuplication] = useState<string[]>([]);

  const DRAG_THRESHOLD = 5;
  const [tokenMouseDownStart, setTokenMouseDownStart] = useState<{
    x: number;
    y: number;
    tokenId: string;
    stagePos: { x: number; y: number };
  } | null>(null);
  const [isDraggingWithThreshold, setIsDraggingWithThreshold] = useState(false);

  const updateTokenPositions = useGameStore((s) => s.updateTokenPositions);
  const addToken = useGameStore((s) => s.addToken);

  const queueDragMove = useCallback(
    (tokenId: string, x: number, y: number): void => {
      if (!isWorldView) {
        queueSyncAction({
          type: 'TOKEN_DRAG_MOVE',
          payload: { id: tokenId, x, y },
        });
      }
    },
    [isWorldView],
  );

  const cacheDragGeometry = useCallback(
    (tokenIds: string[], primaryId: string): boolean => {
      const primaryToken = getResolvedToken(primaryId);
      if (!primaryToken) {
        return false;
      }

      dragStartOffsetsRef.current.clear();
      dragSizeRef.current.clear();
      tokenIds.forEach((id) => {
        const token = getResolvedToken(id);
        if (!token) {
          return;
        }
        dragSizeRef.current.set(id, {
          width: gridSize * token.scale,
          height: gridSize * token.scale,
        });
        if (id === primaryId) {
          dragStartOffsetsRef.current.set(id, { x: 0, y: 0 });
        } else {
          dragStartOffsetsRef.current.set(id, {
            x: token.x - primaryToken.x,
            y: token.y - primaryToken.y,
          });
        }
      });
      return true;
    },
    [gridSize],
  );

  const handleTokenPointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>, tokenId: string): void => {
      trackStylusUsage(e);
      if (shouldRejectPointerEvent(e)) {
        return;
      }
      if (tool !== 'select') {
        return;
      }
      if (isMultiTouchGesture(e)) {
        return;
      }

      const pointerPos = getPointerPosition(e);
      if (!pointerPos) {
        return;
      }

      const token = getResolvedToken(tokenId);
      if (!token) {
        return;
      }

      e.evt.stopPropagation();

      setTokenMouseDownStart({
        x: pointerPos.x,
        y: pointerPos.y,
        tokenId,
        stagePos: { x: token.x, y: token.y },
      });
      setIsDraggingWithThreshold(false);
    },
    [tool, shouldRejectPointerEvent, trackStylusUsage],
  );

  const handleTokenPointerMove = useCallback(
    // eslint-disable-next-line complexity
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): void => {
      if (shouldRejectPointerEvent(e)) {
        return;
      }
      if (!tokenMouseDownStart || tool !== 'select') {
        return;
      }
      if (isMultiTouchGesture(e)) {
        return;
      }

      const pointerPos = getPointerPosition(e);
      if (!pointerPos) {
        return;
      }

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

        if (!cacheDragGeometry(tokenIds, tokenId)) {
          return;
        }

        setDraggingTokenIds(new Set(tokenIds));
        setItemsForDuplication(tokenIds);

        if (!isWorldView) {
          tokenIds.forEach((id) => {
            const token = useGameStore.getState().tokensById[id];
            if (token) {
              queueSyncAction({
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
        queueDragMove(tokenId, newX, newY);

        const livePositions = [{ id: tokenId, x: newX, y: newY }];
        const snapPreviews: SnapPreview[] = [];
        const primarySize = dragSizeRef.current.get(tokenId);
        if (primarySize) {
          const snapped = snapToGrid(
            newX,
            newY,
            gridSize,
            gridType,
            primarySize.width,
            primarySize.height,
          );
          snapPreviews.push({ id: tokenId, x: snapped.x, y: snapped.y, size: primarySize.width });
        }

        const tokenIds = selectedIds.includes(tokenId) ? selectedIds : [tokenId];
        if (tokenIds.length > 1) {
          tokenIds.forEach((id) => {
            if (id === tokenId) {
              return;
            }
            const offset = dragStartOffsetsRef.current.get(id);
            if (!offset) {
              return;
            }
            const offsetX = newX + offset.x;
            const offsetY = newY + offset.y;
            dragPositionsRef.current.set(id, { x: offsetX, y: offsetY });
            queueDragMove(id, offsetX, offsetY);
            livePositions.push({ id, x: offsetX, y: offsetY });

            const otherSize = dragSizeRef.current.get(id);
            if (otherSize) {
              const snapped = snapToGrid(
                offsetX,
                offsetY,
                gridSize,
                gridType,
                otherSize.width,
                otherSize.height,
              );
              snapPreviews.push({ id, x: snapped.x, y: snapped.y, size: otherSize.width });
            }
          });
        }

        publishSnapPreviews(snapPreviews);
        applyTokenNodePositions(livePositions);
      }
    },
    [
      shouldRejectPointerEvent,
      tokenMouseDownStart,
      tool,
      isDraggingWithThreshold,
      selectedIds,
      setSelectedIds,
      gridSize,
      gridType,
      isWorldView,
      queueDragMove,
      cacheDragGeometry,
    ],
  );

  const handleTokenPointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): void => {
      if (!tokenMouseDownStart) {
        return;
      }

      const tokenId = tokenMouseDownStart.tokenId;
      const token = getResolvedToken(tokenId);

      if (!token) {
        setTokenMouseDownStart(null);
        setIsDraggingWithThreshold(false);
        clearSnapPreviews();
        return;
      }

      if (isDraggingWithThreshold) {
        const tokenIds = selectedIds.includes(tokenId) ? selectedIds : [tokenId];
        const dragPos = dragPositionsRef.current.get(tokenId);
        const primarySize = dragSizeRef.current.get(tokenId) ?? {
          width: gridSize * token.scale,
          height: gridSize * token.scale,
        };

        if (dragPos) {
          const snapped = snapToGrid(
            dragPos.x,
            dragPos.y,
            gridSize,
            gridType,
            primarySize.width,
            primarySize.height,
          );
          const committedPositions: Array<{ id: string; x: number; y: number }> = [];

          if (tokenIds.length > 1) {
            const offsetX = snapped.x - dragPos.x;
            const offsetY = snapped.y - dragPos.y;

            tokenIds.forEach((id) => {
              const size = dragSizeRef.current.get(id);
              const existing = useGameStore.getState().tokensById[id];
              if (!existing) {
                return;
              }
              const dragPosForToken = dragPositionsRef.current.get(id) ?? {
                x: existing.x,
                y: existing.y,
              };
              const newX = dragPosForToken.x + offsetX;
              const newY = dragPosForToken.y + offsetY;
              const snappedPos = snapToGrid(
                newX,
                newY,
                gridSize,
                gridType,
                size?.width ?? gridSize,
                size?.height ?? gridSize,
              );
              stampArchitectPrevTokenPosition(id, snappedPos.x, snappedPos.y);
              committedPositions.push({ id, x: snappedPos.x, y: snappedPos.y });
            });
          } else {
            stampArchitectPrevTokenPosition(tokenId, snapped.x, snapped.y);
            committedPositions.push({ id: tokenId, x: snapped.x, y: snapped.y });
          }

          updateTokenPositions(committedPositions);

          if (!isWorldView) {
            committedPositions.forEach((pos) => {
              queueSyncAction({
                type: 'TOKEN_DRAG_END',
                payload: pos,
              });
            });
            flushRafSync();
          }

          if (isAltPressed && !isWorldView) {
            committedPositions.forEach((pos) => {
              const source = getResolvedToken(pos.id);
              if (source) {
                addToken({ ...source, id: crypto.randomUUID(), x: pos.x, y: pos.y });
              }
            });
          }
        }

        tokenIds.forEach((id) => {
          dragPositionsRef.current.delete(id);
          dragStartOffsetsRef.current.delete(id);
          dragSizeRef.current.delete(id);
        });
        setDraggingTokenIds(new Set());
        setItemsForDuplication([]);
      } else {
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
      clearSnapPreviews();
    },
    [
      tokenMouseDownStart,
      isDraggingWithThreshold,
      selectedIds,
      gridSize,
      gridType,
      isWorldView,
      isAltPressed,
      updateTokenPositions,
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
    tokenLayerRef,
    isDragging: isDraggingWithThreshold,
  };
};
