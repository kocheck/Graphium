import { memo, useMemo } from 'react';
import type { ReactElement } from 'react';

import { Group, Text, Circle } from 'react-konva';

import TokenErrorBoundary from './TokenErrorBoundary';
import URLImage from './URLImage';
import { resolveTokenData } from '../../hooks/useTokenData';
import { useGameStore } from '../../store/gameStore';
import { usePointerOverlayStore } from '../../store/pointerOverlayStore';
import { useVisionStore } from '../../store/visionStore';
import { registerTokenNode } from '../../utils/tokenNodeRegistry';
import { isTokenInViewport } from '../../utils/viewportCulling';

import type { URLImageProps } from './URLImage';
import type { TokenLibraryItem } from '../../store/gameStore';
import type { ViewportBounds } from '../../utils/viewportCulling';
import type { KonvaEventObject } from 'konva/lib/Node';

interface TokenNodeProps {
  tokenId: string;
  tokenLibrary: TokenLibraryItem[];
  gridSize: number;
  gridType: string;
  tool: string;
  isSelected: boolean;
  isDragging: boolean;
  dragPos: { x: number; y: number } | undefined;
  textColor: string;
  visibleBounds: ViewportBounds;
  onSelect: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>, tokenId: string) => void;
  onHover: (tokenId: string | null) => void;
  onShowToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

const TOKEN_VISUAL_IDLE: Pick<URLImageProps, 'shadowForStrokeEnabled' | 'scaleX' | 'scaleY'> = {
  shadowForStrokeEnabled: false,
  scaleX: 1,
  scaleY: 1,
};

const TOKEN_VISUAL_DRAGGING: Pick<
  URLImageProps,
  | 'shadowForStrokeEnabled'
  | 'opacity'
  | 'scaleX'
  | 'scaleY'
  | 'shadowColor'
  | 'shadowBlur'
  | 'shadowOffsetX'
  | 'shadowOffsetY'
> = {
  shadowForStrokeEnabled: false,
  opacity: 0.5,
  scaleX: 1.05,
  scaleY: 1.05,
  shadowColor: 'rgba(0, 0, 0, 0.6)',
  shadowBlur: 20,
  shadowOffsetX: 5,
  shadowOffsetY: 5,
};

const TOKEN_VISUAL_HOVERED: Pick<
  URLImageProps,
  | 'shadowForStrokeEnabled'
  | 'scaleX'
  | 'scaleY'
  | 'shadowColor'
  | 'shadowBlur'
  | 'shadowOffsetX'
  | 'shadowOffsetY'
> = {
  shadowForStrokeEnabled: false,
  scaleX: 1.02,
  scaleY: 1.02,
  shadowColor: 'rgba(0, 0, 0, 0.4)',
  shadowBlur: 12,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
};

function tokenVisualProps(
  isDragging: boolean,
  isHovered: boolean,
): Pick<
  URLImageProps,
  | 'shadowForStrokeEnabled'
  | 'opacity'
  | 'scaleX'
  | 'scaleY'
  | 'shadowColor'
  | 'shadowBlur'
  | 'shadowOffsetX'
  | 'shadowOffsetY'
> {
  if (isDragging) {
    return TOKEN_VISUAL_DRAGGING;
  }
  if (isHovered) {
    return TOKEN_VISUAL_HOVERED;
  }
  return TOKEN_VISUAL_IDLE;
}

function TokenNodeComponent({
  tokenId,
  tokenLibrary,
  gridSize,
  gridType,
  tool,
  isSelected,
  isDragging,
  dragPos,
  textColor,
  visibleBounds,
  onSelect,
  onHover,
  onShowToast,
}: TokenNodeProps): ReactElement | null {
  const token = useGameStore((s) => s.tokensById[tokenId]);
  const isHovered = usePointerOverlayStore((s) => s.hoveredTokenId === tokenId);
  const hiddenByFog = useVisionStore((s) => s.hiddenTokenIds.has(tokenId));

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
  const tokenSize = gridSize * safeScale;
  const tokenHeight = tokenSize;
  const displayYOffset = gridType === 'ISOMETRIC' ? -(tokenHeight / 2) : 0;
  const finalDisplayY = displayY + displayYOffset;

  if (hiddenByFog) {
    return null;
  }

  if (
    !isDragging &&
    !isTokenInViewport(displayX, displayY, tokenSize, visibleBounds, gridSize * 2)
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
          width={tokenSize}
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
            x={displayX + tokenSize / 2}
            y={finalDisplayY + tokenSize / 2}
            radius={tokenSize / 2 + 2}
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
          width={tokenSize * 2}
          x={displayX - tokenSize / 2}
          y={displayY + tokenSize + 8}
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
