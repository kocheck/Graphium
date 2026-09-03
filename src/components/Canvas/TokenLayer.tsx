import { memo } from 'react';
import type { ReactElement } from 'react';

import { Group } from 'react-konva';
import { useShallow } from 'zustand/shallow';

import TokenNode from './TokenNode';
import URLImage from './URLImage';
import { getResolvedToken } from '../../hooks/useTokenData';
import { useGameStore } from '../../store/gameStore';

import type { TokenLibraryItem } from '../../store/gameStore';
import type { KonvaEventObject } from 'konva/lib/Node';

interface TokenLayerProps {
  tokenLibrary: TokenLibraryItem[];
  gridSize: number;
  gridType: string;
  isWorldView: boolean;
  isDaylightMode: boolean;
  tool: string;
  selectedIds: string[];
  draggingTokenIds: Set<string>;
  dragPositions: Map<string, { x: number; y: number }>;
  ghostTokenIds: string[];
  showGhosts: boolean;
  textColor: string;
  onSelect: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>, tokenId: string) => void;
  onHover: (tokenId: string | null) => void;
  onShowToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

function TokenLayerComponent({
  tokenLibrary,
  gridSize,
  gridType,
  isWorldView,
  isDaylightMode,
  tool,
  selectedIds,
  draggingTokenIds,
  dragPositions,
  ghostTokenIds,
  showGhosts,
  textColor,
  onSelect,
  onHover,
  onShowToast,
}: TokenLayerProps): ReactElement {
  const tokenIds = useGameStore(
    useShallow((s) => {
      const ids = s.tokens.map((token) => token.id);
      if (gridType !== 'ISOMETRIC') {
        return ids;
      }
      return [...ids].sort((a, b) => (s.tokensById[a]?.y ?? 0) - (s.tokensById[b]?.y ?? 0));
    }),
  );

  return (
    <Group>
      {showGhosts &&
        ghostTokenIds.map((ghostId) => {
          const ghostToken = getResolvedToken(ghostId);
          if (!ghostToken) {
            return null;
          }
          return (
            <URLImage
              key={`ghost-${ghostToken.id}`}
              id={`ghost-${ghostToken.id}`}
              src={ghostToken.src}
              x={ghostToken.x}
              y={ghostToken.y}
              width={gridSize * ghostToken.scale}
              height={gridSize * ghostToken.scale}
              scaleX={1}
              scaleY={1}
              draggable={false}
              listening={false}
              opacity={0.5}
              name="ghost-token"
              onSelect={() => undefined}
            />
          );
        })}
      {tokenIds.map((tokenId) => (
        <TokenNode
          key={tokenId}
          tokenId={tokenId}
          tokenLibrary={tokenLibrary}
          gridSize={gridSize}
          gridType={gridType}
          isWorldView={isWorldView}
          isDaylightMode={isDaylightMode}
          tool={tool}
          isSelected={selectedIds.includes(tokenId)}
          isDragging={draggingTokenIds.has(tokenId)}
          dragPos={dragPositions.get(tokenId)}
          textColor={textColor}
          onSelect={onSelect}
          onHover={onHover}
          onShowToast={onShowToast}
        />
      ))}
    </Group>
  );
}

const TokenLayer = memo(TokenLayerComponent);
TokenLayer.displayName = 'TokenLayer';

export default TokenLayer;
