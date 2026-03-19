// ===== SCALAR BRANDED TYPES =====

export type HexColor = string & { readonly __brand: 'HexColor' };
export type PixelSize = number & { readonly __brand: 'PixelSize' };
export type GridType = 'LINES' | 'DOTS' | 'HIDDEN' | 'HEXAGONAL' | 'ISOMETRIC';

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function toHexColor(value: string): HexColor {
  if (!HEX_COLOR_RE.test(value)) {
    throw new Error(`Invalid hex color: "${value}"`);
  }
  return value as HexColor;
}

export function toPixelSize(value: number): PixelSize {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid pixel size: ${value}`);
  }
  return Math.round(value) as PixelSize;
}

// ===== BRANDED ID TYPES =====
// These are compile-time-only brands — no runtime validation.
// Callers are responsible for passing valid string IDs.
// IDs arriving over IPC or from disk should be validated at the boundary,
// not inside these constructors.

export type MapId = string & { readonly __brand: 'MapId' };
export type TokenId = string & { readonly __brand: 'TokenId' };
export type DoorId = string & { readonly __brand: 'DoorId' };
export type LightId = string & { readonly __brand: 'LightId' };
export type DrawingId = string & { readonly __brand: 'DrawingId' };
export type MapLinkId = string & { readonly __brand: 'MapLinkId' };
export type LibraryItemId = string & { readonly __brand: 'LibraryItemId' };

export function toMapId(s: string): MapId {
  return s as MapId;
}
export function toTokenId(s: string): TokenId {
  return s as TokenId;
}
export function toDoorId(s: string): DoorId {
  return s as DoorId;
}
export function toLightId(s: string): LightId {
  return s as LightId;
}
export function toDrawingId(s: string): DrawingId {
  return s as DrawingId;
}
export function toMapLinkId(s: string): MapLinkId {
  return s as MapLinkId;
}
export function toLibraryItemId(s: string): LibraryItemId {
  return s as LibraryItemId;
}
