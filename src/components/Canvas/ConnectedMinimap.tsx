import { memo, useMemo } from 'react';
import type { ReactElement } from 'react';

import Minimap from './Minimap';
import MinimapErrorBoundary from './MinimapErrorBoundary';
import { resolveTokenData } from '../../hooks/useTokenData';
import { useGameStore } from '../../store/gameStore';

interface ConnectedMinimapProps {
  position: { x: number; y: number };
  scale: number;
  viewportSize: { width: number; height: number };
  onNavigate: (worldX: number, worldY: number) => void;
}

function ConnectedMinimapComponent({
  position,
  scale,
  viewportSize,
  onNavigate,
}: ConnectedMinimapProps): ReactElement {
  const map = useGameStore((s) => s.map);
  const tokens = useGameStore((s) => s.tokens);
  const tokenLibrary = useGameStore((s) => s.campaign.tokenLibrary);

  const resolved = useMemo(
    () => tokens.map((token) => resolveTokenData(token, tokenLibrary)),
    [tokens, tokenLibrary],
  );

  return (
    <MinimapErrorBoundary>
      <Minimap
        position={position}
        scale={scale}
        viewportSize={viewportSize}
        map={map}
        tokens={resolved}
        onNavigate={onNavigate}
      />
    </MinimapErrorBoundary>
  );
}

const ConnectedMinimap = memo(ConnectedMinimapComponent);
ConnectedMinimap.displayName = 'ConnectedMinimap';

export default ConnectedMinimap;
