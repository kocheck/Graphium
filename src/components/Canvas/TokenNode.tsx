import { memo, useMemo } from 'react';
import type { ReactElement } from 'react';

import { Group, Text, Circle } from 'react-konva';

import TokenErrorBoundary from './TokenErrorBoundary';
import URLImage from './URLImage';
import { resolveTokenData } from '../../hooks/useTokenData';
import { useGameStore } from '../../store/gameStore';
import { usePointerOverlayStore } from '../../store/pointerOverlayStore';
import { useVisionStore } from '../../store/visionStore';
import { isRectInAnyPolygon } from '../../types/geometry';
import { registerTokenNode } from '../../utils/tokenNodeRegistry';

import type { TokenLibraryItem } from '../../store/gameStore';
import type { KonvaEventObject } from 'konva/lib/Node';

interface TokenNodeProps {
  tokenId: string;
  tokenLibrary: TokenLibraryItem[];
  gridSize: number;
  gridType: string;
  isWorldView: boolean;
  isDaylightMode: boolean;
  tool: string;
  isSelected: boolean;
  isDragging: boolean;
  dragPos: { x: number; y: number } | undefined;
  textColor: string;
  onSelect: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>, tokenId: string) => void;
  onHover: (tokenId: string | null) => void;
  onShowToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

function isNpcHiddenByFog(args: {
  isWorldView: boolean;
  isDaylightMode: boolean;
  type: string | undefined;
  displayX: number;
  displayY: number;
  size: number;
  visionPolygons: Array<Array<{ x: number; y: number }>>;
}): boolean {
  if (!args.isWorldView || args.isDaylightMode || args.type !== 'NPC') {
    return false;
  }
  return !isRectInAnyPolygon(
    args.displayX,
    args.displayY,
    args.size,
    args.size,
    args.visionPolygons,
  );
}

function tokenVisualProps(isDragging: boolean, isHovered: boolean): Record<string, unknown> {
  const base = { shadowForStrokeEnabled: false };
  if (isDragging) {
    return {
      ...base,
      opacity: 0.5,
      scaleX: 1.05,
      scaleY: 1.05,
      shadowColor: 'rgba(0, 0, 0, 0.6)',
      shadowBlur: 20,
      shadowOffsetX: 5,
      shadowOffsetY: 5,
    };
  }
  if (isHovered) {
    return {
      ...base,
      scaleX: 1.02,
      scaleY: 1.02,
      shadowColor: 'rgba(0, 0, 0, 0.4)',
      shadowBlur: 12,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
    };
  }
  return { ...base, scaleX: 1, scaleY: 1 };
}

function TokenNodeComponent({
  tokenId,
  tokenLibrary,
  gridSize,
  gridType,
  isWorldView,
  isDaylightMode,
  tool,
  isSelected,
  isDragging,
  dragPos,
  textColor,
  onSelect,
  onHover,
  onShowToast,
}: TokenNodeProps): ReactElement | null {
  const token = useGameStore((s) => s.tokensById[tokenId]);
  const isHovered = usePointerOverlayStore((s) => s.hoveredTokenId === tokenId);
  const visionPolygons = useVisionStore((s) => s.polygons);

  const resolved = useMemo(
    () => (token ? resolveTokenData(token, tokenLibrary) : null),
    [token, tokenLibrary],
  );

  if (!token || !resolved) {
    return null;
  }

  const displayX = dragPos ? dragPos.x : resolved.x;
  const displayY = dragPos ? dragPos.y : resolved.y;
  const safeScale = resolved.scale || 1;
  const tokenHeight = gridSize * safeScale;
  const displayYOffset = gridType === 'ISOMETRIC' ? -(tokenHeight / 2) : 0;
  const finalDisplayY = displayY + displayYOffset;

  if (
    isNpcHiddenByFog({
      isWorldView,
      isDaylightMode,
      type: resolved.type,
      displayX,
      displayY,
      size: gridSize * safeScale,
      visionPolygons,
    })
  ) {
    return null;
  }

  const visualProps = tokenVisualProps(isDragging, isHovered && tool === 'select' && !isDragging);

  return (
    <Group>
      <TokenErrorBoundary tokenId={token.id} onShowToast={onShowToast}>
        <URLImage
          ref={(node) => {
            registerTokenNode(token.id, node, displayYOffset);
          }}
          name="token"
          id={token.id}
          src={resolved.src}
          x={displayX}
          y={finalDisplayY}
          width={gridSize * safeScale}
          height={tokenHeight}
          draggable={false}
          listening
          perfectDrawEnabled={false}
          {...visualProps}
          onSelect={(e) => onSelect(e, token.id)}
          onMouseEnter={() => tool === 'select' && onHover(token.id)}
          onMouseLeave={() => tool === 'select' && onHover(null)}
        />
        {isSelected && !isDragging && (
          <Circle
            x={displayX + (gridSize * safeScale) / 2}
            y={finalDisplayY + (gridSize * safeScale) / 2}
            radius={(gridSize * safeScale) / 2 + 2}
            stroke="#2563eb"
            strokeWidth={3}
            shadowColor="#2563eb"
            shadowBlur={8}
            shadowEnabled
            listening={false}
            perfectDrawEnabled={false}
            dash={[8, 4]}
          />
        )}
      </TokenErrorBoundary>
      {resolved.name && (
        <Text
          text={resolved.name}
          fontSize={12}
          fontFamily="IBM Plex Sans, sans-serif"
          fill={textColor}
          fontStyle="bold"
          align="center"
          verticalAlign="middle"
          width={gridSize * safeScale * 2}
          x={displayX - (gridSize * safeScale) / 2}
          y={displayY + gridSize * safeScale + 8}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}

const TokenNode = memo(TokenNodeComponent);
TokenNode.displayName = 'TokenNode';

export default TokenNode;
