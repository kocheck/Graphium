import type { SyncAction } from './syncUtils';

type SendFn = (action: SyncAction) => void;

const pendingMoves = new Map<string, { id: string; x: number; y: number }>();
const pendingActions: SyncAction[] = [];
let sendFn: SendFn | null = null;
let rafHandle = 0;

function flush(): void {
  rafHandle = 0;
  const send = sendFn;
  if (!send) {
    pendingMoves.clear();
    pendingActions.length = 0;
    return;
  }

  if (pendingMoves.size === 1) {
    const only = pendingMoves.values().next().value;
    if (only) {
      send({ type: 'TOKEN_DRAG_MOVE', payload: only });
    }
  } else if (pendingMoves.size > 1) {
    send({ type: 'TOKEN_DRAG_MOVE_BATCH', payload: Array.from(pendingMoves.values()) });
  }
  pendingMoves.clear();

  const actions = pendingActions.splice(0, pendingActions.length);
  for (const action of actions) {
    send(action);
  }
}

function schedule(): void {
  if (rafHandle !== 0) {
    return;
  }
  rafHandle = requestAnimationFrame(flush);
}

export function setRafSyncSender(fn: SendFn | null): void {
  sendFn = fn;
  if (!fn && rafHandle !== 0) {
    cancelAnimationFrame(rafHandle);
    rafHandle = 0;
    pendingMoves.clear();
    pendingActions.length = 0;
  }
}

export function queueSyncAction(action: SyncAction): void {
  if (action.type === 'TOKEN_DRAG_MOVE') {
    pendingMoves.set(action.payload.id, action.payload);
    schedule();
    return;
  }
  if (action.type === 'TOKEN_DRAG_MOVE_BATCH') {
    for (const item of action.payload) {
      pendingMoves.set(item.id, item);
    }
    schedule();
    return;
  }
  pendingActions.push(action);
  schedule();
}

export function flushRafSync(): void {
  if (rafHandle !== 0) {
    cancelAnimationFrame(rafHandle);
  }
  flush();
}
