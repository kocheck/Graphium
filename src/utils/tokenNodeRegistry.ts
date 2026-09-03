import type Konva from 'konva';

const nodes = new Map<string, Konva.Node>();
const isometricOffsets = new Map<string, number>();
let tokenLayer: Konva.Layer | null = null;

export function registerTokenNode(id: string, node: Konva.Node | null, isometricOffset = 0): void {
  if (node) {
    nodes.set(id, node);
    isometricOffsets.set(id, isometricOffset);
  } else {
    nodes.delete(id);
    isometricOffsets.delete(id);
  }
}

export function registerTokenLayer(layer: Konva.Layer | null): void {
  tokenLayer = layer;
}

// eslint-disable-next-line import/no-unused-modules -- used by unit tests
export function applyTokenNodePosition(id: string, x: number, y: number): boolean {
  if (!nodes.has(id)) {
    return false;
  }
  applyTokenNodePositions([{ id, x, y }]);
  return true;
}

export function applyTokenNodePositions(
  positions: Array<{ id: string; x: number; y: number }>,
): void {
  let applied = false;
  for (const pos of positions) {
    const node = nodes.get(pos.id);
    if (!node) {
      continue;
    }
    const offset = isometricOffsets.get(pos.id) ?? 0;
    node.x(pos.x);
    node.y(pos.y + offset);
    applied = true;
  }
  if (applied) {
    tokenLayer?.batchDraw();
  }
}

// eslint-disable-next-line import/no-unused-modules -- used by unit tests
export function clearTokenNodeRegistry(): void {
  nodes.clear();
  isometricOffsets.clear();
  tokenLayer = null;
}
