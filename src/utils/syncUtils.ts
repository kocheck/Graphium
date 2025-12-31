import { Token, Drawing, Door, MapConfig } from '../store/gameStore';

/**
 * Deep equality check for simple objects with primitive values and arrays
 * More reliable than JSON.stringify which can fail due to property ordering
 */
export function isEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;

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
    if (obj1.size !== obj2.size) return false;
    for (const [key, value] of obj1) {
      if (!obj2.has(key) || !isEqual(value, obj2.get(key))) {
        return false;
      }
    }
    return true;
  }

  // Handle Set objects
  if (obj1 instanceof Set && obj2 instanceof Set) {
    if (obj1.size !== obj2.size) return false;
    for (const value of obj1) {
      if (!obj2.has(value)) return false;
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
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!isEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  if (Array.isArray(obj1) || Array.isArray(obj2)) return false;

  // Handle objects
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  const keys2Set = new Set(keys2);

  for (const key of keys1) {
    if (!keys2Set.has(key)) return false;
    if (!isEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

// Define a type for the game state that gets synced
interface SyncableGameState {
  tokens: Token[];
  drawings: Drawing[];
  doors: Door[];
  stairs: unknown[];
  gridSize: number;
  gridType: string;
  map: MapConfig | null;
  exploredRegions: unknown[];
  isDaylightMode: boolean;
}

export type SyncAction =
  | { type: 'FULL_SYNC'; payload: Partial<SyncableGameState> }
  | { type: 'TOKEN_ADD'; payload: Token }
  | { type: 'TOKEN_UPDATE'; payload: { id: string; changes: Partial<Token> } }
  | { type: 'TOKEN_REMOVE'; payload: { id: string } }
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
  | { type: 'MAP_UPDATE'; payload: MapConfig | null }
  | { type: 'GRID_UPDATE'; payload: { gridSize?: number; gridType?: string; isDaylightMode?: boolean } }
  | { type: 'MEASUREMENT_UPDATE'; payload: unknown | null };

/**
 * Detects changes between previous and current state, returns delta actions
 */
export function detectChanges(prevState: Partial<SyncableGameState>, currentState: Partial<SyncableGameState>): SyncAction[] {
  // FORCE RELOAD
  console.log("Safe detectChanges loaded", Date.now());
  const actions: SyncAction[] = [];

  // If no previous state, send full sync
  if (!prevState) {
    actions.push({
      type: 'FULL_SYNC',
      payload: {
          tokens: currentState.tokens,
          drawings: currentState.drawings,
          doors: currentState.doors || [],
          stairs: currentState.stairs || [],
          gridSize: currentState.gridSize,
          gridType: currentState.gridType,
          map: currentState.map,
          exploredRegions: currentState.exploredRegions,
          isDaylightMode: currentState.isDaylightMode
      }
    });
    return actions;
  }

  // --- TOKENS ---
  const prevTokens = prevState.tokens || [];
  const currentTokens = currentState.tokens || [];

  // Create maps, filtering out any invalid tokens
  const prevTokenMap = new Map(prevTokens.filter((t: Token) => t && t.id).map((t: Token) => [t.id, t]));
  const currentTokenMap = new Map(currentTokens.filter((t: Token) => t && t.id).map((t: Token) => [t.id, t]));

  // New tokens
  currentTokens.forEach((token: Token) => {
    if (token && token.id && !prevTokenMap.has(token.id)) {
      actions.push({ type: 'TOKEN_ADD', payload: token });
    }
  });

  // Removed tokens
  prevTokens.forEach((token: Token) => {
    if (token && token.id && !currentTokenMap.has(token.id)) {
      actions.push({ type: 'TOKEN_REMOVE', payload: { id: token.id } });
    }
  });

  // Updated tokens
  currentTokens.forEach((token: Token) => {
    if (!token || !token.id) return;

    const prevToken = prevTokenMap.get(token.id);
    if (prevToken) {
      const changes: Partial<Token> = {};
      Object.keys(token).forEach((key) => {
        const tokenKey = key as keyof Token;
        if (!isEqual(token[tokenKey], prevToken[tokenKey])) {
          (changes as Record<string, unknown>)[key] = token[tokenKey];
        }
      });
      if (Object.keys(changes).length > 0) {
        actions.push({
          type: 'TOKEN_UPDATE',
          payload: { id: token.id, changes },
        });
      }
    }
  });

  // --- DRAWINGS ---
  const prevDrawings = prevState.drawings || [];
  const currentDrawings = currentState.drawings || [];

  if (!isEqual(prevDrawings, currentDrawings)) {
      const prevDrawingMap = new Map(prevDrawings.filter((d: Drawing) => d && d.id).map((d: Drawing) => [d.id, d]));
      const currentDrawingMap = new Map(currentDrawings.filter((d: Drawing) => d && d.id).map((d: Drawing) => [d.id, d]));

      currentDrawings.forEach((drawing: Drawing) => {
          if (!drawing || !drawing.id) return;

          if (!prevDrawingMap.has(drawing.id)) {
              actions.push({ type: 'DRAWING_ADD', payload: drawing });
          } else {
              const prev = prevDrawingMap.get(drawing.id);
              if (!prev) return;
              const changes: Partial<Drawing> = {};
              Object.keys(drawing).forEach(key => {
                   const drawingKey = key as keyof Drawing;
                   if (!isEqual(drawing[drawingKey], prev[drawingKey])) {
                     (changes as Record<string, unknown>)[key] = drawing[drawingKey];
                   }
              });
              if (Object.keys(changes).length > 0) {
                  actions.push({ type: 'DRAWING_UPDATE', payload: { id: drawing.id, changes }});
              }
          }
      });
      prevDrawings.forEach((drawing: Drawing) => {
          if (drawing && drawing.id && !currentDrawingMap.has(drawing.id)) {
              actions.push({ type: 'DRAWING_REMOVE', payload: { id: drawing.id } });
          }
      });
  }

  // --- GRID & MAP ---
  if (!isEqual(prevState.gridSize, currentState.gridSize) ||
      !isEqual(prevState.gridType, currentState.gridType) ||
      !isEqual(prevState.isDaylightMode, currentState.isDaylightMode)) {
    actions.push({
        type: 'GRID_UPDATE',
        payload: {
            gridSize: currentState.gridSize,
            gridType: currentState.gridType,
            isDaylightMode: currentState.isDaylightMode
        }
    });
  }

  if (!isEqual(prevState.map, currentState.map)) {
    actions.push({ type: 'MAP_UPDATE', payload: currentState.map });
  }

  // --- DOORS ---
  // If door count changes or properties change
  const prevDoors = prevState.doors || [];
  const currentDoors = currentState.doors || [];

  if (!isEqual(prevDoors, currentDoors)) {
      const prevDoorMap = new Map(prevDoors.filter((d: Door) => d && d.id).map((d: Door) => [d.id, d]));
      const currentDoorMap = new Map(currentDoors.filter((d: Door) => d && d.id).map((d: Door) => [d.id, d]));

      currentDoors.forEach((door: Door) => {
          if (!door || !door.id) return;

          if (!prevDoorMap.has(door.id)) {
               actions.push({ type: 'DOOR_ADD', payload: door });
          } else {
               const prev = prevDoorMap.get(door.id);
               if (!prev) return;

               // Check changes (including isOpen)
               const changes: Partial<Door> = {};
               Object.keys(door).forEach(key => {
                   const doorKey = key as keyof Door;
                   if (!isEqual(door[doorKey], prev[doorKey])) {
                       (changes as Record<string, unknown>)[key] = door[doorKey];
                   }
               });
               if (Object.keys(changes).length > 0) {
                   actions.push({ type: 'DOOR_UPDATE', payload: { id: door.id, changes }});
               }
          }
      });

      prevDoors.forEach((door: Door) => {
          if (door && door.id && !currentDoorMap.has(door.id)) {
              actions.push({ type: 'DOOR_REMOVE', payload: { id: door.id }});
          }
      });
  }

  return actions;
}
