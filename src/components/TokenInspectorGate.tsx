import type { JSX } from 'react';

import { useShallow } from 'zustand/shallow';

import TokenInspector from './TokenInspector';
import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';

/** Renders TokenInspector for the selected tokens that still exist; App no longer subscribes. */
export default function TokenInspectorGate(): JSX.Element | null {
  const selectedTokenIds = useUiStore((state) => state.selectedTokenIds);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const selectedTokensOnly = useGameStore(
    useShallow((state) => selectedTokenIds.filter((id) => Boolean(state.tokensById[id]))),
  );
  if (selectedTokensOnly.length === 0) {
    return null;
  }
  return <TokenInspector selectedTokenIds={selectedTokensOnly} onClose={clearSelection} />;
}
