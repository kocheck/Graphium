import { sanitizeStack } from './errorSanitizer';
import { emptySessionConsoleRuntime } from '../types/sessionConsole';

import type {
  Token,
  Drawing,
  Door,
  MapConfig,
  Stairs,
  GridType,
  ExploredRegion,
  TokenLibraryItem,
  GameState,
} from '../store/gameStore';
import type { Measurement } from '../types/measurement';
import type { SessionConsoleRuntime } from '../types/sessionConsole';

function isEqualDate(obj1: unknown, obj2: unknown): boolean | undefined {
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }
  if (obj1 instanceof Date || obj2 instanceof Date) {
    return false;
  }
  return undefined;
}

function isEqualArray(obj1: unknown, obj2: unknown): boolean | undefined {
  if (!Array.isArray(obj1) || !Array.isArray(obj2)) {
    if (Array.isArray(obj1) || Array.isArray(obj2)) {
      return false;
    }
    return undefined;
  }
  if (obj1.length !== obj2.length) {
    return false;
  }
  for (let i = 0; i < obj1.length; i++) {
    if (!isEqual(obj1[i], obj2[i])) {
      return false;
    }
  }
  return true;
}

function isEqualObject(obj1: object, obj2: object): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) {
    return false;
  }

  const keys2Set = new Set(keys2);
  for (const key of keys1) {
    if (!keys2Set.has(key)) {
      return false;
    }
    if (!isEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Deep equality for primitives, arrays, plain objects, and Date values
 * used by campaign/sync payloads.
 */
// eslint-disable-next-line import/no-unused-modules -- covered by syncUtils unit tests
export function isEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) {
    return true;
  }
  if (obj1 == null || obj2 == null) {
    return false;
  }

  const dateResult = isEqualDate(obj1, obj2);
  if (dateResult !== undefined) {
    return dateResult;
  }

  const arrayResult = isEqualArray(obj1, obj2);
  if (arrayResult !== undefined) {
    return arrayResult;
  }

  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return false;
  }

  return isEqualObject(obj1, obj2);
}

function cloneSessionConsoleRuntime(
  runtime: SessionConsoleRuntime | undefined | null,
): SessionConsoleRuntime {
  const source = runtime ?? emptySessionConsoleRuntime();
  const empty = emptySessionConsoleRuntime();
  return {
    ...source,
    stage: { ...(source.stage ?? empty.stage) },
    duckPercent: source.duckPercent ?? empty.duckPercent,
    activeImage: source.activeImage ? { ...source.activeImage } : null,
    audio: {
      ...source.audio,
      restartSeq: source.audio.restartSeq ?? 0,
      volumeOffset: source.audio.volumeOffset ?? 0,
    },
  };
}

export interface SyncableGameState {
  tokens: Token[];
  tokenLibrary: TokenLibraryItem[];
  drawings: Drawing[];
  doors: Door[];
  stairs: Stairs[];
  gridSize: number;
  gridType: GridType;
  gridColor: string;
  map: MapConfig | null;
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;
  activeMeasurement: Measurement | null;
  broadcastMeasurement: boolean;
  sessionConsoleRuntime: SessionConsoleRuntime;
}

export type SessionConsoleWorldEvent = {
  type: 'armed' | 'unarmed' | 'ready' | 'error';
  message?: string;
};

// eslint-disable-next-line import/no-unused-modules -- covered by syncUtils unit tests
export const FULL_SYNC_ACTION_THRESHOLD = 20;

