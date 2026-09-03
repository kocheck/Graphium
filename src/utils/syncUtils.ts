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

/**
 * Deep equality check for simple objects with primitive values and arrays
 * More reliable than JSON.stringify which can fail due to property ordering
 */
// eslint-disable-next-line complexity, import/no-unused-modules -- used by syncUtils tests and detectChanges
export function isEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) {
    return true;
  }
  if (obj1 == null || obj2 == null) {
    return false;
  }

  // Handle Date objects
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }

  // Handle RegExp objects
  if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
    return obj1.toString() === obj2.toString();
  }

  // Handle Map objects
  if (obj1 instanceof Map && obj2 instanceof Map) {
    if (obj1.size !== obj2.size) {
      return false;
    }
    for (const [key, value] of obj1) {
      if (!obj2.has(key) || !isEqual(value, obj2.get(key))) {
        return false;
      }
    }
    return true;
  }

  // Handle Set objects
  if (obj1 instanceof Set && obj2 instanceof Set) {
    if (obj1.size !== obj2.size) {
      return false;
    }
    for (const value of obj1) {
      if (!obj2.has(value)) {
        return false;
      }
    }
    return true;
  }

  if (
    obj1 instanceof Date ||
    obj1 instanceof RegExp ||
    obj1 instanceof Map ||
    obj1 instanceof Set ||
    obj2 instanceof Date ||
    obj2 instanceof RegExp ||
    obj2 instanceof Map ||
    obj2 instanceof Set
  ) {
    return false;
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
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

  if (Array.isArray(obj1) || Array.isArray(obj2)) {
    return false;
  }

  // Handle objects
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return false;
  }

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

// Define a type for the game state that gets synced
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
}

export type SyncAction =
  | { type: 'FULL_SYNC'; payload: Partial<SyncableGameState> }
  | { type: 'TOKEN_ADD'; payload: Token }
  | { type: 'TOKEN_UPDATE'; payload: { id: string; changes: Partial<Token> } }
  | { type: 'TOKEN_REMOVE'; payload: { id: string } }
  | { type: 'LIBRARY_UPDATE'; payload: TokenLibraryItem[] }
  | { type: 'TOKEN_DRAG_START'; payload: { id: string; x: number; y: number } }
  | { type: 'TOKEN_DRAG_MOVE'; payload: { id: string; x: number; y: number } }
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
  | { type: 'MEASUREMENT_UPDATE'; payload: Measurement | null };

// ---------------------------------------------------------------------------
// Helpers extracted from detectChanges to reduce per-function complexity
// ---------------------------------------------------------------------------

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
  };
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
  };
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

function detectTokenActions(
  prevState: Partial<SyncableGameState>,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  const actions: SyncAction[] = [];
  const prevTokens = prevState.tokens ?? [];
  const currentTokens = currentState.tokens ?? [];

  const prevTokenMap = new Map(prevTokens.filter((t) => t?.id).map((t) => [t.id, t]));
  const currentTokenMap = new Map(currentTokens.filter((t) => t?.id).map((t) => [t.id, t]));

  for (const token of currentTokens) {
    if (token?.id && !prevTokenMap.has(token.id)) {
      actions.push({ type: 'TOKEN_ADD', payload: token });
    }
  }

  for (const token of prevTokens) {
    if (token?.id && !currentTokenMap.has(token.id)) {
      actions.push({ type: 'TOKEN_REMOVE', payload: { id: token.id } });
    }
  }

  for (const token of currentTokens) {
    if (!token?.id) {
      continue;
    }
    const prevToken = prevTokenMap.get(token.id);
    if (!prevToken) {
      continue;
    }
    const changes: Partial<Token> = {};
    for (const key of Object.keys(token)) {
      const tokenKey = key as keyof Token;
      if (!isEqual(token[tokenKey], prevToken[tokenKey])) {
        (changes as Record<string, unknown>)[key] = token[tokenKey];
      }
    }
    if (Object.keys(changes).length > 0) {
      actions.push({ type: 'TOKEN_UPDATE', payload: { id: token.id, changes } });
    }
  }

  return actions;
}

function detectDrawingActions(
  prevState: Partial<SyncableGameState>,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  const actions: SyncAction[] = [];
  const prevDrawings = prevState.drawings ?? [];
  const currentDrawings = currentState.drawings ?? [];

  if (isEqual(prevDrawings, currentDrawings)) {
    return actions;
  }

  const prevDrawingMap = new Map(prevDrawings.filter((d) => d?.id).map((d) => [d.id, d]));
  const currentDrawingMap = new Map(currentDrawings.filter((d) => d?.id).map((d) => [d.id, d]));

  for (const drawing of currentDrawings) {
    if (!drawing?.id) {
      continue;
    }
    if (!prevDrawingMap.has(drawing.id)) {
      actions.push({ type: 'DRAWING_ADD', payload: drawing });
    } else {
      const prev = prevDrawingMap.get(drawing.id);
      if (!prev) {
        continue;
      }
      const changes: Partial<Drawing> = {};
      for (const key of Object.keys(drawing)) {
        const drawingKey = key as keyof Drawing;
        if (!isEqual(drawing[drawingKey], prev[drawingKey])) {
          (changes as Record<string, unknown>)[key] = drawing[drawingKey];
        }
      }
      if (Object.keys(changes).length > 0) {
        actions.push({ type: 'DRAWING_UPDATE', payload: { id: drawing.id, changes } });
      }
    }
  }

  for (const drawing of prevDrawings) {
    if (drawing?.id && !currentDrawingMap.has(drawing.id)) {
      actions.push({ type: 'DRAWING_REMOVE', payload: { id: drawing.id } });
    }
  }

  return actions;
}

