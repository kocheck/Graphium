import { memo } from 'react';
import type { ReactElement, MutableRefObject } from 'react';

import { Group, Line, Rect } from 'react-konva';

import CanvasOverlayErrorBoundary from './CanvasOverlayErrorBoundary';
// eslint-disable-next-line import/no-named-as-default
import MeasurementOverlay from './MeasurementOverlay';
import MovementRangeOverlay from './MovementRangeOverlay';
import { resolveTokenData, DEFAULT_MOVEMENT_SPEED } from '../../hooks/useTokenData';
import { useGameStore } from '../../store/gameStore';
import { usePointerOverlayStore } from '../../store/pointerOverlayStore';
import { createGridGeometry } from '../../utils/gridGeometry';

import type { GridType } from '../../store/gameStore';
import type { Measurement } from '../../types/measurement';
import type Konva from 'konva';

interface DoorPreviewOverlayProps {
  tool: string;
  isWorldView: boolean;
  doorOrientation: 'horizontal' | 'vertical';
  gridSize: number;
}

function DoorPreviewOverlay({
  tool,
  isWorldView,
  doorOrientation,
  gridSize,
}: DoorPreviewOverlayProps): ReactElement | null {
  const doorPreviewPos = usePointerOverlayStore((s) => s.doorPreviewPos);
  if (!doorPreviewPos || tool !== 'door' || isWorldView) {
    return null;
  }
  return (
    <Rect
      x={doorPreviewPos.x - gridSize / 2}
      y={doorPreviewPos.y - gridSize / 2}
      width={doorOrientation === 'horizontal' ? gridSize : gridSize / 5}
      height={doorOrientation === 'horizontal' ? gridSize / 5 : gridSize}
      fill="rgba(255, 255, 255, 0.5)"
      stroke="white"
      strokeWidth={2}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

interface SnapPreviewOverlayProps {
  isDraggingToken: boolean;
  snapPreviewPositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  gridSize: number;
  gridType: GridType;
}

function SnapPreviewOverlay({
  isDraggingToken,
  snapPreviewPositionsRef,
  gridSize,
  gridType,
}: SnapPreviewOverlayProps): ReactElement | null {
  if (!isDraggingToken) {
    return null;
  }

  const { tokensById, campaign } = useGameStore.getState();
  const geometry = createGridGeometry(gridType);

  return (
    <Group listening={false}>
      {Array.from(snapPreviewPositionsRef.current.entries()).map(([tokenId, snapPos]) => {
        const raw = tokensById[tokenId];
        if (!raw) {
          return null;
        }
        const token = resolveTokenData(raw, campaign.tokenLibrary);
        const size = gridSize * token.scale;
        const snapCell = geometry.pixelToGrid(snapPos.x + size / 2, snapPos.y + size / 2, gridSize);
        const cellPoints = geometry.getCellVertices(snapCell, gridSize).flatMap((v) => [v.x, v.y]);
        return (
          <Group key={`snap-preview-${tokenId}`}>
            <Line
              points={cellPoints}
              stroke="rgba(37, 99, 235, 0.6)"
              strokeWidth={2}
              listening={false}
              perfectDrawEnabled={false}
              dash={[8, 4]}
              closed
            />
            <Line
              points={cellPoints}
              fill="rgba(37, 99, 235, 0.1)"
              listening={false}
              perfectDrawEnabled={false}
              closed
            />
          </Group>
        );
      })}
    </Group>
  );
}

interface IsolatedMovementRangeProps {
  selectedIds: string[];
  isMKeyPressed: boolean;
  isWorldView: boolean;
  gridSize: number;
  gridType: GridType;
  dragPositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
}

function IsolatedMovementRange({
  selectedIds,
  isMKeyPressed,
  isWorldView,
  gridSize,
  gridType,
  dragPositionsRef,
}: IsolatedMovementRangeProps): ReactElement | null {
  const tokenId = selectedIds.length === 1 ? selectedIds[0] : null;
  const token = useGameStore((s) => (tokenId ? s.tokensById[tokenId] : undefined));
  const tokenLibrary = useGameStore((s) => s.campaign.tokenLibrary);

  if (!isMKeyPressed || isWorldView || !tokenId || !token) {
    return null;
  }

  const resolved = resolveTokenData(token, tokenLibrary);
  const dragPos = dragPositionsRef.current.get(tokenId);
  const tokenPos = dragPos ?? { x: resolved.x, y: resolved.y };

  return (
    <CanvasOverlayErrorBoundary overlayName="MovementRangeOverlay">
      <MovementRangeOverlay
        tokenPosition={tokenPos}
        movementSpeed={resolved.movementSpeed ?? DEFAULT_MOVEMENT_SPEED}
        gridSize={gridSize}
        gridType={gridType}
      />
    </CanvasOverlayErrorBoundary>
  );
}

interface OverlayLayerProps {
  tool: string;
  isWorldView: boolean;
  doorOrientation: 'horizontal' | 'vertical';
  gridSize: number;
  gridType: GridType;
  isDraggingToken: boolean;
  snapPreviewPositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  selectedIds: string[];
  isMKeyPressed: boolean;
  dragPositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  selectionRect: { x: number; y: number; width: number; height: number; isVisible: boolean };
  selectionRectRef: MutableRefObject<Konva.Rect | null>;
  isCalibrating: boolean;
  calibrationRect: { x: number; y: number; width: number; height: number } | null;
  measurement: Measurement | null;
}

function OverlayLayerComponent({
  tool,
  isWorldView,
  doorOrientation,
  gridSize,
  gridType,
  isDraggingToken,
  snapPreviewPositionsRef,
  selectedIds,
  isMKeyPressed,
  dragPositionsRef,
  selectionRect,
  selectionRectRef,
  isCalibrating,
  calibrationRect,
  measurement,
}: OverlayLayerProps): ReactElement {
  return (
    <Group listening={false}>
      <DoorPreviewOverlay
        tool={tool}
        isWorldView={isWorldView}
        doorOrientation={doorOrientation}
        gridSize={gridSize}
      />
      <SnapPreviewOverlay
        isDraggingToken={isDraggingToken}
        snapPreviewPositionsRef={snapPreviewPositionsRef}
        gridSize={gridSize}
        gridType={gridType}
      />
      <IsolatedMovementRange
        selectedIds={selectedIds}
        isMKeyPressed={isMKeyPressed}
        isWorldView={isWorldView}
        gridSize={gridSize}
        gridType={gridType}
        dragPositionsRef={dragPositionsRef}
      />
      {selectionRect.isVisible && (
        <Rect
          ref={selectionRectRef}
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          fill="rgba(37, 99, 235, 0.3)"
          stroke="#2563eb"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {isCalibrating && calibrationRect && (
        <Rect
          x={calibrationRect.x}
          y={calibrationRect.y}
          width={calibrationRect.width}
          height={calibrationRect.height}
          fill="rgba(255, 0, 0, 0.2)"
          stroke="red"
          dash={[5, 5]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      <CanvasOverlayErrorBoundary overlayName="MeasurementOverlay">
        <MeasurementOverlay measurement={measurement} gridSize={gridSize} />
      </CanvasOverlayErrorBoundary>
    </Group>
  );
}

const OverlayLayer = memo(OverlayLayerComponent);
OverlayLayer.displayName = 'OverlayLayer';

export default OverlayLayer;