export type SyncAction =
  | { type: 'FULL_SYNC'; payload: Partial<SyncableGameState> }
  | { type: 'BATCH'; payload: SyncAction[] }
  | { type: 'TOKEN_ADD'; payload: Token }
  | { type: 'TOKEN_UPDATE'; payload: { id: string; changes: Partial<Token> } }
  | { type: 'TOKEN_REMOVE'; payload: { id: string } }
  | { type: 'LIBRARY_UPDATE'; payload: TokenLibraryItem[] }
  | { type: 'TOKEN_DRAG_START'; payload: { id: string; x: number; y: number } }
  | { type: 'TOKEN_DRAG_MOVE'; payload: { id: string; x: number; y: number } }
  | { type: 'TOKEN_DRAG_MOVE_BATCH'; payload: Array<{ id: string; x: number; y: number }> }
  | { type: 'TOKEN_DRAG_END'; payload: { id: string; x: number; y: number } }
  | { type: 'DRAWING_ADD'; payload: Drawing }
  | { type: 'DRAWING_UPDATE'; payload: { id: string; changes: Partial<Drawing> } }
  | { type: 'DRAWING_REMOVE'; payload: { id: string } }
  | { type: 'DOOR_ADD'; payload: Door }
  | { type: 'DOOR_UPDATE'; payload: { id: string; changes: Partial<Door> } }
  | { type: 'DOOR_REMOVE'; payload: { id: string } }
  | { type: 'DOOR_TOGGLE'; payload: { id: string } }
  | { type: 'STAIRS_ADD'; payload: Stairs }
  | { type: 'STAIRS_UPDATE'; payload: { id: string; changes: Partial<Stairs> } }
  | { type: 'STAIRS_REMOVE'; payload: { id: string } }
  | { type: 'MAP_UPDATE'; payload: MapConfig | null }
  | {
      type: 'GRID_UPDATE';
      payload: {
        gridSize?: number;
        gridType?: GridType;
        gridColor?: string;
        isDaylightMode?: boolean;
      };
    }
  | { type: 'EXPLORED_UPDATE'; payload: ExploredRegion[] }
  | { type: 'MEASUREMENT_UPDATE'; payload: Measurement | null }
  | {
      type: 'STAGE_UPDATE';
      payload: {
        stageVisible: boolean;
        activeImage: SessionConsoleRuntime['activeImage'];
        stage: SessionConsoleRuntime['stage'];
      };
    }
  | {
      type: 'AUDIO_UPDATE';
      payload: {
        audio: SessionConsoleRuntime['audio'];
        volume: number;
        ducked: boolean;
        duckPercent: number;
      };
    }
  | {
      type: 'SFX_FIRE';
      payload: {
        seq: number;
        sfxId: string | null;
        kind: SessionConsoleRuntime['sfxKind'];
        synthType: SessionConsoleRuntime['sfxSynthType'];
        src: string | null;
      };
    };

function buildFullSync(currentState: Partial<SyncableGameState>): SyncAction {
  return {
    type: 'FULL_SYNC',
    payload: buildFullSyncPayload(currentState),
  };
}

/** Builds the payload used by FULL_SYNC and initial state broadcasts. */
export function buildFullSyncPayload(
  state: Partial<SyncableGameState>,
): Partial<SyncableGameState> {
  return {
    tokens: state.tokens,
    tokenLibrary: state.tokenLibrary,
    drawings: state.drawings,
    doors: state.doors ?? [],
    stairs: state.stairs ?? [],
    gridSize: state.gridSize,
    gridType: state.gridType,
    gridColor: state.gridColor,
    map: state.map,
    exploredRegions: state.exploredRegions,
    isDaylightMode: state.isDaylightMode,
    activeMeasurement: state.activeMeasurement ?? null,
    broadcastMeasurement: Boolean(state.broadcastMeasurement ?? false),
    sessionConsoleRuntime: cloneSessionConsoleRuntime(state.sessionConsoleRuntime),
  };
}

const WORLD_FULL_SYNC_STATE_KEYS = [
  'tokens',
  'drawings',
  'doors',
  'stairs',
  'gridSize',
  'gridType',
  'gridColor',
  'map',
  'exploredRegions',
  'isDaylightMode',
  'activeMeasurement',
  'broadcastMeasurement',
] as const satisfies ReadonlyArray<keyof SyncableGameState>;

/**
 * World FULL_SYNC may only write the documented sync slice.
 * Catalog, campaign, tokenLibrary, and runtime are applied separately.
 */
