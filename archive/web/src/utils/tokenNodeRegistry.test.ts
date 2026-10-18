import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyTokenNodePosition,
  applyTokenNodePositions,
  clearTokenNodeRegistry,
  registerTokenLayer,
  registerTokenNode,
} from './tokenNodeRegistry';

describe('tokenNodeRegistry', () => {
  afterEach(() => {
    clearTokenNodeRegistry();
  });

  it('mutates registered Konva nodes without touching the store', () => {
    const node = { x: vi.fn(), y: vi.fn() };
    const layer = { batchDraw: vi.fn() };
    registerTokenNode('t1', node as never, 12);
    registerTokenLayer(layer as never);

    expect(applyTokenNodePosition('t1', 40, 50)).toBe(true);
    expect(node.x).toHaveBeenCalledWith(40);
    expect(node.y).toHaveBeenCalledWith(62);
    expect(layer.batchDraw).toHaveBeenCalledTimes(1);
  });

  it('applies a batch of positions with one batchDraw', () => {
    const nodeA = { x: vi.fn(), y: vi.fn() };
    const nodeB = { x: vi.fn(), y: vi.fn() };
    const layer = { batchDraw: vi.fn() };
    registerTokenNode('a', nodeA as never);
    registerTokenNode('b', nodeB as never);
    registerTokenLayer(layer as never);

    applyTokenNodePositions([
      { id: 'a', x: 1, y: 2 },
      { id: 'b', x: 3, y: 4 },
    ]);

    expect(nodeA.x).toHaveBeenCalledWith(1);
    expect(nodeB.x).toHaveBeenCalledWith(3);
    expect(layer.batchDraw).toHaveBeenCalledTimes(1);
  });

  it('returns false when the node is not registered', () => {
    expect(applyTokenNodePosition('missing', 0, 0)).toBe(false);
  });
});
