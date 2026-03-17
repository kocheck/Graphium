/**
 * Domain Types — Core game entity type definitions
 *
 * This module contains all domain types for Graphium, extracted from gameStore.ts
 * to enable importing types without pulling in Zustand or any runtime code.
 *
 * **Design principle:** Types here describe the game domain (tokens, drawings, doors,
 * campaigns, etc.) and should never import from React, Zustand, or any component.
 *
 * **Import from here** for all domain types:
 * ```ts
 * import type { Token, Drawing, Door } from '../types/domain';
 * ```
 *
 * **Import from gameStore** when you need the store hook:
 * ```ts
 * import { useGameStore } from '../store/gameStore';
 * ```
 */

// ===== BRANDED PRIMITIVE TYPES =====

/**
 * A CSS hex color string accepted by Konva canvas rendering.
 * Valid formats: #rgb, #rrggbb, #rrggbbaa
 *
 * Note: Konva renders to <canvas> — CSS variables (var(--app-*)) are NOT valid here.
 * Use resolved hex strings only. See CLAUDE.md "Konva + CSS variables" gotcha.
 */
export type HexColor = string & { readonly __brand: 'HexColor' };

/**
 * A positive finite pixel dimension (grid cell size, stroke width, etc.)
 * Always a positive integer — toPixelSize rounds fractional values.
 */
export type PixelSize = number & { readonly __brand: 'PixelSize' };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Validates and brands a string as a HexColor.
 * Throws if the string is not a valid CSS hex color.
 *
 * @example toHexColor('#ff0000')  // ok
 * @example toHexColor('red')      // throws
 */
export function toHexColor(value: string): HexColor {
  if (!HEX_COLOR_RE.test(value)) {
    throw new Error(`Invalid hex color: "${value}"`);
  }
  return value as HexColor;
}

/**
 * Validates and brands a number as a PixelSize.
 * Throws if value is not a positive finite number.
 * Rounds fractional values to the nearest integer.
 *
 * @example toPixelSize(50)   // ok → 50
 * @example toPixelSize(50.7) // ok → 51
 * @example toPixelSize(0)    // throws
 */