export function worldFullSyncStatePatch(
  payload: Partial<SyncableGameState>,
): Partial<SyncableGameState> {
  const patch: Partial<SyncableGameState> = {};
  const record = payload as Record<string, unknown>;
  for (const key of WORLD_FULL_SYNC_STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = record[key];
    }
  }
  return patch;
}

/** Clones game store state into a sync snapshot for diffing. */
export function cloneSyncableStateFromGame(
  state: GameState,
  options: { prevExploredRegions?: ExploredRegion[] } = {},
): SyncableGameState {
  const prevExplored = options.prevExploredRegions;
  const nextExplored = state.exploredRegions;
  let exploredRegions: ExploredRegion[];
  if (prevExplored === nextExplored) {
    exploredRegions = prevExplored ?? [];
  } else if (nextExplored) {
    exploredRegions = [...nextExplored];
  } else {
    exploredRegions = [];
  }

  return {
    tokens: [...state.tokens],
    tokenLibrary: [...state.campaign.tokenLibrary],
    drawings: [...state.drawings],
    doors: [...(state.doors ?? [])],
    stairs: [...(state.stairs ?? [])],
    gridSize: state.gridSize,
    gridType: state.gridType,
    gridColor: state.gridColor,
    map: state.map ? { ...state.map } : null,
    exploredRegions,
    isDaylightMode: state.isDaylightMode,
    activeMeasurement: state.activeMeasurement ?? null,
    broadcastMeasurement: state.broadcastMeasurement ?? false,
    sessionConsoleRuntime: cloneSessionConsoleRuntime(state.sessionConsoleRuntime),
  };
}

/** Clones a FULL_SYNC payload into a sync snapshot with defaults for missing fields. */
export function cloneSyncableStateFromPayload(
  payload: Partial<SyncableGameState>,
  defaults: { gridColor: string },
): SyncableGameState {
  return {
    tokens: payload.tokens ? [...payload.tokens] : [],
    tokenLibrary: payload.tokenLibrary ? [...payload.tokenLibrary] : [],
    drawings: [...(payload.drawings ?? [])],
    doors: [...(payload.doors ?? [])],
    stairs: [...(payload.stairs ?? [])],
    gridSize: payload.gridSize ?? 50,
    gridType: payload.gridType ?? 'LINES',
    gridColor: payload.gridColor ?? defaults.gridColor,
    map: payload.map ? { ...payload.map } : null,
    exploredRegions: payload.exploredRegions ? [...payload.exploredRegions] : [],
    isDaylightMode: payload.isDaylightMode ?? false,
    activeMeasurement: payload.activeMeasurement ?? null,
    broadcastMeasurement: payload.broadcastMeasurement ?? false,
    sessionConsoleRuntime: cloneSessionConsoleRuntime(payload.sessionConsoleRuntime),
  };
}

// eslint-disable-next-line import/no-unused-modules -- covered by syncUtils unit tests
export function isTokenDragAction(
  action: SyncAction,
): action is Extract<
  SyncAction,
  { type: 'TOKEN_DRAG_START' | 'TOKEN_DRAG_MOVE' | 'TOKEN_DRAG_MOVE_BATCH' | 'TOKEN_DRAG_END' }
> {
  return (
    action.type === 'TOKEN_DRAG_START' ||
    action.type === 'TOKEN_DRAG_MOVE' ||
    action.type === 'TOKEN_DRAG_MOVE_BATCH' ||
    action.type === 'TOKEN_DRAG_END'
  );
}

/** True when none of the Architect→World syncable fields changed by reference. */
export function isSyncSliceUnchanged(current: GameState, previous: GameState): boolean {
  return (
    current.tokens === previous.tokens &&
    current.drawings === previous.drawings &&
    current.doors === previous.doors &&
    current.stairs === previous.stairs &&
    current.gridSize === previous.gridSize &&
    current.gridType === previous.gridType &&
    current.gridColor === previous.gridColor &&
    current.map === previous.map &&
    current.exploredRegions === previous.exploredRegions &&
    current.isDaylightMode === previous.isDaylightMode &&
    current.activeMeasurement === previous.activeMeasurement &&
    current.broadcastMeasurement === previous.broadcastMeasurement &&
    current.campaign.tokenLibrary === previous.campaign.tokenLibrary &&
    current.sessionConsoleRuntime === previous.sessionConsoleRuntime
  );
}

