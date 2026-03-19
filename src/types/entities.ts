import type {
  HexColor,
  PixelSize,
  GridType,
  MapId,
  TokenId,
  DoorId,
  LightId,
  DrawingId,
  MapLinkId,
  LibraryItemId,
} from './primitives';

// ===== MAP =====

/**
 * MapConfig describes the background image and its canvas-space transform.
 * null on MapData means no background image is loaded for this map.
 * x/y are canvas-space offsets; scale is a multiplier (1.0 = natural size).
 * Renamed from the legacy `map` field — see domain.ts shim for the compat alias.
 */
export interface MapConfig {
  src: string; // file:// URL to background image
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * ExploredRegion records an area the GM has revealed via fog-of-war.
 * GM-only — stripped from PlayerViewSnapshot before IPC.
 * timestamp is Date.now() at creation; used for ordering in the migration pipeline.
 */
export interface ExploredRegion {
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}

/**
 * MapData holds grid/background config and ID lists for entities on this map.
 *
 * mapLinkIds: links where fromMapId === this map's id (stored once, not duplicated).
 * exploredRegions: GM-only state — stripped from PlayerViewSnapshot before IPC.
 * mapConfig: renamed from the legacy `map` field (see domain.ts shim for compat alias).
 */
export interface MapData {
  id: MapId;
  name: string;
  mapConfig: MapConfig | null;
  gridSize: PixelSize;
  gridType: GridType;
  gridColor: HexColor;
  isDaylightMode: boolean;
  tokenIds: TokenId[];
  doorIds: DoorId[];
  lightIds: LightId[];
  drawingIds: DrawingId[];
  mapLinkIds: MapLinkId[]; // links originating from this map
  exploredRegions: ExploredRegion[];
}

// ===== TOKEN =====

// Placeholder — Condition type will be defined in a future spec.
export type Condition = never;

/**
 * Token is a character or object placed on the map.
 *
 * mapId: which map this token belongs to (BREAKING: required, was absent in v0).
 * Optional fields fall back to the referenced TokenLibraryItem prototype.
 * Orphaned libraryItemId (item deleted from library) is tolerated — not an error.
 * hidden: GM-only; stripped from player snapshot at the IPC boundary.
 * conditions: always [] in v1 (slot reserved for future status effects).
 *
 * MIGRATION: Adding mapId breaks all existing Token construction sites.
 * Fix those in the App Shell spec.
 */
export interface Token {
  id: TokenId;
  mapId: MapId;
  x: number;
  y: number;
  src: string;
  libraryItemId?: LibraryItemId;
  name?: string;
  type?: 'PC' | 'NPC';
  scale?: number;
  visionRadius?: number; // grid cells; 0 = rely on ambient light only
  movementSpeed?: number; // feet
  hidden: boolean; // GM-only; stripped before player sync
  conditions: Condition[]; // always [] in v1
}

// ===== DRAWING =====

/**
 * Drawing is a freehand stroke.
 *
 * tool='eraser' strokes are stored as entities and composited with
 * destination-out blending in the renderer — non-destructive, undo-friendly.
 *
 * pressures: one value per (x,y) point pair (0.0–1.0); empty [] for mouse input.
 * x, y, scale: always required; default to 0, 0, 1.
 *
 * MIGRATION: pressures/x/y/scale were optional in v0. Fix construction sites
 * in the Rendering Engine spec.
 */
export interface Drawing {
  id: DrawingId;
  mapId: MapId;
  tool: 'marker' | 'eraser' | 'wall';
  points: number[]; // [x1, y1, x2, y2, ...]
  color: HexColor;
  size: PixelSize;
  pressures: number[];
  x: number;
  y: number;
  scale: number;
  hidden: boolean;
}

// ===== DOOR =====

/**
 * MIGRATION: mapId and hidden are new required fields. Fix construction sites
 * in the App Shell spec. thickness and swingDirection are now required (were optional).
 */
export interface Door {
  id: DoorId;
  mapId: MapId;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
  isLocked: boolean;
  size: number; // pixels — typically gridSize
  thickness: number; // default: 12
  swingDirection: 'left' | 'right' | 'up' | 'down'; // default: 'right'
  hidden: boolean;
}

// ===== LIGHT SOURCE =====

/**
 * LightSource is a first-class entity.
 *
 * x/y are authoritative when detached (no attachedToTokenId).
 * When attached, x/y are stale — derivePlayerView resolves position from the token.
 * If the attached token is hidden, this light is also suppressed in the player snapshot.
 */
export interface LightSource {
  id: LightId;
  mapId: MapId;
  x: number;
  y: number;
  radius: number; // illumination radius in grid cells
  color: HexColor;
  intensity: number; // 0.0–1.0
  hidden: boolean;
  attachedToTokenId?: TokenId;
}

// ===== MAP LINK =====

/**
 * MapLink is a bidirectional connection between two points on two maps.
 * One entity owns both ends — no paired entities to keep in sync.
 * Stored in the origin map's mapLinkIds (fromMapId). Traversal layer handles
 * reverse navigation without duplicating the link.
 *
 * type is display-only; traversal is always bidirectional regardless of type.
 * Replaces the legacy Stairs entity (see domain.ts for deprecated Stairs shim).
 */
export interface MapLink {
  id: MapLinkId;
  fromMapId: MapId;
  fromX: number;
  fromY: number;
  toMapId: MapId;
  toX: number;
  toY: number;
  type: 'stairs-up' | 'stairs-down' | 'portal' | 'ladder'; // display-only
  label?: string;
  hidden: boolean;
}

// ===== TOKEN LIBRARY =====

export interface TokenLibraryItem {
  id: LibraryItemId;
  name: string;
  src: string; // file:// URL to full-size image
  thumbnailSrc: string; // file:// URL to 128×128 thumbnail
  category: string;
  tags: string[];
  dateAdded: number; // Date.now()
  defaultScale?: number;
  defaultVisionRadius?: number;
  defaultType?: 'PC' | 'NPC';
  defaultMovementSpeed?: number;
}
