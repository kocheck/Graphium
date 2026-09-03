import { describe, expect, it } from 'vitest';

import { computeHiddenNpcIds, getFogBounds } from './fogVisibility';
import { indexTokenLibrary } from '../hooks/useTokenData';

import type { Token } from '../store/gameStore';

describe('fogVisibility', () => {
  it('uses map bounds when a map is present', () => {
    expect(
      getFogBounds({
        src: 'map.png',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        scale: 2,
      }),
    ).toEqual({ x: 10, y: 20, width: 200, height: 100 });
  });

  it('returns a stable world AABB when no map is uploaded', () => {
    expect(getFogBounds(null)).toBe(getFogBounds(null));
  });

  it('hides NPCs that sit outside every vision polygon', () => {
    const tokens: Token[] = [
      { id: 'pc', x: 0, y: 0, src: 'pc.png', type: 'PC' },
      { id: 'seen', x: 10, y: 10, src: 'npc.png', type: 'NPC' },
      { id: 'hidden', x: 400, y: 400, src: 'npc.png', type: 'NPC' },
    ];
    const polygon = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ];
    const hidden = computeHiddenNpcIds(tokens, indexTokenLibrary([]), [polygon], 50);
    expect(hidden.has('seen')).toBe(false);
    expect(hidden.has('hidden')).toBe(true);
    expect(hidden.has('pc')).toBe(false);
  });
});