/** Collapses many delta actions into a BATCH or a single FULL_SYNC. */
export function coalesceSyncActions(
  actions: SyncAction[],
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  if (actions.length === 0) {
    return [];
  }
  if (actions.length >= FULL_SYNC_ACTION_THRESHOLD) {
    return [buildFullSync(currentState)];
  }
  if (actions.length === 1) {
    return actions;
  }
  return [{ type: 'BATCH', payload: actions }];
}

/** Detects World View token position changes for scoped Architect sync. */
export function detectWorldViewTokenUpdates(
  prevState: SyncableGameState | null,
  currentTokens: Token[],
): SyncAction[] {
  if (!prevState) {
    return [];
  }

  const prevTokenMap = new Map(prevState.tokens.map((token) => [token.id, token]));
  const actions: SyncAction[] = [];

  for (const token of currentTokens) {
    const prev = prevTokenMap.get(token.id);
    if (!prev) {
      continue;
    }

    const changes: Partial<Token> = {};
    if (token.x !== prev.x) {
      changes.x = token.x;
    }
    if (token.y !== prev.y) {
      changes.y = token.y;
    }

    if (Object.keys(changes).length > 0) {
      actions.push({ type: 'TOKEN_UPDATE', payload: { id: token.id, changes } });
    }
  }

  return actions;
}

interface Identifiable {
  id: string;
}

function detectEntityActions<T extends Identifiable>(
  prevItems: T[] | undefined,
  currentItems: T[] | undefined,
  types: {
    add: SyncAction['type'];
    update: SyncAction['type'];
    remove: SyncAction['type'];
  },
): SyncAction[] {
  const prev = prevItems ?? [];
  const current = currentItems ?? [];
  if (prev === current) {
    return [];
  }

  const actions: SyncAction[] = [];
  const prevMap = new Map(prev.filter((item) => item.id).map((item) => [item.id, item]));
  const currentMap = new Map(current.filter((item) => item.id).map((item) => [item.id, item]));

  for (const item of current) {
    if (!item.id) {
      continue;
    }
    if (!prevMap.has(item.id)) {
      actions.push({ type: types.add, payload: item } as SyncAction);
      continue;
    }

    const prevItem = prevMap.get(item.id);
    if (!prevItem || prevItem === item) {
      continue;
    }

    const changes: Partial<T> = {};
    for (const key of Object.keys(item) as Array<keyof T>) {
      if (!isEqual(item[key], prevItem[key])) {
        changes[key] = item[key];
      }
    }
    if (Object.keys(changes).length > 0) {
      actions.push({
        type: types.update,
        payload: { id: item.id, changes },
      } as SyncAction);
    }
  }

  for (const item of prev) {
    if (item.id && !currentMap.has(item.id)) {
      actions.push({ type: types.remove, payload: { id: item.id } } as SyncAction);
    }
  }

  return actions;
}

function detectMeasurementActions(
  prevState: Partial<SyncableGameState>,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  const actions: SyncAction[] = [];
  const shouldBroadcast = Boolean(currentState.broadcastMeasurement);
  const prevBroadcast = Boolean(prevState.broadcastMeasurement);

  if (shouldBroadcast) {
    if (!isEqual(prevState.activeMeasurement, currentState.activeMeasurement) || !prevBroadcast) {
      actions.push({
        type: 'MEASUREMENT_UPDATE',
        payload: currentState.activeMeasurement ?? null,
      });
    }
  } else if (prevBroadcast) {
    actions.push({ type: 'MEASUREMENT_UPDATE', payload: null });
  }

  return actions;
}

