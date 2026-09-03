import type { SyncableGameState } from './syncUtils';
import type { Token } from '../store/gameStore';

type StampFn = (id: string, x: number, y: number) => void;

let stampArchitectPrev: StampFn | null = null;
let inboundApplyDepth = 0;

export function registerArchitectPrevStamper(fn: StampFn | null): void {
  stampArchitectPrev = fn;
}

export function stampArchitectPrevTokenPosition(id: string, x: number, y: number): void {
  stampArchitectPrev?.(id, x, y);
}

export function stampTokenPositionsOnSnapshot(
  snapshot: SyncableGameState | null,
  updates: Array<{ id: string; x: number; y: number }>,
): void {
  if (!snapshot) {
    return;
  }
  const byId = new Map(updates.map((item) => [item.id, item]));
  snapshot.tokens = snapshot.tokens.map((token) => {
    const update = byId.get(token.id);
    return update ? ({ ...token, x: update.x, y: update.y } satisfies Token) : token;
  });
}

export function beginInboundApply(): void {
  inboundApplyDepth += 1;
}

export function endInboundApply(): void {
  inboundApplyDepth = Math.max(0, inboundApplyDepth - 1);
}

export function isInboundApply(): boolean {
  return inboundApplyDepth > 0;
}
