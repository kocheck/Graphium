/**
 * Helpers that keep World → Architect sync scoped to token positions.
 * Intentionally free of store/React imports so Electron main can use them.
 */

interface TokenPositionChanges {
  x?: number;
  y?: number;
}

export type WorldToArchitectAction =
  | { type: 'TOKEN_UPDATE'; payload: { id: string; changes: TokenPositionChanges } }
  | { type: 'BATCH'; payload: Array<Extract<WorldToArchitectAction, { type: 'TOKEN_UPDATE' }>> };

/** Keeps only numeric x/y fields from a token change payload. */
export function pickTokenPositionChanges(
  changes: Partial<{ x: number; y: number }> | Record<string, unknown> | null | undefined,
): TokenPositionChanges {
  if (!changes || typeof changes !== 'object') {
    return {};
  }

  const next: TokenPositionChanges = {};
  if (typeof changes['x'] === 'number' && Number.isFinite(changes['x'])) {
    next.x = changes['x'];
  }
  if (typeof changes['y'] === 'number' && Number.isFinite(changes['y'])) {
    next.y = changes['y'];
  }
  return next;
}

function sanitizeTokenUpdateAction(
  action: unknown,
): Extract<WorldToArchitectAction, { type: 'TOKEN_UPDATE' }> | null {
  if (!action || typeof action !== 'object') {
    return null;
  }
  const candidate = action as { type?: unknown; payload?: unknown };
  if (
    candidate.type !== 'TOKEN_UPDATE' ||
    !candidate.payload ||
    typeof candidate.payload !== 'object'
  ) {
    return null;
  }

  const payload = candidate.payload as { id?: unknown; changes?: unknown };
  if (typeof payload.id !== 'string' || payload.id.length === 0) {
    return null;
  }

  const changes = pickTokenPositionChanges(
    payload.changes as Partial<{ x: number; y: number }> | Record<string, unknown> | undefined,
  );
  if (changes.x === undefined && changes.y === undefined) {
    return null;
  }

  return {
    type: 'TOKEN_UPDATE',
    payload: { id: payload.id, changes },
  };
}

/**
 * Validates World → Architect sync payloads.
 * Allows TOKEN_UPDATE (x/y only) or a single-level BATCH of those updates.
 */
export function sanitizeWorldToArchitectAction(action: unknown): WorldToArchitectAction | null {
  if (!action || typeof action !== 'object') {
    return null;
  }

  const candidate = action as { type?: unknown; payload?: unknown };
  if (candidate.type === 'TOKEN_UPDATE') {
    return sanitizeTokenUpdateAction(action);
  }

  if (candidate.type !== 'BATCH' || !Array.isArray(candidate.payload)) {
    return null;
  }

  const updates: Array<Extract<WorldToArchitectAction, { type: 'TOKEN_UPDATE' }>> = [];
  for (const inner of candidate.payload) {
    const sanitized = sanitizeTokenUpdateAction(inner);
    if (sanitized) {
      updates.push(sanitized);
    }
  }

  if (updates.length === 0) {
    return null;
  }
  if (updates.length === 1) {
    return updates[0] ?? null;
  }
  return { type: 'BATCH', payload: updates };
}