function sessionConsoleStageChanged(
  previous: SessionConsoleRuntime,
  current: SessionConsoleRuntime,
): boolean {
  return (
    previous.stageVisible !== current.stageVisible ||
    !isEqual(previous.activeImage, current.activeImage) ||
    !isEqual(previous.stage, current.stage)
  );
}

function sessionConsoleAudioChanged(
  previous: SessionConsoleRuntime,
  current: SessionConsoleRuntime,
): boolean {
  return (
    !isEqual(previous.audio, current.audio) ||
    previous.volume !== current.volume ||
    previous.ducked !== current.ducked ||
    previous.duckPercent !== current.duckPercent
  );
}

function sessionConsoleSfxChanged(
  previous: SessionConsoleRuntime,
  current: SessionConsoleRuntime,
): boolean {
  return previous.sfxSeq !== current.sfxSeq || previous.sfxId !== current.sfxId;
}

function detectSessionConsoleActions(
  prevState: Partial<SyncableGameState>,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  const prevRt = prevState.sessionConsoleRuntime;
  const currRt = currentState.sessionConsoleRuntime;
  if (prevRt === currRt || !currRt) {
    return [];
  }

  const previous = prevRt ?? emptySessionConsoleRuntime();
  const actions: SyncAction[] = [];

  if (sessionConsoleStageChanged(previous, currRt)) {
    actions.push({
      type: 'STAGE_UPDATE',
      payload: {
        stageVisible: currRt.stageVisible,
        activeImage: currRt.activeImage,
        stage: currRt.stage,
      },
    });
  }

  if (sessionConsoleAudioChanged(previous, currRt)) {
    actions.push({
      type: 'AUDIO_UPDATE',
      payload: {
        audio: currRt.audio,
        volume: currRt.volume,
        ducked: currRt.ducked,
        duckPercent: currRt.duckPercent,
      },
    });
  }

  if (sessionConsoleSfxChanged(previous, currRt)) {
    actions.push({
      type: 'SFX_FIRE',
      payload: {
        seq: currRt.sfxSeq,
        sfxId: currRt.sfxId,
        kind: currRt.sfxKind ?? null,
        synthType: currRt.sfxSynthType ?? null,
        src: currRt.sfxSrc ?? null,
      },
    });
  }

  return actions;
}

/**
 * Detects changes between previous and current state, returns delta actions.
 * A null previous state produces a single FULL_SYNC (first Architect→World
 * snapshot when prev is unknown). World-open REQUEST_INITIAL_STATE sends
 * FULL_SYNC explicitly via buildFullSyncPayload instead of this path.
 */
export function detectChanges(
  prevState: Partial<SyncableGameState> | null,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  if (!prevState) {
    return [buildFullSync(currentState)];
  }

  const actions: SyncAction[] = [];

  if (prevState.tokenLibrary !== currentState.tokenLibrary) {
    if (!isEqual(prevState.tokenLibrary, currentState.tokenLibrary)) {
      actions.push({ type: 'LIBRARY_UPDATE', payload: currentState.tokenLibrary ?? [] });
    }
  }

  actions.push(
    ...detectEntityActions(prevState.tokens, currentState.tokens, {
      add: 'TOKEN_ADD',
      update: 'TOKEN_UPDATE',
      remove: 'TOKEN_REMOVE',
    }),
  );
  actions.push(
    ...detectEntityActions(prevState.drawings, currentState.drawings, {
      add: 'DRAWING_ADD',
      update: 'DRAWING_UPDATE',
      remove: 'DRAWING_REMOVE',
    }),
  );

  if (
    !isEqual(prevState.gridSize, currentState.gridSize) ||
    !isEqual(prevState.gridType, currentState.gridType) ||
    !isEqual(prevState.gridColor, currentState.gridColor) ||
    !isEqual(prevState.isDaylightMode, currentState.isDaylightMode)
  ) {
    actions.push({
      type: 'GRID_UPDATE',
      payload: {
        gridSize: currentState.gridSize,
        gridType: currentState.gridType,
        gridColor: currentState.gridColor,
        isDaylightMode: currentState.isDaylightMode,
      },
    });
  }

  if (!isEqual(prevState.map, currentState.map)) {
    actions.push({ type: 'MAP_UPDATE', payload: currentState.map ?? null });
  }

  if (prevState.exploredRegions !== currentState.exploredRegions) {
    actions.push({
      type: 'EXPLORED_UPDATE',
      payload: currentState.exploredRegions ?? [],
    });
  }

  actions.push(...detectMeasurementActions(prevState, currentState));
  actions.push(
    ...detectEntityActions(prevState.doors, currentState.doors, {
      add: 'DOOR_ADD',
      update: 'DOOR_UPDATE',
      remove: 'DOOR_REMOVE',
    }),
  );
  actions.push(
    ...detectEntityActions(prevState.stairs, currentState.stairs, {
      add: 'STAIRS_ADD',
      update: 'STAIRS_UPDATE',
      remove: 'STAIRS_REMOVE',
    }),
  );
  actions.push(...detectSessionConsoleActions(prevState, currentState));

  return actions;
}

