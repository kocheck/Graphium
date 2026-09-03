/**
 * Lightweight process-wide counters for the Resource Monitor.
 * Avoids JSON.stringify and store writes on the render/sync hot path.
 */

interface PerfSnapshot {
  fowRecalcCount: number;
  canvasCommitMs: number;
  ipcActionsByType: Record<string, number>;
}

let fowRecalcCount = 0;
let canvasCommitMs = 0;
const ipcActionsByType: Record<string, number> = {};

export function recordFowRecalc(count = 1): void {
  fowRecalcCount += count;
}

export function recordCanvasCommit(ms: number): void {
  canvasCommitMs = ms;
}

export function recordIpcAction(type: string): void {
  ipcActionsByType[type] = (ipcActionsByType[type] ?? 0) + 1;
}

export function consumePerfSnapshot(): PerfSnapshot {
  const snapshot: PerfSnapshot = {
    fowRecalcCount,
    canvasCommitMs,
    ipcActionsByType: { ...ipcActionsByType },
  };
  fowRecalcCount = 0;
  for (const key of Object.keys(ipcActionsByType)) {
    delete ipcActionsByType[key];
  }
  return snapshot;
}

/** Rough byte size without JSON.stringify of the full payload. */
export function estimatePayloadBytes(value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'string') {
    return value.length;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return 8;
  }
  if (Array.isArray(value)) {
    let total = 8;
    for (const item of value) {
      total += estimatePayloadBytes(item);
    }
    return total;
  }
  if (typeof value === 'object') {
    let total = 8;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      total += key.length + estimatePayloadBytes(nested);
    }
    return total;
  }
  return 8;
}