export function toPixelSize(value: number): PixelSize {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid pixel size: ${value}`);
  }
  return Math.round(value) as PixelSize;
}

// ===== TOKEN TYPES =====

/**
 * TokenMetadata represents the shared metadata properties between library items and map tokens.
 * This interface defines the properties that can be inherited from prototypes (library items)
 * or overridden on instances (map tokens).
 */
// eslint-disable-next-line import/no-unused-modules
export interface TokenMetadata {
  name?: string;
  type?: 'PC' | 'NPC';
  visionRadius?: number;
  scale?: number;
  movementSpeed?: number;
}

/**
 * Token represents a character, creature, or object on the battlemap (Instance)
 *
 * Implements a Prototype/Instance pattern:
 * - If libraryItemId is set, this token references a library item as its prototype
 * - Properties like name, type, visionRadius, scale act as OVERRIDES when present
 * - If a property is undefined, it should fall back to the library item's default value
 * - Position (x, y) and src are always instance-specific
 *
 * @property libraryItemId - Optional reference to a TokenLibraryItem (prototype)
 * @property x - Position X in world coordinates (instance-specific)
 * @property y - Position Y in world coordinates (instance-specific)
 * @property src - Image file:// URL (instance-specific or inherited)
 * @property scale - Size multiplier override (falls back to library defaultScale)
 * @property type - Token type override (falls back to library defaultType)
 * @property visionRadius - Vision radius override (falls back to library defaultVisionRadius)
 * @property name - Name override (falls back to library name)
 */
export interface Token {
  id: string;
  x: number;
  y: number;
  src: string;
  libraryItemId?: string; // Reference to library item prototype
  scale?: number; // Override for library defaultScale
  type?: 'PC' | 'NPC'; // Override for library defaultType
  visionRadius?: number; // Override for library defaultVisionRadius
  name?: string; // Override for library name
  movementSpeed?: number; // Movement speed in feet (default: 30ft)
}

// ===== DRAWING TYPES =====

/**
 * Drawing represents a freehand stroke drawn with marker, eraser, or wall tool
 *
 * Supports pressure-sensitive input for variable-width strokes:
 * - pressures array has length = points.length / 2
 * - Each pressure value corresponds to one (x, y) coordinate pair
 * - Pressure ranges from 0.0 to 1.0 (0.5 for mouse/no pressure)
 * - Used for rendering variable-width strokes with pens/styluses
 */
export interface Drawing {
  id: string;
  tool: 'marker' | 'eraser' | 'wall';
  points: number[]; // [x1, y1, x2, y2, ...] coordinate pairs
  color: string;
  size: number; // Base stroke size (multiplied by pressure for variable width)
  pressures?: number[]; // Optional: [p1, p2, p3, ...] pressure values (0.0-1.0)
  scale?: number;
  x?: number;
  y?: number;
}

// ===== MAP TYPES =====

/**
 * MapConfig represents the background map image configuration
 */
export interface MapConfig {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * GridType determines how the tactical grid is displayed
 *
 * Visual modes for each geometry:
 * - LINES/DOTS/HIDDEN: Square grid (orthogonal)
 * - HEXAGONAL: Hexagonal grid (flat-top orientation)
 * - ISOMETRIC: Diamond/isometric grid (45° rotation)
 */
export type GridType = 'LINES' | 'DOTS' | 'HIDDEN' | 'HEXAGONAL' | 'ISOMETRIC';

/**
 * MapData represents the persistent state of a single map within a campaign
 */
export interface MapData {
  id: string;
  name: string;
  tokens: Token[];
  drawings: Drawing[];
  doors: Door[];
  stairs: Stairs[];
  map: MapConfig | null;
  gridSize: number;
  gridType: GridType;
  gridColor: string; // Hex color for grid lines (e.g., '#222')
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;
}

// ===== TOKEN LIBRARY =====

/**
 * TokenLibraryItem represents a reusable token in the persistent library
 *
 * The library persists across campaigns and sessions, allowing users to
 * build a collection of frequently-used tokens (monsters, NPCs, props).
 *
 * **Storage:**
 * - Full-size images: userData/library/assets/{id}.webp
 * - Thumbnails: userData/library/assets/thumb-{id}.webp
 * - Metadata index: userData/library/index.json
 */
export interface TokenLibraryItem {
  id: string;
  name: string;
  src: string; // file:// URL to full-size image
  thumbnailSrc: string; // file:// URL to 128x128 thumbnail
  category: string; // e.g., "Monsters", "NPCs", "Props", "Custom"
  tags: string[]; // For fuzzy search (e.g., ["dragon", "red", "large"])
  dateAdded: number; // Timestamp (Date.now())
  defaultScale?: number; // Optional default scale when placed
  defaultVisionRadius?: number; // Optional default vision radius
  defaultType?: 'PC' | 'NPC'; // Optional default token type
  defaultMovementSpeed?: number; // Optional default movement speed in feet
}

// ===== CAMPAIGN =====

/**
 * Campaign represents a collection of maps and shared assets
 */
export interface Campaign {
  id: string;
  name: string;
  maps: Record<string, MapData>;
  activeMapId: string;
  tokenLibrary: TokenLibraryItem[];
}

// ===== UI STATE TYPES =====
// Note: These are UI-related types that live here temporarily.
// They will move to uiStore.ts in Session 7 (Store Separation).

/**
 * ToastMessage represents a temporary notification
 */
export interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'info';
}

/**
 * ConfirmDialog represents a confirmation dialog state
 */
export interface ConfirmDialog {
  message: string;
  onConfirm: () => void;
  confirmText?: string;
}

// ===== FOG OF WAR =====

/**
 * ExploredRegion represents an area that PC tokens have previously seen
 */
export interface ExploredRegion {
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}

// ===== DUNGEON FEATURES =====

/**
 * Door represents an interactive door object in the dungeon
 *
 * Doors are rendered as white rectangles with black outlines (standard tabletop symbol).
 * When open, they display a swing arc to show the door's position.
 * Closed doors block Fog of War vision, while open doors allow vision through.
 *
 * @property id - Unique identifier
 * @property x - Center position X in world coordinates
 * @property y - Center position Y in world coordinates
 * @property orientation - Door alignment ('horizontal' = east-west wall, 'vertical' = north-south wall)
 * @property isOpen - Current state (true = open, false = closed)
 * @property isLocked - Whether door requires unlocking (shows lock icon)
 * @property size - Door width/height in pixels (typically gridSize)
 * @property thickness - Visual thickness for rendering (default: 12px for better visibility)
 * @property swingDirection - Which way door opens: 'left', 'right', 'up', 'down' (for swing arc)
 */
export interface Door {
  id: string;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
  isLocked: boolean;
  size: number;
  thickness?: number;
  swingDirection?: 'left' | 'right' | 'up' | 'down';
}

/**
 * Stairs represents a staircase connecting different levels in a dungeon
 *
 * Stairs are rendered with a stepped pattern and directional arrows.
 * They provide visual indication of level transitions in multi-floor dungeons.
 *
 * @property id - Unique identifier
 * @property x - Center position X in world coordinates
 * @property y - Center position Y in world coordinates
 * @property direction - Which compass direction the stairs face ('north', 'south', 'east', 'west')
 * @property type - Whether stairs go up or down ('up' or 'down')
 * @property width - Width in pixels (typically 2 * gridSize for 2-cell width)
 * @property height - Height in pixels (typically 2 * gridSize for 2-cell height)
 */
export interface Stairs {
  id: string;
  x: number;
  y: number;
  direction: 'north' | 'south' | 'east' | 'west';
  type: 'up' | 'down';
  width: number;
  height: number;
}

// ===== CONSTANTS =====

/**
 * Maximum number of explored regions to store in memory.
 */
export const MAX_EXPLORED_REGIONS = 2000;

/**
 * Default grid color (Dark Gray) for light mode.
 * Adaptively mapped to lighter gray in dark mode via CanvasManager.
 */
export const DEFAULT_GRID_COLOR = '#222222';