/** Applies Architect→World session console actions onto a consumer runtime (no catalog). */
export function applyAction(
  runtime: SessionConsoleRuntime,
  action: SyncAction,
): SessionConsoleRuntime {
  switch (action.type) {
    case 'BATCH': {
      let next = runtime;
      for (const inner of action.payload) {
        next = applyAction(next, inner);
      }
      return next;
    }
    case 'STAGE_UPDATE':
      return {
        ...runtime,
        stageVisible: action.payload.stageVisible,
        activeImage: action.payload.activeImage,
        stage: action.payload.stage ? { ...action.payload.stage } : runtime.stage,
      };
    case 'AUDIO_UPDATE':
      return {
        ...runtime,
        audio: {
          ...action.payload.audio,
          restartSeq: action.payload.audio.restartSeq ?? 0,
          volumeOffset: action.payload.audio.volumeOffset ?? 0,
        },
        volume: action.payload.volume,
        ducked: action.payload.ducked,
        duckPercent: action.payload.duckPercent ?? runtime.duckPercent,
      };
    case 'SFX_FIRE':
      return {
        ...runtime,
        sfxSeq: action.payload.seq,
        sfxId: action.payload.sfxId,
        sfxKind: action.payload.kind ?? null,
        sfxSynthType: action.payload.synthType ?? null,
        sfxSrc: action.payload.src ?? null,
      };
    case 'FULL_SYNC': {
      const incoming = action.payload.sessionConsoleRuntime;
      if (!incoming) {
        return runtime;
      }
      return { ...cloneSessionConsoleRuntime(incoming), worldArmed: runtime.worldArmed };
    }
    default:
      return runtime;
  }
}

const WORLD_EVENT_TYPES = new Set(['armed', 'unarmed', 'ready', 'error']);

/** Validates World → Architect Session Console status events. */
export function parseSessionConsoleWorldEvent(raw: unknown): SessionConsoleWorldEvent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const candidate = raw as { type?: unknown; message?: unknown };
  if (typeof candidate.type !== 'string' || !WORLD_EVENT_TYPES.has(candidate.type)) {
    return null;
  }
  const event: SessionConsoleWorldEvent = {
    type: candidate.type as SessionConsoleWorldEvent['type'],
  };
  if (typeof candidate.message === 'string' && candidate.message.length > 0) {
    event.message = candidate.message;
  }
  return event;
}

/** Strips usernames from paths then runs existing PII sanitization. */
export function sanitizeSessionConsoleErrorMessage(message: string): string {
  const withPaths = message
    .replace(/(\/(?:Users|home)\/)[^/\\]+/gi, '$1<USER>')
    .replace(/([A-Za-z]:[/\\](?:Users|Documents and Settings)[/\\])[^/\\]+/gi, '$1<USER>');
  return sanitizeStack(new Error(withPaths), '').message;
}
