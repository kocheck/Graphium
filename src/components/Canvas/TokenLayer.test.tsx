import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TokenLayer from './TokenLayer';
import { useGameStore } from '../../store/gameStore';
import { withTokenIndex } from '../../utils/tokenIndex';

const tokenNodeRenders: string[] = [];

vi.mock('./TokenNode', () => ({
  default: ({ tokenId }: { tokenId: string }) => {
    tokenNodeRenders.push(tokenId);
    return null;
  },
}));

vi.mock('./URLImage', () => ({
  default: () => null,
}));

describe('TokenLayer', () => {
  beforeEach(() => {
    tokenNodeRenders.length = 0;
    useGameStore.setState({
      ...withTokenIndex([
        { id: 't1', x: 0, y: 0, src: 'a.png' },
        { id: 't2', x: 50, y: 50, src: 'b.png' },
      ]),
      campaign: {
        ...useGameStore.getState().campaign,
        tokenLibrary: [],
      },
    });
  });

  it('renders one node per token id and does not remount siblings after a position patch', () => {
    const props = {
      tokenLibrary: [],
      gridSize: 50,
      gridType: 'LINES',
      isWorldView: false,
      isDaylightMode: true,
      tool: 'select',
      selectedIds: [] as string[],
      draggingTokenIds: new Set<string>(),
      dragPositions: new Map<string, { x: number; y: number }>(),
      ghostTokenIds: [] as string[],
      showGhosts: false,
      textColor: '#fff',
      onSelect: vi.fn(),
      onHover: vi.fn(),
      onShowToast: vi.fn(),
    };

    const { rerender } = render(<TokenLayer {...props} />);
    expect(tokenNodeRenders).toEqual(['t1', 't2']);

    tokenNodeRenders.length = 0;
    useGameStore.getState().updateTokenPosition('t1', 80, 90);
    rerender(<TokenLayer {...props} />);

    expect(useGameStore.getState().tokensById.t1?.x).toBe(80);
    // Id list is unchanged, so the memoized layer should not remount every token.
    expect(tokenNodeRenders).toEqual([]);
  });
});