function detectDoorActions(
  prevState: Partial<SyncableGameState>,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  const actions: SyncAction[] = [];
  const prevDoors = prevState.doors ?? [];
  const currentDoors = currentState.doors ?? [];

  if (isEqual(prevDoors, currentDoors)) {
    return actions;
  }

  const prevDoorMap = new Map(prevDoors.filter((d) => d?.id).map((d) => [d.id, d]));
  const currentDoorMap = new Map(currentDoors.filter((d) => d?.id).map((d) => [d.id, d]));

  for (const door of currentDoors) {
    if (!door?.id) {
      continue;
    }
    if (!prevDoorMap.has(door.id)) {
      actions.push({ type: 'DOOR_ADD', payload: door });
    } else {
      const prev = prevDoorMap.get(door.id);
      if (!prev) {
        continue;
      }
      const changes: Partial<Door> = {};
      for (const key of Object.keys(door)) {
        const doorKey = key as keyof Door;
        if (!isEqual(door[doorKey], prev[doorKey])) {
          (changes as Record<string, unknown>)[key] = door[doorKey];
        }
      }
      if (Object.keys(changes).length > 0) {
        actions.push({ type: 'DOOR_UPDATE', payload: { id: door.id, changes } });
      }
    }
  }

  for (const door of prevDoors) {
    if (door?.id && !currentDoorMap.has(door.id)) {
      actions.push({ type: 'DOOR_REMOVE', payload: { id: door.id } });
    }
  }

  return actions;
}

function detectStairsActions(
  prevState: Partial<SyncableGameState>,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  const actions: SyncAction[] = [];
  const prevStairs = prevState.stairs ?? [];
  const currentStairs = currentState.stairs ?? [];

  if (isEqual(prevStairs, currentStairs)) {
    return actions;
  }

  const prevStairsMap = new Map(prevStairs.filter((s) => s?.id).map((s) => [s.id, s]));
  const currentStairsMap = new Map(currentStairs.filter((s) => s?.id).map((s) => [s.id, s]));

  for (const stairs of currentStairs) {
    if (!stairs?.id) {
      continue;
    }
    if (!prevStairsMap.has(stairs.id)) {
      actions.push({ type: 'STAIRS_ADD', payload: stairs });
    } else {
      const prev = prevStairsMap.get(stairs.id);
      if (!prev) {
        continue;
      }
      const changes: Partial<Stairs> = {};
      for (const key of Object.keys(stairs)) {
        const stairsKey = key as keyof Stairs;
        if (!isEqual(stairs[stairsKey], prev[stairsKey])) {
          (changes as Record<string, unknown>)[key] = stairs[stairsKey];
        }
      }
      if (Object.keys(changes).length > 0) {
        actions.push({ type: 'STAIRS_UPDATE', payload: { id: stairs.id, changes } });
      }
    }
  }

  for (const stairs of prevStairs) {
    if (stairs?.id && !currentStairsMap.has(stairs.id)) {
      actions.push({ type: 'STAIRS_REMOVE', payload: { id: stairs.id } });
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

/**
 * Detects changes between previous and current state, returns delta actions
 */
export function detectChanges(
  prevState: Partial<SyncableGameState>,
  currentState: Partial<SyncableGameState>,
): SyncAction[] {
  // If no previous state, send full sync
  if (!prevState) {
    return [buildFullSync(currentState)];
  }

  const actions: SyncAction[] = [];

  // Token library
  if (!isEqual(prevState.tokenLibrary, currentState.tokenLibrary)) {
    actions.push({ type: 'LIBRARY_UPDATE', payload: currentState.tokenLibrary ?? [] });
  }

  actions.push(...detectTokenActions(prevState, currentState));
  actions.push(...detectDrawingActions(prevState, currentState));

  // Grid & map
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

  if (!isEqual(prevState.exploredRegions, currentState.exploredRegions)) {
    actions.push({
      type: 'EXPLORED_UPDATE',
      payload: currentState.exploredRegions ?? [],
    });
  }

  actions.push(...detectMeasurementActions(prevState, currentState));
  actions.push(...detectDoorActions(prevState, currentState));
  actions.push(...detectStairsActions(prevState, currentState));

  return actions;
}
