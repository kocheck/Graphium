import { memo, useCallback } from 'react';
import type { MutableRefObject, ReactElement } from 'react';

import { Line } from 'react-konva';

import PressureSensitiveLine from './PressureSensitiveLine';
import StairsLayer from './StairsLayer';

import type { Drawing, Stairs } from '../../store/gameStore';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

interface DrawingLayerProps {
  drawings: Drawing[];
  stairs: Stairs[];
  tool: string;
  selectedIds: string[];
  isWorldView: boolean;
  isAltPressed: boolean;
  itemsForDuplication: string[];
  tempLine: Drawing | null;
  tempLineRef: MutableRefObject<Konva.Line | null>;
  pressureRange: { min: number; max: number };
  onSelectIds: (ids: string[]) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

function DrawingLine({
  line,
  tool,
  isWorldView,
  pressureRange,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  line: Drawing;
  tool: string;
  isWorldView: boolean;
  pressureRange: { min: number; max: number };
  onClick: (e: KonvaEventObject<MouseEvent>, line: Drawing) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}): ReactElement {
  const commonProps = {
    id: line.id,
    name: 'drawing' as const,
    points: line.points,
    x: line.x ?? 0,
    y: line.y ?? 0,
    scaleX: line.scale ?? 1,
    scaleY: line.scale ?? 1,
    stroke: line.tool === 'wall' && isWorldView ? '#000000' : line.color,
    strokeWidth: line.tool === 'wall' && isWorldView ? 6 : line.size,
    lineCap: 'round' as const,
    opacity: 1,
    globalCompositeOperation:
      line.tool === 'eraser' ? ('destination-out' as const) : ('source-over' as const),
    draggable: tool === 'select' && line.tool !== 'wall',
    listening: line.tool !== 'wall',
    perfectDrawEnabled: false,
  };

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => onClick(e, line),
    [onClick, line],
  );
  const handleDragStart = useCallback(() => onDragStart(line.id), [onDragStart, line.id]);
  const handleDragEnd = useCallback(
    (e: KonvaEventObject<MouseEvent | DragEvent>) => {
      const node = e.target;
      onDragEnd(line.id, node.x(), node.y());
    },
    [onDragEnd, line.id],
  );

  const hasPressureData = line.pressures && line.pressures.length > 0;
  if (hasPressureData) {
    return (
      <PressureSensitiveLine
        {...commonProps}
        onClick={handleClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        pressures={line.pressures}
        pressureRange={pressureRange}
      />
    );
  }

  return (
    <Line
      {...commonProps}
      tension={0.5}
      dash={line.tool === 'wall' ? [10, 5] : undefined}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    />
  );
}

const MemoDrawingLine = memo(DrawingLine);
MemoDrawingLine.displayName = 'DrawingLine';

function DrawingLayerComponent({
  drawings,
  stairs,
  tool,
  selectedIds,
  isWorldView,
  isAltPressed,
  itemsForDuplication,
  tempLine,
  tempLineRef,
  pressureRange,
  onSelectIds,
  onDragStart,
  onDragEnd,
}: DrawingLayerProps): ReactElement {
  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>, line: Drawing) => {
      if (tool !== 'select' || line.tool === 'wall') {
        return;
      }
      e.evt.stopPropagation();
      if (e.evt.shiftKey) {
        if (selectedIds.includes(line.id)) {
          onSelectIds(selectedIds.filter((id) => id !== line.id));
        } else {
          onSelectIds([...selectedIds, line.id]);
        }
      } else {
        onSelectIds([line.id]);
      }
    },
    [tool, selectedIds, onSelectIds],
  );

  return (
    <>
      {isAltPressed &&
        drawings
          .filter((d) => itemsForDuplication.includes(d.id))
          .map((ghostLine) => (
            <Line
              key={`ghost-${ghostLine.id}`}
              id={`ghost-${ghostLine.id}`}
              name="ghost-drawing"
              points={ghostLine.points}
              stroke={ghostLine.color}
              strokeWidth={ghostLine.size}
              tension={0.5}
              lineCap="round"
              dash={ghostLine.tool === 'wall' ? [10, 5] : undefined}
              opacity={0.5}
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}

      {drawings.map((line) => (
        <MemoDrawingLine
          key={line.id}
          line={line}
          tool={tool}
          isWorldView={isWorldView}
          pressureRange={pressureRange}
          onClick={handleClick}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}

      {tempLine && (
        <Line
          ref={tempLineRef}
          points={tempLine.points}
          stroke={tempLine.color}
          strokeWidth={tempLine.size}
          tension={0.5}
          lineCap="round"
          dash={tempLine.tool === 'wall' ? [10, 5] : undefined}
          opacity={1}
          listening={false}
          perfectDrawEnabled={false}
          globalCompositeOperation={tempLine.tool === 'eraser' ? 'destination-out' : 'source-over'}
        />
      )}

      <StairsLayer stairs={stairs} isWorldView={isWorldView} />
    </>
  );
}

const DrawingLayer = memo(DrawingLayerComponent);
DrawingLayer.displayName = 'DrawingLayer';

export default DrawingLayer;
